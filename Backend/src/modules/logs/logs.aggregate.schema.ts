import z from "zod";

export const aggLogsQuerySchema = z.object({
    since  : z.string().datetime(),
    until : z.string().datetime(),
    bucket: z.enum(["1m", "5m", "1h", "1d"]),
    group_by: z.enum(["service", "level"]).optional(), 
    service : z.string().optional(),
    level : z.enum(["debug", "info", "warn", "error"]).optional(),
    q : z.string().optional(),

}).passthrough().refine(
    (data) => new Date(data.until) > new Date(data.since),
    {
        message: "until must not be earlier than since",
        path: ["until"],

    }
)

export type AggLogsQuery = z.infer<typeof aggLogsQuerySchema>;