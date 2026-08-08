import amqp, { Channel, ChannelModel } from "amqplib";
import { env } from "../config/env.js";

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export async function getRabbitCHannel() {
  if (channel) return channel;

  connection = await amqp.connect(env.RABBITMQ_URL!);

  channel = await connection.createChannel();

  return channel;
}

export async function closeRabbitConnection() {
  await channel?.close();
  await connection?.close();

  channel = null;
  connection = null;
}
