import { publishLogs } from "../../queue/publisher.js";
import { ingestLogsSchema } from "./logs.schema.js";
import { validationLog } from "./logs.validation.js";
import { FastifyRequest, FastifyReply } from "fastify";
import { getLogsQueries } from "./logs.query.schema.js";
import { aggLogs, getLogs } from "./logs.service.js";
import { encodeCursor, InvalidCursorError } from "./logs.cursor.js";
import { aggLogsQuerySchema } from "./logs.aggregate.schema.js";

export async function ingestLogsHandler(
  req: FastifyRequest,
  res: FastifyReply,
) {
  const body = ingestLogsSchema.safeParse(req.body);

  if (!body.success) {
    return res.status(400).send({
      error: body.error.issues[0].message,
    });
  }

  const { acceptedLogs, rejectedLogs } = validationLog(body.data.logs);

  try {
    await publishLogs(acceptedLogs);
  } catch (error) {
    req.log.error({ err: error }, "Failed to publish logs");

    return res.status(503).send({
      error: "Log queue unavailable",
    });
  }

  if (acceptedLogs.length === 0) {
    return res.status(400).send({
      accepted: 0,
      rejected: rejectedLogs,
    });
  }

  return res.status(200).send({
    accepted: acceptedLogs.length,
    rejected: rejectedLogs,
  });
}

export async function getLogsHandler(req: FastifyRequest, rep: FastifyReply) {
   try {
    const parsed = getLogsQueries.safeParse(req.query);

    if (!parsed.success) {
      return rep.status(400).send({
        error:
          parsed.error.issues[0]?.message ??
          "Invalid query parameters",
      });
    }

    const res = await getLogs(parsed.data);

    const hasMore = res.length > parsed.data.limit;

    const logs = hasMore
      ? res.slice(0, parsed.data.limit)
      : res;

    let nextCursor = null;

    if (hasMore) {
      const lastLog = logs[logs.length - 1];

      nextCursor = encodeCursor({
        timestamp: lastLog.timestamp.toISOString(),
        id: lastLog.id,
      });
    }

    return rep.status(200).send({
      logs,
      next_cursor: nextCursor,
    });
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      return rep.status(400).send({
        error: "Invalid cursor",
      });
    }

    console.error("GET /logs error:", error);

    return rep.status(500).send({
      error: "Internal server error",
    });
  }
}

export async function aggregateLogsHandler(
  req: FastifyRequest,
  rep: FastifyReply,
) {
  try {
    const parsed = aggLogsQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return rep.status(400).send({
        error:
          parsed.error.issues[0]?.message ??
          "Invalid query parameters",
      });
    }

    const buckets = await aggLogs(parsed.data);

    return rep.status(200).send({
      buckets,
    });
  } catch (error) {
    console.error("GET /logs/aggregate error:", error);

    return rep.status(500).send({
      error: "Internal server error",
    });
  }
}
