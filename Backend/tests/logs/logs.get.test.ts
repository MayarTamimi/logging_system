import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import Fastify from "fastify";
import { logsRoutes } from "../../src/modules/logs/logs.route.js";
import { insertLogs } from "../../src/modules/logs/logs.service.js";

describe("GET /logs", () => {
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
      service?: string;
      level?: "debug" | "info" | "warn" | "error";
    }>,
  ) {
    await insertLogs(
      entries.map((entry, index) => ({
        id: randomUUID(),
        timestamp: new Date(Date.UTC(2026, 7, 11, 10, index)).toISOString(),
        level: entry.level ?? "error",
        service: entry.service ?? serviceName,
        message: entry.message,
        attributes: {
          testRunId,
        },
      })),
    );
  }

  async function getMessages(query: string) {
    const response = await app.inject({
      method: "GET",
      url: `/logs?service=${serviceName}&${query}&limit=100`,
    });

    expect(response.statusCode).toBe(200);

    return response.json().logs.map((log: { message: string }) => log.message);
  }

  it("finds a matching message", async () => {
    await seedLogs([{ message: "payment declined" }]);

    const messages = await getMessages(`q=declined&attr.testRunId=${testRunId}`);

    expect(messages).toContain("payment declined");
  });

  it("matches q case-insensitively", async () => {
    await seedLogs([{ message: "Payment DECLINED" }]);

    const lowerCaseMessages = await getMessages(
      `q=declined&attr.testRunId=${testRunId}`,
    );
    const upperCaseMessages = await getMessages(
      `q=DECLINED&attr.testRunId=${testRunId}`,
    );

    expect(lowerCaseMessages).toContain("Payment DECLINED");
    expect(upperCaseMessages).toContain("Payment DECLINED");
  });

  it("matches substrings", async () => {
    await seedLogs([{ message: "payment was declined by bank" }]);

    const declinedMessages = await getMessages(
      `q=declined&attr.testRunId=${testRunId}`,
    );
    const bankMessages = await getMessages(`q=bank&attr.testRunId=${testRunId}`);

    expect(declinedMessages).toContain("payment was declined by bank");
    expect(bankMessages).toContain("payment was declined by bank");
  });

  it("does not return unrelated logs", async () => {
    await seedLogs([
      { message: "payment declined" },
      { message: "payment approved" },
      { message: "server started" },
    ]);

    const messages = await getMessages(`q=declined&attr.testRunId=${testRunId}`);

    expect(messages).toEqual(["payment declined"]);
  });

  it("combines q with service using AND", async () => {
    await seedLogs([
      { service: serviceName, message: "payment declined" },
      { service: "auth", message: "payment declined" },
      { service: serviceName, message: "payment approved" },
    ]);

    const response = await app.inject({
      method: "GET",
      url: `/logs?service=${serviceName}&q=declined&attr.testRunId=${testRunId}&limit=100`,
    });

    expect(response.statusCode).toBe(200);
    expect(
      response
        .json()
        .logs.map((log: { service: string; message: string }) => ({
          service: log.service,
          message: log.message,
        })),
    ).toEqual([{ service: serviceName, message: "payment declined" }]);
  });
});
