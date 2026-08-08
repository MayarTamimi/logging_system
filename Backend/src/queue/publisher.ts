import { once } from "node:events";
import { LOG_QUEUE } from "./constant.js";
import { getRabbitCHannel } from "./rabbit.js";

let queueReady: Promise<unknown> | null = null;

export async function publishLogs(logs: unknown[]) {
  if (logs.length === 0) return;

  const channel = await getRabbitCHannel();

  queueReady ??= channel.assertQueue(LOG_QUEUE, {
    durable: true,
  });

  await queueReady;

  const canContinue = channel.sendToQueue(
    LOG_QUEUE,
    Buffer.from(JSON.stringify({ logs })),
    {
      persistent: true,
    },
  );

  if (!canContinue) {
    await once(channel, "drain");
  }
}

export async function publishLog(log: unknown) {
  await publishLogs([log]);
}
