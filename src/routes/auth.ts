import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { User, CreditLedger } from '../models';
import { CreditService } from '../services/credits/CreditService';

export const authRouter = Router();

// In-memory fallback if MongoDB connection is in offline/test mode
const inMemoryUsers = new Map<string, any>();
const inMemoryLedger: any[] = [];

// POST /api/v1/auth/anonymous
// Initializes or resumes an anonymous user session without requiring an account
authRouter.post('/auth/anonymous', async (req: Request, res: Response) => {
  try {
    const { userId: providedId, locale = 'en_IN', timezone = 'Asia/Kolkata' } = req.body;
    const userId = providedId || randomUUID();

    let user;
    let balance = 0;

    if (mongoose.connection.readyState === 1) {
      user = await User.findOne({ userId });
      if (!user) {
        user = await User.create({
          userId,
          locale,
          timezone,
        });

        // Initial free credits for review testing and trial (can be set to 0 after review)
        const INITIAL_FREE_CREDITS = 3;
        await CreditLedger.create({
          ledgerId: randomUUID(),
          userId,
          delta: INITIAL_FREE_CREDITS,
          reason: 'initial_grant',
        });
      }

      // Check and grant daily 5 credits if user is an active paid subscriber
      balance = await CreditService.ensureDailyCredits(userId);
    } else {
      // In-memory fallback
      if (!inMemoryUsers.has(userId)) {
        inMemoryUsers.set(userId, {
          userId,
          locale,
          timezone,
          createdAt: new Date(),
        });
        inMemoryLedger.push({
          ledgerId: randomUUID(),
          userId,
          delta: 3,
          reason: 'initial_grant',
        });
      }
      user = inMemoryUsers.get(userId);
      balance = await CreditService.ensureDailyCredits(userId);
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to authenticate user',
    });
  }
});

// GET /api/v1/auth/me/:userId
authRouter.get('/auth/me/:userId', async (req: Request, res: Response) => {
  const userId = req.params.userId as string;

  try {
    let user;
    let balance = 0;

    if (mongoose.connection.readyState === 1) {
      user = await User.findOne({ userId });
      if (user) {
        balance = await CreditService.ensureDailyCredits(userId);
      }
    } else {
      user = inMemoryUsers.get(userId);
      if (user) {
        balance = await CreditService.ensureDailyCredits(userId);
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user profile',
    });
  }
});
