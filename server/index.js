import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import experimentRoutes from './routes/experimentRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/neuroforge';

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/experiments', experimentRoutes);

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    service: 'NeuroForge AI Backend API',
    mongoConnected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString(),
  });
});

// Non-blocking MongoDB connection
mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2000 })
  .then(() => console.log('✓ Connected to MongoDB instance'))
  .catch((err) => console.log('ℹ MongoDB notice: Running in-memory resilient mode for local demo.'));

app.listen(PORT, () => {
  console.log(`✓ NeuroForge AI Server listening on http://localhost:${PORT}`);
});
