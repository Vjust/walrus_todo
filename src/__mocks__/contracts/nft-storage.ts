import { CLIError } from '../../types/error';

export class MockNFTStorageContract {
  private storage: Map<string, any> = new Map();
  private errors = {
    NFTNotFound: 'NFT not found',
    InvalidMetadata: 'Invalid metadata',
    Unauthorized: 'Unauthorized operation',
    StorageFull: 'Storage capacity exceeded'
  };

  constructor(private moduleId: string) {
    // Simulate storage capacity limits
    this.storage = new Map();
  }

  async entry_create_nft(
    ctx: { sender: string },
    metadata: {
      name: string;
      description: string;
      url: string;
    }
  ): Promise<string> {
    // Validate metadata
    if (!metadata.name || !metadata.description || !metadata.url) {
      throw new CLIError(this.errors.InvalidMetadata, 'CONTRACT_ERROR');
    }

    // Simulate storage space check
    if (this.storage.size >= 1000) { // Arbitrary limit
      throw new CLIError(this.errors.StorageFull, 'CONTRACT_ERROR');
    }

    const nftId = `${this.moduleId}_nft_${Math.random().toString(36).slice(2)}`;
    this.storage.set(nftId, {
      owner: ctx.sender,
      metadata,
      created_at: Date.now(),
      updated_at: Date.now(),
      transfer_history: []
    });

    this.emitEvent('NFTCreated', { nftId, owner: ctx.sender, metadata });
    return nftId;
  }

  async entry_transfer_nft(
    ctx: { sender: string },
    nftId: string,
    newOwner: string
  ): Promise<void> {
    const nft = this.storage.get(nftId);
    if (!nft) {
      throw new CLIError(this.errors.NFTNotFound, 'CONTRACT_ERROR');
    }
    if (nft.owner !== ctx.sender) {
      throw new CLIError(this.errors.Unauthorized, 'CONTRACT_ERROR');
    }

    nft.transfer_history.push({
      from: ctx.sender,
      to: newOwner,
      timestamp: Date.now()
    });

    nft.owner = newOwner;
    nft.updated_at = Date.now();
    this.storage.set(nftId, nft);

    this.emitEvent('NFTTransferred', { nftId, from: ctx.sender, to: newOwner });
  }

  async entry_update_metadata(
    ctx: { sender: string },
    nftId: string,
    metadata: Partial<{
      name: string;
      description: string;
      url: string;
    }>
  ): Promise<void> {
    const nft = this.storage.get(nftId);
    if (!nft) {
      throw new CLIError(this.errors.NFTNotFound, 'CONTRACT_ERROR');
    }
    if (nft.owner !== ctx.sender) {
      throw new CLIError(this.errors.Unauthorized, 'CONTRACT_ERROR');
    }

    nft.metadata = { ...nft.metadata, ...metadata };
    nft.updated_at = Date.now();
    this.storage.set(nftId, nft);

    this.emitEvent('NFTMetadataUpdated', { nftId, metadata });
  }

  async view_get_nft(nftId: string): Promise<any> {
    const nft = this.storage.get(nftId);
    if (!nft) {
      throw new CLIError(this.errors.NFTNotFound, 'CONTRACT_ERROR');
    }
    return nft;
  }

  async view_get_nfts_by_owner(owner: string): Promise<any[]> {
    return Array.from(this.storage.values())
      .filter(nft => nft.owner === owner);
  }

  // Simulated blockchain events
  private emitEvent(eventType: string, data: any) {
    console.log('Contract Event:', { type: eventType, data });
  }
}