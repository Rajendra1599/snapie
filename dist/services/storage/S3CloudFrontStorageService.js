"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3CloudFrontStorageService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const env_1 = require("../../config/env");
class S3CloudFrontStorageService {
    s3;
    bucket;
    cdnDomain;
    constructor() {
        this.s3 = new client_s3_1.S3Client({
            region: env_1.env.AWS_REGION,
            credentials: {
                accessKeyId: env_1.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env_1.env.AWS_SECRET_ACCESS_KEY,
            },
        });
        this.bucket = env_1.env.AWS_S3_BUCKET;
        this.cdnDomain = env_1.env.AWS_CLOUDFRONT_DOMAIN.replace(/\/$/, '');
    }
    async getSignedUploadUrl(key, contentType = 'image/jpeg') {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ContentType: contentType,
        });
        // 5-minute expiry per privacy & safety spec
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3, command, { expiresIn: 300 });
        return { uploadUrl, key };
    }
    async getSignedDownloadUrl(key, expiresInSeconds = 86400) {
        const cleanKey = key.replace(/^\//, '');
        const command = new client_s3_1.GetObjectCommand({
            Bucket: this.bucket,
            Key: cleanKey,
        });
        // 24-hour expiry by default so users can view & download easily
        return (0, s3_request_presigner_1.getSignedUrl)(this.s3, command, { expiresIn: expiresInSeconds });
    }
    getPublicCdnUrl(key) {
        const cleanKey = key.replace(/^\//, '');
        return `${this.cdnDomain}/${cleanKey}`;
    }
    async uploadBuffer(key, buffer, contentType = 'image/jpeg') {
        const cleanKey = key.replace(/^\//, '');
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: cleanKey,
            Body: buffer,
            ContentType: contentType,
            ContentLength: buffer.length,
        });
        await this.s3.send(command);
        return this.getPublicCdnUrl(cleanKey);
    }
    async deleteObject(key) {
        const command = new client_s3_1.DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });
        await this.s3.send(command);
    }
}
exports.S3CloudFrontStorageService = S3CloudFrontStorageService;
