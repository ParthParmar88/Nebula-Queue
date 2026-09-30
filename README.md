# Nebula Queue

Nebula Queue is a queue-based full-stack application for submitting jobs, processing them asynchronously, and streaming live status updates back to the UI.

## Tech Stack

- **API:** Java 21, Spring Boot, Spring Security (JWT), Spring Data JPA, RabbitMQ, WebSocket/STOMP
- **Client:** React (Vite), Axios, SockJS + STOMP, Tailwind
- **Worker:** Node.js, amqplib, axios, nodemailer
- **Infra:** Docker Compose, PostgreSQL, RabbitMQ, MongoDB (currently not used by core flow)

## Repository Structure

```text
.
├── api/        # Spring Boot API (auth, jobs, queue publishing, websocket updates)
├── client/     # React UI (job submit/listen for status)
├── workers/    # Queue consumers/job processors
└── docker-compose.yml
```

## Architecture (Run-time Flow)

1. User submits a job from the client.
2. API stores the job in PostgreSQL.
3. API publishes the job to RabbitMQ (`job-queue`).
4. Worker consumes the job and processes it by type.
5. Worker reports status to the API (`PATCH /internal/worker/jobs/{id}/status` with `X-Worker-Token`).
6. API publishes status over WebSocket (`/topic/jobs`) to connected clients.

## Services and Ports

