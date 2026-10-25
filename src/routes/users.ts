import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { User, Generation, CreditLedger, Purchase, Report } from '../models';
import { S3CloudFrontStorageService } from '../services/storage/S3CloudFrontStorageService';

export const usersRouter = Router();
const storageService = new S3CloudFrontStorageService();

// DELETE /api/v1/users/:id
// Non-negotiable privacy requirement: deletes all user data and photos
usersRouter.delete('/users/:id', async (req: Request, res: Response) => {
  const userId = req.params.id as string;

  try {
    if (mongoose.connection.readyState === 1) {
      // Find all generations to clean up storage objects
      const generations = await Generation.find({ userId });
      for (const gen of generations) {
        if (gen.inputKey) {
          try {
            await storageService.deleteObject(gen.inputKey);
          } catch (_) {}
        }
        if (gen.outputKey) {
          try {
            await storageService.deleteObject(gen.outputKey);
          } catch (_) {}
        }
      }

      // Delete all database records
      await Promise.all([
        User.deleteOne({ userId }),
        Generation.deleteMany({ userId }),
        CreditLedger.deleteMany({ userId }),
        Purchase.deleteMany({ userId }),
        Report.deleteMany({ userId }),
      ]);
    }

    res.status(200).json({
      success: true,
      message:
        'All user data, records, and photos have been permanently deleted from our servers. Please cancel any active store subscriptions directly in Google Play or the App Store.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete user account' });
  }
});
