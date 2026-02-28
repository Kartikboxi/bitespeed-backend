import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import identifyRoutes from "./routes/identify.routes";
import { errorHandler } from "./middlewares/error.middleware";
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/identify", identifyRoutes);
app.use(errorHandler);

export default app;