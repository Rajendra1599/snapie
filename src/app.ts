import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { healthRouter } from './routes/health';
import { looksRouter } from './routes/looks';
import { authRouter } from './routes/auth';
import { generationsRouter, handleImageEdit } from './routes/generations';
import { purchasesRouter } from './routes/purchases';
import { reportsRouter } from './routes/reports';
import { usersRouter } from './routes/users';
import { adminRouter } from './routes/admin';
import { privacyRouter } from './routes/privacy';

export const createApp = (): Application => {
  const app = express();

  // Trust reverse proxy (Render, Cloudflare, AWS) so req.protocol is correctly 'https'
  app.set('trust proxy', true);

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Static uploads directory for media fallbacks
  app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

  // Root redirect to Admin Panel
  app.get('/', (_req: Request, res: Response) => {
    res.redirect('/admin');
  });

  // Root Health check for Cloud Platforms (Render, AWS, Railway) & Keep-Alive
  app.use(healthRouter);

  // Public Privacy Policy Web Page (Available at /privacy and /privacy-policy)
  app.use(privacyRouter);

  // Admin Web Panel (Available directly at http://localhost:4000/admin)
  app.use(adminRouter);

  // In-app billing & webhook router (both root and /api/v1 paths supported)
  app.use(purchasesRouter);

  // Standard Image Edit endpoints for BFL FLUX 3 Image
  app.post('/api/image/edit', handleImageEdit);
  app.post('/image/edit', handleImageEdit);

  // API Routes
  app.use('/api/v1', healthRouter);
  app.use('/api/v1', looksRouter);
  app.use('/api/v1', authRouter);
  app.use('/api/v1', generationsRouter);
  app.use('/api/v1', purchasesRouter);
  app.use('/api/v1', reportsRouter);
  app.use('/api/v1', usersRouter);
  app.use('/api/v1', adminRouter);
  app.use('/api/v1', privacyRouter);

  // Fallback 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Global Error Handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    // Spec rule: Never log image bytes or raw signed URLs
    console.error('[Internal Error]:', err.message);
    res.status(500).json({
      error: 'An unexpected internal server error occurred',
    });
  });

  return app;
};
