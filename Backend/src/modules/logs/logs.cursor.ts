export type LogCursor = {
  timestamp: string;
  id: string;
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

    if (
      typeof parsed.timestamp !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new InvalidCursorError();
    }

    return parsed;
  } catch {
    throw new InvalidCursorError();
  }
}