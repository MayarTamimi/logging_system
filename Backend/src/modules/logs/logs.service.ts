import { logInput } from "./logs.schema.js";
import { db } from "../../db/index.js";
import { logs } from "../../db/schema.js";

export async function insertLogs(entryLogs: logInput[]) {
  if (entryLogs.length === 0) return;

  await db.insert(logs).values(
    entryLogs.map((log) => ({
      ...log,
      timestamp: new Date(log.timestamp),
      attributes: log.attributes ?? {},
    })),
  );
}
