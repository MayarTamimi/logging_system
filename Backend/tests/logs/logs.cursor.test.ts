import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import Fastify from "fastify";
import { logsRoutes } from "../../src/modules/logs/logs.route.js";
import { insertLogs } from "../../src/modules/logs/logs.service.js";

describe("GET /logs pagination", () => {
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
      timestamp?: string;
      message: string;
    }>,
  ) {
    await insertLogs(
      entries.map((entry, index) => ({
        timestamp:
          entry.timestamp ??
          new Date(Date.UTC(2026, 7, 11, 10, index)).toISOString(),
        level: "info",
        service: serviceName,
        message: entry.message,
        attributes: { testRunId },
      })),
    );
  }

  function query(extra: string) {
    return app.inject({
      method: "GET",
      url: `/logs?service=${serviceName}&attr.testRunId=${testRunId}&${extra}`,
    });
  }

  it("paginates across multiple pages without duplicates or missing rows", async () => {
    const total = 25;

    await seedLogs(
      Array.from({ length: total }, (_, index) => ({
        message: `msg-${index}`,
      })),
    );

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;

    do {
      const extra = cursor
        ? `limit=10&cursor=${encodeURIComponent(cursor)}`
        : "limit=10";

      const response = await query(extra);

      expect(response.statusCode).toBe(200);

      const body = response.json();

      seen.push(...body.logs.map((log: { id: string }) => log.id));
      pages += 1;
      cursor = body.next_cursor;
    } while (cursor);

    expect(pages).toBe(Math.ceil(total / 10));
    expect(seen.length).toBe(total);
    expect(new Set(seen).size).toBe(total);
  });

  it("returns 400 for an invalid cursor", async () => {
    await seedLogs([{ message: "one" }]);

    const response = await app.inject({
      method: "GET",
      url: `/logs?service=${serviceName}&attr.testRunId=${testRunId}&cursor=bm90LWEtdmFsaWQtY3Vyc29y`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Invalid cursor",
    });
  });

  it("orders by timestamp DESC", async () => {
    const timestamps = [
      "2026-07-20T10:00:00.100Z",
      "2026-07-20T10:00:00.050Z",
      "2026-07-20T10:00:00.001Z",
    ];

    await seedLogs(
      timestamps.map((timestamp) => ({
        timestamp,
        message: `t-${timestamp}`,
      })),
    );

    const response = await query("limit=100");

    expect(response.statusCode).toBe(200);

    const logs = response.json().logs;

    expect(logs.map((log: { timestamp: string }) => log.timestamp)).toEqual([
      timestamps[0],
      timestamps[1],
      timestamps[2],
    ]);
  });
});
