import { describe, expect, it } from "vitest";
import { getLogsQueries } from "../../src/modules/logs/logs.query.schema";
describe("GET /logs query schema", () => {
  it("accepts an empty query", () => {
    const result = getLogsQueries.safeParse({});

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.limit).toBe(100);
    }
  });

  it("accepts valid filters", () => {
    const result = getLogsQueries.safeParse({
      service: "checkout",
      level: "error",
      since: "2026-07-20T14:00:00Z",
      until: "2026-07-20T15:00:00Z",
      q: "declined",
      limit: "500",
      cursor: "eyJpZCI6...",
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported log level", () => {
    const result = getLogsQueries.safeParse({
      level: "banana",
    });

    expect(result.success).toBe(false);
  });

  it("rejects limit greater than 1000", () => {
    const result = getLogsQueries.safeParse({
      limit: "1001",
    });

    expect(result.success).toBe(false);
  });

  it("rejects limit less than 1", () => {
    const result = getLogsQueries.safeParse({
      limit: "0",
    });

    expect(result.success).toBe(false);
  });

  it("converts limit from string to number", () => {
    const result = getLogsQueries.safeParse({
      limit: "500",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.limit).toBe(500);
      expect(typeof result.data.limit).toBe("number");
    }
  });

  it("accepts dynamic attributes", () => {
    const result = getLogsQueries.safeParse({
      "attr.user_id": "42",
      "attr.region": "PS",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid timestamp", () => {
    const result = getLogsQueries.safeParse({
      since: "not-a-date",
    });

    expect(result.success).toBe(false);
  });

  it("rejects until earlier than since", () => {
    const result = getLogsQueries.safeParse({
      since: "2026-07-20T15:00:00Z",
      until: "2026-07-20T14:00:00Z",
    });

    expect(result.success).toBe(false);
  });
  it("accepts until equal to since", () => {
    const result = getLogsQueries.safeParse({
      since: "2026-07-20T14:00:00Z",
      until: "2026-07-20T14:00:00Z",
    });

    expect(result.success).toBe(true);
  });
  it("accepts attr.* parameters", () => {
    const result = getLogsQueries.safeParse({
      "attr.user_id": "42",
      "attr.region": "PS",
    });

    expect(result.success).toBe(true);
  });
  it("rejects unsupported query parameters", () => {
    const result = getLogsQueries.safeParse({
      foo: "bar",
    });

    expect(result.success).toBe(false);
  });
  it("accepts a q parameter", () => {
    const result = getLogsQueries.safeParse({
      q: "declined",
    });

    expect(result.success).toBe(true);
  });
  it("accepts an empty q parameter", () => {
    const result = getLogsQueries.safeParse({
      q: "",
    });

    expect(result.success).toBe(true);
  });

  // attr test
  it("accepts an attribute filter", () => {
    const result = getLogsQueries.safeParse({
      "attr.user_id": "42",
    });

    expect(result.success).toBe(true);
  });

  it("accepts multiple attribute filters", () => {
    const result = getLogsQueries.safeParse({
      "attr.user_id": "42",
      "attr.region": "PS",
    });

    expect(result.success).toBe(true);
  });

  it("accepts an attribute filter with a numeric value", () => {
    const result = getLogsQueries.safeParse({
      "attr.user_id": 42,
    });

    expect(result.success).toBe(true);
  });

  it("accepts an attribute filter with a boolean value", () => {
    const result = getLogsQueries.safeParse({
      "attr.active": true,
    });

    expect(result.success).toBe(true);
  });

  it("accepts an attribute filter combined with other filters", () => {
    const result = getLogsQueries.safeParse({
      service: "checkout",
      level: "error",
      q: "declined",
      "attr.user_id": "42",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unsupported query parameter", () => {
    const result = getLogsQueries.safeParse({
      unknown: "value",
    });

    expect(result.success).toBe(false);
  });
});
