import type { FastifyInstance } from "fastify";
import { ingestLogsHandler } from "./logs.controller.js";

export async function logsRoutes(app: FastifyInstance) {
  app.post(
    "/logs",
    {
      schema: {
        summary: "Ingest logs",
        description: "Accept a batch of structured logs",
        body: {
          type: "object",
          required: ["logs"],
          properties: {
            logs: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: true,
              },
            },
          },
        },

        response: {
          200: {
            type: "object",
            properties: {
              accepted: {
                type: "number",
              },

              rejected: {
                type: "array",
              },
            },
          },

          400: {
            type: "object",
          },
        },
      },
    },
    ingestLogsHandler,
  );
}
