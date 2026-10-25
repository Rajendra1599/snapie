import fs from 'fs';
import path from 'path';
import { IAIProvider, RestyleJobParams, RestyleJobResult } from './IAIProvider';
import { env } from '../../config/env';
import { S3CloudFrontStorageService } from '../storage/S3CloudFrontStorageService';
import { STARTER_LOOKS } from '../../data/starterLooks';
import { loadCustomLooks } from '../../data/customLooksStorage';
import { PortraitEnhancementService } from '../image/PortraitEnhancementService';

const uploadsDir = path.join(__dirname, '../../../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export class BFLImageAIProvider implements IAIProvider {
  readonly providerName = 'bfl';
  private apiKey?: string;
  private storageService: S3CloudFrontStorageService;

  constructor() {
    this.apiKey = env.BFL_API_KEY;
    this.storageService = new S3CloudFrontStorageService();
  }

  /**
   * Builds an identity-preserving prompt tailored for FLUX 3 Image.
   */
  public buildPreservationPrompt(userPrompt: string, lookId?: string): string {
    const customLooks = loadCustomLooks();
    const allLooks = [...customLooks, ...STARTER_LOOKS];
    const look = allLooks.find((l) => l.id === lookId || l.name?.toLowerCase() === lookId?.toLowerCase());

    const activePrompt = userPrompt || look?.pipeline_b?.prompt_template || look?.name || '';
    const lower = activePrompt.toLowerCase();
    const lookIdLower = (lookId || '').toLowerCase();

    // 0. Remini AI Glow Up & Facial Enhancement
    if (
      lower.includes('remini') ||
      lower.includes('glow') ||
      lower.includes('enhance') ||
      lower.includes('smooth') ||
      lower.includes('beauty') ||
      lookIdLower.includes('enhance') ||
      lookIdLower.includes('remini') ||
      lookIdLower.includes('glow')
    ) {
      return (
        'Remini AI ultra-high-definition portrait enhancement and beauty glow up. ' +
        'Reconstruct razor-sharp facial details, sparkling crystal clear eyes, natural fine eyelashes, ' +
        'soft silky smooth porcelain glowing skin, blemish-free complexion, luminous cheekbone highlights, ' +
        'natural hair strand texture and pro studio DSLR lighting. ' +
        'Preserve the person\'s exact identity, facial structure, expressions, clothing, and natural features.'
      );
    }

    // 1. Specific Predefined Looks / Effects
    if (lookIdLower.includes('forest') || lower.includes('forest') || lower.includes('dense foggy forest')) {
      return (
        'Replace the entire background with a realistic dense green forest. ' +
        'Keep the person completely unchanged, including identity, face, facial features, hair, skin, clothing, body, pose and proportions. ' +
        'Match the lighting, perspective and shadows naturally. Do not modify the person.'
      );
    }

    if (lookIdLower.includes('beach') || lower.includes('beach') || lower.includes('tropical beach')) {
      return (
        'Replace the entire background with a photorealistic tropical beach during golden hour. ' +
        'Keep the person completely unchanged. Preserve identity, face, hair, skin, clothing, body, pose and composition. ' +
        'Match environmental lighting and shadows naturally. Do not modify the person.'
      );
    }

    if (lookIdLower.includes('cinematic') || lower.includes('cinematic')) {
      return (
        'Apply a cinematic photographic color grade with rich contrast, deep but detailed shadows, controlled highlights and natural skin tones. ' +
        'Preserve the person\'s identity, facial features, composition and all important details.'
      );
    }

    if (lookIdLower.includes('kodak') || lower.includes('kodak') || lower.includes('analog film')) {
      return (
        'Transform the photograph into a realistic analog Kodak-style film photograph. ' +
        'Add subtle natural film grain, warm film colors, soft highlight rolloff and authentic analog character. ' +
        'Preserve the person\'s identity, face, skin texture, pose, clothing and composition.'
      );
    }

    if (lookIdLower.includes('vintage') || lower.includes('vintage')) {
      return (
        'Apply an authentic vintage photographic aesthetic with subtle film grain, slightly faded colors, natural contrast and analog texture. ' +
        'Keep the person\'s identity and facial features unchanged.'
      );
    }

    if (lookIdLower.includes('night_flash') || lower.includes('night flash') || lower.includes('direct flash')) {
      return (
        'Transform the image into a realistic direct-camera-flash night photograph. ' +
        'Preserve the person\'s identity, face, clothing and pose. ' +
        'Add realistic flash illumination, darker ambient surroundings and natural photographic falloff.'
      );
    }

    // 2. Background-Modifying Custom Instructions
    const isBackgroundEdit =
      lower.includes('background') ||
      lower.includes('backdrop') ||
      lower.includes('mountain') ||
      lower.includes('apartment') ||
      lower.includes('studio') ||
      lower.includes('sunset') ||
      lower.includes('environment');

    if (isBackgroundEdit) {
      return (
        `${activePrompt}. ` +
        'Keep the main subject\'s identity, face, facial features, hair, skin, clothing, body, pose and proportions unchanged. ' +
        'Only modify the requested environment. Make the result photorealistic, with naturally integrated lighting and shadows.'
      );
    }

    // 3. Color Grading & Lighting Instructions
    const isColorEdit =
      lower.includes('warmer') ||
      lower.includes('teal') ||
      lower.includes('black and white') ||
      lower.includes('b&w') ||
      lower.includes('contrast') ||
      lower.includes('pastel') ||
      lower.includes('lighting') ||
      lower.includes('grade');

    if (isColorEdit) {
      return (
        `${activePrompt}. ` +
        'Explicitly preserve the person\'s identity, facial features, skin texture, body geometry, pose, clothing, and composition.'
      );
    }

    // 4. Default Photographic Restyle Prompt with Identity Preservation
    return (
      `${activePrompt}. ` +
      'Photorealistic portrait restyle. Strongly preserve the subject\'s face, identity, hair, skin, clothing, and pose naturally.'
    );
  }

  /**
   * Main entry point to restyle photo with BFL FLUX 3 Image.
   * If AI is unavailable, out of credits, or errors, automatically executes
   * Complete Image Enhancement & Face Smoothing Pipeline.
   */
  async restylePhoto(params: RestyleJobParams): Promise<RestyleJobResult> {
    try {
      if (!this.apiKey || this.apiKey.trim().length === 0) {
        throw new Error('BFL_API_KEY is not configured on the server.');
      }

      const resolution = params.resolution || env.BFL_RESOLUTION || '1k';
      const enhancedPrompt = this.buildPreservationPrompt(params.prompt, params.lookId);

      console.log(`[BFL FLUX 3 Image]: Submitting request for Job "${params.jobId}" (Resolution: ${resolution})`);

      // Prepare input image format (http URL or base64)
      let imageInput = params.imageInputUrl;
      if (imageInput.startsWith('data:image')) {
        // Keep data URI or clean base64 string
        const parts = imageInput.split('base64,');
        imageInput = parts.length > 1 ? parts[1] : imageInput;
      }

      // 1. Submit Generation Request to BFL FLUX 3 Image / Klein Endpoint
      const model = env.BFL_MODEL || 'flux-3-image-klein';
      const submitUrl = `https://api.bfl.ai/v1/${model}`;
      console.log(`[BFL ${model}]: Submitting request for Job "${params.jobId}" (Resolution: ${resolution})`);
      let submitRes: Response;
      try {
        submitRes = await fetch(submitUrl, {
          method: 'POST',
          headers: {
            'x-key': this.apiKey,
            'Content-Type': 'application/json',
            'accept': 'application/json',
          },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            images: [imageInput],
            resolution: resolution,
          }),
        });
      } catch (netErr: any) {
        throw new Error(`Failed to connect to Black Forest Labs API: ${netErr.message}`);
      }

      if (!submitRes.ok) {
        let errorMsg = `BFL API error (Status ${submitRes.status})`;
        try {
          const errJson: any = await submitRes.json();
          if (errJson.detail) {
            errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
          } else if (errJson.message) {
            errorMsg = errJson.message;
          }
        } catch (_) {}
        console.error(`[BFL FLUX 3 Image Error]: ${errorMsg}`);
        throw new Error(`BFL generation request failed: ${errorMsg}`);
      }

      const submitData: any = await submitRes.json();
      const taskId: string = submitData.id;
      const pollingUrl: string = submitData.polling_url || `https://api.bfl.ai/v1/get_result?id=${taskId}`;

      if (!taskId) {
        throw new Error('Invalid response from BFL API: Missing task ID');
      }

      console.log(`[BFL FLUX 3 Image]: Task created successfully. ID: ${taskId}. Polling: ${pollingUrl}`);

      // 2. Poll the Result Endpoint until Generation is Ready
      const finalGeneratedUrl = await this.pollGenerationResult(pollingUrl, taskId);

      // 3. Download the generated image from BFL
      console.log(`[BFL FLUX 3 Image]: Generation Ready. Downloading generated sample from BFL...`);
      const downloadRes = await fetch(finalGeneratedUrl);
      if (!downloadRes.ok) {
        throw new Error(`Failed to download result image from BFL (Status: ${downloadRes.status})`);
      }

      const arrayBuffer = await downloadRes.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      // 4. Upload to CloudFront / AWS S3 Permanent Storage
      const filename = `bfl_${Date.now()}_${params.jobId.substring(0, 8)}.jpg`;
      let outputUrl: string;

      const isAwsConfigured =
        Boolean(env.AWS_ACCESS_KEY_ID) &&
        !env.AWS_ACCESS_KEY_ID.startsWith('mock') &&
        Boolean(env.AWS_SECRET_ACCESS_KEY) &&
        !env.AWS_SECRET_ACCESS_KEY.startsWith('mock');

      if (isAwsConfigured) {
        try {
          const s3Key = `generations/${filename}`;
          await this.storageService.uploadBuffer(s3Key, imageBuffer, 'image/jpeg');
          outputUrl = await this.storageService.getSignedDownloadUrl(s3Key, 172800);
          console.log(`[BFL FLUX 3 Image]: Saved to AWS S3 & CloudFront: ${outputUrl}`);
        } catch (s3Err: any) {
          console.warn(`[BFL FLUX 3 Image]: S3 upload failed, using local disk fallback: ${s3Err.message}`);
          const localPath = path.join(uploadsDir, filename);
          fs.writeFileSync(localPath, imageBuffer);
          outputUrl = `/uploads/${filename}`;
        }
      } else {
        const localPath = path.join(uploadsDir, filename);
        fs.writeFileSync(localPath, imageBuffer);
        outputUrl = `/uploads/${filename}`;
      }

      return {
        outputImageUrl: outputUrl,
        provider: `Black Forest Labs ${model === 'flux-3-image-klein' ? 'FLUX 3 Image Klein' : 'FLUX 3 Image'}`,
        metadata: {
          model,
          bflId: taskId,
          resolution,
          prompt: enhancedPrompt,
        },
      };
    } catch (aiErr: any) {
      console.warn(`[BFL FLUX 3 Image Notice]: AI response failed (${aiErr.message}). Activating Complete Image Enhancement & Face Smoothing Fallback...`);
      return await this.handleFallbackEnhancement(params, aiErr.message);
    }
  }

  /**
   * Complete image enhancement & face smoothing fallback
   * Triggered automatically when AI provider does not respond or fails.
   */
  private async handleFallbackEnhancement(
    params: RestyleJobParams,
    failureReason: string
  ): Promise<RestyleJobResult> {
    try {
      // 1. Convert input image to Buffer
      const inputBuffer = await PortraitEnhancementService.bufferFromInput(params.imageInputUrl);

      // 2. Run Ultra HD Quality Enhancement + Skin Smoothing
      const enhancedBuffer = await PortraitEnhancementService.enhanceAndSmoothPortrait(inputBuffer, {
        lookId: params.lookId,
        strength: params.strength,
      });

      // 3. Save to AWS S3 & CloudFront or local /uploads/
      const filename = `enhanced_${Date.now()}_${params.jobId.substring(0, 8)}.jpg`;
      let outputUrl: string;

      const isAwsConfigured =
        Boolean(env.AWS_ACCESS_KEY_ID) &&
        !env.AWS_ACCESS_KEY_ID.startsWith('mock') &&
        Boolean(env.AWS_SECRET_ACCESS_KEY) &&
        !env.AWS_SECRET_ACCESS_KEY.startsWith('mock');

      if (isAwsConfigured) {
        try {
          const s3Key = `generations/${filename}`;
          await this.storageService.uploadBuffer(s3Key, enhancedBuffer, 'image/jpeg');
          outputUrl = await this.storageService.getSignedDownloadUrl(s3Key, 172800);
          console.log(`[Snapie Ultra Enhancer]: Enhanced photo saved to AWS S3 & CloudFront: ${outputUrl}`);
        } catch (s3Err: any) {
          console.warn(`[Snapie Ultra Enhancer]: S3 upload notice: ${s3Err.message}, saved to local disk`);
          const localPath = path.join(uploadsDir, filename);
          fs.writeFileSync(localPath, enhancedBuffer);
          outputUrl = `/uploads/${filename}`;
        }
      } else {
        const localPath = path.join(uploadsDir, filename);
        fs.writeFileSync(localPath, enhancedBuffer);
        outputUrl = `/uploads/${filename}`;
      }

      console.log(`[Snapie Ultra Enhancer]: Complete enhancement & face smoothing finished for Job ${params.jobId}`);

      return {
        outputImageUrl: outputUrl,
        provider: 'Snapie Ultra HD Enhancer & Face Smoothing (AI Fallback)',
        metadata: {
          jobId: params.jobId,
          fallback: true,
          aiFailureReason: failureReason,
          faceSmoothing: 'active',
          qualityEnhanced: 'ultra_hd',
          processedAt: new Date().toISOString(),
        },
      };
    } catch (fallbackErr: any) {
      console.error(`[Snapie Ultra Enhancer Error]: Fallback failed: ${fallbackErr.message}`);
      throw new Error(failureReason);
    }
  }

  /**
   * Asynchronous Polling with configurable interval and timeout.
   */
  private async pollGenerationResult(
    pollingUrl: string,
    taskId: string,
    timeoutMs: number = 90000,
    customIntervalMs?: number
  ): Promise<string> {
    const startTime = Date.now();
    const intervalMs = customIntervalMs || (process.env.NODE_ENV === 'test' ? 50 : 1500);

    while (Date.now() - startTime < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      try {
        const pollRes = await fetch(pollingUrl, {
          method: 'GET',
          headers: {
            'x-key': this.apiKey!,
            'accept': 'application/json',
          },
        });

        if (!pollRes.ok) {
          const errData: any = await pollRes.json().catch(() => ({}));
          console.warn(`[BFL Polling Notice]: Status ${pollRes.status} for task ${taskId}:`, errData);
          continue;
        }

        const pollData: any = await pollRes.json();
        const status = pollData.status;

        console.log(`[BFL Polling]: Task ${taskId} status: "${status}"`);

        if (status === 'Ready') {
          const sampleUrl = pollData.result?.sample;
          if (!sampleUrl) {
            throw new Error('BFL generation is Ready but no result sample URL was returned');
          }
          return sampleUrl;
        }

        if (status === 'Error' || status === 'Failed') {
          const errorDetail = pollData.error || pollData.result?.error || 'BFL image generation failed';
          throw new Error(`BFL Generation Failed: ${errorDetail}`);
        }

        // Status is 'Pending', 'Processing', etc. -> loop again
      } catch (err: any) {
        if (err.message?.includes('BFL Generation Failed')) {
          throw err;
        }
        console.warn(`[BFL Polling Warning]: Check attempt failed: ${err.message}`);
      }
    }

    throw new Error(`BFL image generation timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`);
  }
}
