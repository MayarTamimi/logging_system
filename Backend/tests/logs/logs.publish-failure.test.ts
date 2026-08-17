import { beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { logsRoutes } from "../../src/modules/logs/logs.route.js";

vi.mock("../../src/queue/publisher.js", () => ({
  publishLogs: vi.fn().mockRejectedValue(new Error("queue down")),
  publishLog: vi.fn(),
}));

describe("POST /logs when the queue is unavailable", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();

    await app.register(logsRoutes);
    await app.ready();
  });

  it("returns 503 with a queue unavailable error", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/logs",
      payload: {
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: "info",
            service: "api",
            message: "test",
            attributes: {},
          },
        ],
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: "Log queue unavailable",
    });
  });
});
