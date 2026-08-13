import dotenv from "dotenv";

dotenv.config();

function parseBooleanEnv(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parsePositiveIntEnv(value: string | undefined, defaultValue: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

export const env = {
  PORT: Number(process.env.PORT ?? 8080),
  DATABASE_URL: process.env.DATABASE_URL!,
  RABBITMQ_URL: process.env.RABBITMQ_URL!,
  AUTH_ENABLED: parseBooleanEnv(process.env.AUTH_ENABLED, false),
  LOADGEN_API_KEY: process.env.LOADGEN_API_KEY,
  LOG_RETENTION_ENABLED: parseBooleanEnv(
    process.env.LOG_RETENTION_ENABLED,
    true,
  ),
  LOG_RETENTION_DAYS: parsePositiveIntEnv(
    process.env.LOG_RETENTION_DAYS,
    30,
  ),
  LOG_RETENTION_CLEANUP_INTERVAL_MS: parsePositiveIntEnv(
    process.env.LOG_RETENTION_CLEANUP_INTERVAL_MS,
    60 * 60 * 1000,
  ),
  LOG_RETENTION_BATCH_SIZE: parsePositiveIntEnv(
    process.env.LOG_RETENTION_BATCH_SIZE,
    50_000,
  ),
  FASTIFY_LOGGER: parseBooleanEnv(
    process.env.FASTIFY_LOGGER,
    process.env.NODE_ENV !== "production",
  ),
};


