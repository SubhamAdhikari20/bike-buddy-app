// src/server.ts
import app from "./app.ts";
import { PORT } from "./config/index.ts";
import connectDB from "./config/db.ts";


const startServer = async () => {
    await connectDB();

    app.listen(
        PORT,
        () => {
            console.log(`Server is running on port .................... ${PORT}`);
        }
    );
};

startServer();