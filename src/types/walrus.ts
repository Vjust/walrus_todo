export interface WalrusClientInterface {
  writeBlob(params: { content: Uint8Array; metadata?: Record<string, string> }): Promise<{ // Refined metadata type
    blobId: string;
    blobObject: { [key: string]: unknown }; // Keeping unknown as structure is not defined
  }>;
  
  readBlob(params: { blobId: string }): Promise<Uint8Array>;
  getBlob(params: { blobId: string }): Promise<{ [key: string]: unknown }>; // Replaced any with unknown
}