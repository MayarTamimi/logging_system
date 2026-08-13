import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { db } from "../../db/index.js";
import { LOG_QUEUE } from "../../queue/constant.js";
import { getRabbitCHannel } from "../../queue/rabbit.js";

async function isReady() {
  const [migrationCheck] = await db.execute<{
    logs_table_exists: boolean;
  }>(sql`
    select to_regclass('public.logs') is not null as logs_table_exists
  `);

  if (!migrationCheck?.logs_table_exists) {
    throw new Error("Database migrations have not been applied");
  }

  if (env.AUTH_ENABLED) {
    const [authCheck] = await db.execute<{
      api_keys_table_exists: boolean;
    }>(sql`
      select to_regclass('public.api_keys') is not null as api_keys_table_exists
    `);

    if (!authCheck?.api_keys_table_exists) {
      throw new Error("Auth migrations have not been applied");
    }
  }

  const channel = await getRabbitCHannel();

  await channel.assertQueue(LOG_QUEUE, {
    durable: true,
  });
}

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_req, reply) => {
    try {
      await isReady();

      return reply.status(200).send({
        status: "ok",
      });
    } catch (error) {
      app.log.error({ error }, "Health check failed");

      return reply.status(503).send({
        status: "unavailable",
      });
    }
  });
}
