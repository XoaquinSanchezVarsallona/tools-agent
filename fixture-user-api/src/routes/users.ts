import { Router, Request, Response } from "express";
import { createUser, listUsers } from "../models/user";
import { userCreateSchema } from "../schemas/userCreate";

export const usersRouter = Router();

usersRouter.post("/", (req: Request, res: Response) => {
  const parsed = userCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      details: parsed.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    });
  }

  const user = createUser(parsed.data);
  res.status(201).json(user);
});

usersRouter.get("/", (_req: Request, res: Response) => {
  res.status(200).json(listUsers());
});
