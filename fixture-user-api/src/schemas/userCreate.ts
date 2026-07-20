import { z } from "zod";

export const userCreateSchema = z
  .object({
    name: z.string().min(1, "name is required"),
    email: z.string().email("invalid email"),
    age: z.number(),
  })
  .strict();

export type UserCreateInput = z.infer<typeof userCreateSchema>;
