import { Router } from "express";
import bikeRoutes from "./bike.routes.ts";
import bookingRoutes from "./booking.routes.ts";
import paymentRoutes from "./payment.routes.ts";
import reviewRoutes from "./review.routes.ts";
import adminRoutes from "./admin.routes.ts";

const apiRoutes = Router();

apiRoutes.use("/bikes", bikeRoutes);
apiRoutes.use("/bookings", bookingRoutes);
apiRoutes.use("/payments", paymentRoutes);
apiRoutes.use("/reviews", reviewRoutes);
apiRoutes.use("/admin", adminRoutes);

export default apiRoutes;
