import amqp, { Channel, ChannelModel } from "amqplib";
import { env } from "../config/env.js";

let connection: ChannelModel | null = null;
let channel: Channel | null = null;
let connectionPromise: Promise<ChannelModel> | null = null;
let channelPromise: Promise<Channel> | null = null;
const connectionTimeoutMs = Number(process.env.RABBITMQ_CONNECTION_TIMEOUT_MS ?? 3000);

export async function getRabbitCHannel() {
  if (channel) return channel;

  try {
    connectionPromise ??= amqp.connect(env.RABBITMQ_URL!, {
      timeout: connectionTimeoutMs,
    });
    connection = await connectionPromise;

    channelPromise ??= connection.createChannel();
    channel = await channelPromise;
  } catch (error) {
    channel = null;
    connection = null;
    channelPromise = null;
    connectionPromise = null;

    throw error;
  }

  return channel;
}

export async function closeRabbitConnection() {
  await channel?.close();
  await connection?.close();

  channel = null;
  connection = null;
  channelPromise = null;
  connectionPromise = null;
}
