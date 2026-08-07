import { LOG_QUEUE } from "./constant.js";
import { getRabbitCHannel } from "./rabbit.js";

export async function publishLog(log : unknown) { 
    const channel = await getRabbitCHannel();

    await channel.assertQueue(
        LOG_QUEUE,
        {
            durable : true
        }
    )

    channel.sendToQueue(
        LOG_QUEUE,
        Buffer.from(JSON.stringify(log)),
        {
            persistent : true
        }
    )
}

