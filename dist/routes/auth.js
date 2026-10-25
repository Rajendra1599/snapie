"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const crypto_1 = require("crypto");
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
const CreditService_1 = require("../services/credits/CreditService");
exports.authRouter = (0, express_1.Router)();
// In-memory fallback if MongoDB connection is in offline/test mode
const inMemoryUsers = new Map();
const inMemoryLedger = [];
// POST /api/v1/auth/anonymous
// Initializes or resumes an anonymous user session without requiring an account
exports.authRouter.post('/auth/anonymous', async (req, res) => {
    try {
        const { userId: providedId, locale = 'en_IN', timezone = 'Asia/Kolkata' } = req.body;
        const userId = providedId || (0, crypto_1.randomUUID)();
        let user;
        let balance = 0;
        if (mongoose_1.default.connection.readyState === 1) {
            user = await models_1.User.findOne({ userId });
            if (!user) {
                user = await models_1.User.create({
                    userId,
                    locale,
                    timezone,
                });
                // Initial free credits for review testing and trial (can be set to 0 after review)
                const INITIAL_FREE_CREDITS = 3;
                await models_1.CreditLedger.create({
                    ledgerId: (0, crypto_1.randomUUID)(),
                    userId,
                    delta: INITIAL_FREE_CREDITS,
                    reason: 'initial_grant',
                });
            }
            // Check and grant daily 5 credits if user is an active paid subscriber
            balance = await CreditService_1.CreditService.ensureDailyCredits(userId);
        }
        else {
            // In-memory fallback
            if (!inMemoryUsers.has(userId)) {
                inMemoryUsers.set(userId, {
                    userId,
                    locale,
                    timezone,
                    createdAt: new Date(),
                });
                inMemoryLedger.push({
                    ledgerId: (0, crypto_1.randomUUID)(),
                    userId,
                    delta: 3,
                    reason: 'initial_grant',
                });
            }
            user = inMemoryUsers.get(userId);
            balance = await CreditService_1.CreditService.ensureDailyCredits(userId);
        }
        res.status(200).json({
            success: true,
            data: {
                userId: user.userId,
                locale: user.locale,
                timezone: user.timezone,
                ageConfirmedAt: user.ageConfirmedAt,
                consentVersion: user.consentVersion,
                creditsBalance: balance,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to authenticate user',
        });
    }
});
// GET /api/v1/auth/me/:userId
exports.authRouter.get('/auth/me/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
        let user;
        let balance = 0;
        if (mongoose_1.default.connection.readyState === 1) {
            user = await models_1.User.findOne({ userId });
            if (user) {
                balance = await CreditService_1.CreditService.ensureDailyCredits(userId);
            }
        }
        else {
            user = inMemoryUsers.get(userId);
            if (user) {
                balance = await CreditService_1.CreditService.ensureDailyCredits(userId);
            }
        }
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        res.status(200).json({
            success: true,
            data: {
                userId: user.userId,
                ageConfirmedAt: user.ageConfirmedAt,
                consentVersion: user.consentVersion,
                creditsBalance: balance,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch user profile',
        });
    }
});
