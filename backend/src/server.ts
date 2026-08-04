// src/server.ts
import app from "./app.ts";
import { HOST, PORT } from "./config/index.ts";
import connectDB from "./config/db.ts";
import { createServerAccessGuidance } from "./utils/server-access.ts";

const startServer = async () => {
  await connectDB();

  app.listen(PORT, HOST, () => {
    for (const message of createServerAccessGuidance(HOST, PORT)) {
      console.log(message);
    }
  });
};

startServer();
