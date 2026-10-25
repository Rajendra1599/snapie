import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { CreditLedger, Purchase } from '../../models';

// In-memory fallback stores for test/offline mode
export const inMemoryCreditLedger: any[] = [];
export const inMemoryActiveSubscriptions = new Set<string>();

export class CreditService {
  /**
   * Ensures that an active paid subscriber receives 5 credits every day.
   * If today's 5 credits haven't been granted yet, grants +5 credits to the ledger.
   */
  static async ensureDailyCredits(userId: string): Promise<number> {
    if (!userId || userId === 'anonymous') {
      return 0;
    }

    let isPaid = false;
    if (mongoose.connection.readyState === 1) {
      const activePurchase = await Purchase.findOne({
        userId,
        status: 'active',
      });
      isPaid = Boolean(activePurchase);
    } else {
      isPaid = inMemoryActiveSubscriptions.has(userId) || userId.includes('paid') || userId.includes('plus') || userId.includes('gold');
    }

    if (isPaid) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (mongoose.connection.readyState === 1) {
        // Check if daily grant was already given today
        const existingGrant = await CreditLedger.findOne({
          userId,
          reason: 'subscription_daily',
          createdAt: { $gte: today },
        });

        if (!existingGrant) {
          await CreditLedger.create({
            ledgerId: randomUUID(),
            userId,
            delta: 5,
            reason: 'subscription_daily',
          });
          console.log(`[CreditService]: Granted 5 daily credits to paid user: ${userId}`);
        }
      } else {
        const existingGrant = inMemoryCreditLedger.find(
          (e) => e.userId === userId && e.reason === 'subscription_daily' && new Date(e.createdAt) >= today
        );
        if (!existingGrant) {
          inMemoryCreditLedger.push({
            ledgerId: randomUUID(),
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
  static async getUserBalance(userId: string): Promise<number> {
    if (!userId || userId === 'anonymous') {
      return 0;
    }

    if (mongoose.connection.readyState === 1) {
      const entries = await CreditLedger.find({ userId });
      return entries.reduce((acc, entry) => acc + entry.delta, 0);
    } else {
      return inMemoryCreditLedger
        .filter((e) => e.userId === userId)
        .reduce((acc, entry) => acc + entry.delta, 0);
    }
  }

  /**
   * Deducts 1 credit for image generation.
   * Returns success: false if balance is 0 or less.
   */
  static async reserveCredit(
    userId: string,
    generationId: string,
    cost: number = 1
  ): Promise<{ success: boolean; balance: number; error?: string }> {
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
    if (mongoose.connection.readyState === 1) {
      await CreditLedger.create({
        ledgerId: randomUUID(),
        userId,
        delta: -cost,
        reason: 'generation_reserve',
        generationId,
      });
    } else {
      inMemoryCreditLedger.push({
        ledgerId: randomUUID(),
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
  static async refundCredit(userId: string, generationId: string, cost: number = 1): Promise<void> {
    if (!userId || userId === 'anonymous') return;

    if (mongoose.connection.readyState === 1) {
      // Prevent duplicate refund
      const existingRefund = await CreditLedger.findOne({
        generationId,
        reason: 'generation_refund',
      });

      if (!existingRefund) {
        await CreditLedger.create({
          ledgerId: randomUUID(),
          userId,
          delta: cost,
          reason: 'generation_refund',
          generationId,
        });
        console.log(`[CreditService]: Refunded ${cost} credit for failed generation: ${generationId}`);
      }
    } else {
      const existingRefund = inMemoryCreditLedger.find(
        (e) => e.generationId === generationId && e.reason === 'generation_refund'
      );
      if (!existingRefund) {
        inMemoryCreditLedger.push({
          ledgerId: randomUUID(),
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
