import http from "k6/http";
import { check } from "k6";

const RATE = Number(__ENV.RATE || 15000);
const DURATION = __ENV.DURATION || "10s";
const BATCH_SIZE = Number(__ENV.BATCH_SIZE || 100);
const BASE_URL = __ENV.BASE_URL || "http://host.docker.internal:8080";

export const options = {
  scenarios: {
    ingestion: {
      executor: "constant-arrival-rate",

      // Number of HTTP requests per second.
      rate: Math.ceil(RATE / BATCH_SIZE),

      timeUnit: "1s",
      duration: DURATION,

      // k6 will automatically create enough VUs to maintain the rate.
      preAllocatedVUs: 50,
      maxVUs: 300,
    },
  },

  thresholds: {
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const logs = [];

  for (let i = 0; i < BATCH_SIZE; i++) {
    logs.push({
      timestamp: new Date().toISOString(),
      level: "info",
      service: "load-test",
      message: `Load test log ${__VU}-${__ITER}-${i}`,
      attributes: {
        test: "15k-ingestion",
      },
    });
  }

  const response = http.post(
    `${BASE_URL}/logs`,
    JSON.stringify({ logs }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  check(response, {
    "status is 200": (r) => r.status === 200,
    "all logs accepted": (r) => {
      try {
        return JSON.parse(r.body).accepted === BATCH_SIZE;
      } catch {
        return false;
      }
    },
  });
}