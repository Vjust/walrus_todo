/// Module for managing AI provider credentials on the blockchain
module walrus_todo::ai_credential {
    use std::string::{Self, String};
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;

    // Error codes
    const E_NOT_OWNER: u64 = 1;
    const E_UNAUTHORIZED: u64 = 2;
    const E_INVALID_CREDENTIAL_TYPE: u64 = 3;
    const E_INVALID_PERMISSION_LEVEL: u64 = 4;
    const E_CREDENTIAL_EXPIRED: u64 = 5;
    const E_INVALID_INPUT: u64 = 6;
    
    // Credential Types
    const CREDENTIAL_TYPE_API_KEY: u8 = 0;
    const CREDENTIAL_TYPE_OAUTH_TOKEN: u8 = 1;
    const CREDENTIAL_TYPE_CERTIFICATE: u8 = 2;
    const CREDENTIAL_TYPE_BLOCKCHAIN_KEY: u8 = 3;

    // Permission Levels
    const PERMISSION_NO_ACCESS: u8 = 0;
    const PERMISSION_READ_ONLY: u8 = 1;
    const PERMISSION_STANDARD: u8 = 2;
    const PERMISSION_ADVANCED: u8 = 3;
    const PERMISSION_ADMIN: u8 = 4;

    /// Registry for AI credentials
    public struct CredentialRegistry has key {
        id: UID,
        owner: address,
        credential_count: u64,
        verification_count: u64,
    }

    /// AI Credential
    public struct Credential has key, store {
        id: UID,
        credential_id: String,
        provider_name: String,
        credential_type: u8,
        credential_hash: String,
        permission_level: u8,
        is_verified: bool,
        verification_proof: String,
        created_at: u64,
        expires_at: u64,
        metadata: String,
        owner: address
    }

    // Events
    public struct CredentialCreated has copy, drop {
        credential_id: String,
        provider_name: String,
        owner: address,
        timestamp: u64
    }

    public struct CredentialVerified has copy, drop {
        credential_id: String,
        verification_id: String,
        owner: address,
        timestamp: u64
    }

    public struct CredentialUpdated has copy, drop {
        credential_id: String,
        owner: address,
        timestamp: u64
    }

    public struct CredentialDeleted has copy, drop {
        credential_id: String,
        owner: address,
        timestamp: u64
    }

    public struct RegistryCreated has copy, drop {
        registry_owner: address,
        timestamp: u64
    }

    /// Initialize registry
    fun init(ctx: &mut TxContext) {
        let registry = CredentialRegistry {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            credential_count: 0,
            verification_count: 0,
        };

        event::emit(RegistryCreated {
            registry_owner: tx_context::sender(ctx),
            timestamp: tx_context::epoch_timestamp_ms(ctx)
        });

        transfer::share_object(registry);
    }

    /// Create a new credential
    public entry fun create_credential(
        registry: &mut CredentialRegistry,
        credential_id: vector<u8>,
        provider_name: vector<u8>,
        credential_type: u8,
        credential_hash: vector<u8>,
        permission_level: u8,
        expires_at: u64,
        metadata: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Validate inputs
        assert!(credential_id.length() > 0 && credential_id.length() <= 64, E_INVALID_INPUT);
        assert!(provider_name.length() > 0 && provider_name.length() <= 32, E_INVALID_INPUT);
        assert!(credential_hash.length() > 0 && credential_hash.length() <= 128, E_INVALID_INPUT);
        assert!(metadata.length() <= 512, E_INVALID_INPUT);
        assert!(is_valid_credential_type(credential_type), E_INVALID_CREDENTIAL_TYPE);
        assert!(is_valid_permission_level(permission_level), E_INVALID_PERMISSION_LEVEL);

        let credential_id_str = string::utf8(credential_id);
        let provider_name_str = string::utf8(provider_name);
        let credential_hash_str = string::utf8(credential_hash);
        let metadata_str = string::utf8(metadata);
        let current_time = tx_context::epoch_timestamp_ms(ctx);
        let owner = tx_context::sender(ctx);

        let credential = Credential {
            id: object::new(ctx),
            credential_id: credential_id_str,
            provider_name: provider_name_str,
            credential_type,
            credential_hash: credential_hash_str,
            permission_level,
            is_verified: false,
            verification_proof: string::utf8(b""),
            created_at: current_time,
            expires_at,
            metadata: metadata_str,
            owner
        };

        // Update registry
        registry.credential_count = registry.credential_count + 1;

        // Emit event
        event::emit(CredentialCreated {
            credential_id: credential_id_str,
            provider_name: provider_name_str,
            owner,
            timestamp: current_time
        });

        // Transfer to owner
        transfer::public_transfer(credential, owner);
    }

