import { publishLog } from "../../queue/publisher.js";
import { ingestLogsSchema } from "./logs.schema.js";
import { validationLog } from "./logs.validation.js";
import { FastifyRequest, FastifyReply } from "fastify";

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

  await Promise.all(acceptedLogs.map((log) => publishLog(log)));

  if (acceptedLogs.length === 0) {
    return res.status(400).send({
      accepted: 0,
      rejected: rejectedLogs,
    });
  }

  console.log({
    acceptedLogs,
    rejectedLogs,
  });

  return res.status(200).send({
    accepted: acceptedLogs.length,
    rejected: rejectedLogs,
  });
}
