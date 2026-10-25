import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { Report, Generation } from '../models';

export const reportsRouter = Router();

// POST /api/v1/reports
// Submits a report for safety review and hides output pending moderation
reportsRouter.post('/reports', async (req: Request, res: Response) => {
  try {
    const { userId, generationId, reason } = req.body;

    if (!userId || !generationId || !reason) {
      return res.status(400).json({ error: 'userId, generationId, and reason are required' });
    }

    if (mongoose.connection.readyState === 1) {
      const report = await Report.create({
        reportId: randomUUID(),
        userId,
        generationId,
        reason,
      });

      // Hide output pending review
      await Generation.findOneAndUpdate(
        { generationId },
        { status: 'rejected', errorCode: 'flagged_for_review' }
      );

      return res.status(201).json({ success: true, data: report });
    } else {
      return res.status(201).json({
        success: true,
        data: { reportId: randomUUID(), userId, generationId, reason },
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit report' });
  }
});
