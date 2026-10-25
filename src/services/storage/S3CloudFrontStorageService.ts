import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageService } from './IStorageService';
import { env } from '../../config/env';

export class S3CloudFrontStorageService implements IStorageService {
  private s3: S3Client;
  private bucket: string;
  private cdnDomain: string;

  constructor() {
    this.s3 = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
    this.bucket = env.AWS_S3_BUCKET;
    this.cdnDomain = env.AWS_CLOUDFRONT_DOMAIN.replace(/\/$/, '');
  }

  async getSignedUploadUrl(key: string, contentType: string = 'image/jpeg'): Promise<{ uploadUrl: string; key: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    // 5-minute expiry per privacy & safety spec
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    return { uploadUrl, key };
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds: number = 86400): Promise<string> {
    const cleanKey = key.replace(/^\//, '');
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
    });
    // 24-hour expiry by default so users can view & download easily
    return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
  }

  getPublicCdnUrl(key: string): string {
    const cleanKey = key.replace(/^\//, '');
    return `${this.cdnDomain}/${cleanKey}`;
  }

  async uploadBuffer(key: string, buffer: Buffer, contentType: string = 'image/jpeg'): Promise<string> {
    const cleanKey = key.replace(/^\//, '');
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
      Body: buffer,
      ContentType: contentType,
    });
    await this.s3.send(command);
    return this.getPublicCdnUrl(cleanKey);
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.s3.send(command);
  }
}
