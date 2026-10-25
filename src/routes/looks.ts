import { Router, Request, Response } from 'express';
import { STARTER_LOOKS } from '../data/starterLooks';
import { Look } from '../models';
import '../data/customLooksStorage';
import { resolveMediaUrl } from './admin';

export const looksRouter = Router();

// GET /api/v1/looks - returns active effects and templates
looksRouter.get('/looks', async (req: Request, res: Response) => {
  try {
    const kind = req.query.kind as string | undefined;

    // In production with MongoDB connected:
    // let query: any = { active: true };
    // if (kind) query.kind = kind;
    // const looks = await Look.find(query).sort({ order: 1 });

    let results = STARTER_LOOKS.filter((l) => l.active);
    if (kind) {
      results = results.filter((l) => l.kind === kind);
    }
    results.sort((a, b) => a.order - b.order);

    const host = req.get('host') || 'localhost:4000';
    const baseUrl = `${req.protocol}://${host}`;
    const normalized = results.map((look) => ({
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
  const baseUrl = `${req.protocol}://${host}`;
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
