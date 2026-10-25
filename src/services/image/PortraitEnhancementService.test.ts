import sharp from 'sharp';
import { PortraitEnhancementService } from './PortraitEnhancementService';

describe('PortraitEnhancementService', () => {
  let sampleImageBuffer: Buffer;

  beforeAll(async () => {
    // Generate a valid 300x300 portrait-like test image with skin tones
    sampleImageBuffer = await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 3,
        background: { r: 240, g: 200, b: 180 },
      },
    })
      .jpeg()
      .toBuffer();
  });

  it('successfully enhances image quality and applies facial skin smoothing', async () => {
    const enhanced = await PortraitEnhancementService.enhanceAndSmoothPortrait(sampleImageBuffer, {
      lookId: 'golden_hour',
      strength: 85,
    });

    expect(enhanced).toBeDefined();
    expect(enhanced.length).toBeGreaterThan(0);

    const metadata = await sharp(enhanced).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(300);
    expect(metadata.height).toBe(300);
  });

  it('converts base64 data URI to buffer correctly', async () => {
    const base64Str = `data:image/jpeg;base64,${sampleImageBuffer.toString('base64')}`;
    const buf = await PortraitEnhancementService.bufferFromInput(base64Str);
    expect(buf.length).toBe(sampleImageBuffer.length);
  });

  it('converts raw base64 to buffer correctly', async () => {
    const base64Str = sampleImageBuffer.toString('base64');
    const buf = await PortraitEnhancementService.bufferFromInput(base64Str);
    expect(buf.length).toBe(sampleImageBuffer.length);
  });

  it('rejects corrupted image buffer with descriptive error', async () => {
    const corrupted = Buffer.from('not an image data');
    await expect(PortraitEnhancementService.enhanceAndSmoothPortrait(corrupted)).rejects.toThrow(
      'Failed to process image buffer'
    );
  });
});
