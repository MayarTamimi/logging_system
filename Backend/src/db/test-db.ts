import { db } from "./index.js";

async function testConnection() {
  try {
    await db.execute("SELECT 1");

    console.log("Database connected successfully ✅");
  } catch (error) {
    console.error("Database connection failed ❌");
    console.error(error);
  }

  process.exit();
}

testConnection();