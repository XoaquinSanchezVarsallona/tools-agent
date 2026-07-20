import express from "express";
import { usersRouter } from "./routes/users";
import { logger } from "./utils/logger";

export const app = express();

app.use(express.json());
app.use("/users", usersRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`fixture-user-api escuchando en http://localhost:${PORT}`);
  });
}
