"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationWorker = void 0;
const crypto_1 = require("crypto");
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../../models");
const ModerationService_1 = require("../moderation/ModerationService");
const AIProviderFactory_1 = require("../ai/AIProviderFactory");
const S3CloudFrontStorageService_1 = require("../storage/S3CloudFrontStorageService");
const starterLooks_1 = require("../../data/starterLooks");
class GenerationWorker {
    moderationService;
    aiProvider;
    storageService;
    constructor(moderationService, aiProvider, storageService) {
        this.moderationService = moderationService || new ModerationService_1.ModerationService();
        this.aiProvider = aiProvider || AIProviderFactory_1.AIProviderFactory.getProvider();
        this.storageService = storageService || new S3CloudFrontStorageService_1.S3CloudFrontStorageService();
    }
    async processJob(jobId) {
        let job;
        if (mongoose_1.default.connection.readyState === 1) {
            job = await models_1.Generation.findOne({ generationId: jobId });
        }
        if (!job) {
            return { success: false, error: 'Job not found' };
        }
        try {
            // Stage 1: Analyzing & Input Moderation
            job.status = 'running';
            if (mongoose_1.default.connection.readyState === 1)
                await job.save();
            const modResult = await this.moderationService.moderateImage(job.inputKey);
            if (!modResult.passed) {
                job.status = 'rejected';
                job.errorCode = modResult.rejectReason || 'moderation_failed';
                job.completedAt = new Date();
                if (mongoose_1.default.connection.readyState === 1)
                    await job.save();
                // Non-negotiable rule: Refund credits exactly once on moderation rejection
                await this.refundCredits(job.userId, job.generationId, 'Moderation rejection refund');
                return { success: false, error: job.errorCode };
            }
            // Stage 2: Styling (AI Provider invocation)
            const look = starterLooks_1.STARTER_LOOKS.find((l) => l.id === job.lookId);
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
            if (mongoose_1.default.connection.readyState === 1)
                await job.save();
            // Return short-lived signed download URL (15 min per spec)
            const downloadUrl = await this.storageService.getSignedDownloadUrl(outputKey);
            return { success: true, outputUrl: downloadUrl };
        }
        catch (err) {
            job.status = 'failed';
            job.errorCode = err.message || 'generation_failed';
            job.completedAt = new Date();
            if (mongoose_1.default.connection.readyState === 1)
                await job.save();
            // Automatic refund for failed jobs
            await this.refundCredits(job.userId, job.generationId, 'Generation failure refund');
            return { success: false, error: job.errorCode };
        }
    }
    async refundCredits(userId, generationId, reason) {
        if (mongoose_1.default.connection.readyState === 1) {
            // Ensure refund is written exactly once keyed by generationId
            const existingRefund = await models_1.CreditLedger.findOne({
                generationId,
                reason: 'generation_refund',
            });
            if (!existingRefund) {
                // Find cost deducted originally
                const deduction = await models_1.CreditLedger.findOne({
                    generationId,
                    reason: 'generation_reserve',
                });
                const refundAmount = deduction ? Math.abs(deduction.delta) : 1;
                await models_1.CreditLedger.create({
                    ledgerId: (0, crypto_1.randomUUID)(),
                    userId,
                    delta: refundAmount,
                    reason: 'generation_refund',
                    generationId,
                });
            }
        }
    }
}
exports.GenerationWorker = GenerationWorker;
