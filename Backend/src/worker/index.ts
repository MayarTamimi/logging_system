import { startConsumer } from "./consumer.js";

startConsumer().catch((err) => {
    console.error(err)
    process.exit(1)
})