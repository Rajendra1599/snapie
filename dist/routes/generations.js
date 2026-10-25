"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleImageEdit = exports.generationsRouter = void 0;
const express_1 = require("express");
const crypto_1 = require("crypto");
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
const S3CloudFrontStorageService_1 = require("../services/storage/S3CloudFrontStorageService");
const starterLooks_1 = require("../data/starterLooks");
const AIProviderFactory_1 = require("../services/ai/AIProviderFactory");
const admin_1 = require("./admin");
exports.generationsRouter = (0, express_1.Router)();
const storageService = new S3CloudFrontStorageService_1.S3CloudFrontStorageService();
// In-memory fallback stores for offline/test mode
const inMemoryGenerations = new Map();
const inMemoryLedger = [];
// POST /api/v1/generations/upload-url
// Returns a 5-minute pre-signed S3 upload URL for direct client upload
exports.generationsRouter.post('/generations/upload-url', async (req, res) => {
    try {
        const { userId, contentType = 'image/jpeg' } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }
        const fileId = (0, crypto_1.randomUUID)();
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
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Failed to generate upload URL' });
    }
});
const rateLimiter_1 = require("../middleware/rateLimiter");
// POST /api/v1/generations
// Queues a generation job, checks idempotency and credit balance
exports.generationsRouter.post('/generations', rateLimiter_1.rateLimitGenerations, async (req, res) => {
    try {
        const { userId, lookId, inputKey, strength = 80, idempotencyKey } = req.body;
        if (!userId || !lookId || !inputKey || !idempotencyKey) {
            return res.status(400).json({
                success: false,
                error: 'userId, lookId, inputKey, and idempotencyKey are required',
            });
        }
        // Look up template and credit cost
        const look = starterLooks_1.STARTER_LOOKS.find((l) => l.id === lookId);
        if (!look) {
            return res.status(404).json({ success: false, error: 'Look template not found' });
        }
        const cost = look.credit_cost || 1;
        // Idempotency Check: if job with idempotencyKey exists, return it immediately
        if (mongoose_1.default.connection.readyState === 1) {
            const existingJob = await models_1.Generation.findOne({ idempotencyKey });
            if (existingJob) {
                return res.status(200).json({
                    success: true,
                    data: existingJob,
                    isDuplicate: true,
                });
            }
            // Check user balance from append-only ledger
            const entries = await models_1.CreditLedger.find({ userId });
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
            const generationId = (0, crypto_1.randomUUID)();
            await models_1.CreditLedger.create({
                ledgerId: (0, crypto_1.randomUUID)(),
                userId,
                delta: -cost,
                reason: 'generation_reserve',
                generationId,
            });
            // Create generation record
            const job = await models_1.Generation.create({
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
        }
        else {
            // In-memory fallback
            const existing = Array.from(inMemoryGenerations.values()).find((g) => g.idempotencyKey === idempotencyKey);
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
            const generationId = (0, crypto_1.randomUUID)();
            inMemoryLedger.push({
                ledgerId: (0, crypto_1.randomUUID)(),
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
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Failed to queue generation' });
    }
});
// GET /api/v1/generations/:id
exports.generationsRouter.get('/generations/:id', async (req, res) => {
    const generationId = req.params.id;
    try {
        let job;
        if (mongoose_1.default.connection.readyState === 1) {
            job = await models_1.Generation.findOne({ generationId });
        }
        else {
            job = inMemoryGenerations.get(generationId);
        }
        if (!job) {
            return res.status(404).json({ success: false, error: 'Generation job not found' });
        }
        let downloadUrl;
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
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Failed to fetch generation' });
    }
});
const CreditService_1 = require("../services/credits/CreditService");
// GET /api/v1/credits/balance/:userId
exports.generationsRouter.get('/credits/balance/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const balance = await CreditService_1.CreditService.ensureDailyCredits(userId);
        res.status(200).json({ success: true, balance });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/v1/generations/restyle
// Direct synchronous AI photo restyle with prompt, image input, and credit enforcement
exports.generationsRouter.post('/generations/restyle', async (req, res) => {
    const jobId = (0, crypto_1.randomUUID)();
    let creditReserved = false;
    const { userId = 'anonymous', lookId, imageBase64, prompt, strength = 80, resolution } = req.body;
    try {
        if (!imageBase64) {
            return res.status(400).json({ success: false, error: 'imageBase64 is required' });
        }
        // 1. Credit Enforcement (1 credit per image, blocked at 0 credits)
        if (userId && userId !== 'anonymous') {
            const creditRes = await CreditService_1.CreditService.reserveCredit(userId, jobId, 1);
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
        const look = starterLooks_1.STARTER_LOOKS.find((l) => l.id === lookId);
        const activePrompt = prompt ||
            look?.pipeline_b?.prompt_template ||
            `${look?.name || 'Aesthetic'} portrait, cinematic flash photography, editorial lighting`;
        const aiProvider = AIProviderFactory_1.AIProviderFactory.getProvider();
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
        const outputUrl = (0, admin_1.resolveMediaUrl)(baseUrl, result.outputImageUrl);
        // Save record to DB if MongoDB is connected
        if (mongoose_1.default.connection.readyState === 1) {
            await models_1.Generation.create({
                generationId: jobId,
                userId,
                lookId: lookId || 'custom',
                strength,
                status: 'completed',
                inputKey: 'client_base64',
                outputKey: result.outputImageUrl,
                idempotencyKey: (0, crypto_1.randomUUID)(),
                completedAt: new Date(),
            }).catch(() => { });
        }
        const currentBalance = userId !== 'anonymous' ? await CreditService_1.CreditService.getUserBalance(userId) : 0;
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
    }
    catch (err) {
        console.error('[Restyle Error]:', err.message);
        // Refund reserved credit on generation failure
        if (creditReserved && userId && userId !== 'anonymous') {
            await CreditService_1.CreditService.refundCredit(userId, jobId, 1);
        }
        res.status(500).json({ success: false, error: err.message || 'Restyle failed' });
    }
});
// POST /api/v1/image/edit & POST /api/image/edit
// Dedicated BFL FLUX 3 Image Editing endpoint with standard schema & credit enforcement
const handleImageEdit = async (req, res) => {
    const jobId = (0, crypto_1.randomUUID)();
    let creditReserved = false;
    const { image, imageBase64, images, prompt, effect, lookId, resolution, userId = 'anonymous', strength = 80, } = req.body;
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
            const creditRes = await CreditService_1.CreditService.reserveCredit(userId, jobId, 1);
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
        const look = starterLooks_1.STARTER_LOOKS.find((l) => l.id === activeLookId);
        const activePrompt = prompt || look?.pipeline_b?.prompt_template || look?.name || 'Photorealistic portrait restyle';
        const aiProvider = AIProviderFactory_1.AIProviderFactory.getProvider();
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
        const outputUrl = (0, admin_1.resolveMediaUrl)(baseUrl, result.outputImageUrl);
        // Persist in DB if connected
        if (mongoose_1.default.connection.readyState === 1) {
            await models_1.Generation.create({
                generationId: jobId,
                userId,
                lookId: activeLookId,
                strength,
                status: 'completed',
                inputKey: typeof inputImage === 'string' && inputImage.startsWith('http') ? inputImage : 'client_input',
                outputKey: result.outputImageUrl,
                idempotencyKey: (0, crypto_1.randomUUID)(),
                completedAt: new Date(),
            }).catch(() => { });
        }
        const currentBalance = userId !== 'anonymous' ? await CreditService_1.CreditService.getUserBalance(userId) : 0;
        return res.status(200).json({
            success: true,
            imageUrl: outputUrl,
            provider: result.provider,
            generationId: jobId,
            creditsRemaining: currentBalance,
        });
    }
    catch (err) {
        console.error('[Image Edit Error]:', err.message);
        if (creditReserved && userId && userId !== 'anonymous') {
            await CreditService_1.CreditService.refundCredit(userId, jobId, 1);
        }
        return res.status(500).json({
            success: false,
            message: err.message || 'Image generation failed',
        });
    }
};
exports.handleImageEdit = handleImageEdit;
exports.generationsRouter.post('/image/edit', exports.handleImageEdit);
