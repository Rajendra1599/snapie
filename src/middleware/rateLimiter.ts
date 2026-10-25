import { Request, Response, NextFunction } from 'express';

// In-memory token bucket keyed by userId
const userTimestamps = new Map<string, number[]>();

export const rateLimitGenerations = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userId = req.body?.userId || req.query?.userId;
  if (!userId) {
    next();
    return;
  }

  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  const timestamps = (userTimestamps.get(userId) || []).filter((t) => t > oneHourAgo);

  const maxRequestsPerHour = 10;
  if (timestamps.length >= maxRequestsPerHour) {
    res.status(429).json({
      success: false,
      error: 'rate_limit_exceeded',
      message: 'You have reached the maximum generation limit of 10 requests per hour. Please try again later.',
    });
    return;
  }

  timestamps.push(now);
  userTimestamps.set(userId, timestamps);
  next();
};
