import assert from "node:assert/strict";
import test from "node:test";
import AppError from "../src/errors/AppError.ts";
import NotificationModel from "../src/models/notification.model.ts";
import { notificationRepository } from "../src/repositories/notification.repository.ts";
import { notificationEmissionSchema } from "../src/schemas/notification.schema.ts";
import { notificationHub } from "../src/services/notification-hub.service.ts";
import notificationService, {
  toNotificationDto,
} from "../src/services/notification.service.ts";

const recipientId = "507f1f77bcf86cd799439011";
const notificationId = "507f1f77bcf86cd799439012";
const bookingId = "507f1f77bcf86cd799439013";
const createdAt = new Date("2030-01-01T00:00:00.000Z");

const storedNotification = {
  _id: notificationId,
  recipientId,
  sequence: 7,
  type: "booking.approved" as const,
  severity: "success" as const,
  title: "Booking approved",
  message: "The owner approved your booking request.",
  action: { resource: "booking" as const, id: bookingId },
  dedupeKey: `booking:${bookingId}:approved`,
  readAt: null,
  expiresAt: new Date("2030-04-01T00:00:00.000Z"),
  createdAt,
  updatedAt: createdAt,
};

test("notification schema keeps immutable content and retention indexes", () => {
  assert.equal(
    NotificationModel.schema.path("recipientId").options.immutable,
    true,
  );
  assert.equal(
    NotificationModel.schema.path("sequence").options.immutable,
    true,
  );
  assert.equal(NotificationModel.schema.path("message").options.maxlength, 240);
  assert.ok(
    NotificationModel.schema
      .indexes()
      .some(
        ([fields, options]) =>
          fields.recipientId === 1 &&
          fields.sequence === 1 &&
          options.unique === true,
      ),
  );
  assert.ok(
    NotificationModel.schema
      .indexes()
      .some(
        ([fields, options]) =>
          fields.expiresAt === 1 && options.expireAfterSeconds === 0,
      ),
  );
});

test("notification payloads reject URLs, media paths and extra fields", () => {
  const valid = {
    recipientId,
    type: "booking.approved" as const,
    severity: "success" as const,
    title: "Booking approved",
    message: "Open the booking to review pickup details.",
    action: { resource: "booking" as const, id: bookingId },
    dedupeKey: `booking:${bookingId}:approved`,
  };
  assert.equal(
    notificationEmissionSchema.parse(valid).type,
    "booking.approved",
  );
  assert.throws(() =>
    notificationEmissionSchema.parse({
      ...valid,
      message: "Open https://private.example/receipt",
    }),
  );
  assert.throws(() =>
    notificationEmissionSchema.parse({
      ...valid,
      message: "Evidence is at /uploads/private-id.jpg",
    }),
  );
  assert.throws(() =>
    notificationEmissionSchema.parse({
      ...valid,
      email: "private@example.com",
    }),
  );
});

test("public DTO omits dedupe, recipient and expiry internals", () => {
  assert.deepEqual(toNotificationDto(storedNotification), {
    _id: notificationId,
    sequence: 7,
    type: "booking.approved",
    severity: "success",
    title: "Booking approved",
    message: "The owner approved your booking request.",
    action: { resource: "booking", id: bookingId },
    readAt: null,
    createdAt,
  });
});

test("emission allocates once, publishes once and deduplicates retries", async (context) => {
  const originalFind = notificationRepository.findByDedupeKey;
  const originalNext = notificationRepository.nextSequence;
  const originalCreate = notificationRepository.create;
  const originalPublish = notificationHub.publish;
  context.after(() => {
    notificationRepository.findByDedupeKey = originalFind;
    notificationRepository.nextSequence = originalNext;
    notificationRepository.create = originalCreate;
    notificationHub.publish = originalPublish;
  });

  let existing: typeof storedNotification | null = null;
  let creates = 0;
  let publishes = 0;
  notificationRepository.findByDedupeKey = (() =>
    Promise.resolve(
      existing,
    )) as unknown as typeof notificationRepository.findByDedupeKey;
  notificationRepository.nextSequence = (() =>
    Promise.resolve({
      lastSequence: 7,
    })) as unknown as typeof notificationRepository.nextSequence;
  notificationRepository.create = ((payload: Record<string, unknown>) => {
    creates += 1;
    existing = {
      ...storedNotification,
      ...payload,
    } as typeof storedNotification;
    return Promise.resolve(existing);
  }) as unknown as typeof notificationRepository.create;
  notificationHub.publish = ((selectedRecipient: string, value: unknown) => {
    assert.equal(selectedRecipient, recipientId);
    assert.equal((value as { sequence: number }).sequence, 7);
    publishes += 1;
  }) as typeof notificationHub.publish;

  const input = {
    recipientId,
    type: "booking.approved" as const,
    severity: "success" as const,
    title: "Booking approved",
    message: "The owner approved your booking request.",
    action: { resource: "booking" as const, id: bookingId },
    dedupeKey: `booking:${bookingId}:approved`,
  };
  const first = await notificationService.emit(input);
  const second = await notificationService.emit(input);
  assert.equal(first.sequence, 7);
  assert.equal(second.sequence, 7);
  assert.equal(creates, 1);
  assert.equal(publishes, 1);
});

test("mark-read remains recipient scoped and idempotent", async (context) => {
  const originalMark = notificationRepository.markRead;
  const originalFind = notificationRepository.findScoped;
  context.after(() => {
    notificationRepository.markRead = originalMark;
    notificationRepository.findScoped = originalFind;
  });

  notificationRepository.markRead = (() =>
    Promise.resolve(null)) as unknown as typeof notificationRepository.markRead;
  notificationRepository.findScoped = ((selectedRecipient: string) => {
    assert.equal(selectedRecipient, recipientId);
    return Promise.resolve({ ...storedNotification, readAt: createdAt });
  }) as unknown as typeof notificationRepository.findScoped;
  const result = await notificationService.markRead(
    recipientId,
    notificationId,
  );
  assert.equal(result.readAt?.toISOString(), createdAt.toISOString());

  notificationRepository.findScoped = (() =>
    Promise.resolve(
      null,
    )) as unknown as typeof notificationRepository.findScoped;
  await assert.rejects(
    () => notificationService.markRead(recipientId, notificationId),
    (error: unknown) => error instanceof AppError && error.code === "NOT_FOUND",
  );
});

test("live hub enforces per-user limits and removes failed subscribers", () => {
  const testRecipient = "hub-limit-test";
  const unsubscribers = [1, 2, 3].map(() =>
    notificationHub.subscribe(testRecipient, {
      send: () => undefined,
      close: () => undefined,
    }),
  );
  assert.equal(notificationHub.getConnectionCount(testRecipient), 3);
  assert.throws(
    () =>
      notificationHub.subscribe(testRecipient, {
        send: () => undefined,
        close: () => undefined,
      }),
    (error: unknown) =>
      error instanceof AppError && error.code === "NOTIFICATION_STREAM_LIMIT",
  );
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  assert.equal(notificationHub.getConnectionCount(testRecipient), 0);

  let closed = false;
  notificationHub.subscribe(testRecipient, {
    send: () => {
      throw new Error("closed socket");
    },
    close: () => {
      closed = true;
    },
  });
  notificationHub.publish(testRecipient, toNotificationDto(storedNotification));
  assert.equal(closed, true);
  assert.equal(notificationHub.getConnectionCount(testRecipient), 0);
});