- `client`: [http://localhost:5173](http://localhost:5173)
- `api`: [http://localhost:9090](http://localhost:9090)
- `postgres`: `localhost:5432`
- `rabbitmq`: `localhost:5672`
- RabbitMQ management UI: [http://localhost:15672](http://localhost:15672)
- `mongo`: `localhost:27017`

Default RabbitMQ credentials in current compose file:

- username: `admin`
- password: `admin123`

## Quick Start (Docker Recommended)

### Prerequisites

- Docker + Docker Compose

### Run the full stack

From repo root:

```bash
docker compose up --build
```

Start in detached mode:

```bash
docker compose up --build -d
```

Stop:

```bash
docker compose down
```

Stop and remove volumes:

```bash
docker compose down -v
```

## Local Development (Without Docker for App Services)

You can run `api`, `client`, and `workers` locally while using local Postgres/RabbitMQ.

### 1) Start dependencies

Run only infra services:

```bash
docker compose up -d postgres rabbitmq mongo
```

### 2) Run API

```bash
cd api
./gradlew bootRun
```

API expects defaults from `api/src/main/resources/application.properties` (localhost DB/Rabbit).

### 3) Run Client

```bash
cd client
npm install
npm run dev
```

Vite proxies `/api`, `/auth`, and `/ws` to the API (see `API_PROXY_TARGET` in `client/vite.config.js`; Docker Compose sets this to `http://api:9090` for the `client` service).

### 4) Run Worker

The worker must use the same secret as the API property `app.worker.internal-token` (env `APP_WORKER_INTERNAL_TOKEN`, default in `application.properties` is `dev-worker-token` for local use).

```bash
cd workers
npm install
WORKER_INTERNAL_TOKEN=dev-worker-token API_URL=http://localhost:9090 \
  DB_HOST=localhost RABBITMQ_HOST=localhost node index.js
```

## Build, Test, and Lint

### API

```bash
cd api
./gradlew clean build
./gradlew test
```

### Client

```bash
cd client
npm run build
npm run lint
```

### Worker

Worker currently has no implemented automated test script.

## API and Realtime Endpoints

### Auth

- `POST /auth/register`
- `POST /auth/login`

### Jobs

- `POST /api/jobs` (authenticated)
- `GET /api/jobs` (admin)
- `GET /api/jobs/my` (authenticated)
- `GET /api/jobs/{id}` (authenticated)
- `PATCH /api/jobs/{id}/status` (admin JWT; query params `status`, optional `resultUrl`)
- `PATCH /internal/worker/jobs/{id}/status` (background worker; header `X-Worker-Token` must match `app.worker.internal-token`; same query params as above)
- `POST /api/jobs/{id}/cancel` (authenticated; only while `PENDING`)

### WebSocket

- handshake endpoint: `/ws`
- topic subscription: `/topic/jobs`

## Configuration

Key files:

- `docker-compose.yml`
- `api/src/main/resources/application.properties`
- `client/vite.config.js`
- `workers/index.js`

Common runtime env vars used in compose:

- API: `SPRING_DATASOURCE_*`, `SPRING_RABBITMQ_*`, `APP_WORKER_INTERNAL_TOKEN` (shared with worker), optional `APP_BOOTSTRAP_ADMIN_EMAIL` / `APP_BOOTSTRAP_ADMIN_PASSWORD` (creates an admin user once if that email does not exist)
- Worker: `API_URL`, `WORKER_INTERNAL_TOKEN` (must match API), `DB_*`, `RABBITMQ_*`, optional `EMAIL_USER` / `EMAIL_PASS` for `EMAIL_SEND` jobs
- Client (Docker): `API_PROXY_TARGET` (Vite dev proxy target for `/api`, `/auth`, `/ws`)

### Default accounts (Docker Compose)

With the sample `docker-compose.yml`, an admin user is bootstrapped on API startup if not already present:

- Email: `admin@nebula.local`
- Password: `changeme123`

You can still register additional users from the UI; non-admin users only see **My jobs** in the dashboard.

### EMAIL_SEND (Gmail)

Only needed if you submit `EMAIL_SEND` jobs. Other job types work without this.

1. Use a Google account with [2-Step Verification](https://myaccount.google.com/signinoptions/two-step-verification) enabled.
2. Create an [App password](https://myaccount.google.com/apppasswords) (16 characters, no spaces).
3. In the repo root:

```bash
cp .env.example .env
# Edit .env: set EMAIL_USER=your@gmail.com and EMAIL_PASS=the app password
docker compose up --build
```

Docker Compose reads `.env` automatically and passes values to the `worker` service.

**Local worker (no Docker):**

```bash
cd workers
EMAIL_USER=your@gmail.com EMAIL_PASS=your-app-password \
  WORKER_INTERNAL_TOKEN=dev-worker-token API_URL=http://localhost:9090 \
  RABBITMQ_HOST=localhost node index.js
```

Example payload in the UI:

```json
{"to":"recipient@example.com","subject":"Test","body":"Hello from Nebula Queue"}
```

## MVP behavior

- Register and log in from the web UI; JWT is stored in the browser and sent on API calls.
- Submit jobs (optional JSON payload; required for `EMAIL_SEND` with `to`, `subject`, `body`).
- Cancel jobs while they are `PENDING`.
- Worker updates status via the internal PATCH route and `X-Worker-Token`; the API broadcasts over WebSocket to `/topic/jobs`.

## Troubleshooting

- **Submit job appears to do nothing:** use the UI at [http://localhost:5173](http://localhost:5173) (Vite dev server with API proxy), not a static `client/dist` folder or `npm run preview` without rebuilding after config changes. Sign in first (register does not log you in automatically). Check the browser Network tab for `POST /api/jobs` — it should return `200`. After a successful submit, `docker logs nq-api` should show `Job submitted: id=...` and `📨 Job pushed to queue`.
- **Port already in use:** stop existing processes/containers on ports `5173`, `9090`, `5432`, `5672`, `15672`.
- **API cannot connect to DB/Rabbit:** verify infra is running and hostnames match runtime mode (`localhost` for local, service names in Docker network).
- **No realtime updates in UI:** check API WebSocket endpoint `/ws`, Vite proxy config, and RabbitMQ/worker logs.
- **Worker not consuming jobs:** verify `job-queue` exists and worker can connect to RabbitMQ.
- **Worker cannot update status (401/503):** ensure `WORKER_INTERNAL_TOKEN` matches `APP_WORKER_INTERNAL_TOKEN` / `app.worker.internal-token`, and the worker calls `PATCH /internal/worker/jobs/{id}/status` with query params (not a JSON body).
- **EMAIL_SEND jobs fail:** set `EMAIL_USER` and `EMAIL_PASS` in `.env` (see [EMAIL_SEND](#email_send-gmail)); use a Gmail **app password**, not your normal login password. Check `docker logs nq-worker` for `Job failed (...):`.
- **Integration tests:** `./gradlew test` skips full Spring context unless you set `RUN_INTEGRATION_TESTS=true` (requires Postgres and RabbitMQ).

## Security Notice

Use strong, unique values for `APP_WORKER_INTERNAL_TOKEN`, JWT `jwt.secret`, database passwords, and bootstrap admin credentials outside of local development. Prefer environment variables or a secret manager instead of committing real credentials.