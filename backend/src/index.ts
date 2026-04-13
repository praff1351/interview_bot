import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import "./db/index";
import authRoutes from "./routes/auth";
import interviewRoutes from "./routes/interview";
dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/interview", interviewRoutes);

app.get("/", (req: Request, res: Response) => {
  res.json({ message: `Interview prep AI running perfectly` });
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});

export default app;
