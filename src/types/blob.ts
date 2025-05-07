export interface BlobContent {
  data: Buffer | string;
  mimeType: string;
  size: number;
}

export interface BlobStorageOptions {
  validate?: boolean;
  timeout?: number;
  retries?: number;
}

export interface BlobStorageResult {
  success: boolean;
  hash?: string;
  error?: Error;
}

export interface BlobReadResult extends BlobStorageResult {
  content?: BlobContent;
}

export interface BlobWriteResult extends BlobStorageResult {
  location?: string;
}