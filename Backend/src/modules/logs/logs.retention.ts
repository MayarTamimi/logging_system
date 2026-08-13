import type { FastifyBaseLogger } from "fastify";
import { sql } from "drizzle-orm";
import { env } from "../../config/env.js";
import { db } from "../../db/index.js";
import { logs } from "../../db/schema.js";

let cleanupRunning = false;
let retentionTimer: NodeJS.Timeout | null = null;

function retentionCutoff() {
  return new Date(Date.now() - env.LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export async function deleteExpiredLogs() {
  if (!env.LOG_RETENTION_ENABLED) {
    return 0;
  }

  const cutoff = retentionCutoff();
  const deletedRows = await db.execute<{ id: string }>(sql`
    with expired as (
      select ${logs.id}
      from ${logs}
      where ${logs.timestamp} < ${cutoff}
      limit ${env.LOG_RETENTION_BATCH_SIZE}
    )
    delete from ${logs}
    using expired
    where ${logs.id} = expired.id
    returning ${logs.id}
  `);

  return deletedRows.length;
}

async function runRetentionCleanup(logger: FastifyBaseLogger) {
  if (cleanupRunning) {
    return;
  }

  cleanupRunning = true;

  try {
    const deleted = await deleteExpiredLogs();

    if (deleted > 0) {
      logger.info(
        {
          deleted,
          retentionDays: env.LOG_RETENTION_DAYS,
        },
        "Deleted expired logs",
      );
    }
  } catch (error) {
    logger.error({ error }, "Log retention cleanup failed");
  } finally {
    cleanupRunning = false;
  }
}

export function startLogRetentionJob(logger: FastifyBaseLogger) {
  if (!env.LOG_RETENTION_ENABLED) {
    logger.info("Log retention cleanup disabled");
    return;
  }

  void runRetentionCleanup(logger);

  retentionTimer = setInterval(() => {
    void runRetentionCleanup(logger);
  }, env.LOG_RETENTION_CLEANUP_INTERVAL_MS);

  retentionTimer.unref();
}

export function stopLogRetentionJob() {
  if (retentionTimer) {
    clearInterval(retentionTimer);
    retentionTimer = null;
  }
}
