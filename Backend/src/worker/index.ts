import { startConsumer } from "./consumer.js";

startConsumer().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
