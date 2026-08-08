import { insertLogs } from "../modules/logs/logs.service.js";
import { LOG_QUEUE } from "../queue/constant.js";
import { getRabbitCHannel } from "../queue/rabbit.js";

const BATCH_SIZE = 100;
const BATCH_TIMEOUT = 1000;

export async function startConsumer() {
  const channel = await getRabbitCHannel();

  await channel.assertQueue(LOG_QUEUE, {
    durable: true,
  });

  await channel.prefetch(BATCH_SIZE);

  console.log("Worker listening...");

  let messages: any[] = [];
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
      const logs = batch.map((message) =>
        JSON.parse(message.content.toString()),
      );

      await insertLogs(logs);

      for (const message of batch) {
        channel.ack(message);
      }

      console.log(`Batch inserted: ${batch.length}`);

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
      timer = setTimeout(processBatch, BATCH_TIMEOUT);
    }

    if (messages.length >= BATCH_SIZE) {
      await processBatch();
    }
  });
}