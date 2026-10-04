require('dotenv').config();

const amqp = require('amqplib');
const { Pool } = require('pg');
const axios = require('axios');

const { handleEmailSend } = require('./handlers/emailHandler');

const API_URL = process.env.API_URL || 'http://localhost:9090';

const DEAD_LETTER_EXCHANGE = 'job-dlx';
const DEAD_LETTER_QUEUE = 'job-dlq';
const DEAD_LETTER_ROUTING_KEY = 'job.dead';
const WORKER_TOKEN = process.env.WORKER_INTERNAL_TOKEN;

const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'nebula-queue',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'admin123',
});

async function retry(fn, retries = 10, delay = 5000) {
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      console.log(`Attempt ${i} failed. Retrying in ${delay / 1000}s...`);
      if (i === retries) throw err;
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

async function connectDB() {
  await retry(async () => {
    await db.query('SELECT 1');
    console.log('Connected to PostgreSQL');
  });
}

async function updateJobStatus(jobId, status, result = null) {
  if (!WORKER_TOKEN) {
    throw new Error('WORKER_INTERNAL_TOKEN is not set (must match API app.worker.internal-token)');
  }
  const params = { status };
  if (result != null && result !== '') {
    params.resultUrl = result;
  }
  await axios.patch(`${API_URL}/internal/worker/jobs/${jobId}/status`, null, {
    params,
    headers: { 'X-Worker-Token': WORKER_TOKEN },
  });
  console.log(`Job ${jobId} -> ${status}`);
}

async function processJob(job) {
  console.log(`Processing job: ${job.id} | type: ${job.type}`);

  let result = null;

  switch (job.type) {
    case 'EMAIL_SEND':
      result = await handleEmailSend(job);
      break;

    default:
      console.log(`Unknown job type: ${job.type}, completing with note`);
      result = `Unknown job type: ${job.type}`;
  }

  await new Promise((resolve) => setTimeout(resolve, 3000));

  return result;
}

async function connectRabbitMQ() {
  const host = process.env.RABBITMQ_HOST || 'localhost';
  const port = Number(process.env.RABBITMQ_PORT || 5672);
  const user = process.env.RABBITMQ_USER || 'admin';
  const pass = process.env.RABBITMQ_PASS || process.env.RABBITMQ_PASSWORD || 'admin123';

  return retry(async () => {
    const connection = await amqp.connect({
      hostname: host,
      port,
      username: user,
      password: pass,
    });
    console.log('Connected to RabbitMQ');
    return connection;
  });
}

async function startWorker() {
  await connectDB();

  const connection = await connectRabbitMQ();
  const channel = await connection.createChannel();

  await channel.assertQueue('job-queue', { durable: true });
  channel.prefetch(1);

  // Failed messages are parked in job-dlq (with the reason) instead of being dropped,
  // so they can be inspected or replayed. The same job-dlx exchange is used by the AI worker.
  await channel.assertExchange(DEAD_LETTER_EXCHANGE, 'direct', { durable: true });
  await channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
  await channel.bindQueue(DEAD_LETTER_QUEUE, DEAD_LETTER_EXCHANGE, DEAD_LETTER_ROUTING_KEY);

  function deadLetter(msg, reason) {
    channel.publish(DEAD_LETTER_EXCHANGE, DEAD_LETTER_ROUTING_KEY, msg.content, {
      persistent: true,
      contentType: 'application/json',
      headers: { 'x-error': String(reason).slice(0, 500), 'x-attempts': 1 },
    });
    channel.ack(msg);
  }

  console.log('Worker listening on job-queue...');

  channel.consume('job-queue', async (msg) => {
    if (!msg) return;

    // A bad message must still be acked/nacked, or it blocks this worker (prefetch 1).
    let job;
    try {
      job = JSON.parse(msg.content.toString());
    } catch {
      console.error('Dead-lettering malformed message (not JSON)');
      deadLetter(msg, 'Malformed message');
      return;
    }
    if (!job?.id) {
      console.error('Dead-lettering message without a job id');
      deadLetter(msg, 'Message has no job id');
      return;
    }

    // Claim the job. The API answers 409 if it is no longer PENDING (e.g. the user
    // cancelled it while it sat in the queue) and 404 if it no longer exists — skip those.
    try {
      await updateJobStatus(job.id, 'PROCESSING');
    } catch (err) {
      const status = err.response?.status;
      if (status === 409 || status === 404) {
        console.log(`Skipping job ${job.id}: no longer runnable (HTTP ${status}, probably cancelled)`);
        channel.ack(msg);
      } else {
        console.error(`Could not start job ${job.id}:`, err?.message || err);
        channel.nack(msg, false, false);
      }
      return;
    }

    try {
      const result = await processJob(job);
      await updateJobStatus(job.id, 'COMPLETED', result);
      console.log(`Done: ${job.id}`);
      channel.ack(msg);
    } catch (err) {
      const reason = err?.message || String(err);
      console.error(`Job failed (${job.id}):`, reason);

      try {
        await updateJobStatus(job.id, 'FAILED', `Error: ${reason}`);
      } catch (dbErr) {
        console.error('Failed to mark job FAILED:', dbErr);
      }

      deadLetter(msg, reason);
    }
  });

  connection.on('close', () => {
    console.log('RabbitMQ connection closed. Reconnecting...');
    setTimeout(startWorker, 5000);
  });

  connection.on('error', (err) => {
    console.error('RabbitMQ error:', err);
  });
}

startWorker().catch((err) => {
  console.error('Worker crashed:', err);
  process.exit(1);
});
