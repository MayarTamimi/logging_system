import { z } from "zod";

const attributesSchema = z.record(
    z.string(),
    z.union([
        z.string(),
        z.number(),
        z.boolean()
    ])
);


export const logSchema = z.object({
  timestamp: z
    .string()
    .datetime()
    .refine((val) => {
      const time = new Date(val);
      const now = new Date();

      const fiveMinutes = 5 * 60 * 1000;

      return time.getTime() <= now.getTime() + fiveMinutes;
    }),
  level: z.enum(["debug", "info", "warn", "error"]),
  service: z.string().min(1, "service is required"),
  message: z.string().min(1, "message is required"),
  attributes: attributesSchema.optional(),
});

export const ingestLogsSchema = z.object({
  logs: z.array(logSchema).min(1, "At least one log is required"),
});

export type logInput = z.infer<typeof logSchema>;
export type ingestLogsInput = z.infer<typeof ingestLogsSchema>;
