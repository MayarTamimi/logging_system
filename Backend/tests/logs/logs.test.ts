import { describe, it, expect } from "vitest";
import Fastify from "fastify";

import { logsRoutes } from "../../src/modules/logs/logs.route.js";


describe("POST /logs", () => {

    const app = Fastify();

    app.register(logsRoutes);


    it("should accept valid logs", async () => {

        const response = await app.inject({
            method: "POST",
            url: "/logs",
            payload: {
                logs: [
                    {
                        timestamp: new Date().toISOString(),
                        level: "error",
                        service: "checkout",
                        message: "payment declined",
                        attributes: {
                            user_id: "42",
                            retries: 3,
                            success: false
                        }
                    }
                ]
            }
        });


        expect(response.statusCode).toBe(200);

        expect(response.json()).toEqual({
            accepted: 1,
            rejected: []
        });

    });


});