import { createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { apiKeys } from "../../db/schema.js";
import { env } from "../../config/env.js";

type AuthScope = "ingest" | "query";

type CachedApiKey = {
  canIngest: boolean;
  canQuery: boolean;
};

const apiKeyCache = new Map<string, CachedApiKey>();

function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

function authEnabled() {
  return env.AUTH_ENABLED;
}

function extractCredential(req: FastifyRequest) {
  const authorization = req.headers.authorization;

  if (authorization !== undefined) {
    const value = Array.isArray(authorization)
      ? authorization[0]
      : authorization;
    const match = value.match(/^Bearer\s+(.+)$/i);

    return match?.[1]?.trim() || null;
  }

  const apiKeyHeader = req.headers["x-api-key"];

  if (apiKeyHeader !== undefined) {
    const value = Array.isArray(apiKeyHeader)
      ? apiKeyHeader[0]
      : apiKeyHeader;

    return value.trim() || null;
  }

  return null;
}

async function findApiKey(key: string) {
  const keyHash = hashApiKey(key);
  const cached = apiKeyCache.get(keyHash);

  if (cached) {
    return cached;
  }

  const [row] = await db
    .select({
      canIngest: apiKeys.canIngest,
      canQuery: apiKeys.canQuery,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (row) {
    apiKeyCache.set(keyHash, row);
  }

  return row;
}

export async function seedLoadgenApiKey() {
  if (!authEnabled() || !env.LOADGEN_API_KEY) {
    return;
  }

  const keyHash = hashApiKey(env.LOADGEN_API_KEY);

  await db
    .insert(apiKeys)
    .values({
      keyHash,
      canIngest: true,
      canQuery: true,
    })
    .onConflictDoUpdate({
      target: apiKeys.keyHash,
      set: {
        canIngest: true,
        canQuery: true,
      },
    });

  apiKeyCache.set(keyHash, {
    canIngest: true,
    canQuery: true,
  });
}

export function requireAuthScope(scope: AuthScope) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!authEnabled()) {
      return;
    }

    const credential = extractCredential(req);

    if (!credential) {
      return reply.status(401).send({
        error: "Missing or malformed credential",
      });
    }

    const apiKey = await findApiKey(credential);

    if (!apiKey) {
      return reply.status(401).send({
        error: "Invalid credential",
      });
    }

    const allowed =
      scope === "ingest" ? apiKey.canIngest : apiKey.canQuery;

    if (!allowed) {
      return reply.status(403).send({
        error: "Insufficient scope",
      });
    }
  };
}
