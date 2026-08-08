import { randomUUID } from "node:crypto";
import { publishLog } from "../../../src/queue/publisher.js";
import { closeRabbitConnection } from "../../../src/queue/rabbit.js";

async function testDeduplication() {
  const id = randomUUID();

  const log = {
    id,
    timestamp: new Date().toISOString(),
    level: "info",
    service: "dedup-test",
    message: "Deduplication test",
    attributes: {
      test: true,
    },
  };

  console.log("Publishing ID:", id);

  await publishLog(log);
  await publishLog(log);

  console.log("Published the same message twice.");
}

testDeduplication()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRabbitConnection();
  });
