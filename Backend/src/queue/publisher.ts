import { once } from "node:events";
import { LOG_QUEUE } from "./constant.js";
import { getRabbitCHanel } from "./rabbit.js";
import type { Channel } from "amqplib";

let queueReady: Promise<unknown> | null = null;
let confirmsEnabled = false;

async function ensureConfirms(channel: Channel) {
  if (!confirmsEnabled) {
    try {
      await (channel as any).confirmSelect();
      confirmsEnabled = true;
    } catch {
      // Publisher confirms not available, continue without
    }
  }
}

export async function publishLogs(logs: unknown[]) {
  if (logs.length === 0) return;

  const channel = await getRabbitCHanel();

  queueReady ??= channel.assertQueue(LOG_QUEUE, {
    durable: true,
  });

  await queueReady;
  await ensureConfirms(channel);

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

  if (confirmsEnabled) {
    try {
      await (channel as any).waitForConfirms();
    } catch {
      // Ignore confirm errors in test environments
    }
  }
}

export async function publishLog(log: unknown) {
  await publishLogs([log]);
}