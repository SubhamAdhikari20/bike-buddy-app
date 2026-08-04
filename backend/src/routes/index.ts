import { Router } from "express";
import bikeRoutes from "./bike.routes.ts";
import bookingRoutes from "./booking.routes.ts";
import paymentRoutes from "./payment.routes.ts";
import reviewRoutes from "./review.routes.ts";
import adminRoutes from "./admin.routes.ts";
import uploadRoutes from "./upload.routes.ts";
import safetyRoutes from "./safety.routes.ts";
import supportRoutes from "./support.routes.ts";
import notificationRoutes from "./notification.routes.ts";

const apiRoutes = Router();

apiRoutes.use("/bikes", bikeRoutes);
apiRoutes.use("/bookings", bookingRoutes);
apiRoutes.use("/payments", paymentRoutes);
apiRoutes.use("/reviews", reviewRoutes);
apiRoutes.use("/admin", adminRoutes);
apiRoutes.use("/uploads", uploadRoutes);
apiRoutes.use("/safety", safetyRoutes);
apiRoutes.use("/support", supportRoutes);
apiRoutes.use("/notifications", notificationRoutes);

export default apiRoutes;
