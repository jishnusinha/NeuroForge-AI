import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createApp } from './app.js';

dotenv.config();

const production = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5000;
const URI = process.env.MONGODB_URI || (production ? null : 'mongodb://127.0.0.1:27017/neuroforge');

async function start() {
  if (!URI) throw new Error('PRODUCTION_MONGODB_URI_REQUIRED');
  if (production) {
    // Never advertise a production API before durable storage is connected.
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 10000 });
    console.log('Connected to MongoDB.');
  } else {
    mongoose.connect(URI, { serverSelectionTimeoutMS: 2000 })
      .then(() => console.log('Connected to MongoDB.'))
      .catch(() => console.log('Database unavailable; development records use temporary memory.'));
  }
  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`NeuroForge AI server listening on port ${PORT}`);
  });
  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    server.close(async () => { await mongoose.disconnect(); });
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch(async error => {
  // Do not log connection strings, passwords or connection-error objects.
  console.error(`NeuroForge startup rejected: ${error.message.startsWith('PRODUCTION_') ? error.message : 'Database unavailable'}`);
  process.exitCode = 1;
  await mongoose.disconnect().catch(() => {});
});
