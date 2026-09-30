require('dotenv').config();

const amqp = require('amqplib');
const { Pool } = require('pg');
const axios = require('axios');

const { handleEmailSend } = require('./handlers/emailHandler');

const API_URL = process.env.API_URL || 'http://localhost:9090';
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

  await updateJobStatus(job.id, 'PROCESSING');

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

  await updateJobStatus(job.id, 'COMPLETED', result);
  console.log(`Done: ${job.id}`);
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

  console.log('Worker listening on job-queue...');

  channel.consume('job-queue', async (msg) => {
    if (!msg) return;

    const job = JSON.parse(msg.content.toString());

    try {
      await processJob(job);
      channel.ack(msg);
    } catch (err) {
      const reason = err?.message || String(err);
      console.error(`Job failed (${job.id}):`, reason);

      try {
        await updateJobStatus(job.id, 'FAILED', `Error: ${reason}`);
      } catch (dbErr) {
        console.error('Failed to mark job FAILED:', dbErr);
      }

      channel.nack(msg, false, false);
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
