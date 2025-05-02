export interface WalrusClientInterface {
  writeBlob(params: { content: Uint8Array; metadata?: Record<string, any> }): Promise<{
    blobId: string;
    blobObject: { [key: string]: any };
  }>;
  
  readBlob(params: { blobId: string }): Promise<Uint8Array>;
  getBlob(params: { blobId: string }): Promise<{ [key: string]: any }>;
}