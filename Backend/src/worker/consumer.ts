import { insertLogs } from "../modules/logs/logs.service.js";
import { LOG_QUEUE } from "../queue/constant.js";
import { getRabbitCHannel } from "../queue/rabbit.js";

export async function startConsumer() {
  const channel = await getRabbitCHannel();

  await channel.assertQueue(LOG_QUEUE, {
    durable: true,
  });

  console.log("Worker listening...");

  channel.consume(LOG_QUEUE, async (message) => {
    if (!message) return;

    try {
      const log = JSON.parse(message.content.toString());

      await insertLogs([log]);

      channel.ack(message);

      console.log("Log inserted!");
    } catch (err) {
      console.error("Failed to process the log", err);
      channel.nack(message, false, true);
    }
  });
}
