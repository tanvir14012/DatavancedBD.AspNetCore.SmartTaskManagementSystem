// ─── CDN Asset Models ──────────────────────────────────────────────────────────

export interface AssetMetadata {
  key: string;
  bucket: string;
  contentType: string;
  size: number;
  lastModified: string; // ISO 8601
  eTag?: string;
  contentHash?: string;
  metadata: Record<string, string>;
  storageProvider?: string;
  region?: string;
  isPublic: boolean;
  expiresAt?: string; // ISO 8601
}

export interface SecureLinkToken {
  /** base64url(MD5(input)) without padding */
  hash: string;
  /** Unix epoch seconds at which the link expires */
  expiresAt: number;
  /** The URI path that was signed */
  uri: string;
  /** IP address bound when IP-binding is enabled */
  boundToIp?: string;
  /** Full signed URL: "{cdnBase}{uri}?md5={hash}&expires={expiresAt}" */
  signedUrl: string;
}

export interface SignedUrlRequest {
  assetKey: string;
  expiresInSeconds?: number;
  bindToClientIp?: boolean;
}

// ─── Upload Models ─────────────────────────────────────────────────────────────

export type UploadStatus =
  'Pending' | 'InProgress' | 'Scanning' | 'Completed' | 'Failed' | 'Aborted';

export interface UploadSession {
  uploadId: string;
  fileName: string;
  contentType: string;
  totalSize: number;
  totalChunks: number;
  chunkSize: number;
  status: UploadStatus;
  completedChunks: number[];
  createdAt: string; // ISO 8601
  completedAt?: string;
  finalAssetKey?: string;
  scanStatus?: string;
  errorMessage?: string;
}

export interface InitiateUploadRequest {
  fileName: string;
  contentType: string;
  totalSize: number;
  /** Destination bucket / prefix within the CDN storage provider */
  targetKey?: string;
}

export interface UploadChunkResult {
  uploadId: string;
  chunkIndex: number;
  bytesWritten: number;
  isComplete: boolean;
}

/** Progress event emitted by CdnUploadService.upload$() */
export interface CdnUploadProgress {
  uploadId: string;
  status: UploadStatus;
  /** Percentage 0–100 */
  percent: number;
  bytesUploaded: number;
  totalBytes: number;
  /** Populated once upload reaches Completed status */
  finalAssetKey?: string;
  /** Populated on failure */
  error?: string;
}

// ─── Image Transform Options ───────────────────────────────────────────────────

export type ImageFormat = 'webp' | 'avif' | 'jpeg' | 'png' | 'gif';
export type ResizeMode = 'contain' | 'cover' | 'stretch' | 'crop';

export interface CdnTransformOptions {
  /** Target width in pixels */
  width?: number;
  /** Target height in pixels */
  height?: number;
  /** Output image format */
  format?: ImageFormat;
  /** Quality 1–100 (for lossy formats) */
  quality?: number;
  /** Resize mode */
  mode?: ResizeMode;
}

// ─── Rate Limiting ─────────────────────────────────────────────────────────────

export interface RateLimitState {
  /** Endpoint URL pattern that is currently rate-limited */
  urlPattern: string;
  /** Timestamp (ms) when the rate limit window expires */
  expiresAt: number;
  /** Seconds remaining until the window expires (live-computed) */
  remainingSeconds: number;
}

// ─── Cache Invalidation ────────────────────────────────────────────────────────

export interface InvalidateCacheRequest {
  assetKey: string;
  /** When true, also invalidates all derivative image variants */
  includeVariants?: boolean;
}

export interface InvalidateCacheResult {
  assetKey: string;
  invalidatedCount: number;
  success: boolean;
}
