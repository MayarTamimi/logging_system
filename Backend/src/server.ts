import { join } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import app from "./app.js";
import { db } from "./db/index.js";

const PORT = Number(process.env.PORT) || 8080;

async function applyMigrations() {
  try {
    await migrate(db, {
      migrationsFolder: join(process.cwd(), "src", "db", "migrations"),
    });
  } catch (error) {
    console.error("Failed to apply database migrations:", error);
  }
}

await applyMigrations();

app
  .listen({
    port: PORT,
    host: "0.0.0.0",
  })
  .then(() => {
    console.log(`Server running on port ${PORT}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
