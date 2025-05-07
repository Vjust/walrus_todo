import { WalrusError } from '../types/error';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface VaultConfig {
  name: string;
  maxSize: number;
  allowedTypes: string[];
  retentionPeriod: number;
}

interface VaultMetadata {
  id: string;
  name: string;
  created: string;
  totalFiles: number;
  totalSize: number;
  config: VaultConfig;
}

export interface BlobRecord {
  blobId: string;
  fileName: string;
  size: number;
  mimeType: string;
  checksum: string;
  uploadedAt: string;
  expiresAt: string;
  vaultId: string;
  metadata?: Record<string, any>;
}

export class VaultManager {
  private readonly baseDir: string;
  private readonly vaults: Map<string, VaultMetadata>;
  private readonly recordsFile: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.recordsFile = path.join(baseDir, 'vault-records.json');
    this.vaults = new Map();
    this.initializeVaultSystem();
  }

  private initializeVaultSystem(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    
    if (fs.existsSync(this.recordsFile)) {
      const records = JSON.parse(fs.readFileSync(this.recordsFile, 'utf-8'));
      records.vaults.forEach((vault: VaultMetadata) => {
        this.vaults.set(vault.id, vault);
      });
    } else {
      this.saveVaultRecords();
    }
  }

  private saveVaultRecords(): void {
    const records = {
      lastUpdated: new Date().toISOString(),
      vaults: Array.from(this.vaults.values()).map(vault => ({
        id: vault.id,
        name: vault.name,
        created: vault.created,
        totalFiles: vault.totalFiles,
        totalSize: vault.totalSize,
        config: vault.config
      }))
    };
    fs.writeFileSync(this.recordsFile, JSON.stringify(records, null, 2));
  }

  createVault(config: VaultConfig): string {
    const vaultId = crypto.randomBytes(16).toString('hex');
    const vault: VaultMetadata = {
      id: vaultId,
      name: config.name,
      created: new Date().toISOString(),
      totalFiles: 0,
      totalSize: 0,
      config
    };

    const vaultDir = path.join(this.baseDir, vaultId);
    fs.mkdirSync(vaultDir);
    fs.mkdirSync(path.join(vaultDir, 'metadata'));
    fs.mkdirSync(path.join(vaultDir, 'blobs'));

    this.vaults.set(vaultId, vault);
    this.saveVaultRecords();

    return vaultId;
  }

  saveBlobRecord(record: BlobRecord): void {
    const vault = this.vaults.get(record.vaultId);
    if (!vault) {
      throw new WalrusError(`Vault ${record.vaultId} not found`);
    }

    // Update vault stats
    vault.totalFiles++;
    vault.totalSize += record.size;

    // Save blob metadata
    const metadataPath = path.join(
      this.baseDir,
      record.vaultId,
      'metadata',
      `${record.blobId}.json`
    );
    fs.writeFileSync(metadataPath, JSON.stringify(record, null, 2));

    this.saveVaultRecords();
  }

  getBlobRecord(blobId: string, vaultId: string): BlobRecord {
    const metadataPath = path.join(
      this.baseDir,
      vaultId,
      'metadata',
      `${blobId}.json`
    );

    if (!fs.existsSync(metadataPath)) {
      throw new WalrusError(`Blob record not found: ${blobId}`);
    }

    return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  }

  getVaultMetadata(vaultId: string): VaultMetadata {
    const vault = this.vaults.get(vaultId);
    if (!vault) {
      throw new WalrusError(`Vault ${vaultId} not found`);
    }
    return { ...vault };
  }

  validateFileForVault(vaultId: string, size: number, mimeType: string): void {
    const vault = this.vaults.get(vaultId);
    if (!vault) {
      throw new WalrusError(`Vault ${vaultId} not found`);
    }

    if (size > vault.config.maxSize) {
      throw new WalrusError(
        `File size ${size} exceeds vault limit of ${vault.config.maxSize}`
      );
    }

    if (!vault.config.allowedTypes.includes(mimeType)) {
      throw new WalrusError(
        `File type ${mimeType} not allowed in vault. Allowed types: ${vault.config.allowedTypes.join(
          ', '
        )}`
      );
    }

    if (vault.totalSize + size > vault.config.maxSize) {
      throw new WalrusError('Vault size limit would be exceeded');
    }
  }

  getExpiringBlobs(withinDays: number): BlobRecord[] {
    const expiringBlobs: BlobRecord[] = [];
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + withinDays);

    for (const vault of Array.from(this.vaults.values())) {
      const metadataDir = path.join(this.baseDir, vault.id, 'metadata');
      if (!fs.existsSync(metadataDir)) continue;

      const files = fs.readdirSync(metadataDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const record: BlobRecord = JSON.parse(
          fs.readFileSync(path.join(metadataDir, file), 'utf-8')
        );

        const expiryDate = new Date(record.expiresAt);
        if (expiryDate <= threshold) {
          expiringBlobs.push(record);
        }
      }
    }

    return expiringBlobs;
  }

  updateBlobExpiry(blobId: string, vaultId: string, newExpiryDate: string): void {
    const record = this.getBlobRecord(blobId, vaultId);
    record.expiresAt = newExpiryDate;

    const metadataPath = path.join(
      this.baseDir,
      vaultId,
      'metadata',
      `${blobId}.json`
    );
    fs.writeFileSync(metadataPath, JSON.stringify(record, null, 2));
  }
}