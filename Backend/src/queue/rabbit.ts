import amqp, { Channel, ChannelModel } from "amqplib";
import { env } from "../config/env.js";

let connection: ChannelModel | null = null;
let channel: Channel | null = null;
let connectionPromise: Promise<ChannelModel> | null = null;
let channelPromise: Promise<Channel> | null = null;

const CONNECTION_TIMEOUT_MS = Number(
  process.env.RABBITMQ_CONNECTION_TIMEOUT_MS ?? 3000,
);
const RECONNECT_ATTEMPTS = Number(
  process.env.RABBITMQ_RECONNECT_ATTEMPTS ?? 3,
);
const RECONNECT_DELAY_MS = Number(
  process.env.RABBITMQ_RECONNECT_DELAY_MS ?? 500,
);

function resetRabbitState() {
  connection = null;
  channel = null;
  connectionPromise = null;
  channelPromise = null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect(): Promise<ChannelModel> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= RECONNECT_ATTEMPTS; attempt += 1) {
    try {
      const conn = await amqp.connect(env.RABBITMQ_URL!, {
        timeout: CONNECTION_TIMEOUT_MS,
      });

      conn.on("error", (error) => {
        console.error("RabbitMQ connection error:", error);
        resetRabbitState();
      });

      conn.on("close", () => {
        resetRabbitState();
      });

      return conn;
    } catch (error) {
      lastError = error;
      console.error(
        `RabbitMQ connect failed (attempt ${attempt}/${RECONNECT_ATTEMPTS}):`,
        error,
      );

      if (attempt < RECONNECT_ATTEMPTS) {
        await sleep(RECONNECT_DELAY_MS * attempt);
      }
    }
  }

  throw lastError;
}

export async function getRabbitCHanel() {
  if (channel && connection) {
    return channel;
  }

  try {
    connectionPromise ??= connect();
    connection = await connectionPromise;

    channelPromise ??= connection.createChannel();
    channel = await channelPromise;

    channel.on("error", (error) => {
      console.error("RabbitMQ channel error:", error);
      channel = null;
      channelPromise = null;
    });

    channel.on("close", () => {
      channel = null;
      channelPromise = null;
    });

    return channel;
  } catch (error) {
    resetRabbitState();
    throw error;
  }
}

export async function closeRabbitConnection() {
  await channel?.close();
  await connection?.close();
  resetRabbitState();
}
