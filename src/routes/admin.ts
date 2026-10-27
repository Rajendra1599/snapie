import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { STARTER_LOOKS, LookDto } from '../data/starterLooks';
import { Look, OnboardingSlide, HeroConfig } from '../models';
import { S3CloudFrontStorageService } from '../services/storage/S3CloudFrontStorageService';
import { env } from '../config/env';
import { saveCustomLook, deleteCustomLook } from '../data/customLooksStorage';
import {
  loadOnboardingSlides,
  saveOnboardingSlide,
  deleteOnboardingSlide,
  OnboardingSlideDto,
} from '../data/onboardingStorage';
import {
  loadHeroConfig,
  saveHeroConfig,
  HeroConfigDto,
} from '../data/heroStorage';

export const adminRouter = Router();
const storageService = new S3CloudFrontStorageService();

// Local uploads directory fallback if AWS S3 credentials are not yet configured
const uploadsDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Uploads an image either to AWS S3 (if valid credentials present) or locally as fallback.
 * Returns full absolute URL so both Chrome and Flutter client can load it without failing.
 */
async function uploadAdminMedia(req: Request, fileBase64: string, filename: string): Promise<string> {
  const matches = fileBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(fileBase64, 'base64');
  const contentType = matches ? matches[1] : 'image/jpeg';
  const key = `uploads/${Date.now()}_${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  const isRealAwsConfigured =
    Boolean(env.AWS_ACCESS_KEY_ID) &&
    !env.AWS_ACCESS_KEY_ID.startsWith('mock') &&
    Boolean(env.AWS_SECRET_ACCESS_KEY) &&
    !env.AWS_SECRET_ACCESS_KEY.startsWith('mock');

  if (isRealAwsConfigured) {
    try {
      const cdnUrl = await storageService.uploadBuffer(key, buffer, contentType);
      return cdnUrl;
    } catch (err) {
      console.warn('[Admin AWS Upload Warning]: S3 upload failed, using local storage fallback', err);
    }
  }

  // Instant local storage with portable relative path
  const localFilename = path.basename(key);
  const localFilePath = path.join(uploadsDir, localFilename);
  fs.writeFileSync(localFilePath, buffer);
  return `/uploads/${localFilename}`;
}

export function resolveMediaUrl(baseUrl: string, url?: string): string {
  if (!url) return '';
  if (url.includes('/uploads/')) {
    const idx = url.indexOf('/uploads/');
    let secureBase = baseUrl;
    if (secureBase.includes('onrender.com') || secureBase.includes('render.com')) {
      secureBase = secureBase.replace(/^http:/, 'https:');
    }
    return `${secureBase}${url.substring(idx)}`;
  }
  if (url.startsWith('http://') && (url.includes('onrender.com') || url.includes('render.com'))) {
    return url.replace(/^http:/, 'https:');
  }
  return url;
}

function getRequestBaseUrl(req: Request): string {
  const host = req.get('host') || 'localhost:4000';
  const proto = req.get('x-forwarded-proto') || (host.includes('onrender.com') ? 'https' : req.protocol);
  return `${proto}://${host}`;
}

/**
 * Helper to ensure look preview URLs are always fully qualified
 */
function normalizeLookUrls(req: Request, looks: LookDto[]): LookDto[] {
  const baseUrl = getRequestBaseUrl(req);
  return looks.map((look) => ({
    ...look,
    preview: {
      ...look.preview,
      before_url: resolveMediaUrl(baseUrl, look.preview.before_url),
      after_url: resolveMediaUrl(baseUrl, look.preview.after_url),
      thumbnail_url: resolveMediaUrl(baseUrl, look.preview.thumbnail_url),
    },
  }));
}

function normalizeOnboardingUrls(req: Request, slides: OnboardingSlideDto[]): OnboardingSlideDto[] {
  const baseUrl = getRequestBaseUrl(req);
  return slides.map((slide) => ({
    ...slide,
    before_url: resolveMediaUrl(baseUrl, slide.before_url),
    after_url: resolveMediaUrl(baseUrl, slide.after_url),
  }));
}

function normalizeHeroUrls(req: Request, hero: HeroConfigDto): HeroConfigDto {
  const baseUrl = getRequestBaseUrl(req);
  return {
    ...hero,
    picture1_url: resolveMediaUrl(baseUrl, hero.picture1_url),
    picture2_url: resolveMediaUrl(baseUrl, hero.picture2_url),
  };
}

// POST /api/v1/admin/login - Admin Authentication
adminRouter.post('/admin/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'password123';

  if (username === adminUser && password === adminPass) {
    return res.status(200).json({
      success: true,
      token: 'boothie_admin_secret_token_2026',
      message: 'Admin access granted',
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Incorrect username or password. Please try again.',
  });
});

