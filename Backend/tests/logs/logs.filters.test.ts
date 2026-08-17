import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import Fastify from "fastify";
import { logsRoutes } from "../../src/modules/logs/logs.route.js";
import { insertLogs } from "../../src/modules/logs/logs.service.js";

describe("GET /logs filters", () => {
  let app: ReturnType<typeof Fastify>;
  let testRunId: string;
  let serviceName: string;

  beforeEach(async () => {
    app = Fastify();
    testRunId = randomUUID();
    serviceName = `test-${testRunId}`;

    await app.register(logsRoutes);
    await app.ready();
  });

  async function seedLogs(
    entries: Array<{
      message: string;
      attributes?: Record<string, string | number | boolean>;
    }>,
  ) {
    await insertLogs(
      entries.map((entry, index) => ({
        timestamp: new Date(Date.UTC(2026, 7, 11, 10, index)).toISOString(),
        level: "info",
        service: serviceName,
        message: entry.message,
        attributes: {
          testRunId,
          ...(entry.attributes ?? {}),
        },
      })),
    );
  }

  async function getMessages(query: string) {
    const response = await app.inject({
      method: "GET",
      url: `/logs?service=${serviceName}&attr.testRunId=${testRunId}&${query}&limit=100`,
    });

    expect(response.statusCode).toBe(200);

    return response
      .json()
      .logs.map((log: { message: string }) => log.message);
  }

  it("treats q as a literal substring and escapes wildcards", async () => {
    await seedLogs([
      { message: "disk usage 100%" },
      { message: "disk usage 100 percent" },
      { message: "disk usage_high" },
    ]);

    const percent = await getMessages(
      `q=${encodeURIComponent("100%")}`,
    );

    expect(percent).toEqual(["disk usage 100%"]);

    const underscore = await getMessages(
      `q=${encodeURIComponent("usage_h")}`,
    );

    expect(underscore).toEqual(["disk usage_high"]);
  });

  it("filters by numeric attribute values", async () => {
    await seedLogs([
      { message: "a", attributes: { retries: 3 } },
      { message: "b", attributes: { retries: 1 } },
    ]);

    const messages = await getMessages("attr.retries=3");

    expect(messages).toEqual(["a"]);
  });

  it("filters by boolean attribute values", async () => {
    await seedLogs([
      { message: "ok", attributes: { success: true } },
      { message: "fail", attributes: { success: false } },
    ]);

    const messages = await getMessages("attr.success=false");

    expect(messages).toEqual(["fail"]);
  });

  it("applies since and until as an inclusive/exclusive range", async () => {
    await seedLogs([
      { message: "inside" },
      { message: "outside" },
    ]);

    const response = await app.inject({
      method: "GET",
      url: `/logs?service=${serviceName}&attr.testRunId=${testRunId}&since=2026-08-11T10:00:00Z&until=2026-08-11T10:00:01Z&limit=100`,
    });

    expect(response.statusCode).toBe(200);

    expect(
      response
        .json()
        .logs.map((log: { message: string }) => log.message),
    ).toEqual(["inside"]);
  });
});
