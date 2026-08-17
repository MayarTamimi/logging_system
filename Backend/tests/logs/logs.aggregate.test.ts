import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import Fastify from "fastify";
import { logsRoutes } from "../../src/modules/logs/logs.route.js";
import { insertLogs } from "../../src/modules/logs/logs.service.js";

describe("GET /logs/aggregate", () => {
  let app: ReturnType<typeof Fastify>;
  let testRunId: string;

  beforeEach(async () => {
    app = Fastify();
    testRunId = randomUUID();

    await app.register(logsRoutes);
    await app.ready();
  });

  async function seedLogs(
    entries: Array<{
      timestamp: string;
      service?: string;
      level?: "debug" | "info" | "warn" | "error";
      message?: string;
      attributes?: Record<string, string | number | boolean>;
    }>,
  ) {
    await insertLogs(
      entries.map((entry) => ({
        timestamp: entry.timestamp,
        level: entry.level ?? "info",
        service: entry.service ?? "checkout",
        message: entry.message ?? "payment processed",
        attributes: {
          testRunId,
          ...entry.attributes,
        },
      })),
    );
  }

  function aggregate(query: string) {
    return app.inject({
      method: "GET",
      url: `/logs/aggregate?${query}&attr.testRunId=${testRunId}`,
    });
  }

  it("returns counts grouped into time buckets", async () => {
    await seedLogs([
      { timestamp: "2026-07-20T14:00:05Z" },
      { timestamp: "2026-07-20T14:00:45Z" },
      { timestamp: "2026-07-20T14:01:10Z" },
    ]);

    const response = await aggregate(
      "since=2026-07-20T14:00:00Z&until=2026-07-20T14:02:00Z&bucket=1m",
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      buckets: [
        {
          start: "2026-07-20T14:00:00Z",
          group: null,
          count: 2,
        },
        {
          start: "2026-07-20T14:01:00Z",
          group: null,
          count: 1,
        },
      ],
    });
  });

  it("groups buckets by service", async () => {
    await seedLogs([
      { timestamp: "2026-07-20T14:00:05Z", service: "checkout" },
      { timestamp: "2026-07-20T14:00:20Z", service: "checkout" },
      { timestamp: "2026-07-20T14:00:30Z", service: "auth" },
    ]);

    const response = await aggregate(
      "since=2026-07-20T14:00:00Z&until=2026-07-20T14:01:00Z&bucket=1m&group_by=service",
    );

    expect(response.statusCode).toBe(200);
    expect(response.json().buckets).toEqual([
      {
        start: "2026-07-20T14:00:00Z",
        group: "auth",
        count: 1,
      },
      {
        start: "2026-07-20T14:00:00Z",
        group: "checkout",
        count: 2,
      },
    ]);
  });

  it("applies service, level, q, and attr filters", async () => {
    await seedLogs([
      {
        timestamp: "2026-07-20T14:00:05Z",
        service: "checkout",
        level: "error",
        message: "payment declined",
        attributes: { region: "west" },
      },
      {
        timestamp: "2026-07-20T14:00:10Z",
        service: "checkout",
        level: "info",
        message: "payment declined",
        attributes: { region: "west" },
      },
      {
        timestamp: "2026-07-20T14:00:15Z",
        service: "auth",
        level: "error",
        message: "payment declined",
        attributes: { region: "west" },
      },
      {
        timestamp: "2026-07-20T14:00:20Z",
        service: "checkout",
        level: "error",
        message: "payment approved",
        attributes: { region: "west" },
      },
      {
        timestamp: "2026-07-20T14:00:25Z",
        service: "checkout",
        level: "error",
        message: "payment declined",
        attributes: { region: "east" },
      },
    ]);

    const response = await aggregate(
      "since=2026-07-20T14:00:00Z&until=2026-07-20T14:01:00Z&bucket=1m&service=checkout&level=error&q=declined&attr.region=west",
    );

    expect(response.statusCode).toBe(200);
    expect(response.json().buckets).toEqual([
      {
        start: "2026-07-20T14:00:00Z",
        group: null,
        count: 1,
      },
    ]);
  });

  it("rejects invalid parameters with the same error shape as GET /logs", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/logs/aggregate?since=2026-07-20T14:00:00Z&until=2026-07-20T15:00:00Z&bucket=10m",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: expect.any(String),
    });
  });

  it("buckets into 5 minute intervals", async () => {
    await seedLogs([
      { timestamp: "2026-07-20T14:02:45Z" },
      { timestamp: "2026-07-20T14:07:00Z" },
      { timestamp: "2026-07-20T14:12:30Z" },
      { timestamp: "2026-07-20T14:57:00Z" },
    ]);

    const response = await aggregate(
      "since=2026-07-20T14:00:00Z&until=2026-07-20T15:00:00Z&bucket=5m",
    );

    expect(response.statusCode).toBe(200);
    expect(response.json().buckets).toEqual([
      { start: "2026-07-20T14:00:00Z", group: null, count: 1 },
      { start: "2026-07-20T14:05:00Z", group: null, count: 1 },
      { start: "2026-07-20T14:10:00Z", group: null, count: 1 },
      { start: "2026-07-20T14:55:00Z", group: null, count: 1 },
    ]);
  });

  it("buckets into hourly intervals", async () => {
    await seedLogs([
      { timestamp: "2026-07-20T14:30:00Z" },
      { timestamp: "2026-07-20T15:10:00Z" },
    ]);

    const response = await aggregate(
      "since=2026-07-20T14:00:00Z&until=2026-07-20T16:00:00Z&bucket=1h",
    );

    expect(response.statusCode).toBe(200);
    expect(response.json().buckets).toEqual([
      { start: "2026-07-20T14:00:00Z", group: null, count: 1 },
      { start: "2026-07-20T15:00:00Z", group: null, count: 1 },
    ]);
  });

  it("buckets into daily intervals", async () => {
    await seedLogs([
      { timestamp: "2026-07-20T14:30:00Z" },
      { timestamp: "2026-07-21T01:00:00Z" },
    ]);

    const response = await aggregate(
      "since=2026-07-20T00:00:00Z&until=2026-07-22T00:00:00Z&bucket=1d",
    );

    expect(response.statusCode).toBe(200);
    expect(response.json().buckets).toEqual([
      { start: "2026-07-20T00:00:00Z", group: null, count: 1 },
      { start: "2026-07-21T00:00:00Z", group: null, count: 1 },
    ]);
  });

  it("returns an empty buckets array when no logs match the range", async () => {
    await seedLogs([{ timestamp: "2026-07-20T14:00:00Z" }]);

    const response = await aggregate(
      "since=2026-07-21T00:00:00Z&until=2026-07-22T00:00:00Z&bucket=1m",
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ buckets: [] });
  });
});
