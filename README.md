# Logs Service

A high-throughput log management API built with **Fastify, TypeScript, RabbitMQ, and PostgreSQL**.

The service supports asynchronous log ingestion, efficient querying, cursor-based pagination, and fast time-bucketed aggregations using pre-computed rollups.

## Features

- **Asynchronous ingestion** through RabbitMQ
- **Batch log processing** with partial validation and acceptance
- **PostgreSQL storage** for raw logs
- **Pre-computed rollups** for fast time-based aggregations
- **Cursor-based pagination** for stable, gap-free queries
- **Rich filtering** by service, level, time range, message, and JSON attributes
- **Optional API-key authentication**
- **Automatic log retention**
- **Swagger UI** for API documentation
- **Health checks** covering database migrations and RabbitMQ availability

## Architecture

```text
                         ┌─────────────┐
                         │   Client    │
                         └──────┬──────┘
                                │
                           POST /logs
                                │
                                ▼
                         ┌─────────────┐
                         │ API Server  │
                         │  Fastify    │
                         └──────┬──────┘
                                │
                             publish
                                │
                                ▼
                         ┌─────────────┐
                         │  RabbitMQ   │
                         │  log_queue  │
                         └──────┬──────┘
                                │
                             consume
                                │
                                ▼
                         ┌─────────────┐
                         │   Worker    │
                         └──────┬──────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
             ┌─────────────┐        ┌─────────────┐
             │ PostgreSQL  │        │ log_counts  │
             │ raw logs    │        │  rollups    │
             └─────────────┘        └─────────────┘
```

The API receives and validates logs, then publishes them to RabbitMQ. A separate worker consumes messages in batches and stores the logs in PostgreSQL while maintaining pre-aggregated count data for fast aggregation queries.

## API

| Method | Endpoint          | Description                     |
| ------ | ----------------- | ------------------------------- |
| `POST` | `/logs`           | Ingest a batch of logs          |
| `GET`  | `/logs`           | Query stored logs               |
| `GET`  | `/logs/aggregate` | Return time-bucketed log counts |
| `GET`  | `/health`         | Check service readiness         |

## Benchmark Results

The service was benchmarked using `@foothill/logs-benchmark` with k6.

### Final Score

**97.44 / 100**

| Category    |     Score | Maximum |
| ----------- | --------: | ------: |
| Correctness |     15.00 |      15 |
| Performance |     47.50 |      50 |
| Queries     |     14.95 |      15 |
| Reliability |     20.00 |      20 |
| **Total**   | **97.44** | **100** |

### Correctness

**15/15 correctness checks passed.**

The tested functionality included:

- Health checks
- Single and batch ingestion
- Partial invalid-log handling
- Empty and malformed requests
- Log querying and filtering
- Stable pagination
- Cursor pagination
- Aggregation
- Grouping
- Invalid parameter handling

### Load Performance

| Scenario   |    Throughput | Ingestion p95 | Aggregate p95 | Error Rate |
| ---------- | ------------: | ------------: | ------------: | ---------: |
| Load       | 14,999 logs/s |       1.36 ms |       3.00 ms |         0% |
| Stress     | 20,999 logs/s |       1.76 ms |       4.00 ms |         0% |
| Spike      | 15,375 logs/s |       1.37 ms |       2.05 ms |         0% |
| Breakpoint | 24,373 logs/s |      11.18 ms |       5.00 ms |         0% |

- Full report available in [`benchmark-report.json`](benchmark-report.json)

## Quick Start

### Docker Compose (recommended)

```bash
docker compose up --build
```

This starts the full stack:

| Service  | Port         | Notes                                            |
| -------- | ------------ | ------------------------------------------------ |
| api      | 8080         | REST API + Swagger UI                            |
| worker   | —            | Queue consumer (no exposed port)                 |
| postgres | 5433         | Mapped to host `5433` (container 5432)           |
| rabbitmq | 5672 / 15672 | AMQP + management UI at `http://localhost:15672` |

Migrations run automatically before the API starts.

### Local development

```bash
cd Backend
npm install
npm run dev       # start the API server
npm run worker    # in another terminal, start the queue consumer
npm run db:migrate # apply database migrations
```
