import Fastify from "fastify";
import { logsRoutes } from "./modules/logs/logs.route.js";
import { errorHandler } from "./plugins/error-handler.js";
import { registerSwagger, registerSwaggerUi } from "./plugins/swagger.js";

const app = Fastify({
    logger : true,
});

errorHandler(app)

await registerSwagger(app);

await app.register(logsRoutes);

await registerSwaggerUi(app);


export default app;
