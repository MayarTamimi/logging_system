import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: Number(process.env.PORT ?? 8080),
  DATABASE_URL: process.env.DATABASE_URL!,
};
