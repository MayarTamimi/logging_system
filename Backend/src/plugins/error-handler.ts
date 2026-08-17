import { FastifyInstance, FastifyError } from "fastify";

type ClientError = FastifyError & {
  validation?: Array<{ message?: string }>;
  headers?: Record<string, string | number | string[]>;
};

export function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError, req, reply) => {
    const clientError = err as ClientError;

    if (clientError.validation && clientError.validation.length > 0) {
      req.log.warn(err);

      return reply.status(400).send({
        error: clientError.validation[0]?.message ?? "Invalid request",
      });
    }

    const statusCode = err.statusCode ?? 500;

    if (statusCode >= 400 && statusCode < 500) {
      for (const [key, value] of Object.entries(clientError.headers ?? {})) {
        reply.header(key, value);
      }

      if (statusCode === 429 && !reply.getHeader("retry-after")) {
        reply.header("Retry-After", 1);
      }

      req.log.warn(err);

      return reply.status(statusCode).send({
        error: err.message,
      });
    }

    req.log.error(err);

    return reply.status(500).send({
      error: "Internal server error",
    });
  });
}
