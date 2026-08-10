import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import { logsRoutes } from "../../src/modules/logs/logs.route.js";

describe("POST /logs", () => {
  let app: any;

  beforeEach(async () => {
    app = Fastify();

    await app.register(logsRoutes);

    await app.ready();
  });

  it("should accept valid logs", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/logs",
      payload: {
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: "error",
            service: "checkout",
            message: "payment failed",
            attributes: {
              user_id: "42",
              retries: 3,
            },
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      accepted: 1,
      rejected: [],
    });
  });

  it("should reject invalid level", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/logs",
      payload: {
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: "critical",
            service: "auth",
            message: "failed",
            attributes: {},
          },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("should accept valid logs and reject invalid logs", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/logs",
      payload: {
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: "info",
            service: "api",
            message: "started",
            attributes: {},
          },
          {
            timestamp: new Date().toISOString(),
            level: "wrong",
            service: "api",
            message: "failed",
            attributes: {},
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json().accepted).toBe(1);

    expect(response.json().rejected.length).toBe(1);
  });

  it("should reject empty batch", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/logs",
      payload: {
        logs: [],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("should reject invalid body structure", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/logs",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it("should reject future timestamps", async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const response = await app.inject({
      method: "POST",
      url: "/logs",
      payload: {
        logs: [
          {
            timestamp: future,
            level: "info",
            service: "api",
            message: "test",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
