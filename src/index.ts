import dotenv from "dotenv";
dotenv.config();

import express from "express";
import eventsRoutes from "./routes/events.routes";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ success: true, message: "Event Scheduler API is running" });
});

app.use("/api/events", eventsRoutes);

app.listen(PORT, () => {
  console.log(`Server Running on http://localhost:${PORT}`);
});
