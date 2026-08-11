import z from "zod";

export const getLogsQueries = z
  .object({
    service: z.string().optional(),
    level: z.enum(["debug", "info", "warn", "error"]).optional(),
    since: z.string().datetime({ offset: true }).optional(),
    until: z.string().datetime({ offset: true }).optional(),
    q: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(100), // convert from string to int
    cursor: z.string().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (data.since && data.until) {
      const since = new Date(data.since);
      const until = new Date(data.until);

      if (until < since) {
        ctx.addIssue({
          code: "custom",
          path: ["until"],
          message: "until must not be earlier than since",
        });
      }
    }
    const allowedKeys = new Set([
      "service",
      "level",
      "since",
      "until",
      "q",
      "limit",
      "cursor",
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

export type GetLogsQuery = z.infer<typeof getLogsQueries>;
