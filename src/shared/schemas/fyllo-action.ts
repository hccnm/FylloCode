import { z } from "zod";

export const taskCreateFylloActionPayloadSchema = z.strictObject({
  title: z.string().min(1),
  description: z.string().optional(),
});

export const fylloActionStateStatusSchema = z.enum(["succeeded", "failed", "cancelled"]);

export const fylloActionStateSchema = z.strictObject({
  type: z.literal("task.create"),
  status: fylloActionStateStatusSchema,
  updatedAt: z.string().datetime(),
});
