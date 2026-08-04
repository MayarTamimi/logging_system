import Fastify from "fastify";
import { logsRoutes } from "./modules/logs/logs.route.js";
import swagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";

const app = Fastify();

app.register(swagger , {
    openapi : {
        info : {
            title: "Log Ingestion API",
            description: "High volume structured log ingestion service",
            version: "1.0.0",
        }
    }
})

await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
});

app.register(logsRoutes);


export default app;