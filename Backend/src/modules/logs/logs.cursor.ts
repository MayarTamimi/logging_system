export type LogCursor = {
  timestamp: string;
  id: number;
};

export class InvalidCursorError extends Error {
  constructor() {
    super("Invalid cursor");
    this.name = "InvalidCursorError";
  }
}

export function encodeCursor(cursor: LogCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(cursor: string): LogCursor {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");

    const parsed = JSON.parse(decoded);

    if (typeof parsed.timestamp !== "string") {
      throw new InvalidCursorError();
    }

    const id =
      typeof parsed.id === "number" ? parsed.id : Number(parsed.id);

    if (!Number.isInteger(id) || id < 0) {
      throw new InvalidCursorError();
    }

    return { timestamp: parsed.timestamp, id };
  } catch {
    throw new InvalidCursorError();
  }
}