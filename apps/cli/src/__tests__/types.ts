export type EncodingType = { RedStuff: true; $kind: 'RedStuff' };
export type Hash = { Digest: Uint8Array; $kind: 'Digest' };
export type BlobHashPair = {
  primary_hash: Hash;
  secondary_hash: Hash;
};

export type BlobMetadata = {
  encoding_type: EncodingType;
  unencoded_length: string;
  hashes: BlobHashPair[];
  $kind: 'V1';
};

export type BlobInfo = {
  blob_id: string;
  certified_epoch?: number;
  registered_epoch: number;
  encoding_type: EncodingType;
  unencoded_length: string;
  hashes: BlobHashPair[];
  metadata?: {
    V1: BlobMetadata;
  };
};
