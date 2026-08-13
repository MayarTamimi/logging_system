# logging_system

Fastify + RabbitMQ + Postgres log ingestion backend.

## Load testing and worker scaling

The API publishes log batches to a durable RabbitMQ queue using persistent messages. Workers consume from the queue and insert logs into Postgres in batches.

Start the stack with the worker replica count configured in
`docker-compose.yml`:

```sh
docker compose up --build
```

The default Compose file uses two worker replicas:

```yaml
worker:
  deploy:
    replicas: 2
```

Change `replicas` to `1`, `2`, or `3` before deploying if your load-test
environment runs the Compose file as-is. You can also override it manually when
running locally:

```sh
docker compose up --scale worker=2
```

The worker service intentionally does not set `container_name`, because Docker Compose cannot scale services that have a fixed container name.

## Throughput tuning

The Docker Compose defaults are tuned for higher ingestion throughput:

```env
WORKER_PREFETCH=1000
WORKER_BATCH_MESSAGES=500
WORKER_BATCH_TIMEOUT_MS=50
WORKER_LOG_BATCHES=false
FASTIFY_LOGGER=false
```

Suggested first benchmark passes:

| Workers | WORKER_PREFETCH | WORKER_BATCH_MESSAGES | WORKER_BATCH_TIMEOUT_MS |
| ------- | --------------- | --------------------- | ----------------------- |
| 1       | 1000            | 500                   | 50                      |
| 1       | 2000            | 1000                  | 50                      |
| 2       | 1000            | 500                   | 50                      |
| 2       | 1500            | 750                   | 50                      |

Keep RabbitMQ durability and persistent messages enabled for reliability. If you test a non-durable or non-persistent benchmark-only mode later, label those results separately because they do not represent the same reliability behavior.

## Metrics to watch

- RabbitMQ queue depth and message publish/ack rates.
- Postgres CPU, disk I/O, WAL activity, and connection pressure.
- API CPU, event loop saturation, request latency, and failed thresholds.
- Worker CPU, insert latency, and whether queue depth drains after each stress stage.
- Load-test rejected/failed requests and p95/p99 latency.
