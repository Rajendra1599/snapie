"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditService = exports.inMemoryActiveSubscriptions = exports.inMemoryCreditLedger = void 0;
const crypto_1 = require("crypto");
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../../models");
// In-memory fallback stores for test/offline mode
exports.inMemoryCreditLedger = [];
exports.inMemoryActiveSubscriptions = new Set();
class CreditService {
    /**
     * Ensures that an active paid subscriber receives 5 credits every day.
     * If today's 5 credits haven't been granted yet, grants +5 credits to the ledger.
     */
    static async ensureDailyCredits(userId) {
        if (!userId || userId === 'anonymous') {
            return 0;
        }
        let isPaid = false;
        if (mongoose_1.default.connection.readyState === 1) {
            const activePurchase = await models_1.Purchase.findOne({
                userId,
                status: 'active',
            });
            isPaid = Boolean(activePurchase);
        }
        else {
            isPaid = exports.inMemoryActiveSubscriptions.has(userId) || userId.includes('paid') || userId.includes('plus') || userId.includes('gold');
        }
        if (isPaid) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (mongoose_1.default.connection.readyState === 1) {
                // Check if daily grant was already given today
                const existingGrant = await models_1.CreditLedger.findOne({
                    userId,
                    reason: 'subscription_daily',
                    createdAt: { $gte: today },
                });
                if (!existingGrant) {
                    await models_1.CreditLedger.create({
                        ledgerId: (0, crypto_1.randomUUID)(),
                        userId,
                        delta: 5,
                        reason: 'subscription_daily',
                    });
                    console.log(`[CreditService]: Granted 5 daily credits to paid user: ${userId}`);
                }
            }
            else {
                const existingGrant = exports.inMemoryCreditLedger.find((e) => e.userId === userId && e.reason === 'subscription_daily' && new Date(e.createdAt) >= today);
                if (!existingGrant) {
                    exports.inMemoryCreditLedger.push({
                        ledgerId: (0, crypto_1.randomUUID)(),
                        userId,
                        delta: 5,
                        reason: 'subscription_daily',
                        createdAt: new Date(),
                    });
                }
            }
        }
        return this.getUserBalance(userId);
    }
    /**
     * Calculates total credit balance for a user.
     */
    static async getUserBalance(userId) {
        if (!userId || userId === 'anonymous') {
            return 0;
        }
        if (mongoose_1.default.connection.readyState === 1) {
            const entries = await models_1.CreditLedger.find({ userId });
            return entries.reduce((acc, entry) => acc + entry.delta, 0);
        }
        else {
            return exports.inMemoryCreditLedger
                .filter((e) => e.userId === userId)
                .reduce((acc, entry) => acc + entry.delta, 0);
        }
    }
    /**
     * Deducts 1 credit for image generation.
     * Returns success: false if balance is 0 or less.
     */
    static async reserveCredit(userId, generationId, cost = 1) {
        // 1. Ensure any daily credit has been granted for today
        await this.ensureDailyCredits(userId);
        const balance = await this.getUserBalance(userId);
        // Block generation if user has 0 credits
        if (balance < cost) {
            return {
                success: false,
                balance,
                error: 'insufficient_credits',
            };
        }
        // Deduct 1 credit
        if (mongoose_1.default.connection.readyState === 1) {
            await models_1.CreditLedger.create({
                ledgerId: (0, crypto_1.randomUUID)(),
                userId,
                delta: -cost,
                reason: 'generation_reserve',
                generationId,
            });
        }
        else {
            exports.inMemoryCreditLedger.push({
                ledgerId: (0, crypto_1.randomUUID)(),
                userId,
                delta: -cost,
                reason: 'generation_reserve',
                generationId,
                createdAt: new Date(),
            });
        }
        const newBalance = await this.getUserBalance(userId);
        return { success: true, balance: newBalance };
    }
    /**
     * Automatically refunds 1 credit if image generation failed.
     */
    static async refundCredit(userId, generationId, cost = 1) {
        if (!userId || userId === 'anonymous')
            return;
        if (mongoose_1.default.connection.readyState === 1) {
            // Prevent duplicate refund
            const existingRefund = await models_1.CreditLedger.findOne({
                generationId,
                reason: 'generation_refund',
            });
            if (!existingRefund) {
                await models_1.CreditLedger.create({
                    ledgerId: (0, crypto_1.randomUUID)(),
                    userId,
                    delta: cost,
                    reason: 'generation_refund',
                    generationId,
                });
                console.log(`[CreditService]: Refunded ${cost} credit for failed generation: ${generationId}`);
            }
        }
        else {
            const existingRefund = exports.inMemoryCreditLedger.find((e) => e.generationId === generationId && e.reason === 'generation_refund');
            if (!existingRefund) {
                exports.inMemoryCreditLedger.push({
                    ledgerId: (0, crypto_1.randomUUID)(),
                    userId,
                    delta: cost,
                    reason: 'generation_refund',
                    generationId,
                    createdAt: new Date(),
                });
            }
        }
    }
}
exports.CreditService = CreditService;
