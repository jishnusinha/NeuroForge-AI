import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createApp } from './app.js';

dotenv.config();

const app = createApp();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/neuroforge';

// Non-blocking MongoDB connection
mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2000 })
  .then(() => console.log('Connected to MongoDB.'))
  .catch(() => console.log(process.env.NODE_ENV === 'production'
    ? 'Database unavailable; experiment API is not ready.'
    : 'Database unavailable; demo records use temporary memory.'));

const server = app.listen(PORT, () => {
  console.log(`✓ NeuroForge AI Server listening on http://localhost:${PORT}`);
});

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(async () => { await mongoose.disconnect(); });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