// ==================== LOOKS & FILTERS ====================
// GET /api/v1/admin/looks - List all looks for admin
adminRouter.get('/admin/looks', async (req: Request, res: Response) => {
  try {
    let results: LookDto[] = [...STARTER_LOOKS];

    if (mongoose.connection.readyState === 1) {
      try {
        const dbLooks = await Look.find().sort({ order: 1 }).lean();
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
        console.warn('[Admin Looks] DB query warning:', dbErr);
      }
    }

    const formatted = normalizeLookUrls(req, results);
    res.status(200).json({
      success: true,
      data: formatted,
      count: formatted.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/admin/looks - Create or Update Effect / Template
adminRouter.post('/admin/looks', async (req: Request, res: Response) => {
  try {
    const {
      id: lookId,
      name,
      kind,
      description,
      promptTemplate,
      negativePrompt,
      tier = 'free',
      creditCost,
      beforeImageBase64,
      afterImageBase64,
      beforeUrl,
      afterUrl,
    } = req.body;

    if (!name || !kind) {
      return res.status(400).json({ success: false, error: 'Name and category are required' });
    }

    const id = lookId || (name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + randomUUID().substring(0, 4));

    // If updating, find existing look to preserve urls if no new image was selected
    const existingLooks = STARTER_LOOKS.find((l) => l.id === id);
    let finalAfterUrl = afterUrl || existingLooks?.preview.after_url || '';
    let finalBeforeUrl = beforeUrl || existingLooks?.preview.before_url || '';

    if (afterImageBase64) {
      finalAfterUrl = await uploadAdminMedia(req, afterImageBase64, `${name}_after.jpg`);
    }

    if (beforeImageBase64) {
      finalBeforeUrl = await uploadAdminMedia(req, beforeImageBase64, `${name}_before.jpg`);
    } else if (!finalBeforeUrl && finalAfterUrl) {
      finalBeforeUrl = finalAfterUrl;
    }

    if (!finalAfterUrl) {
      finalAfterUrl = 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&q=80';
    }
    if (!finalBeforeUrl) {
      finalBeforeUrl = finalAfterUrl;
    }

    const assignedTier = (tier === 'gold' || tier === 'plus') ? tier : 'free';
    const computedCreditCost = creditCost !== undefined ? Number(creditCost) : (assignedTier === 'gold' ? 2 : (assignedTier === 'plus' ? 1 : 0));

    const newLook: LookDto = {
      id,
      name: name.toUpperCase().trim(),
      kind: kind === 'template' ? 'template' : 'effect',
      description: description || 'Creative look curated by admin.',
      tier: assignedTier,
      credit_cost: computedCreditCost,
      order: existingLooks?.order ?? -Date.now(),
      active: true,
      pipeline_a: existingLooks?.pipeline_a ?? {
        grain: 0.25,
        vignette: 0.2,
        split_tone: { shadow: '#1F2A38', highlight: '#FFE8C8' },
        contrast: 1.15,
        halation: 0.15,
        flash_falloff: 0.3,
        white_balance: 5500,
        filter_strength_default: 80,
      },
      pipeline_b: {
        prompt_template: promptTemplate || `${name} aesthetic photography, editorial flash lighting`,
        default_strength: 80,
        negative_prompt: negativePrompt || 'blurry, cartoon, 3d, distorted',
      },
      preview: {
        before_url: finalBeforeUrl,
        after_url: finalAfterUrl,
        thumbnail_url: finalAfterUrl,
      },
    };

    saveCustomLook(newLook);

    if (mongoose.connection.readyState === 1) {
      await Look.findOneAndUpdate(
        { $or: [{ id }, { lookId: id }] },
        {
          ...newLook,
          id,
          lookId: id,
          creditCost: computedCreditCost,
          pipelineA: newLook.pipeline_a,
          pipelineB: newLook.pipeline_b,
          preview: {
            beforeUrl: finalBeforeUrl,
            afterUrl: finalAfterUrl,
            thumbnailUrl: finalAfterUrl,
          },
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    res.status(201).json({
      success: true,
      data: newLook,
      message: lookId ? 'Look updated successfully' : 'Look created and saved successfully',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to create look' });
  }
});

// DELETE /api/v1/admin/looks/:id
adminRouter.delete('/admin/looks/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  deleteCustomLook(id);

  if (mongoose.connection.readyState === 1) {
    await Look.deleteOne({ $or: [{ id }, { lookId: id }] });
  }

  res.status(200).json({ success: true, message: 'Look removed from catalog' });
});

// ==================== ONBOARDING (APP OPEN 3 IMAGES) ====================
// GET /api/v1/onboarding & /api/v1/admin/onboarding
adminRouter.get(['/onboarding', '/admin/onboarding'], async (req: Request, res: Response) => {
  try {
    let slides: OnboardingSlideDto[] = [];
    if (mongoose.connection.readyState === 1) {
      try {
        const dbSlides = await OnboardingSlide.find().sort({ order: 1 }).lean();
        if (dbSlides.length > 0) {
          slides = dbSlides.map((s) => ({
            id: s.id,
            title: s.title,
            subtitle: s.subtitle,
            before_url: s.before_url,
            after_url: s.after_url,
            filter: s.filter || [],
            order: s.order,
          }));
        }
      } catch (dbErr) {
        console.warn('[Onboarding] DB fetch warning:', dbErr);
      }
    }
    if (slides.length === 0) {
      slides = loadOnboardingSlides();
    }
    const formatted = normalizeOnboardingUrls(req, slides);
    res.status(200).json({
      success: true,
      data: formatted,
      count: formatted.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/admin/onboarding - Add / Update App Open Onboarding Slide
adminRouter.post('/admin/onboarding', async (req: Request, res: Response) => {
  try {
    const { title, subtitle, beforeImageBase64, afterImageBase64, beforeUrl, afterUrl, order = 1 } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    let finalBeforeUrl = beforeUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80';
    let finalAfterUrl = afterUrl || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80';

    if (beforeImageBase64) {
      finalBeforeUrl = await uploadAdminMedia(req, beforeImageBase64, `onboarding_${Date.now()}_before.jpg`);
    }
    if (afterImageBase64) {
      finalAfterUrl = await uploadAdminMedia(req, afterImageBase64, `onboarding_${Date.now()}_after.jpg`);
    } else if (beforeImageBase64 && !afterImageBase64) {
      finalAfterUrl = finalBeforeUrl;
    }

    const id = `slide_${Date.now()}_${randomUUID().substring(0, 4)}`;
    const newSlide: OnboardingSlideDto = {
      id,
      title,
      subtitle: subtitle || '',
      before_url: finalBeforeUrl,
      after_url: finalAfterUrl,
      filter: [
        1.15, 0.0, 0.0, 0.0, 18.0,
        0.0, 1.08, 0.0, 0.0, 10.0,
        -0.05, 0.0, 0.95, 0.0, -8.0,
        0.0, 0.0, 0.0, 1.0, 0.0,
      ],
      order: Number(order) || 1,
    };

    saveOnboardingSlide(newSlide);
    if (mongoose.connection.readyState === 1) {
      await OnboardingSlide.findOneAndUpdate({ id }, newSlide, { upsert: true });
    }

    res.status(201).json({
      success: true,
      data: newSlide,
      message: 'Onboarding slide saved successfully',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to save onboarding slide' });
  }
});

// DELETE /api/v1/admin/onboarding/:id
adminRouter.delete('/admin/onboarding/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  deleteOnboardingSlide(id);
  if (mongoose.connection.readyState === 1) {
    await OnboardingSlide.deleteOne({ id });
  }
  res.status(200).json({ success: true, message: 'Onboarding slide removed' });
});

// ==================== HERO POLAROIDS (FILTERS PAGE 2 PHOTOS) ====================
// GET /api/v1/hero & /api/v1/admin/hero
adminRouter.get(['/hero', '/admin/hero'], async (req: Request, res: Response) => {
  try {
    let config: HeroConfigDto | null = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const dbHero = await HeroConfig.findOne({ key: 'default' }).lean();
        if (dbHero) {
          config = {
            picture1_url: dbHero.picture1_url,
            picture2_url: dbHero.picture2_url,
            title: dbHero.title,
            subtitle: dbHero.subtitle,
            button_text: dbHero.button_text,
          };
        }
      } catch (dbErr) {
        console.warn('[Hero] DB fetch warning:', dbErr);
      }
    }
    if (!config) {
      config = loadHeroConfig();
    }
    const formatted = normalizeHeroUrls(req, config);
    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/admin/hero - Update Hero Polaroids & Text
adminRouter.post(['/admin/hero', '/hero'], async (req: Request, res: Response) => {
  try {
    const { picture1Base64, picture2Base64, picture1Url, picture2Url, title, subtitle, button_text } = req.body;
    const current = loadHeroConfig();
    let finalPic1 = picture1Url || current.picture1_url;
    let finalPic2 = picture2Url || current.picture2_url;

    if (picture1Base64) {
      finalPic1 = await uploadAdminMedia(req, picture1Base64, `hero_pic1_${Date.now()}.jpg`);
    }
    if (picture2Base64) {
      finalPic2 = await uploadAdminMedia(req, picture2Base64, `hero_pic2_${Date.now()}.jpg`);
    }

    const updated = saveHeroConfig({
      picture1_url: finalPic1,
      picture2_url: finalPic2,
      title: title !== undefined ? title : current.title,
      subtitle: subtitle !== undefined ? subtitle : current.subtitle,
      button_text: button_text !== undefined ? button_text : current.button_text,
    });

    if (mongoose.connection.readyState === 1) {
      await HeroConfig.findOneAndUpdate(
        { key: 'default' },
        { ...updated, key: 'default' },
        { upsert: true }
      );
    }

    res.status(200).json({
      success: true,
      data: normalizeHeroUrls(req, updated),
      message: 'Filter hero pictures updated successfully!',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to update hero pictures' });
  }
});

// ==================== ADMIN WEB DASHBOARD ====================
adminRouter.get(['/admin', '/admin/'], (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Snapie Admin Panel | Media & Filters Management</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #F7F1E8;
      --card-bg: #FFFFFF;
      --dark-pill: #1A1715;
      --accent-pink: #D6336C;
      --border: #E5DDD0;
      --text-primary: #1A1715;
      --text-muted: #756D65;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text-primary);
      font-family: 'Plus Jakarta Sans', sans-serif;
      padding: 32px 24px;
      line-height: 1.5;
    }

    #loginModal {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(26, 23, 21, 0.85);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }
    .login-box {
      background: #FFFFFF;
      border-radius: 24px;
      padding: 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      text-align: center;
    }
    .login-logo {
      font-family: 'Playfair Display', serif;
      font-size: 32px;
      font-style: italic;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .login-logo span { color: var(--accent-pink); }
    .login-subtitle {
      color: var(--text-muted);
      font-size: 14px;
      margin-bottom: 24px;
    }
    .login-group {
      text-align: left;
      margin-bottom: 16px;
    }
    .login-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .login-btn {
      width: 100%;
      padding: 14px;
      background: var(--dark-pill);
      color: var(--bg);
      border: none;
      border-radius: 24px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 10px;
      transition: opacity 0.2s;
    }
    .login-btn:hover { opacity: 0.9; }
    .login-err {
      color: #D32F2F;
      font-size: 13px;
      margin-top: 12px;
      display: none;
    }

    .header {
      max-width: 1240px;
      margin: 0 auto 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }
    .logo {
      font-family: 'Playfair Display', serif;
      font-size: 32px;
      font-weight: 700;
      font-style: italic;
    }
    .logo span { color: var(--accent-pink); }
    .badge {
      background: var(--dark-pill);
      color: var(--bg);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
    }
    .logout-btn {
      background: #EFE8DD;
      border: none;
      padding: 6px 14px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      margin-left: 10px;
    }

    /* Tab Navigation */
    .tabs-nav {
      max-width: 1240px;
      margin: 0 auto 24px;
      display: flex;
      gap: 12px;
    }
    .tab-btn {
      padding: 12px 24px;
      border-radius: 16px;
      border: 1px solid var(--border);
      background: #FFFFFF;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tab-btn.active {
      background: var(--dark-pill);
      color: #FFFFFF;
      border-color: var(--dark-pill);
    }

    .container {
      max-width: 1240px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 440px 1fr;
      gap: 28px;
    }
    @media (max-width: 900px) {
      .container { grid-template-columns: 1fr; }
    }
    .panel {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.03);
    }
    h2 {
      font-family: 'Playfair Display', serif;
      font-size: 22px;
      margin-bottom: 16px;
    }
    .form-group {
      margin-bottom: 14px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    input, select, textarea {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      font-family: inherit;
      font-size: 14px;
      background: #FAF8F5;
      outline: none;
      transition: border 0.2s;
    }
    input:focus, select:focus, textarea:focus {
      border-color: var(--dark-pill);
      background: #FFF;
    }
    .file-dropzone {
      border: 2px dashed #D5CAB8;
      border-radius: 14px;
      padding: 16px;
      text-align: center;
      background: #FAF8F5;
      cursor: pointer;
      position: relative;
      margin-top: 6px;
      transition: background 0.2s, border-color 0.2s;
    }
    .file-dropzone.dragover {
      background: #EFE8DD;
      border-color: var(--dark-pill);
    }
    .file-dropzone input[type="file"] {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      opacity: 0;
      cursor: pointer;
    }
    .preview-thumb {
      max-height: 120px;
      max-width: 100%;
      margin: 10px auto 0;
      border-radius: 10px;
      display: none;
      object-fit: cover;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    button.submit-btn {
      width: 100%;
      padding: 14px;
      background: var(--dark-pill);
      color: var(--bg);
      border: none;
      border-radius: 24px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 14px;
      transition: opacity 0.2s;
    }
    button.submit-btn:hover { opacity: 0.9; }

    .catalog-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 16px;
      margin-top: 16px;
      max-height: 650px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .card {
      background: #FAF8F5;
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .card-img-wrap {
      width: 100%;
      height: 160px;
      background: #EFE8DD;
      display: flex;
      position: relative;
      overflow: hidden;
    }
    .card-img-split {
      width: 50%;
      height: 100%;
      object-fit: cover;
    }
    .card-img-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .card-type-tag {
      position: absolute;
      top: 8px;
      left: 8px;
      background: rgba(26, 23, 21, 0.85);
      color: #FFF;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      text-transform: uppercase;
    }
    .card-content {
      padding: 12px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .card-title {
      font-weight: 700;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .card-desc {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 12px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .delete-btn {
      background: #FFECEC;
      color: #D32F2F;
      border: 1px solid #FFCDD2;
      padding: 6px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      transition: background 0.2s;
    }
    .delete-btn:hover { background: #FFDADA; }

    .tab-content { display: none; }
    .tab-content.active { display: block; }

    /* Polaroid Hero Mockup Preview in Admin */
    .mockup-preview-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #F7F1E8;
      border-radius: 28px;
      padding: 32px 20px;
      border: 1px solid var(--border);
      box-shadow: inset 0 2px 10px rgba(0,0,0,0.03);
      text-align: center;
      position: relative;
      min-height: 520px;
    }
    .mockup-header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding: 0 10px;
      position: relative;
    }
    .mockup-logo {
      font-family: 'Playfair Display', serif;
      font-size: 26px;
      font-style: italic;
      font-weight: 700;
      color: #1A1715;
      margin: 0 auto;
    }
    .mockup-logo span { color: #D6336C; }
    .mockup-gear {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #EDE6DA;
      display: flex;
      align-items: center;
      justify-content: center;
      position: absolute;
      right: 10px;
      top: -2px;
      font-size: 18px;
    }
    .polaroid-stack {
      position: relative;
      width: 270px;
      height: 220px;
      margin: 0 auto 28px;
    }
    .polaroid-frame {
      position: absolute;
      background: #FFFFFF;
      border-radius: 10px;
      padding: 8px 8px 24px 8px;
      box-shadow: 0 10px 24px rgba(0,0,0,0.14);
      width: 155px;
      height: 195px;
      transition: transform 0.3s;
    }
    .polaroid-frame img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 4px;
    }
    .polaroid-1 {
      left: 10px;
      top: 10px;
      transform: rotate(-8deg);
      z-index: 1;
    }
    .polaroid-2 {
      right: 10px;
      top: 0px;
      transform: rotate(6deg);
      z-index: 2;
      box-shadow: 0 14px 28px rgba(0,0,0,0.18);
    }
    .mockup-title {
      font-family: 'Playfair Display', serif;
      font-size: 34px;
      font-style: italic;
      font-weight: 700;
      line-height: 1.15;
      color: #1A1715;
      margin-bottom: 10px;
      white-space: pre-line;
    }
    .mockup-subtitle {
      font-size: 13px;
      color: #756D65;
      max-width: 280px;
      margin: 0 auto 24px;
    }
    .mockup-cta {
      background: #1A1715;
      color: #FAF4EC;
      border: none;
      border-radius: 26px;
      padding: 14px 28px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.8px;
      width: 90%;
      max-width: 320px;
    }
  </style>
</head>
<body>

  <!-- Password Authentication Modal -->
  <div id="loginModal">
    <div class="login-box">
      <div class="login-logo">snapie<span>.</span> admin</div>
      <div class="login-subtitle">Enter admin credentials to unlock dashboard</div>
      <form id="loginForm" autocomplete="off">
        <div class="login-group">
          <label>Username</label>
          <input type="text" id="adminUser" placeholder="Enter username" autocomplete="off" required />
        </div>
        <div class="login-group">
          <label>Password</label>
          <input type="password" id="adminPass" placeholder="Enter password" autocomplete="new-password" required />
        </div>
        <button type="submit" class="login-btn">Unlock Admin Panel</button>
        <div class="login-err" id="loginErr">Incorrect username or password.</div>
      </form>
    </div>
  </div>

  <div class="header">
    <div class="logo">snapie<span>.</span> admin</div>
    <div style="display:flex; align-items:center;">
      <div class="badge">Google Play & Media Cloud &bull; Live</div>
      <button class="logout-btn" onclick="logoutAdmin()">Lock / Logout</button>
    </div>
  </div>

  <!-- Tabs Navigation -->
  <div class="tabs-nav">
    <button class="tab-btn active" id="tabLooksBtn" onclick="switchTab('looks')">
      🎨 Filters & Templates (Effects)
    </button>
    <button class="tab-btn" id="tabOnboardingBtn" onclick="switchTab('onboarding')">
      📱 App Open (First 3 Images) Onboarding
    </button>
    <button class="tab-btn" id="tabHeroBtn" onclick="switchTab('hero')">
      🖼️ Filter Page (2 Polaroid Photos)
    </button>
  </div>

  <!-- SECTION 1: FILTERS & TEMPLATES -->
  <div id="looksSection" class="tab-content active">
    <div class="container">
      <div class="panel">
        <h2>Add New Filter / Effect / Template</h2>
        <form id="uploadForm">
          <div class="form-group">
            <label>Filter Name</label>
            <input type="text" id="name" placeholder="e.g. VINTAGE GLOW" required />
          </div>

          <div class="form-group">
            <label>Category Type</label>
            <select id="kind" onchange="handleKindChange()">
              <option value="effect">Effect (Color, Lighting & Analog Restyle)</option>
              <option value="template">Template (Complete Scene Restyle)</option>
            </select>
          </div>

          <div class="form-group">
            <label>Access Tier</label>
            <select id="tier">
              <option value="free">Free (0 Credits)</option>
              <option value="plus">Plus (1 Credit)</option>
              <option value="gold">Gold VIP (2 Credits)</option>
            </select>
          </div>

          <div class="form-group">
            <label>Description</label>
            <input type="text" id="description" placeholder="e.g. Warm analog glow with high contrast." required />
          </div>

          <div class="form-group">
            <label>AI Prompt Template</label>
            <textarea id="promptTemplate" rows="3" placeholder="e.g. Editorial portrait with direct on-camera flash, sharp contrast, glossy skin."></textarea>
          </div>

          <div class="form-group">
            <label id="beforeLabel">Before Image (Original Photo)</label>
            <div class="file-dropzone" id="beforeDropzone">
              <span id="beforeText">Choose or drop Before Image</span>
              <input type="file" id="beforeFile" accept="image/*" />
              <img id="beforePreview" class="preview-thumb" />
            </div>
            <div style="margin-top:6px;">
              <input type="url" id="beforeUrlInput" placeholder="... or paste Before Image URL directly" style="font-size:12px; padding:8px 12px;" />
            </div>
          </div>

          <div class="form-group">
            <label id="afterLabel">After Image (Filter / Restyled Result)</label>
            <div class="file-dropzone" id="afterDropzone">
              <span id="afterText">Choose or drop After Image</span>
              <input type="file" id="afterFile" accept="image/*" />
              <img id="afterPreview" class="preview-thumb" />
            </div>
            <div style="margin-top:6px;">
              <input type="url" id="afterUrlInput" placeholder="... or paste After Image URL directly" style="font-size:12px; padding:8px 12px;" />
            </div>
          </div>

          <div id="formStatusMsg" style="display:none; padding:10px 14px; border-radius:12px; font-size:13px; font-weight:600; margin-top:10px;"></div>

          <input type="hidden" id="editLookId" value="" />
          <button type="submit" class="submit-btn" id="submitBtn">Upload & Sync Live to App</button>
          <button type="button" id="cancelEditBtn" onclick="cancelEditLook()" style="display:none; width:100%; padding:12px; margin-top:8px; background:#ECE4D8; border:1px solid #D5CAB8; border-radius:24px; font-weight:600; cursor:pointer;">Cancel Edit</button>
        </form>
      </div>

      <div class="panel">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h2>Active Filters & Templates (<span id="totalCount">0</span>)</h2>
          <button onclick="fetchLooks()" style="background:none; border:1px solid var(--border); padding:6px 12px; border-radius:12px; cursor:pointer;">Refresh</button>
        </div>
        <div class="catalog-grid" id="catalogGrid"></div>
      </div>
    </div>
  </div>

  <!-- SECTION 2: APP OPEN (FIRST 3 IMAGES) ONBOARDING -->
  <div id="onboardingSection" class="tab-content">
    <div class="container">
      <div class="panel">
        <h2>Add / Update App Open Slide</h2>
        <form id="onboardingForm">
          <div class="form-group">
            <label>Title Headline</label>
            <input type="text" id="onboardingTitle" placeholder="e.g. welcome to snapie." required />
          </div>

          <div class="form-group">
            <label>Subtitle Description</label>
            <input type="text" id="onboardingSubtitle" placeholder="e.g. give your photos an instant glow-up 🤍" required />
          </div>

          <div class="form-group">
            <label>Slide Order (1 = First Image, 2 = Second, 3 = Third)</label>
            <input type="number" id="onboardingOrder" value="1" min="1" max="10" required />
          </div>

          <div class="form-group">
            <label>Before Image (Left Side of Slider)</label>
            <div class="file-dropzone" id="obBeforeDropzone">
              <span id="obBeforeText">Choose or drop Before Image</span>
              <input type="file" id="obBeforeFile" accept="image/*" />
              <img id="obBeforePreview" class="preview-thumb" />
            </div>
          </div>

          <div class="form-group">
            <label>After Image (Right Side of Slider)</label>
            <div class="file-dropzone" id="obAfterDropzone">
              <span id="obAfterText">Choose or drop After Image</span>
              <input type="file" id="obAfterFile" accept="image/*" />
              <img id="obAfterPreview" class="preview-thumb" />
            </div>
          </div>

          <button type="submit" class="submit-btn" id="obSubmitBtn">Save Onboarding Slide</button>
        </form>
      </div>

      <div class="panel">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h2>App Open Slides (<span id="obCount">0</span>)</h2>
          <button onclick="fetchOnboarding()" style="background:none; border:1px solid var(--border); padding:6px 12px; border-radius:12px; cursor:pointer;">Refresh</button>
        </div>
        <div class="catalog-grid" id="onboardingGrid"></div>
      </div>
    </div>
  </div>

  <!-- SECTION 3: FILTER PAGE POLAROIDS (HERO) -->
  <div id="heroSection" class="tab-content">
    <div class="container">
      <div class="panel">
        <h2>Set Filter Page Photos & Text</h2>
        <p style="color:var(--text-muted); font-size:13px; margin-bottom:18px;">
          Set the 2 Polaroid pictures displayed on the mobile app's main Filters screen.
        </p>
        <form id="heroForm">
          <div class="form-group">
            <label>Picture 1 (Left Tilted Polaroid - Back)</label>
            <div class="file-dropzone" id="heroPic1Dropzone">
              <span id="heroPic1Text">Choose or drop Left Photo</span>
              <input type="file" id="heroPic1File" accept="image/*" />
              <img id="heroPic1Preview" class="preview-thumb" />
            </div>
          </div>

          <div class="form-group">
            <label>Picture 2 (Right Tilted Polaroid - Front)</label>
            <div class="file-dropzone" id="heroPic2Dropzone">
              <span id="heroPic2Text">Choose or drop Right Photo</span>
              <input type="file" id="heroPic2File" accept="image/*" />
              <img id="heroPic2Preview" class="preview-thumb" />
            </div>
          </div>

          <div class="form-group">
            <label>Headline (supports newlines)</label>
            <textarea id="heroTitle" rows="2">aesthetic&#10;filters</textarea>
          </div>

          <div class="form-group">
            <label>Subtitle Description</label>
            <input type="text" id="heroSubtitle" value="Film looks and pro adjustments, free on any photo." />
          </div>

          <div class="form-group">
            <label>Button Label</label>
            <input type="text" id="heroButtonText" value="SELECT A PHOTO" />
          </div>

          <button type="submit" class="submit-btn" id="heroSubmitBtn">Save & Sync Live to App</button>
        </form>
      </div>

      <div class="panel">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h2>Mobile App Live Preview</h2>
          <span style="font-size:12px; color:var(--text-muted);">Exact App View</span>
        </div>
        <div class="mockup-preview-container">
          <div class="mockup-header">
            <div class="mockup-logo">snapie<span>.</span></div>
            <div class="mockup-gear">⚙️</div>
          </div>
          <div class="polaroid-stack">
            <div class="polaroid-frame polaroid-1">
              <img id="mockupImg1" src="" alt="Left Polaroid" />
            </div>
            <div class="polaroid-frame polaroid-2">
              <img id="mockupImg2" src="" alt="Right Polaroid" />
            </div>
          </div>
          <div class="mockup-title" id="mockupTitle">aesthetic<br>filters</div>
          <div class="mockup-subtitle" id="mockupSubtitle">Film looks and pro adjustments, free on any photo.</div>
          <button type="button" class="mockup-cta" id="mockupBtn">SELECT A PHOTO</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    function checkAuth() {
      const token = localStorage.getItem('boothie_admin_token');
      if (token === 'boothie_admin_secret_token_2026') {
        document.getElementById('loginModal').style.display = 'none';
        fetchLooks();
        fetchOnboarding();
      } else {
        document.getElementById('loginModal').style.display = 'flex';
      }
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('adminUser').value;
      const p = document.getElementById('adminPass').value;
      const err = document.getElementById('loginErr');
      err.style.display = 'none';

      try {
        const res = await fetch('/api/v1/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p }),
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem('boothie_admin_token', data.token);
          document.getElementById('loginModal').style.display = 'none';
          fetchLooks();
          fetchOnboarding();
        } else {
          err.innerText = data.error || 'Invalid credentials';
          err.style.display = 'block';
        }
      } catch (e) {
        err.innerText = 'Login error. Check backend connection.';
        err.style.display = 'block';
      }
    });

    function logoutAdmin() {
      localStorage.removeItem('boothie_admin_token');
      document.getElementById('loginModal').style.display = 'flex';
    }

    function switchTab(tab) {
      document.getElementById('looksSection').classList.remove('active');
      document.getElementById('onboardingSection').classList.remove('active');
      document.getElementById('heroSection').classList.remove('active');
      document.getElementById('tabLooksBtn').classList.remove('active');
      document.getElementById('tabOnboardingBtn').classList.remove('active');
      document.getElementById('tabHeroBtn').classList.remove('active');

      if (tab === 'looks') {
        document.getElementById('looksSection').classList.add('active');
        document.getElementById('tabLooksBtn').classList.add('active');
        fetchLooks();
      } else if (tab === 'onboarding') {
        document.getElementById('onboardingSection').classList.add('active');
        document.getElementById('tabOnboardingBtn').classList.add('active');
        fetchOnboarding();
      } else if (tab === 'hero') {
        document.getElementById('heroSection').classList.add('active');
        document.getElementById('tabHeroBtn').classList.add('active');
        fetchHero();
      }
    }

    function handleKindChange() {
      const kind = document.getElementById('kind').value;
      const beforeLabel = document.getElementById('beforeLabel');
      const afterLabel = document.getElementById('afterLabel');
      if (kind === 'template') {
        beforeLabel.innerText = 'Optional Before Image (for comparison)';
        afterLabel.innerText = 'Template Preview Image (Required)';
      } else {
        beforeLabel.innerText = 'Before Image (Original Photo)';
        afterLabel.innerText = 'After Image (Filter / Restyled Result)';
      }
    }

    function compressImageFile(file, maxWidth, quality, callback) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            let w = img.width;
            let h = img.height;
            if (w > maxWidth) {
              h = Math.round((h * maxWidth) / w);
              w = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/jpeg', quality);
            callback(compressed);
          } catch (cErr) {
            callback(e.target.result);
          }
        };
        img.onerror = () => {
          callback(e.target.result);
        };
        img.src = e.target.result;
      };
      reader.onerror = () => {
        alert('Could not read image file. Please try another image.');
      };
      reader.readAsDataURL(file);
    }

    function setupDropzone(dropzoneId, inputId, textId, previewId, onLoaded) {
      const dropzone = document.getElementById(dropzoneId);
      const input = document.getElementById(inputId);
      const text = document.getElementById(textId);
      const preview = document.getElementById(previewId);

      function processFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        text.innerText = file.name;
        compressImageFile(file, 1200, 0.85, (b64) => {
          preview.src = b64;
          preview.style.display = 'block';
          onLoaded(b64);
        });
      }

      input.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          processFile(e.target.files[0]);
        }
      });

      ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          input.files = e.dataTransfer.files;
          processFile(e.dataTransfer.files[0]);
        }
      });
    }

    function showStatusMsg(text, isError = false, isLoading = false) {
      const msg = document.getElementById('formStatusMsg');
      if (!msg) return;
      msg.style.display = 'block';
      msg.innerText = text;
      if (isLoading) {
        msg.style.background = '#E8F0FE';
        msg.style.color = '#1A73E8';
        msg.style.border = '1px solid #C2E7FF';
      } else if (isError) {
        msg.style.background = '#FDE8E8';
        msg.style.color = '#D32F2F';
        msg.style.border = '1px solid #F8B4B4';
      } else {
        msg.style.background = '#DEF7EC';
        msg.style.color = '#0E9F6E';
        msg.style.border = '1px solid #BCF0DA';
      }
    }
    function hideStatusMsg() {
      const msg = document.getElementById('formStatusMsg');
      if (msg) msg.style.display = 'none';
    }

    // Looks form files
    let beforeBase64 = null;
    let afterBase64 = null;
    let existingBeforeUrl = null;
    let existingAfterUrl = null;
    let allLoadedLooks = [];

    setupDropzone('beforeDropzone', 'beforeFile', 'beforeText', 'beforePreview', (b64) => beforeBase64 = b64);
    setupDropzone('afterDropzone', 'afterFile', 'afterText', 'afterPreview', (b64) => afterBase64 = b64);

    function editLook(id) {
      const item = allLoadedLooks.find(l => l.id === id);
      if (!item) return;
      document.getElementById('editLookId').value = item.id;
      document.getElementById('name').value = item.name;
      document.getElementById('kind').value = item.kind;
      document.getElementById('tier').value = item.tier || 'free';
      document.getElementById('description').value = item.description;
      document.getElementById('promptTemplate').value = item.pipeline_b ? (item.pipeline_b.prompt_template || '') : '';
      handleKindChange();

      existingBeforeUrl = item.preview ? (item.preview.before_url || '') : '';
      existingAfterUrl = item.preview ? (item.preview.after_url || '') : '';

      const beforeUrlEl = document.getElementById('beforeUrlInput');
      const afterUrlEl = document.getElementById('afterUrlInput');
      if (beforeUrlEl) beforeUrlEl.value = existingBeforeUrl;
      if (afterUrlEl) afterUrlEl.value = existingAfterUrl;

      if (existingBeforeUrl) {
        document.getElementById('beforePreview').src = existingBeforeUrl;
        document.getElementById('beforePreview').style.display = 'block';
        document.getElementById('beforeText').innerText = 'Current Before Image (click to replace)';
      } else {
        document.getElementById('beforePreview').style.display = 'none';
        document.getElementById('beforeText').innerText = 'Choose or drop Before Image';
      }

      if (existingAfterUrl) {
        document.getElementById('afterPreview').src = existingAfterUrl;
        document.getElementById('afterPreview').style.display = 'block';
        document.getElementById('afterText').innerText = 'Current After Image (click to replace)';
      } else {
        document.getElementById('afterPreview').style.display = 'none';
        document.getElementById('afterText').innerText = 'Choose or drop After Image';
      }

      document.getElementById('submitBtn').innerText = 'Update Filter / Template & Sync Live';
      document.getElementById('cancelEditBtn').style.display = 'block';
      hideStatusMsg();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function cancelEditLook() {
      document.getElementById('uploadForm').reset();
      document.getElementById('editLookId').value = '';
      document.getElementById('tier').value = 'free';
      document.getElementById('beforePreview').style.display = 'none';
      document.getElementById('afterPreview').style.display = 'none';
      document.getElementById('beforeText').innerText = 'Choose or drop Before Image';
      document.getElementById('afterText').innerText = 'Choose or drop After Image';
      const beforeUrlEl = document.getElementById('beforeUrlInput');
      const afterUrlEl = document.getElementById('afterUrlInput');
      if (beforeUrlEl) beforeUrlEl.value = '';
      if (afterUrlEl) afterUrlEl.value = '';
      document.getElementById('submitBtn').innerText = 'Upload & Sync Live to App';
      document.getElementById('cancelEditBtn').style.display = 'none';
      hideStatusMsg();
      beforeBase64 = null;
      afterBase64 = null;
      existingBeforeUrl = null;
      existingAfterUrl = null;
    }

    document.getElementById('uploadForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      const isEditing = !!document.getElementById('editLookId').value;
      const inputAfterUrl = (document.getElementById('afterUrlInput')?.value || '').trim();
      const inputBeforeUrl = (document.getElementById('beforeUrlInput')?.value || '').trim();
      const targetAfterUrl = inputAfterUrl || existingAfterUrl;
      const targetBeforeUrl = inputBeforeUrl || existingBeforeUrl;

      if (!afterBase64 && !targetAfterUrl) {
        showStatusMsg('⚠️ Please upload an After/Template preview image OR paste an image URL.', true);
        return;
      }

      btn.disabled = true;
      btn.innerText = 'Uploading & Syncing...';
      showStatusMsg('⏳ Uploading image and syncing live with Mobile App...', false, true);

      const payload = {
        id: document.getElementById('editLookId').value || undefined,
        name: document.getElementById('name').value,
        kind: document.getElementById('kind').value,
        tier: document.getElementById('tier').value || 'free',
        description: document.getElementById('description').value,
        promptTemplate: document.getElementById('promptTemplate').value,
        beforeImageBase64: beforeBase64,
        afterImageBase64: afterBase64,
        beforeUrl: targetBeforeUrl || undefined,
        afterUrl: targetAfterUrl || undefined,
      };

      try {
        const res = await fetch('/api/v1/admin/looks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          showStatusMsg(isEditing ? '✅ Filter/Template updated successfully! Live in mobile app.' : '✅ Filter/Template uploaded successfully! Live in mobile app.', false, false);
          setTimeout(() => {
            cancelEditLook();
            fetchLooks();
          }, 1000);
        } else {
          showStatusMsg('❌ Error: ' + (data.error || 'Failed to save look'), true);
        }
      } catch (err) {
        showStatusMsg('❌ Upload failed: ' + err.message, true);
      } finally {
        btn.disabled = false;
        btn.innerText = isEditing ? 'Update Filter / Template & Sync Live' : 'Upload & Sync Live to App';
      }
    });

    async function fetchLooks() {
      try {
        const res = await fetch('/api/v1/admin/looks');
        const data = await res.json();
        if (data.success) {
          allLoadedLooks = data.data;
          document.getElementById('totalCount').innerText = data.data.length;
          const grid = document.getElementById('catalogGrid');
          grid.innerHTML = data.data.map(item => {
            const hasBefore = item.preview && item.preview.before_url && item.preview.before_url !== item.preview.after_url;
            const previewAfter = (item.preview && (item.preview.after_url || item.preview.thumbnail_url)) || '';
            const previewBefore = (item.preview && item.preview.before_url) || '';
            const tierBadgeColor = item.tier === 'gold' ? '#D4AF37' : (item.tier === 'plus' ? '#7C3AED' : '#555555');
            const tierLabel = item.tier === 'gold' ? 'GOLD VIP' : (item.tier === 'plus' ? 'PLUS' : 'FREE');
            return \`
              <div class="card">
                <div class="card-img-wrap">
                  \${hasBefore ? \`
                    <img src="\${previewBefore}" class="card-img-split" title="Before" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80'" />
                    <img src="\${previewAfter}" class="card-img-split" title="After" onerror="this.src='https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&q=80'" />
                  \` : \`
                    <img src="\${previewAfter}" alt="\${item.name}" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'" />
                  \`}
                  <div style="position:absolute; top:8px; left:8px; display:flex; gap:4px;">
                    <span class="card-type-tag">\${item.kind}</span>
                    <span class="card-type-tag" style="background:\${tierBadgeColor}; color:#fff;">\${tierLabel}</span>
                  </div>
                </div>
                <div class="card-content">
                  <div>
                    <div class="card-title">\${item.name}</div>
                    <div class="card-desc">\${item.description}</div>
                  </div>
                  <div style="display:flex; gap:8px;">
                    <button class="edit-btn" onclick="editLook('\${item.id}')" style="background:var(--dark-pill); color:#fff; border:none; padding:6px 14px; border-radius:12px; font-size:12px; font-weight:600; cursor:pointer;">Edit</button>
                    <button class="delete-btn" onclick="deleteLook('\${item.id}')">Delete</button>
                  </div>
                </div>
              </div>
            \`;
          }).join('');
        }
      } catch (err) {
        console.error('Failed to load looks:', err);
      }
    }

    async function deleteLook(id) {
      if (!confirm('Remove this filter from the live app catalog?')) return;
      try {
        const res = await fetch('/api/v1/admin/looks/' + id, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          fetchLooks();
        }
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    }

    // Onboarding form files
    let obBeforeBase64 = null;
    let obAfterBase64 = null;
    setupDropzone('obBeforeDropzone', 'obBeforeFile', 'obBeforeText', 'obBeforePreview', (b64) => obBeforeBase64 = b64);
    setupDropzone('obAfterDropzone', 'obAfterFile', 'obAfterText', 'obAfterPreview', (b64) => obAfterBase64 = b64);

    document.getElementById('onboardingForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('obSubmitBtn');
      btn.disabled = true;
      btn.innerText = 'Saving Slide...';

      const payload = {
        title: document.getElementById('onboardingTitle').value,
        subtitle: document.getElementById('onboardingSubtitle').value,
        order: Number(document.getElementById('onboardingOrder').value) || 1,
        beforeImageBase64: obBeforeBase64,
        afterImageBase64: obAfterBase64,
      };

      try {
        const res = await fetch('/api/v1/admin/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          alert('Onboarding slide saved! Live on app open.');
          document.getElementById('onboardingForm').reset();
          document.getElementById('obBeforePreview').style.display = 'none';
          document.getElementById('obAfterPreview').style.display = 'none';
          document.getElementById('obBeforeText').innerText = 'Choose or drop Before Image';
          document.getElementById('obAfterText').innerText = 'Choose or drop After Image';
          obBeforeBase64 = null;
          obAfterBase64 = null;
          fetchOnboarding();
        } else {
          alert('Error: ' + data.error);
        }
      } catch (err) {
        alert('Failed to save slide: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerText = 'Save Onboarding Slide';
      }
    });

    async function fetchOnboarding() {
      try {
        const res = await fetch('/api/v1/admin/onboarding');
        const data = await res.json();
        if (data.success) {
          document.getElementById('obCount').innerText = data.data.length;
          const grid = document.getElementById('onboardingGrid');
          grid.innerHTML = data.data.map(slide => \`
            <div class="card">
              <div class="card-img-wrap">
                <img src="\${slide.before_url}" class="card-img-split" title="Before" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80'" />
                <img src="\${slide.after_url}" class="card-img-split" title="After" onerror="this.src='https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&q=80'" />
                <span class="card-type-tag">Slide #\${slide.order}</span>
              </div>
              <div class="card-content">
                <div>
                  <div class="card-title">\${slide.title}</div>
                  <div class="card-desc">\${slide.subtitle}</div>
                </div>
                <button class="delete-btn" onclick="deleteOnboarding('\${slide.id}')">Delete</button>
              </div>
            </div>
          \`).join('');
        }
      } catch (err) {
        console.error('Failed to load onboarding slides:', err);
      }
    }

    async function deleteOnboarding(id) {
      if (!confirm('Remove this slide from the app open screen?')) return;
      try {
        const res = await fetch('/api/v1/admin/onboarding/' + id, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          fetchOnboarding();
        }
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    }

    // Hero form files & live preview sync
    let heroPic1Base64 = null;
    let heroPic2Base64 = null;

    setupDropzone('heroPic1Dropzone', 'heroPic1File', 'heroPic1Text', 'heroPic1Preview', (b64) => {
      heroPic1Base64 = b64;
      document.getElementById('mockupImg1').src = b64;
    });

    setupDropzone('heroPic2Dropzone', 'heroPic2File', 'heroPic2Text', 'heroPic2Preview', (b64) => {
      heroPic2Base64 = b64;
      document.getElementById('mockupImg2').src = b64;
    });

    document.getElementById('heroTitle').addEventListener('input', (e) => {
      document.getElementById('mockupTitle').innerText = e.target.value;
    });

    document.getElementById('heroSubtitle').addEventListener('input', (e) => {
      document.getElementById('mockupSubtitle').innerText = e.target.value;
    });

    document.getElementById('heroButtonText').addEventListener('input', (e) => {
      document.getElementById('mockupBtn').innerText = e.target.value;
    });

    async function fetchHero() {
      try {
        const res = await fetch('/api/v1/hero');
        const data = await res.json();
        if (data.success && data.data) {
          const cfg = data.data;
          document.getElementById('mockupImg1').src = cfg.picture1_url;
          document.getElementById('mockupImg2').src = cfg.picture2_url;
          document.getElementById('mockupTitle').innerText = cfg.title;
          document.getElementById('mockupSubtitle').innerText = cfg.subtitle;
          document.getElementById('mockupBtn').innerText = cfg.button_text;

          document.getElementById('heroTitle').value = cfg.title;
          document.getElementById('heroSubtitle').value = cfg.subtitle;
          document.getElementById('heroButtonText').value = cfg.button_text;

          document.getElementById('heroPic1Preview').src = cfg.picture1_url;
          document.getElementById('heroPic1Preview').style.display = 'block';
          document.getElementById('heroPic2Preview').src = cfg.picture2_url;
          document.getElementById('heroPic2Preview').style.display = 'block';
        }
      } catch (err) {
        console.error('Failed to load hero configuration:', err);
      }
    }

    document.getElementById('heroForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('heroSubmitBtn');
      btn.disabled = true;
      btn.innerText = 'Saving Live to App...';

      const payload = {
        title: document.getElementById('heroTitle').value,
        subtitle: document.getElementById('heroSubtitle').value,
        button_text: document.getElementById('heroButtonText').value,
        picture1Base64: heroPic1Base64,
        picture2Base64: heroPic2Base64,
      };

      try {
        const res = await fetch('/api/v1/admin/hero', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          alert('Filter page photos & text saved successfully! App will now show updated polaroids.');
          heroPic1Base64 = null;
          heroPic2Base64 = null;
          fetchHero();
        } else {
          alert('Error: ' + data.error);
        }
      } catch (err) {
        alert('Failed to save hero pictures: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerText = 'Save & Sync Live to App';
      }
    });

    checkAuth();
    fetchHero();
  </script>
</body>
</html>`);
});
