import { publishLog } from "../../src/queue/publisher.js";
async function test() {
    await publishLog({
        id: "123",
        service: "auth",
        level: "error",
        message: "test message",
    });
    console.log("message sent");
}
test();
