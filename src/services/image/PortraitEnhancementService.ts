import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export interface PortraitEnhanceOptions {
  lookId?: string;
  strength?: number;
}

export class PortraitEnhancementService {
  /**
   * Completely enhances image quality and applies natural, aesthetic skin smoothing
   * 1. Skin Smoothing: Softens blemishes, pores, and uneven skin tones
   * 2. Eye & Facial Feature Sharpening: Razor-sharp eyes, eyelashes, lips, hair
   * 3. CLAHE Contrast & Dynamic Range: Lifts shadows, optimizes highlights
   * 4. Color Grading: Flattering skin warmth, vibrant tone balancing
   */
  public static async enhanceAndSmoothPortrait(
    inputBuffer: Buffer,
    options: PortraitEnhanceOptions = {}
  ): Promise<Buffer> {
    try {
      // 1. Auto-orient image based on EXIF metadata
      const base = sharp(inputBuffer).rotate();
      const metadata = await base.metadata();

      const width = metadata.width || 1080;
      const height = metadata.height || 1080;

      // Calculate blur radius proportional to image size
      const blurRadius = Math.max(1.0, Math.min(2.8, (width / 700)));

      // 2. Generate smooth skin diffusion layer (Frequency Separation Base)
      // Softens skin imperfections without introducing any red/orange color cast
      const smoothSkinLayer = await sharp(inputBuffer)
        .rotate()
        .blur(blurRadius)
        .modulate({
          brightness: 1.05,
          saturation: 0.96, // Keeps red hue down, giving clean natural skin
        })
        .toBuffer();

      // 3. Remini Clean White Radiance Glow Layer (crystal clear cheekbone & porcelain highlights)
      const glowBloomRadius = Math.max(6, Math.min(16, Math.floor(width / 60)));
      const cleanGlowLayer = await sharp(inputBuffer)
        .rotate()
        .blur(glowBloomRadius)
        .modulate({
          brightness: 1.10,
          saturation: 0.94, // Clean porcelain white glow without red/warm burning
        })
        .toBuffer();

      // 4. Studio Brightness & Clean Color Balance (Remini Style)
      // Noticeably lifts brightness and keeps saturation balanced to eliminate red/orange hue
      const brightness = 1.14; // Bright, clean, studio-lit exposure
      const saturation = 1.00; // True neutral colors (pure white clean look, no red hue)

      // 5. Composite: Remini Ultra HD Crystal Clarity
      // Razor-sharp eyes & hair + Porcelain Smooth Skin + Clean White Studio Lighting
      const enhancedBuffer = await sharp(inputBuffer)
        .rotate()
        // Contrast Limited Adaptive Histogram Equalization with gentle slope to avoid red artifacts
        .clahe({
          width: Math.min(64, Math.max(16, Math.floor(width / 32))),
          height: Math.min(64, Math.max(16, Math.floor(height / 32))),
          maxSlope: 2,
        })
        // Boost brightness and maintain pure clean white tones
        .modulate({
          brightness,
          saturation,
        })
        // Remini crystal-clear detail definition on eyes, lashes, brows & lips
        .sharpen({
          sigma: 1.25,
          m1: 1.35,
          m2: 0.55,
          x1: 2.0,
          y2: 10.0,
          y3: 20.0,
        })
        // Multi-layer composite: Porcelain Smooth Skin + Clean Luminous Studio Glow
        .composite([
          {
            input: smoothSkinLayer,
            blend: 'soft-light',
          },
          {
            input: cleanGlowLayer,
            blend: 'soft-light',
          },
        ])
        .jpeg({
          quality: 96,
          mozjpeg: true,
          chromaSubsampling: '4:4:4',
        })
        .toBuffer();

      return enhancedBuffer;
    } catch (err: any) {
      console.warn('[PortraitEnhancementService] Advanced blend failed, using direct beautification fallback:', err.message);

      // Safe secondary fallback: Direct clean enhance without red cast
      try {
        return await sharp(inputBuffer)
          .rotate()
          .modulate({ brightness: 1.12, saturation: 1.00 })
          .sharpen({ sigma: 1.2 })
          .jpeg({ quality: 94 })
          .toBuffer();
      } catch (secErr: any) {
        throw new Error(`Failed to process image buffer: ${err.message}`);
      }
    }
  }

  /**
   * Helper to convert base64 or URL or file path into a Buffer
   */
  public static async bufferFromInput(imageInput: string): Promise<Buffer> {
    if (imageInput.startsWith('data:image')) {
      const base64Data = imageInput.split('base64,')[1];
      return Buffer.from(base64Data, 'base64');
    }

    if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
      const res = await fetch(imageInput);
      if (!res.ok) {
        throw new Error(`Failed to fetch input image from URL: ${res.status}`);
      }
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    }

    // Check if local file path
    if (fs.existsSync(imageInput)) {
      return fs.readFileSync(imageInput);
    }

    // Try raw base64
    try {
      return Buffer.from(imageInput, 'base64');
    } catch (_) {
      throw new Error('Unsupported image input format for portrait enhancement');
    }
  }
}
