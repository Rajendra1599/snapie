import mongoose from 'mongoose';
import { Generation } from '../../models';
import { IStorageService } from '../storage/IStorageService';
import { S3CloudFrontStorageService } from '../storage/S3CloudFrontStorageService';

export class CleanupJob {
  private storageService: IStorageService;

  constructor(storageService?: IStorageService) {
    this.storageService = storageService || new S3CloudFrontStorageService();
  }

  /**
   * Deletes original input uploads older than 24 hours after completion.
   * Keeps final output results until user explicitly deletes them.
   */
  async run24HourOriginalDeletion(): Promise<{ deletedCount: number }> {
    if (mongoose.connection.readyState !== 1) {
      return { deletedCount: 0 };
    }

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find completed or failed generations older than 24h that still have an inputKey
    const expiredGenerations = await Generation.find({
      completedAt: { $lt: cutoff },
      inputKey: { $ne: '' },
    });

    let count = 0;
    for (const gen of expiredGenerations) {
      if (gen.inputKey) {
        try {
          await this.storageService.deleteObject(gen.inputKey);
          gen.inputKey = ''; // Mark input as purged
          await gen.save();
          count++;
        } catch (_) {}
      }
    }

    return { deletedCount: count };
  }
}
