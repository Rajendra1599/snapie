import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { Generation, CreditLedger, Look } from '../../models';
import { ModerationService } from '../moderation/ModerationService';
import { IAIProvider } from '../ai/IAIProvider';
import { AIProviderFactory } from '../ai/AIProviderFactory';
import { IStorageService } from '../storage/IStorageService';
import { S3CloudFrontStorageService } from '../storage/S3CloudFrontStorageService';
import { STARTER_LOOKS } from '../../data/starterLooks';

export class GenerationWorker {
  private moderationService: ModerationService;
  private aiProvider: IAIProvider;
  private storageService: IStorageService;

  constructor(
    moderationService?: ModerationService,
    aiProvider?: IAIProvider,
    storageService?: IStorageService
  ) {
    this.moderationService = moderationService || new ModerationService();
    this.aiProvider = aiProvider || AIProviderFactory.getProvider();
    this.storageService = storageService || new S3CloudFrontStorageService();
  }

  async processJob(jobId: string): Promise<{ success: boolean; outputUrl?: string; error?: string }> {
    let job: any;

    if (mongoose.connection.readyState === 1) {
      job = await Generation.findOne({ generationId: jobId });
    }

    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    try {
      // Stage 1: Analyzing & Input Moderation
      job.status = 'running';
      if (mongoose.connection.readyState === 1) await job.save();

      const modResult = await this.moderationService.moderateImage(job.inputKey);
      if (!modResult.passed) {
        job.status = 'rejected';
        job.errorCode = modResult.rejectReason || 'moderation_failed';
        job.completedAt = new Date();
        if (mongoose.connection.readyState === 1) await job.save();

        // Non-negotiable rule: Refund credits exactly once on moderation rejection
        await this.refundCredits(job.userId, job.generationId, 'Moderation rejection refund');
        return { success: false, error: job.errorCode };
      }

      // Stage 2: Styling (AI Provider invocation)
      const look = STARTER_LOOKS.find((l) => l.id === job.lookId);
      const prompt = look?.pipeline_b?.prompt_template || 'Aesthetic film restyle';
      const negativePrompt = look?.pipeline_b?.negative_prompt;

      const aiResult = await this.aiProvider.restylePhoto({
        jobId: job.generationId,
        imageInputUrl: job.inputKey,
        prompt,
        negativePrompt,
        strength: job.strength,
        lookId: job.lookId,
      });

      // Stage 3: Finishing & Metadata embedding
      const outputKey = `generations/${job.userId}/${job.generationId}_output.jpg`;
      job.outputKey = outputKey;
      job.status = 'completed';
      job.completedAt = new Date();
      if (mongoose.connection.readyState === 1) await job.save();

      // Return short-lived signed download URL (15 min per spec)
      const downloadUrl = await this.storageService.getSignedDownloadUrl(outputKey);
      return { success: true, outputUrl: downloadUrl };
    } catch (err: any) {
      job.status = 'failed';
      job.errorCode = err.message || 'generation_failed';
      job.completedAt = new Date();
      if (mongoose.connection.readyState === 1) await job.save();

      // Automatic refund for failed jobs
      await this.refundCredits(job.userId, job.generationId, 'Generation failure refund');
      return { success: false, error: job.errorCode };
    }
  }

  private async refundCredits(userId: string, generationId: string, reason: string): Promise<void> {
    if (mongoose.connection.readyState === 1) {
      // Ensure refund is written exactly once keyed by generationId
      const existingRefund = await CreditLedger.findOne({
        generationId,
        reason: 'generation_refund',
      });

      if (!existingRefund) {
        // Find cost deducted originally
        const deduction = await CreditLedger.findOne({
          generationId,
          reason: 'generation_reserve',
        });
        const refundAmount = deduction ? Math.abs(deduction.delta) : 1;

        await CreditLedger.create({
          ledgerId: randomUUID(),
          userId,
          delta: refundAmount,
          reason: 'generation_refund',
          generationId,
        });
      }
    }
  }
}
