import { FastifyInstance, FastifyError } from "fastify";

export function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError, req, reply) => {
    req.log.error(err);

    return reply.status(500).send({
      error: "Internal server error",
    });
  });
}