import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { eq } from "drizzle-orm";

function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

async function buildApp(authEnabled: boolean, loadgenApiKey?: string) {
  vi.resetModules();

  vi.stubEnv("AUTH_ENABLED", String(authEnabled));

  if (loadgenApiKey) {
    vi.stubEnv("LOADGEN_API_KEY", loadgenApiKey);
  } else {
    vi.stubEnv("LOADGEN_API_KEY", "");
  }

  const { logsRoutes } = await import("../../src/modules/logs/logs.route.js");
  const { seedLoadgenApiKey } = await import(
    "../../src/modules/auth/auth.service.js"
  );

  await seedLoadgenApiKey();

  const app = Fastify();

  await app.register(logsRoutes);
  await app.ready();

  return app;
}

describe("auth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps log endpoints open when AUTH_ENABLED is false", async () => {
    const app = await buildApp(false);

    const response = await app.inject({
      method: "GET",
      url: "/logs?limit=1",
    });

    expect(response.statusCode).toBe(200);

    await app.close();
  });

  it("rejects missing credentials when AUTH_ENABLED is true", async () => {
    const app = await buildApp(true);

    const response = await app.inject({
      method: "GET",
      url: "/logs?limit=1",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: expect.any(String),
    });

    await app.close();
  });

  it("rejects malformed credentials", async () => {
    const app = await buildApp(true);

    const response = await app.inject({
      method: "GET",
      url: "/logs?limit=1",
      headers: {
        authorization: "Basic abc",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: expect.any(String),
    });

    await app.close();
  });

  it("accepts the seeded loadgen key with Authorization Bearer", async () => {
    const app = await buildApp(true, "loadgen-test-key");

    const response = await app.inject({
      method: "GET",
      url: "/logs?limit=1",
      headers: {
        authorization: "Bearer loadgen-test-key",
      },
    });

    expect(response.statusCode).toBe(200);

    await app.close();
  });

  it("accepts the seeded loadgen key with X-API-Key", async () => {
    const app = await buildApp(true, "loadgen-test-key");

    const response = await app.inject({
      method: "GET",
      url: "/logs?limit=1",
      headers: {
        "x-api-key": "loadgen-test-key",
      },
    });

    expect(response.statusCode).toBe(200);

    await app.close();
  });

  it("ignores credentials in the query string", async () => {
    const app = await buildApp(true, "loadgen-test-key");

    const response = await app.inject({
      method: "GET",
      url: "/logs?limit=1&api_key=loadgen-test-key",
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it("rejects a valid key with insufficient scope", async () => {
    const app = await buildApp(true);
    const { db } = await import("../../src/db/index.js");
    const { apiKeys } = await import("../../src/db/schema.js");
    const queryOnlyKeyHash = hashApiKey("query-only-key");

    await db
      .insert(apiKeys)
      .values({
        keyHash: queryOnlyKeyHash,
        canIngest: false,
        canQuery: true,
      })
      .onConflictDoUpdate({
        target: apiKeys.keyHash,
        set: {
          canIngest: false,
          canQuery: true,
        },
      });

    const response = await app.inject({
      method: "POST",
      url: "/logs",
      headers: {
        authorization: "Bearer query-only-key",
      },
      payload: {
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: "info",
            service: "api",
            message: "test",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: expect.any(String),
    });

    await db.delete(apiKeys).where(eq(apiKeys.keyHash, queryOnlyKeyHash));
    await app.close();
  });
});
