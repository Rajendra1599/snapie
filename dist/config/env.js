"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.string().default('4000').transform((v) => parseInt(v, 10)),
    MONGODB_URI: zod_1.z.string().default('mongodb://localhost:27017/photo_restyler'),
    AWS_REGION: zod_1.z.string().default('ap-south-1'),
    AWS_ACCESS_KEY_ID: zod_1.z.string().default('mock_key'),
    AWS_SECRET_ACCESS_KEY: zod_1.z.string().default('mock_secret'),
    AWS_S3_BUCKET: zod_1.z.string().default('photo-restyler-uploads'),
    AWS_CLOUDFRONT_DOMAIN: zod_1.z.string().default('https://cdn.example.com'),
    AI_PROVIDER: zod_1.z.enum(['bfl', 'gemini', 'mock', 'huggingface']).default('bfl'),
    BFL_API_KEY: zod_1.z.string().optional(),
    BFL_MODEL: zod_1.z.string().default('flux-3-image-klein'),
    BFL_RESOLUTION: zod_1.z.enum(['768sq', '1k', '1.5k', '2k', '4k', 'match_input']).default('1k'),
    GEMINI_API_KEY: zod_1.z.string().optional(),
    HUGGINGFACE_API_KEY: zod_1.z.string().optional(),
    // Google Play In-App Purchases & Subscriptions
    GOOGLE_PLAY_PACKAGE_NAME: zod_1.z.string().default('com.restyler.app.photo_restyle_app'),
    GOOGLE_SERVICE_ACCOUNT_KEY_PATH: zod_1.z.string().optional(),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: zod_1.z.string().optional(),
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: zod_1.z.string().optional(),
    GOOGLE_PLAY_PRODUCT_PLUS_WEEKLY: zod_1.z.string().default('boothie_plus_weekly'),
    GOOGLE_PLAY_PRODUCT_GOLD_WEEKLY: zod_1.z.string().default('boothie_gold_weekly'),
    GOOGLE_PLAY_PUBSUB_TOPIC: zod_1.z.string().optional(),
    // Self-Ping / Keep-Alive Configuration (prevents free hosting from sleeping)
    RENDER_EXTERNAL_URL: zod_1.z.string().optional(),
    SELF_PING_URL: zod_1.z.string().optional(),
});
exports.env = envSchema.parse(process.env);
