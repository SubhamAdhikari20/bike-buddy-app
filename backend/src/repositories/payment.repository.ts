import PaymentModel from "../models/payment.model.ts";

export const paymentRepository = {
  create: (payload: Record<string, unknown>) => PaymentModel.create(payload),
  findById: (paymentId: string) =>
    PaymentModel.findById(paymentId)
      .populate("bookingId")
      .populate("payerId", "_id email role"),
  findByTransactionRef: (transactionRef: string) =>
    PaymentModel.findOne({ transactionRef }),
  findByBookingId: (bookingId: string) =>
    PaymentModel.findOne({ bookingId }).sort({ createdAt: -1 }),
  findPendingByBookingAndProvider: (
    bookingId: string,
    provider: "khalti" | "esewa" | "manual",
  ) =>
    PaymentModel.findOne({ bookingId, provider, status: "pending" }).sort({
      createdAt: -1,
    }),
  updateById: (paymentId: string, payload: Record<string, unknown>) =>
    PaymentModel.findByIdAndUpdate(paymentId, payload, {
      new: true,
      runValidators: true,
    }),
  transitionPendingById: (
    paymentId: string,
    payload: Record<string, unknown>,
  ) =>
    PaymentModel.findOneAndUpdate(
      { _id: paymentId, status: "pending" },
      payload,
      { new: true, runValidators: true },
    ),
  list: (
    filter: Record<string, unknown>,
    sort: Record<string, 1 | -1>,
    skip: number,
    limit: number,
  ) =>
    PaymentModel.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("bookingId")
      .populate("payerId"),
  count: (filter: Record<string, unknown>) =>
    PaymentModel.countDocuments(filter),
};