    /// Update a credential with verification
    public entry fun update_credential_verification(
        registry: &mut CredentialRegistry,
        credential: &mut Credential,
        verification_id: String,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == credential.owner, E_UNAUTHORIZED);
        assert!(string::length(&verification_id) > 0 && string::length(&verification_id) <= 128, E_INVALID_INPUT);

        credential.is_verified = true;
        credential.verification_proof = verification_id;
        registry.verification_count = registry.verification_count + 1;

        let current_time = tx_context::epoch_timestamp_ms(ctx);

        event::emit(CredentialVerified {
            credential_id: credential.credential_id,
            verification_id,
            owner: credential.owner,
            timestamp: current_time
        });
    }

    /// Delete a credential
    public entry fun delete_credential(
        registry: &mut CredentialRegistry,
        credential: Credential,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == credential.owner, E_UNAUTHORIZED);
        
        let credential_id = credential.credential_id;
        let owner = credential.owner;
        let current_time = tx_context::epoch_timestamp_ms(ctx);
        
        // Update registry
        if (registry.credential_count > 0) {
            registry.credential_count = registry.credential_count - 1;
        };

        // Emit event before deletion
        event::emit(CredentialDeleted {
            credential_id,
            owner,
            timestamp: current_time
        });
        
        // Delete the credential
        let Credential { id, credential_id: _, provider_name: _, credential_type: _, 
                        credential_hash: _, permission_level: _, is_verified: _, 
                        verification_proof: _, created_at: _, expires_at: _, metadata: _,
                        owner: _ } = credential;
        object::delete(id);
    }

    /// Update credential permission level
    public entry fun update_credential_permission(
        credential: &mut Credential,
        permission_level: u8,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == credential.owner, E_UNAUTHORIZED);
        assert!(is_valid_permission_level(permission_level), E_INVALID_PERMISSION_LEVEL);
        
        credential.permission_level = permission_level;

        event::emit(CredentialUpdated {
            credential_id: credential.credential_id,
            owner: credential.owner,
            timestamp: tx_context::epoch_timestamp_ms(ctx)
        });
    }

    /// Update credential expiry
    public entry fun update_credential_expiry(
        credential: &mut Credential,
        expires_at: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == credential.owner, E_UNAUTHORIZED);
        assert!(expires_at > tx_context::epoch_timestamp_ms(ctx), E_CREDENTIAL_EXPIRED);
        
        credential.expires_at = expires_at;

        event::emit(CredentialUpdated {
            credential_id: credential.credential_id,
            owner: credential.owner,
            timestamp: tx_context::epoch_timestamp_ms(ctx)
        });
    }

    /// Update credential metadata
    public entry fun update_credential_metadata(
        credential: &mut Credential,
        metadata: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == credential.owner, E_UNAUTHORIZED);
        assert!(metadata.length() <= 512, E_INVALID_INPUT);
        
        credential.metadata = string::utf8(metadata);

        event::emit(CredentialUpdated {
            credential_id: credential.credential_id,
            owner: credential.owner,
            timestamp: tx_context::epoch_timestamp_ms(ctx)
        });
    }

    // === Getter Functions ===

    /// Get credential ID
    public fun credential_id(credential: &Credential): &String {
        &credential.credential_id
    }

    /// Get provider name
    public fun provider_name(credential: &Credential): &String {
        &credential.provider_name
    }

    /// Get credential type
    public fun credential_type(credential: &Credential): u8 {
        credential.credential_type
    }

    /// Check if credential is verified
    public fun is_verified(credential: &Credential): bool {
        credential.is_verified
    }

    /// Get permission level
    public fun permission_level(credential: &Credential): u8 {
        credential.permission_level
    }

    /// Get credential owner
    public fun owner(credential: &Credential): address {
        credential.owner
    }

    /// Check if credential is expired
    public fun is_expired(credential: &Credential, current_time: u64): bool {
        credential.expires_at <= current_time
    }

    /// Get registry credential count
    public fun credential_count(registry: &CredentialRegistry): u64 {
        registry.credential_count
    }

    /// Get registry verification count
    public fun verification_count(registry: &CredentialRegistry): u64 {
        registry.verification_count
    }

    // === Helper Functions ===

    /// Validate credential type
    fun is_valid_credential_type(cred_type: u8): bool {
        cred_type == CREDENTIAL_TYPE_API_KEY ||
        cred_type == CREDENTIAL_TYPE_OAUTH_TOKEN ||
        cred_type == CREDENTIAL_TYPE_CERTIFICATE ||
        cred_type == CREDENTIAL_TYPE_BLOCKCHAIN_KEY
    }

    /// Validate permission level
    fun is_valid_permission_level(permission: u8): bool {
        permission == PERMISSION_NO_ACCESS ||
        permission == PERMISSION_READ_ONLY ||
        permission == PERMISSION_STANDARD ||
        permission == PERMISSION_ADVANCED ||
        permission == PERMISSION_ADMIN
    }
}