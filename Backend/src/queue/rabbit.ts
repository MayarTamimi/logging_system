import amqp, { Channel, Connection } from "amqplib";
import { env } from "../config/env.js";

let connection= null;
let channel : any = null;

export async function getRabbitCHannel() {
  if (channel) return channel;

  connection = await amqp.connect(env.RABBITMQ_URL!);

  channel = await connection.createChannel();

  return channel;
}
