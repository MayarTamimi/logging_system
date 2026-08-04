import { z } from "zod";

export const logSchema = z.object({
    timestamp : z.string().datetime(),
    level  : z.enum(["debug","info", "warn", "error"]),
    service : z.string().min(1 , "service is required"),
    message : z.string().min(1 , "message is required"),
    attributes : z.record(z.string() , z.unknown())
})

export const ingestLogsSchema = z.object({
    logs : z.array(logSchema).min(1, "At least one log is required"),
})


export type logInput = z.infer<typeof logSchema>
export type ingestLogsInput = z.infer<typeof ingestLogsSchema>