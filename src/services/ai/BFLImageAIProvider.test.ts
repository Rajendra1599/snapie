import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../../app';
import { BFLImageAIProvider } from './BFLImageAIProvider';
import { AIProviderFactory } from './AIProviderFactory';

describe('BFL FLUX 3 Image Provider & Edit Endpoints', () => {
  jest.setTimeout(20000);
  const app = createApp();

  describe('Prompt Builder & Identity Preservation Engine', () => {
    const provider = new BFLImageAIProvider();

    it('enhances background forest requests with identity preservation', () => {
      const prompt = provider.buildPreservationPrompt('Make the background a dense foggy forest', 'background_forest');
      expect(prompt).toContain('Replace the entire background with a realistic dense green forest');
      expect(prompt).toContain('identity, face, facial features, hair, skin, clothing, body, pose and proportions');
      expect(prompt).toContain('Match the lighting, perspective and shadows naturally');
    });

    it('enhances background beach requests with golden hour lighting', () => {
      const prompt = provider.buildPreservationPrompt('beach sunset', 'background_beach');
      expect(prompt).toContain('photorealistic tropical beach during golden hour');
      expect(prompt).toContain('Preserve identity, face, hair, skin, clothing, body, pose and composition');
    });

    it('enhances cinematic color grade requests with tone preservation', () => {
      const prompt = provider.buildPreservationPrompt('cinematic look', 'cinematic');
      expect(prompt).toContain('cinematic photographic color grade with rich contrast');
      expect(prompt).toContain('Preserve the person\'s identity, facial features, composition');
    });

    it('enhances analog Kodak film requests with grain and warmth', () => {
      const prompt = provider.buildPreservationPrompt('kodak film photo', 'kodak');
      expect(prompt).toContain('analog Kodak-style film photograph');
      expect(prompt).toContain('Preserve the person\'s identity, face, skin texture, pose, clothing and composition');
    });

    it('enhances vintage requests preserving identity', () => {
      const prompt = provider.buildPreservationPrompt('vintage photo', 'vintage');
      expect(prompt).toContain('authentic vintage photographic aesthetic');
      expect(prompt).toContain('Keep the person\'s identity and facial features unchanged');
    });

    it('enhances night flash requests with falloff lighting', () => {
      const prompt = provider.buildPreservationPrompt('night flash photo', 'night_flash');
      expect(prompt).toContain('direct-camera-flash night photograph');
      expect(prompt).toContain('realistic flash illumination');
    });

    it('enhances custom user background prompts preserving subject identity', () => {
      const prompt = provider.buildPreservationPrompt('Make the background a snowy mountain landscape', 'custom');
      expect(prompt).toContain('snowy mountain landscape');
      expect(prompt).toContain('identity, face, facial features, hair, skin, clothing, body, pose and proportions');
    });

    it('enhances custom color grading prompt preserving subject geometry', () => {
      const prompt = provider.buildPreservationPrompt('Make the image warmer with teal and orange grade', 'custom');
      expect(prompt).toContain('warmer with teal and orange grade');
      expect(prompt).toContain('identity, facial features, skin texture, body geometry, pose, clothing');
    });
  });

  describe('AIProviderFactory Integration', () => {
    it('returns BFLImageAIProvider for "bfl"', () => {
      const provider = AIProviderFactory.getProvider('bfl');
      expect(provider.providerName).toBe('bfl');
    });

    it('migrates and routes "gemini" directly to BFLImageAIProvider', () => {
      const provider = AIProviderFactory.getProvider('gemini');
      expect(provider.providerName).toBe('bfl');
    });
  });

  describe('POST /api/image/edit Validation', () => {
    it('returns 400 if image is missing', async () => {
      const res = await request(app)
        .post('/api/image/edit')
        .send({ prompt: 'Replace background with forest' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('image (URL or base64) is required');
    });

    it('returns 400 if prompt and effect are missing', async () => {
      const res = await request(app)
        .post('/api/image/edit')
        .send({ image: 'https://example.com/photo.jpg' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('prompt or effect/lookId is required');
    });
  });

  describe('Asynchronous Polling & Result Flow', () => {
    it('simulates BFL FLUX 3 asynchronous polling Ready state', async () => {
      const originalFetch = global.fetch;

      // Mock fetch:
      // 1. POST /v1/flux-3-image -> returns { id: 'test_task_123', polling_url: 'https://api.bfl.ai/v1/get_result?id=test_task_123' }
      // 2. GET polling_url (first poll) -> returns { status: 'Processing' }
      // 3. GET polling_url (second poll) -> returns { status: 'Ready', result: { sample: 'https://delivery.bfl.ai/sample.jpg' } }
      // 4. GET sample.jpg -> returns binary image buffer
      let pollCount = 0;
      global.fetch = jest.fn(async (url: any, options: any) => {
        const urlStr = url.toString();

        if (urlStr.includes('/v1/flux-3-image')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'test_task_123',
              polling_url: 'https://api.bfl.ai/v1/get_result?id=test_task_123',
            }),
          } as any;
        }

        if (urlStr.includes('/get_result')) {
          pollCount++;
          if (pollCount === 1) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ status: 'Processing' }),
            } as any;
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: 'Ready',
              result: { sample: 'https://delivery.bfl.ai/sample.jpg' },
            }),
          } as any;
        }

        if (urlStr.includes('sample.jpg')) {
          const tinyJpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
          return {
            ok: true,
            status: 200,
            arrayBuffer: async () => tinyJpeg.buffer,
          } as any;
        }

        return originalFetch(url, options);
      });

      const provider = new BFLImageAIProvider();
      const result = await provider.restylePhoto({
        jobId: 'unit_test_job_1',
        imageInputUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
        prompt: 'Replace background with a foggy forest',
        strength: 80,
        lookId: 'background_forest',
      });

      expect(result.provider).toContain('Black Forest Labs');
      expect(result.outputImageUrl).toBeDefined();
      expect(result.metadata?.model).toBeDefined();
      expect(result.metadata?.bflId).toBe('test_task_123');
      expect(pollCount).toBeGreaterThanOrEqual(2);

      // Restore fetch
      global.fetch = originalFetch;
    });

    it('handles BFL generation failure gracefully', async () => {
      const originalFetch = global.fetch;

      global.fetch = jest.fn(async (url: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('/v1/flux-3-image')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'fail_task_456',
              polling_url: 'https://api.bfl.ai/v1/get_result?id=fail_task_456',
            }),
          } as any;
        }

        if (urlStr.includes('/get_result')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: 'Failed',
              error: 'Invalid input image format',
            }),
          } as any;
        }

        return { ok: false } as any;
      });

      const provider = new BFLImageAIProvider();
      await expect(
        provider.restylePhoto({
          jobId: 'unit_test_job_fail',
          imageInputUrl: 'https://example.com/bad.jpg',
          prompt: 'Replace background',
          strength: 80,
          lookId: 'custom',
        })
      ).rejects.toThrow('BFL Generation Failed: Invalid input image format');

      global.fetch = originalFetch;
    });

    it('automatically applies Complete Enhancement & Face Smoothing fallback when BFL fails', async () => {
      const originalFetch = global.fetch;

      // Mock BFL API returning 402 Insufficient credits
      global.fetch = jest.fn(async (url: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('/v1/flux-3-image')) {
          return {
            ok: false,
            status: 402,
            json: async () => ({ detail: 'Insufficient credits' }),
          } as any;
        }
        return { ok: false } as any;
      });

      const sampleJpeg = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 230, g: 190, b: 170 } },
      }).jpeg().toBuffer();

      const provider = new BFLImageAIProvider();
      const result = await provider.restylePhoto({
        jobId: 'unit_test_fallback_job',
        imageInputUrl: `data:image/jpeg;base64,${sampleJpeg.toString('base64')}`,
        prompt: 'Warm cinematic portrait',
        strength: 85,
        lookId: 'golden_hour',
      });

      expect(result.outputImageUrl).toBeDefined();
      expect(result.provider).toContain('Enhancer & Face Smoothing');
      expect(result.metadata?.fallback).toBe(true);
      expect(result.metadata?.faceSmoothing).toBe('active');

      global.fetch = originalFetch;
    });
  });
});

