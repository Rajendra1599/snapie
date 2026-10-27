import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { STARTER_LOOKS, LookDto } from '../data/starterLooks';
import { Look } from '../models';
import '../data/customLooksStorage';
import { resolveMediaUrl } from './admin';

export const looksRouter = Router();

// GET /api/v1/looks - returns active effects and templates
looksRouter.get('/looks', async (req: Request, res: Response) => {
  try {
    const kind = req.query.kind as string | undefined;

    // Start with default starter looks
    let results: LookDto[] = [...STARTER_LOOKS];

    // If MongoDB is connected, load all custom admin-uploaded looks from database
    if (mongoose.connection.readyState === 1) {
      try {
        let query: any = { active: { $ne: false } };
        if (kind) query.kind = kind;
        const dbLooks = await Look.find(query).sort({ order: 1 }).lean();

        for (const dl of dbLooks) {
          const id = (dl.id || dl.lookId || (dl as any)._id?.toString()) as string;
          const formatted: LookDto = {
            id,
            name: dl.name,
            kind: dl.kind as any,
            description: dl.description || '',
            tier: (dl.tier || 'free') as any,
            credit_cost: dl.creditCost || 0,
            order: dl.order || 0,
            active: dl.active !== false,
            pipeline_a: (dl as any).pipeline_a || (dl as any).pipelineA || {
              grain: 0.25,
              vignette: 0.2,
              split_tone: { shadow: '#1F2A38', highlight: '#FFE8C8' },
              contrast: 1.15,
              halation: 0.15,
              flash_falloff: 0.3,
              white_balance: 5500,
              filter_strength_default: 80,
            },
            pipeline_b: (dl as any).pipeline_b || (dl as any).pipelineB || {
              prompt_template: `${dl.name} aesthetic photography`,
              default_strength: 80,
              negative_prompt: 'blurry, cartoon, 3d, distorted',
            },
            preview: {
              before_url: (dl as any).preview?.before_url || (dl as any).preview?.beforeUrl || '',
              after_url: (dl as any).preview?.after_url || (dl as any).preview?.afterUrl || '',
              thumbnail_url: (dl as any).preview?.thumbnail_url || (dl as any).preview?.thumbnailUrl || '',
            },
          };

          const existingIdx = results.findIndex((l) => l.id === id);
          if (existingIdx !== -1) {
            results[existingIdx] = formatted;
          } else {
            results.unshift(formatted);
          }
        }
      } catch (dbErr) {
        console.warn('[Looks] MongoDB query warning:', dbErr);
      }
    }

    let filtered = results.filter((l) => l.active);
    if (kind) {
      filtered = filtered.filter((l) => l.kind === kind);
    }
    filtered.sort((a, b) => a.order - b.order);

    const host = req.get('host') || 'localhost:4000';
    const proto = req.get('x-forwarded-proto') || (host.includes('onrender.com') ? 'https' : req.protocol);
    const baseUrl = `${proto}://${host}`;
    const normalized = filtered.map((look) => ({
      ...look,
      preview: {
        ...look.preview,
        before_url: resolveMediaUrl(baseUrl, look.preview.before_url),
        after_url: resolveMediaUrl(baseUrl, look.preview.after_url),
        thumbnail_url: resolveMediaUrl(baseUrl, look.preview.thumbnail_url),
      },
    }));

    res.status(200).json({
      success: true,
      data: normalized,
      count: normalized.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch looks and templates',
    });
  }
});

// GET /api/v1/looks/:id
looksRouter.get('/looks/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const look = STARTER_LOOKS.find((l) => l.id === id);

  if (!look) {
    return res.status(404).json({
      success: false,
      error: 'Look not found',
    });
  }

  const host = req.get('host') || 'localhost:4000';
  const proto = req.get('x-forwarded-proto') || (host.includes('onrender.com') ? 'https' : req.protocol);
  const baseUrl = `${proto}://${host}`;
  const normalized = {
    ...look,
    preview: {
      ...look.preview,
      before_url: resolveMediaUrl(baseUrl, look.preview.before_url),
      after_url: resolveMediaUrl(baseUrl, look.preview.after_url),
      thumbnail_url: resolveMediaUrl(baseUrl, look.preview.thumbnail_url),
    },
  };

  res.status(200).json({
    success: true,
    data: normalized,
  });
});
