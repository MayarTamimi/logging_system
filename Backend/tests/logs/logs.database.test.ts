import { describe, it, expect } from "vitest";

import { db } from "../../src/db/index.js";
import { logs } from "../../src/db/schema.js";
import { insertLogs } from "../../src/modules/logs/logs.service.js";


describe("logs database insertion", () => {


    it("should insert logs into database", async () => {


        await insertLogs([
            {
                timestamp: new Date().toISOString(),
                level: "error",
                service: "checkout",
                message: "payment failed",
                attributes: {
                    user_id: "42"
                }
            }
        ]);


        const result = await db.select()
            .from(logs);


        expect(result.length)
            .toBeGreaterThan(0);


    });


});