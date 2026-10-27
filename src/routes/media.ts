import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { env } from '../config/env';

export const mediaRouter = Router();

const uploadsDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

let s3Client: S3Client | null = null;
function getS3Client(): S3Client | null {
  if (
    !s3Client &&
    env.AWS_ACCESS_KEY_ID &&
    !env.AWS_ACCESS_KEY_ID.startsWith('mock') &&
    env.AWS_SECRET_ACCESS_KEY &&
    !env.AWS_SECRET_ACCESS_KEY.startsWith('mock')
  ) {
    s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

/**
 * Serves media files from local disk if present,
 * otherwise streams directly from AWS S3 bucket and caches locally.
 */
async function handleMediaRequest(req: Request, res: Response, rawKey: string) {
  try {
    const filename = path.basename(rawKey);
    const localPath = path.join(uploadsDir, filename);

    // 1. If present on local disk, serve immediately
    if (fs.existsSync(localPath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      return res.sendFile(localPath);
    }

    // 2. Fallback to AWS S3
    const s3 = getS3Client();
    if (s3) {
      const s3Key = rawKey.startsWith('uploads/') ? rawKey : `uploads/${filename}`;
      const command = new GetObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: s3Key,
      });

      const s3Response = await s3.send(command);

      if (s3Response.ContentType) {
        res.setHeader('Content-Type', s3Response.ContentType);
      } else {
        res.setHeader('Content-Type', 'image/jpeg');
      }

      if (s3Response.ContentLength) {
        res.setHeader('Content-Length', s3Response.ContentLength);
      }
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');

      const stream = s3Response.Body as Readable;
      if (stream && typeof stream.pipe === 'function') {
        // Cache to local disk in background
        try {
          const writeStream = fs.createWriteStream(localPath);
          stream.pipe(writeStream);
        } catch (_) {}

        return stream.pipe(res);
      }
    }

    return res.status(404).send('Image not found');
  } catch (err: any) {
    console.warn(`[Media Proxy Warning] Could not fetch media for "${rawKey}":`, err.message);
    return res.status(404).send('Media not found');
  }
}

// Support /uploads/:filename
mediaRouter.get('/uploads/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename as string;
  handleMediaRequest(req, res, filename);
});

// Support /media/:filename
mediaRouter.get('/media/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename as string;
  handleMediaRequest(req, res, filename);
});
