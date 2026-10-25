import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { Generation, CreditLedger } from '../models';
import { S3CloudFrontStorageService } from '../services/storage/S3CloudFrontStorageService';
import { STARTER_LOOKS } from '../data/starterLooks';
import { AIProviderFactory } from '../services/ai/AIProviderFactory';
import { resolveMediaUrl } from './admin';

export const generationsRouter = Router();
const storageService = new S3CloudFrontStorageService();

// In-memory fallback stores for offline/test mode
const inMemoryGenerations = new Map<string, any>();
const inMemoryLedger: any[] = [];

// POST /api/v1/generations/upload-url
// Returns a 5-minute pre-signed S3 upload URL for direct client upload
generationsRouter.post('/generations/upload-url', async (req: Request, res: Response) => {
  try {
    const { userId, contentType = 'image/jpeg' } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const fileId = randomUUID();
    const key = `uploads/${userId}/${fileId}.jpg`;
    const { uploadUrl } = await storageService.getSignedUploadUrl(key, contentType);

    res.status(200).json({
      success: true,
      data: {
        uploadUrl,
        key,
        expiresInSeconds: 300,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to generate upload URL' });
  }
});

import { rateLimitGenerations } from '../middleware/rateLimiter';

// POST /api/v1/generations
// Queues a generation job, checks idempotency and credit balance
generationsRouter.post('/generations', rateLimitGenerations, async (req: Request, res: Response) => {
  try {
    const { userId, lookId, inputKey, strength = 80, idempotencyKey } = req.body;

    if (!userId || !lookId || !inputKey || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: 'userId, lookId, inputKey, and idempotencyKey are required',
      });
    }

    // Look up template and credit cost
    const look = STARTER_LOOKS.find((l) => l.id === lookId);
    if (!look) {
      return res.status(404).json({ success: false, error: 'Look template not found' });
    }
    const cost = look.credit_cost || 1;

    // Idempotency Check: if job with idempotencyKey exists, return it immediately
    if (mongoose.connection.readyState === 1) {
      const existingJob = await Generation.findOne({ idempotencyKey });
      if (existingJob) {
        return res.status(200).json({
          success: true,
          data: existingJob,
          isDuplicate: true,
        });
      }

      // Check user balance from append-only ledger
      const entries = await CreditLedger.find({ userId });
      const balance = entries.reduce((acc, e) => acc + e.delta, 0);

      // User rule: All AI restyle is paid. If balance < cost, reject with 402
      if (balance < cost) {
        return res.status(402).json({
          success: false,
          error: 'insufficient_credits',
          required: cost,
          currentBalance: balance,
        });
      }

      // Reserve credits
      const generationId = randomUUID();
      await CreditLedger.create({
        ledgerId: randomUUID(),
        userId,
        delta: -cost,
        reason: 'generation_reserve',
        generationId,
      });

      // Create generation record
      const job = await Generation.create({
        generationId,
        userId,
        lookId,
        strength,
        status: 'queued',
        inputKey,
        idempotencyKey,
      });

      return res.status(201).json({
        success: true,
        data: job,
      });
    } else {
      // In-memory fallback
      const existing = Array.from(inMemoryGenerations.values()).find(
        (g) => g.idempotencyKey === idempotencyKey
      );
      if (existing) {
        return res.status(200).json({ success: true, data: existing, isDuplicate: true });
      }

      const balance = inMemoryLedger
        .filter((e) => e.userId === userId)
        .reduce((acc, e) => acc + e.delta, 0);

      if (balance < cost) {
        return res.status(402).json({
          success: false,
          error: 'insufficient_credits',
          required: cost,
          currentBalance: balance,
        });
      }

      const generationId = randomUUID();
      inMemoryLedger.push({
        ledgerId: randomUUID(),
        userId,
        delta: -cost,
        reason: 'generation_reserve',
        generationId,
      });

      const job = {
        generationId,
        userId,
        lookId,
        strength,
        status: 'queued',
        inputKey,
        idempotencyKey,
        createdAt: new Date(),
      };
      inMemoryGenerations.set(generationId, job);

      return res.status(201).json({ success: true, data: job });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to queue generation' });
  }
});

// GET /api/v1/generations/:id
generationsRouter.get('/generations/:id', async (req: Request, res: Response) => {
  const generationId = req.params.id as string;

  try {
    let job: any;

    if (mongoose.connection.readyState === 1) {
      job = await Generation.findOne({ generationId });
    } else {
      job = inMemoryGenerations.get(generationId);
    }

    if (!job) {
      return res.status(404).json({ success: false, error: 'Generation job not found' });
    }

    let downloadUrl: string | undefined;
    if (job.status === 'completed' && job.outputKey) {
      downloadUrl = await storageService.getSignedDownloadUrl(job.outputKey);
    }

    res.status(200).json({
      success: true,
      data: {
        generationId: job.generationId,
        status: job.status,
        errorCode: job.errorCode,
        downloadUrl,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch generation' });
  }
});

import { CreditService } from '../services/credits/CreditService';

// GET /api/v1/credits/balance/:userId
generationsRouter.get('/credits/balance/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const balance = await CreditService.ensureDailyCredits(userId);
    res.status(200).json({ success: true, balance });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/generations/restyle
// Direct synchronous AI photo restyle with prompt, image input, and credit enforcement
generationsRouter.post('/generations/restyle', async (req: Request, res: Response) => {
  const jobId = randomUUID();
  let creditReserved = false;
  const { userId = 'anonymous', lookId, imageBase64, prompt, strength = 80, resolution } = req.body;

  try {
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'imageBase64 is required' });
    }

    // 1. Credit Enforcement (1 credit per image, blocked at 0 credits)
    if (userId && userId !== 'anonymous') {
      const creditRes = await CreditService.reserveCredit(userId, jobId, 1);
      if (!creditRes.success) {
        return res.status(402).json({
          success: false,
          error: 'insufficient_credits',
          message: 'You have 0 credits remaining. Paid users receive 5 fresh credits daily.',
          currentBalance: creditRes.balance,
        });
      }
      creditReserved = true;
    }

    // Find look template
    const look = STARTER_LOOKS.find((l) => l.id === lookId);
    const activePrompt =
      prompt ||
      look?.pipeline_b?.prompt_template ||
      `${look?.name || 'Aesthetic'} portrait, cinematic flash photography, editorial lighting`;

    const aiProvider = AIProviderFactory.getProvider();
    const result = await aiProvider.restylePhoto({
      jobId,
      imageInputUrl: imageBase64,
      prompt: activePrompt,
      negativePrompt: look?.pipeline_b?.negative_prompt || 'blurry, distorted, low quality',
      strength,
      lookId: lookId || 'custom',
      resolution: resolution || undefined,
    });

    const host = req.get('host') || 'localhost:4000';
    const baseUrl = `${req.protocol}://${host}`;
    const outputUrl = resolveMediaUrl(baseUrl, result.outputImageUrl);

    // Save record to DB if MongoDB is connected
    if (mongoose.connection.readyState === 1) {
      await Generation.create({
        generationId: jobId,
        userId,
        lookId: lookId || 'custom',
        strength,
        status: 'completed',
        inputKey: 'client_base64',
        outputKey: result.outputImageUrl,
        idempotencyKey: randomUUID(),
        completedAt: new Date(),
      }).catch(() => {});
    }

    const currentBalance = userId !== 'anonymous' ? await CreditService.getUserBalance(userId) : 0;

    res.status(200).json({
      success: true,
      data: {
        generationId: jobId,
        outputUrl,
        prompt: activePrompt,
        provider: result.provider,
        lookName: look?.name || 'Aesthetic Look',
        creditsRemaining: currentBalance,
      },
    });
  } catch (err: any) {
    console.error('[Restyle Error]:', err.message);
    // Refund reserved credit on generation failure
    if (creditReserved && userId && userId !== 'anonymous') {
      await CreditService.refundCredit(userId, jobId, 1);
    }
    res.status(500).json({ success: false, error: err.message || 'Restyle failed' });
  }
});

// POST /api/v1/image/edit & POST /api/image/edit
// Dedicated BFL FLUX 3 Image Editing endpoint with standard schema & credit enforcement
export const handleImageEdit = async (req: Request, res: Response) => {
  const jobId = randomUUID();
  let creditReserved = false;
  const {
    image,
    imageBase64,
    images,
    prompt,
    effect,
    lookId,
    resolution,
    userId = 'anonymous',
    strength = 80,
  } = req.body;

  try {
    const inputImage = image || imageBase64 || (Array.isArray(images) && images.length > 0 ? images[0] : null);

    if (!inputImage) {
      return res.status(400).json({
        success: false,
        message: 'image (URL or base64) is required',
      });
    }

    if (!prompt && !effect && !lookId) {
      return res.status(400).json({
        success: false,
        message: 'prompt or effect/lookId is required',
      });
    }

    // 1. Credit Enforcement (1 credit per image, blocked at 0 credits)
    if (userId && userId !== 'anonymous') {
      const creditRes = await CreditService.reserveCredit(userId, jobId, 1);
      if (!creditRes.success) {
        return res.status(402).json({
          success: false,
          error: 'insufficient_credits',
          message: 'You have 0 credits remaining. Paid users receive 5 fresh credits daily.',
          currentBalance: creditRes.balance,
        });
      }
      creditReserved = true;
    }

    const activeLookId = effect || lookId || 'custom';
    const look = STARTER_LOOKS.find((l) => l.id === activeLookId);
    const activePrompt = prompt || look?.pipeline_b?.prompt_template || look?.name || 'Photorealistic portrait restyle';

    const aiProvider = AIProviderFactory.getProvider();
    const result = await aiProvider.restylePhoto({
      jobId,
      imageInputUrl: inputImage,
      prompt: activePrompt,
      strength,
      lookId: activeLookId,
      resolution: resolution || undefined,
    });

    const host = req.get('host') || 'localhost:4000';
    const baseUrl = `${req.protocol}://${host}`;
    const outputUrl = resolveMediaUrl(baseUrl, result.outputImageUrl);

    // Persist in DB if connected
    if (mongoose.connection.readyState === 1) {
      await Generation.create({
        generationId: jobId,
        userId,
        lookId: activeLookId,
        strength,
        status: 'completed',
        inputKey: typeof inputImage === 'string' && inputImage.startsWith('http') ? inputImage : 'client_input',
        outputKey: result.outputImageUrl,
        idempotencyKey: randomUUID(),
        completedAt: new Date(),
      }).catch(() => {});
    }

    const currentBalance = userId !== 'anonymous' ? await CreditService.getUserBalance(userId) : 0;

    return res.status(200).json({
      success: true,
      imageUrl: outputUrl,
      provider: result.provider,
      generationId: jobId,
      creditsRemaining: currentBalance,
    });
  } catch (err: any) {
    console.error('[Image Edit Error]:', err.message);
    if (creditReserved && userId && userId !== 'anonymous') {
      await CreditService.refundCredit(userId, jobId, 1);
    }
    return res.status(500).json({
      success: false,
      message: err.message || 'Image generation failed',
    });
  }
};

generationsRouter.post('/image/edit', handleImageEdit);
