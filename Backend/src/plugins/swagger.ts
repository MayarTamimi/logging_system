import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { FastifyInstance } from "fastify";

export async function registerSwagger(app: FastifyInstance) {
    await app.register(swagger, {
        openapi: {
            info: {
                title: "Log Ingestion API",
                description: "High volume log ingestion service",
                version: "1.0.0"
            }
        }
    });
}

export async function registerSwaggerUi(app: FastifyInstance) {
    await app.register(swaggerUI, {
        routePrefix: "/docs"
    });
}
