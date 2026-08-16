import { insertLogs } from "../modules/logs/logs.service.js";
import { LOG_QUEUE } from "../queue/constant.js";
import { getRabbitCHanel } from "../queue/rabbit.js";
import type { ConsumeMessage } from "amqplib";

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

function parseLogBatch(message: ConsumeMessage) {
  const payload = JSON.parse(message.content.toString());

  if (Array.isArray(payload.logs)) {
    return payload.logs;
  }

  return [payload];
}

export async function startConsumer() {
  const channel = await getRabbitCHanel();

  await channel.assertQueue(LOG_QUEUE, {
    durable: true,
  });

  await channel.prefetch(PREFETCH);

  console.log(
    `Worker listening with prefetch=${PREFETCH}, batchMessages=${BATCH_MESSAGE_COUNT}, batchTimeoutMs=${BATCH_TIMEOUT_MS}`,
  );

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
        processBatches(true).catch((error) => {
          console.error("Batch processing failed:", error);
        });
      }, BATCH_TIMEOUT_MS);
    }
  }

  async function processBatch(batch: ConsumeMessage[]) {
    const logs = batch.flatMap(parseLogBatch);

    await insertLogs(logs);

    for (const message of batch) {
      channel.ack(message);
    }

    if (LOG_BATCHES) {
      console.log(
        `Batch inserted: ${logs.length} logs from ${batch.length} messages`,
      );
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
            channel.nack(message, false, true);
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

  channel.consume(LOG_QUEUE, async (message: ConsumeMessage | null) => {
    if (!message) return;

    messages.push(message);

    if (messages.length >= BATCH_MESSAGE_COUNT) {
      void processBatches();
    } else {
      armBatchTimer();
    }
  });
}