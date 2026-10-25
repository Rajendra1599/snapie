"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HuggingFaceAIProvider = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sharp_1 = __importDefault(require("sharp"));
const env_1 = require("../../config/env");
const S3CloudFrontStorageService_1 = require("../storage/S3CloudFrontStorageService");
const starterLooks_1 = require("../../data/starterLooks");
const customLooksStorage_1 = require("../../data/customLooksStorage");
const uploadsDir = path_1.default.join(__dirname, '../../../public/uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
class HuggingFaceAIProvider {
    providerName = 'huggingface';
    storageService;
    constructor() {
        this.storageService = new S3CloudFrontStorageService_1.S3CloudFrontStorageService();
    }
    async restylePhoto(params) {
        console.log(`[Photo Restyle]: Processing photo for look: "${params.lookId}"`);
        // 1. Clean and decode user's actual uploaded photo bytes
        let base64Clean = params.imageInputUrl;
        if (params.imageInputUrl.includes('base64,')) {
            base64Clean = params.imageInputUrl.split('base64,')[1];
        }
        const userPhotoBuffer = Buffer.from(base64Clean, 'base64');
        // 2. Read exact dimensions and metadata of user's photo
        const imageInstance = (0, sharp_1.default)(userPhotoBuffer);
        const metadata = await imageInstance.metadata();
        const originalWidth = metadata.width || 800;
        const originalHeight = metadata.height || 800;
        console.log(`[Photo Restyle]: Input photo dimensions: ${originalWidth}x${originalHeight} (Format: ${metadata.format})`);
        // 3. Find look aesthetic parameters (from STARTER_LOOKS or custom admin looks)
        const customLooks = (0, customLooksStorage_1.loadCustomLooks)();
        const allLooks = [...customLooks, ...starterLooks_1.STARTER_LOOKS];
        const look = allLooks.find((l) => l.id === params.lookId) || allLooks.find((l) => l.name.toLowerCase() === params.lookId?.toLowerCase());
        const lookNameLower = (look?.name || params.lookId || '').toLowerCase();
        const pA = look?.pipeline_a;
        const contrastVal = pA?.contrast || 1.18;
        const whiteBalance = pA?.white_balance || 5500;
        // 4. Apply faithful Photo Restyling directly onto user's photo pixels
        // Preserves 100% of user face, posture, clothing, background, and exact dimensions
        let processed = (0, sharp_1.default)(userPhotoBuffer);
        // Maintain exact original width and height without any cropping
        processed = processed.resize({
            width: originalWidth,
            height: originalHeight,
            fit: 'fill',
        });
        if (lookNameLower.includes('noir') || lookNameLower.includes('b&w') || lookNameLower.includes('black')) {
            // Black & White / Film Noir aesthetic
            processed = processed
                .grayscale()
                .linear(contrastVal * 1.05, -25)
                .sharpen({ sigma: 1.2, m1: 1.5, m2: 0.7 });
        }
        else if (lookNameLower.includes('golden') || lookNameLower.includes('sunset') || lookNameLower.includes('amalfi') || whiteBalance > 5600) {
            // Golden Hour / Amalfi warm sunlight flash
            processed = processed
                .modulate({
                brightness: 1.06, // Direct flash pop
                saturation: 1.20, // Rich warm tones
            })
                .linear(contrastVal, -15)
                .tint({ r: 255, g: 240, b: 218 }) // Warm golden tone
                .sharpen({ sigma: 1.0, m1: 1.2, m2: 0.8 });
        }
        else if (lookNameLower.includes('teal') || lookNameLower.includes('cool') || lookNameLower.includes('cyan')) {
            // Vintage Teal / Cool film
            processed = processed
                .modulate({
                brightness: 1.04,
                saturation: 1.15,
            })
                .linear(contrastVal, -18)
                .tint({ r: 228, g: 246, b: 252 })
                .sharpen({ sigma: 1.0 });
        }
        else {
            // 90s Flash / Jersey Flash / Classic Photo Restyle (Default)
            processed = processed
                .modulate({
                brightness: 1.08, // Direct camera flash lighting
                saturation: 1.16, // Vibrant film colors
            })
                .linear(contrastVal, -20) // Deep cinematic contrast
                .tint({ r: 255, g: 246, b: 236 }) // Creamy editorial flash highlight
                .sharpen({ sigma: 1.1, m1: 1.4, m2: 0.7 }); // Crisp high-definition details
        }
        // 5. Compress bit size (JPEG progressive compression: 82 quality, mozjpeg optimization)
        // Compresses file size significantly while retaining crisp high-resolution quality
        const compressedRestyledBuffer = await processed
            .jpeg({
            quality: 82,
            progressive: true,
            mozjpeg: true,
        })
            .toBuffer();
        console.log(`[Photo Restyle]: Restyled with exact dimensions ${originalWidth}x${originalHeight}. Original: ${(userPhotoBuffer.byteLength / 1024).toFixed(1)} KB -> Compressed: ${(compressedRestyledBuffer.byteLength / 1024).toFixed(1)} KB`);
        const isRealAwsConfigured = Boolean(env_1.env.AWS_ACCESS_KEY_ID) &&
            !env_1.env.AWS_ACCESS_KEY_ID.startsWith('mock') &&
            Boolean(env_1.env.AWS_SECRET_ACCESS_KEY) &&
            !env_1.env.AWS_SECRET_ACCESS_KEY.startsWith('mock');
        const filename = `restyle_${Date.now()}_${params.jobId.substring(0, 6)}.jpg`;
        // 6. Upload compressed restyled image to AWS S3 (2-day auto-delete lifecycle)
        if (isRealAwsConfigured) {
            try {
                const s3OutputKey = `generations/${filename}`;
                await this.storageService.uploadBuffer(s3OutputKey, compressedRestyledBuffer, 'image/jpeg');
                // Generate 48-hour (2 days) secure pre-signed download URL
                const signedDownloadUrl = await this.storageService.getSignedDownloadUrl(s3OutputKey, 172800);
                console.log(`[Photo Restyle]: Uploaded compressed photo to AWS S3: ${s3OutputKey}`);
                return {
                    outputImageUrl: signedDownloadUrl,
                    provider: 'Photo Restyle Engine (AWS S3)',
                    metadata: {
                        width: originalWidth,
                        height: originalHeight,
                        compressedBytes: compressedRestyledBuffer.byteLength,
                        lookId: params.lookId,
                        autoDeleteDays: 2,
                    },
                };
            }
            catch (s3Err) {
                console.warn('[Photo Restyle]: AWS S3 upload failed, falling back to local disk:', s3Err.message);
            }
        }
        // Local disk fallback
        const filePath = path_1.default.join(uploadsDir, filename);
        fs_1.default.writeFileSync(filePath, compressedRestyledBuffer);
        return {
            outputImageUrl: `/uploads/${filename}`,
            provider: 'Photo Restyle Engine (Local)',
            metadata: { width: originalWidth, height: originalHeight, local: true },
        };
    }
}
exports.HuggingFaceAIProvider = HuggingFaceAIProvider;
