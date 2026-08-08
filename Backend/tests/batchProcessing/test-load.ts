async function testLoad() {
  const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:8080";

  const logs = Array.from({ length: 200 }, (_, i) => ({
    timestamp: new Date().toISOString(),
    level: "info",
    service: "load-test",
    message: `Test log ${i}`,
    attributes: {
      testId: i,
    },
  }));

  const response = await fetch(`${baseUrl}/logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ logs }),
  });

  console.log("Status:", response.status);
  console.log("Response:", await response.json());
}

testLoad();
