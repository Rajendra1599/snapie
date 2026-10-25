import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
    version: '1.0.0',
  });
});
