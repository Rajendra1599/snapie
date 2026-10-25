export interface IStorageService {
  /**
   * Generates a signed PUT URL for direct client upload.
   * Expires in 5 minutes (300 seconds) per spec.
   */
  getSignedUploadUrl(key: string, contentType?: string): Promise<{ uploadUrl: string; key: string }>;

  /**
   * Generates a signed GET URL for downloading an asset.
   * Expires in 15 minutes (900 seconds) per spec.
   */
  getSignedDownloadUrl(key: string): Promise<string>;

  /**
   * Resolves the public CloudFront CDN URL for public assets (like preview thumbnails).
   */
  getPublicCdnUrl(key: string): string;

  /**
   * Directly uploads a binary buffer to storage and returns its public CDN URL.
   */
  uploadBuffer?(key: string, buffer: Buffer, contentType?: string): Promise<string>;

  /**
   * Deletes an object from storage (used in 24h upload cleanup and account deletion).
   */
  deleteObject(key: string): Promise<void>;
}
