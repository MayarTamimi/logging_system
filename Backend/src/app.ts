import Fastify from "fastify";
import { env } from "./config/env.js";
import { seedLoadgenApiKey } from "./modules/auth/auth.service.js";
import { healthRoutes } from "./modules/health/health.route.js";
import { logsRoutes } from "./modules/logs/logs.route.js";
import { errorHandler } from "./plugins/error-handler.js";
import { registerSwagger, registerSwaggerUi } from "./plugins/swagger.js";

const app = Fastify({
  logger: env.FASTIFY_LOGGER,
});

errorHandler(app);

await seedLoadgenApiKey();

await registerSwagger(app);

await app.register(healthRoutes);

await app.register(logsRoutes);

await registerSwaggerUi(app);

export default app;
