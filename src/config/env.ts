import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('4000').transform((v) => parseInt(v, 10)),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/photo_restyler'),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string().default('mock_key'),
  AWS_SECRET_ACCESS_KEY: z.string().default('mock_secret'),
  AWS_S3_BUCKET: z.string().default('photo-restyler-uploads'),
  AWS_CLOUDFRONT_DOMAIN: z.string().default('https://cdn.example.com'),
  AI_PROVIDER: z.enum(['bfl', 'gemini', 'mock', 'huggingface']).default('bfl'),
  BFL_API_KEY: z.string().optional(),
  BFL_MODEL: z.string().default('flux-3-image-klein'),
  BFL_RESOLUTION: z.enum(['768sq', '1k', '1.5k', '2k', '4k', 'match_input']).default('1k'),
  GEMINI_API_KEY: z.string().optional(),
  HUGGINGFACE_API_KEY: z.string().optional(),
  
  // Google Play In-App Purchases & Subscriptions
  GOOGLE_PLAY_PACKAGE_NAME: z.string().default('com.restyler.app.photo_restyle_app'),
  GOOGLE_SERVICE_ACCOUNT_KEY_PATH: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),
  GOOGLE_PLAY_PRODUCT_PLUS_WEEKLY: z.string().default('boothie_plus_weekly'),
  GOOGLE_PLAY_PRODUCT_GOLD_WEEKLY: z.string().default('boothie_gold_weekly'),
  GOOGLE_PLAY_PUBSUB_TOPIC: z.string().optional(),

  // Self-Ping / Keep-Alive Configuration (prevents free hosting from sleeping)
  RENDER_EXTERNAL_URL: z.string().optional(),
  SELF_PING_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
