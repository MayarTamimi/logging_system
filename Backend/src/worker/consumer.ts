import {
  insertLogs,
  insertLogCounts,
} from "../modules/logs/logs.service.js";
import type { LogCountRow } from "../modules/logs/logs.service.js";
import { LOG_QUEUE } from "../queue/constant.js";
import { getRabbitCHanel } from "../queue/rabbit.js";
import type { Channel, ConsumeMessage } from "amqplib";

function readPositiveIntEnv(name: string, defaultValue: number) {
  const value = Number(process.env[name]);

  return Number.isInteger(value) && value > 0 ? value : defaultValue;
}

function readBooleanEnv(name: string, defaultValue: boolean) {
  const value = process.env[name];

  if (value === undefined) return defaultValue;

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

const PREFETCH = readPositiveIntEnv("WORKER_PREFETCH", 1000);
const BATCH_MESSAGE_COUNT = readPositiveIntEnv("WORKER_BATCH_MESSAGES", 500);
const BATCH_TIMEOUT_MS = readPositiveIntEnv("WORKER_BATCH_TIMEOUT_MS", 50);
const LOG_BATCHES = readBooleanEnv("WORKER_LOG_BATCHES", false);
const RESTART_DELAY_MS = readPositiveIntEnv("WORKER_RESTART_DELAY_MS", 1000);
const RESTART_MAX_DELAY_MS = readPositiveIntEnv(
  "WORKER_RESTART_MAX_DELAY_MS",
  10000,
);
const COUNT_FLUSH_INTERVAL_MS = readPositiveIntEnv(
  "WORKER_COUNT_FLUSH_INTERVAL_MS",
  3000,
);
const COUNT_BUFFER_MAX_ENTRIES = readPositiveIntEnv(
  "WORKER_COUNT_BUFFER_MAX",
  20000,
);

let stopped = false;

let countBuffer = new Map<string, number>();
let countFlushTimer: NodeJS.Timeout | null = null;
let flushingCounts = false;

function pushCountRows(
  rows: Array<{ timestamp: Date; service: string; level: string }>,
) {
  for (const row of rows) {
    const bucket = new Date(
      Math.floor(row.timestamp.getTime() / 60_000) * 60_000,
    );

    const key = `${bucket.toISOString()}\u0000${row.service}\u0000${row.level}`;

    countBuffer.set(key, (countBuffer.get(key) ?? 0) + 1);
  }
}

async function flushCounts() {
  if (flushingCounts || countBuffer.size === 0) return;

  flushingCounts = true;

  const rows: LogCountRow[] = [...countBuffer.entries()].map(([key, count]) => {
    const [bucket, service, level] = key.split("\u0000");

    return { bucket: new Date(bucket), service, level, count };
  });

  countBuffer = new Map();

  try {
    await insertLogCounts(rows);
  } finally {
    flushingCounts = false;
  }
}

function armCountFlushTimer() {
  if (countFlushTimer) return;

  countFlushTimer = setTimeout(() => {
    countFlushTimer = null;
    armCountFlushTimer();
    void flushCounts().catch((error) => {
      console.error("Count flush failed:", error);
    });
  }, COUNT_FLUSH_INTERVAL_MS);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseLogBatch(message: ConsumeMessage) {
  const payload = JSON.parse(message.content.toString());

  if (Array.isArray(payload.logs)) {
    return payload.logs;
  }

  return [payload];
}

function buildBatchProcessor(channel: Channel) {
  let messages: ConsumeMessage[] = [];
  let timer: NodeJS.Timeout | null = null;
  let processing = false;

  function clearBatchTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function armBatchTimer() {
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        processBatches(true).catch((error) => {
          console.error("Batch processing failed:", error);
        });
      }, BATCH_TIMEOUT_MS);
    }
  }

  async function processBatch(batch: ConsumeMessage[]) {
    const logs = batch.flatMap(parseLogBatch);

    const rows = await insertLogs(logs);

    pushCountRows(rows);

    for (const message of batch) {
      channel.ack(message);
    }

    if (LOG_BATCHES) {
      console.log(
        `Batch inserted: ${rows.length} logs from ${batch.length} messages`,
      );
    }

    if (countBuffer.size >= COUNT_BUFFER_MAX_ENTRIES) {
      await flushCounts();
    }
  }

  async function processBatches(force = false) {
    if (processing || messages.length === 0) {
      return;
    }

    if (!force && messages.length < BATCH_MESSAGE_COUNT) {
      armBatchTimer();
      return;
    }

    processing = true;
    clearBatchTimer();

    try {
      while (
        messages.length > 0 &&
        (force || messages.length >= BATCH_MESSAGE_COUNT)
      ) {
        const batch = messages.splice(0, BATCH_MESSAGE_COUNT);

        try {
          await processBatch(batch);
        } catch (error) {
          console.error("Batch processing failed:", error);

          for (const message of batch) {
            try {
              channel.nack(message, false, true);
            } catch (nackError) {
              // Channel may already be closed; unacked messages are
              // requeued automatically by the broker in that case.
              console.error("Failed to nack message:", nackError);
            }
          }
        }
      }
    } finally {
      processing = false;

      if (messages.length >= BATCH_MESSAGE_COUNT) {
        void processBatches();
      } else if (messages.length > 0) {
        armBatchTimer();
      }
    }
  }

  return (message: ConsumeMessage | null) => {
    if (!message) return;

    messages.push(message);

    if (messages.length >= BATCH_MESSAGE_COUNT) {
      void processBatches();
    } else {
      armBatchTimer();
    }
  };
}

export async function startConsumer() {
  let restartDelayMs = RESTART_DELAY_MS;

  while (!stopped) {
    try {
      const channel = await getRabbitCHanel();

      await channel.assertQueue(LOG_QUEUE, {
        durable: true,
      });

      await channel.prefetch(PREFETCH);

      console.log(
        `Worker listening with prefetch=${PREFETCH}, batchMessages=${BATCH_MESSAGE_COUNT}, batchTimeoutMs=${BATCH_TIMEOUT_MS}`,
      );

      armCountFlushTimer();

      const onMessage = buildBatchProcessor(channel);

      await new Promise<void>((resolve) => {
        const onChannelClose = () => {
          channel.off("close", onChannelClose);
          resolve();
        };

        channel.on("close", onChannelClose);

        void channel.consume(LOG_QUEUE, onMessage).catch((error) => {
          console.error("Failed to register consumer:", error);
          onChannelClose();
        });
      });

      restartDelayMs = RESTART_DELAY_MS;

      if (!stopped) {
        console.error(
          "RabbitMQ channel closed; reconnecting consumer...",
        );
      }
    } catch (error) {
      console.error("Worker connection error:", error);
    }

    if (stopped) {
      break;
    }

    await sleep(restartDelayMs);
    restartDelayMs = Math.min(restartDelayMs * 2, RESTART_MAX_DELAY_MS);
  }
}

export function stopConsumer() {
  stopped = true;

  void flushCounts().catch((error) => {
    console.error("Count flush failed during shutdown:", error);
  });
}
