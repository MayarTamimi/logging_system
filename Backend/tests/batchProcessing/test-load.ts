import { randomUUID } from "node:crypto";
import "dotenv/config";
import postgres from "postgres";

const batchSize = Number(process.env.BATCH_SIZE ?? 200);
const waitTimeoutMs = Number(process.env.WAIT_TIMEOUT_MS ?? 30_000);
const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? 100);

function elapsedMs(start: bigint) {
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testLoad() {
  const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:8080";
  const batchId = randomUUID();
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  const logs = Array.from({ length: batchSize }, (_, i) => ({
    timestamp: new Date().toISOString(),
    level: "info",
    service: "load-test",
    message: `Test log ${i}`,
    attributes: {
      batchId,
      testId: i,
    },
  }));

  console.log("Batch ID:", batchId);
  console.log("Batch size:", batchSize);

  const totalStart = process.hrtime.bigint();
  const apiStart = process.hrtime.bigint();

  const response = await fetch(`${baseUrl}/logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ logs }),
  });

  const apiDurationMs = elapsedMs(apiStart);
  const responseBody = await response.json();

  console.log("Status:", response.status);
  console.log("Response:", responseBody);
  console.log("API time:", `${apiDurationMs.toFixed(2)}ms`);

  const waitStart = process.hrtime.bigint();
  let insertedCount = 0;

  while (elapsedMs(waitStart) < waitTimeoutMs) {
    const result = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM logs
      WHERE attributes->>'batchId' = ${batchId}
    `;

    insertedCount = result[0]?.count ?? 0;

    if (insertedCount >= batchSize) {
      break;
    }

    await sleep(pollIntervalMs);
  }

  const totalDurationMs = elapsedMs(totalStart);

  console.log("Inserted:", `${insertedCount}/${batchSize}`);
  console.log("End-to-end insert time:", `${totalDurationMs.toFixed(2)}ms`);

  await sql.end();
}

testLoad().catch((error) => {
  console.error(error);
  process.exit(1);
});
