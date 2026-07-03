import { z } from "zod";
import { bookingListQuerySchema, cancelBookingSchema, createBookingSchema } from "./../schemas/booking.schema.ts";

export type CreateBookingDTO = z.infer<typeof createBookingSchema>;
export type CancelBookingDTO = z.infer<typeof cancelBookingSchema>;
export type BookingListQueryDTO = z.infer<typeof bookingListQuerySchema>;
