import { once } from "node:events";
import { LOG_QUEUE } from "./constant.js";
import { getRabbitCHanel } from "./rabbit.js";
import type { Channel } from "amqplib";

let queueReady: Promise<unknown> | null = null;
let queueReadyChannel: Channel | null = null;
let confirmsChannel: Channel | null = null;
let confirmsEnabled = false;
let pendingConfirms = 0;

const CONFIRM_BATCH = 50;

async function ensureConfirms(channel: Channel) {
  if (confirmsChannel !== channel) {
    confirmsEnabled = false;
    confirmsChannel = channel;
  }

  if (!confirmsEnabled) {
    try {
      await (channel as any).confirmSelect();
      confirmsEnabled = true;
    } catch(err) {
      console.log(err)
    }
  }
}

export async function publishLogs(logs: unknown[]) {
  if (logs.length === 0) return;

  const channel = await getRabbitCHanel();

  if (queueReadyChannel !== channel) {
    queueReady = null;
    queueReadyChannel = channel;
  }

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
    await Promise.race([
      once(channel, "drain"),
      once(channel, "close").then(() => {
        throw new Error("RabbitMQ channel closed while draining");
      }),
    ]);
  }

  if (confirmsEnabled) {
    pendingConfirms += 1;

    if (pendingConfirms >= CONFIRM_BATCH) {
      try {
        await (channel as any).waitForConfirms();
      } catch {
        //
      } finally {
        pendingConfirms = 0;
      }
    }
  }
}

export async function publishLog(log: unknown) {
  await publishLogs([log]);
}
