import mongoose from 'mongoose';
import { createApp } from './app';
import { env } from './config/env';
import { KeepAliveService } from './services/keepAlive/KeepAliveService';

const startServer = async () => {
  const app = createApp();

  // Start HTTP server immediately so /admin and APIs are instantly available
  const server = app.listen(env.PORT, () => {
    console.log(`[Server]: Photo Restyler API listening on port ${env.PORT} (${env.NODE_ENV})`);
    console.log(`[Admin]: Web Panel live at http://localhost:${env.PORT}/admin`);

    // Start 9-10 minute Keep-Alive ping service (keeps free hosting awake 24/7)
    KeepAliveService.start();
  });

  // Attempt database connection in background with 15s timeout
  mongoose
    .connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
    .then(() => {
      console.log('[Database]: Successfully connected to MongoDB');
    })
    .catch((err) => {
      console.warn('[Database Warning]: MongoDB connection failed:', err.message);
    });

  const shutdown = async () => {
    console.log('[Server]: Shutting down gracefully...');
    KeepAliveService.stop();
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

startServer();
