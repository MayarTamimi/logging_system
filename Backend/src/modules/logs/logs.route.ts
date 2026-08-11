import type { FastifyInstance } from "fastify";
import { getLogsHandler, ingestLogsHandler } from "./logs.controller.js";

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

  app.get(
    "/logs",
    {
      schema: {
        summary: "Query logs",
        description: "Query stored logs using optional filters",

        querystring: {
          type: "object",

          properties: {
            service: {
              type: "string",
              description: "Exact service-name match",
            },

            level: {
              type: "string",
              enum: ["debug", "info", "warn", "error"],
              description: "Exact log level match",
            },

            since: {
              type: "string",
              format: "date-time",
              description: "Inclusive start of the time range",
            },

            until: {
              type: "string",
              format: "date-time",
              description: "Exclusive end of the time range",
            },

            q: {
              type: "string",
              description: "Case-insensitive substring match on message",
            },

            limit: {
              type: "integer",
              minimum: 1,
              maximum: 1000,
              default: 100,
              description: "Maximum number of results",
            },

            cursor: {
              type: "string",
              description: "Opaque cursor from a previous response",
            },
          },

          additionalProperties: true,
        },

        response: {
          200: {
            type: "object",
            properties: {
              logs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    timestamp: {
                      type: "string",
                      format: "date-time",
                    },
                    level: {
                      type: "string",
                      enum: ["debug", "info", "warn", "error"],
                    },
                    service: { type: "string" },
                    message: { type: "string" },
                    attributes: {
                      type: "object",
                      additionalProperties: true,
                    },
                  },
                },
              },

              next_cursor: {
                type: ["string", "null"],
              },
            },

            required: ["logs", "next_cursor"],
          },

          400: {
            type: "object",
            properties: {
              error: {
                type: "string",
              },
            },
            required: ["error"],
          },
        },
      },
    },
    getLogsHandler,
  );
}
