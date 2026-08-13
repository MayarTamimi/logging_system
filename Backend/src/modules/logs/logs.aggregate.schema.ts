import z from "zod";

export const aggLogsQuerySchema = z
  .object({
    since: z.string().datetime({ offset: true }),
    until: z.string().datetime({ offset: true }),
    bucket: z.enum(["1m", "5m", "1h", "1d"]),
    group_by: z.enum(["service", "level"]).optional(),
    service: z.string().optional(),
    level: z.enum(["debug", "info", "warn", "error"]).optional(),
    q: z.string().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (new Date(data.until) <= new Date(data.since)) {
      ctx.addIssue({
        code: "custom",
        path: ["until"],
        message: "until must be after since",
      });
    }

    const allowedKeys = new Set([
      "since",
      "until",
      "bucket",
      "group_by",
      "service",
      "level",
      "q",
    ]);

    for (const key of Object.keys(data)) {
      if (!allowedKeys.has(key) && !key.startsWith("attr.")) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `Unsupported query parameter: ${key}`,
        });
      }
    }
  });

export type AggLogsQuery = z.infer<typeof aggLogsQuerySchema>;
