import { insertLogs } from "../modules/logs/logs.service.js";
import { LOG_QUEUE } from "../queue/constant.js";
import { getRabbitCHannel } from "../queue/rabbit.js";
import type { ConsumeMessage } from "amqplib";

const PREFETCH = Number(process.env.WORKER_PREFETCH ?? 20);
const BATCH_MESSAGE_COUNT = Number(process.env.WORKER_BATCH_MESSAGES ?? 20);
const BATCH_TIMEOUT_MS = Number(process.env.WORKER_BATCH_TIMEOUT_MS ?? 100);

function parseLogBatch(message: ConsumeMessage) {
  const payload = JSON.parse(message.content.toString());

  if (Array.isArray(payload.logs)) {
    return payload.logs;
  }

  return [payload];
}

export async function startConsumer() {
  const channel = await getRabbitCHannel();

  await channel.assertQueue(LOG_QUEUE, {
    durable: true,
  });

  await channel.prefetch(PREFETCH);

  console.log("Worker listening...");

  let messages: ConsumeMessage[] = [];
  let timer: NodeJS.Timeout | null = null;

  async function processBatch() {
    if (messages.length === 0) {
      return;
    }

    const batch = messages;
    messages = [];

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    try {
      const logs = batch.flatMap(parseLogBatch);

      await insertLogs(logs);

      for (const message of batch) {
        channel.ack(message);
      }

      console.log(
        `Batch inserted: ${logs.length} logs from ${batch.length} messages`,
      );
    } catch (error) {
      console.error("Batch processing failed:", error);

      for (const message of batch) {
        channel.nack(message, false, true);
      }
    }
  }

  channel.consume(LOG_QUEUE, async (message) => {
    if (!message) return;

    messages.push(message);

    if (messages.length === 1) {
      timer = setTimeout(processBatch, BATCH_TIMEOUT_MS);
    }

    if (messages.length >= BATCH_MESSAGE_COUNT) {
      await processBatch();
    }
  });
}
