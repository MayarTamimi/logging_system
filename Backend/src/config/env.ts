import dotenv from "dotenv";

dotenv.config();

function parseBooleanEnv(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const env = {
  PORT: Number(process.env.PORT ?? 8080),
  DATABASE_URL: process.env.DATABASE_URL!,
  RABBITMQ_URL: process.env.RABBITMQ_URL!,
  FASTIFY_LOGGER: parseBooleanEnv(
    process.env.FASTIFY_LOGGER,
    process.env.NODE_ENV !== "production",
  ),
};


