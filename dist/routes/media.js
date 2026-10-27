"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRouter = void 0;
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const client_s3_1 = require("@aws-sdk/client-s3");
const env_1 = require("../config/env");
exports.mediaRouter = (0, express_1.Router)();
const uploadsDir = path_1.default.join(__dirname, '../../public/uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
let s3Client = null;
function getS3Client() {
    if (!s3Client &&
        env_1.env.AWS_ACCESS_KEY_ID &&
        !env_1.env.AWS_ACCESS_KEY_ID.startsWith('mock') &&
        env_1.env.AWS_SECRET_ACCESS_KEY &&
        !env_1.env.AWS_SECRET_ACCESS_KEY.startsWith('mock')) {
        s3Client = new client_s3_1.S3Client({
            region: env_1.env.AWS_REGION,
            credentials: {
                accessKeyId: env_1.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env_1.env.AWS_SECRET_ACCESS_KEY,
            },
        });
    }
    return s3Client;
}
/**
 * Serves media files from local disk if present,
 * otherwise streams directly from AWS S3 bucket and caches locally.
 */
async function handleMediaRequest(req, res, rawKey) {
    try {
        const filename = path_1.default.basename(rawKey);
        const localPath = path_1.default.join(uploadsDir, filename);
        // 1. If present on local disk, serve immediately
        if (fs_1.default.existsSync(localPath)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
            return res.sendFile(localPath);
        }
        // 2. Fallback to AWS S3
        const s3 = getS3Client();
        if (s3) {
            const s3Key = rawKey.startsWith('uploads/') ? rawKey : `uploads/${filename}`;
            const command = new client_s3_1.GetObjectCommand({
                Bucket: env_1.env.AWS_S3_BUCKET,
                Key: s3Key,
            });
            const s3Response = await s3.send(command);
            if (s3Response.ContentType) {
                res.setHeader('Content-Type', s3Response.ContentType);
            }
            else {
                res.setHeader('Content-Type', 'image/jpeg');
            }
            if (s3Response.ContentLength) {
                res.setHeader('Content-Length', s3Response.ContentLength);
            }
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
            const stream = s3Response.Body;
            if (stream && typeof stream.pipe === 'function') {
                // Cache to local disk in background
                try {
                    const writeStream = fs_1.default.createWriteStream(localPath);
                    stream.pipe(writeStream);
                }
                catch (_) { }
                return stream.pipe(res);
            }
        }
        return res.status(404).send('Image not found');
    }
    catch (err) {
        console.warn(`[Media Proxy Warning] Could not fetch media for "${rawKey}":`, err.message);
        return res.status(404).send('Media not found');
    }
}
// Support /uploads/:filename
exports.mediaRouter.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    handleMediaRequest(req, res, filename);
});
// Support /media/:filename
exports.mediaRouter.get('/media/:filename', (req, res) => {
    const filename = req.params.filename;
    handleMediaRequest(req, res, filename);
});
