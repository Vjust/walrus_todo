/// Module for managing AI provider credentials on the blockchain
module walrus_todo::ai_credential {
    use std::string::{Self, String};
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;

    /// Credential Type
    const CREDENTIAL_TYPE_API_KEY: u8 = 0;
    const CREDENTIAL_TYPE_OAUTH_TOKEN: u8 = 1;
    const CREDENTIAL_TYPE_CERTIFICATE: u8 = 2;
    const CREDENTIAL_TYPE_BLOCKCHAIN_KEY: u8 = 3;

    /// Permission Level
    const PERMISSION_NO_ACCESS: u8 = 0;
    const PERMISSION_READ_ONLY: u8 = 1;
    const PERMISSION_STANDARD: u8 = 2;
    const PERMISSION_ADVANCED: u8 = 3;
    const PERMISSION_ADMIN: u8 = 4;

    /// Registry for AI credentials
    struct CredentialRegistry has key {
        id: UID,
        owner: address,
        credential_count: u64,
        verification_count: u64,
    }

    /// AI Credential
    struct Credential has key, store {
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
    }

    /// Credential Verification
    struct CredentialVerification has key, store {
        id: UID,
        credential_id: String,
        provider_name: String,
        timestamp: u64,
        is_valid: bool,
        verifier: address,
        expiry_timestamp: u64,
        metadata: String,
    }

    /// Event emitted when a credential is stored
    struct CredentialStored has copy, drop {
        credential_id: address,
        provider_name: String,
        credential_type: u8,
        permission_level: u8,
        timestamp: u64,
    }

    /// Event emitted when a credential is verified
    struct CredentialVerified has copy, drop {
        verification_id: address,
        credential_id: String,
        provider_name: String,
        verifier: address,
        timestamp: u64,
    }

    /// Create a new credential registry
    public entry fun create_registry(ctx: &mut TxContext) {
        let registry = CredentialRegistry {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            credential_count: 0,
            verification_count: 0,
        };
        
        transfer::share_object(registry);
    }

    /// Store a credential on the blockchain
    public entry fun store_credential(
        registry: &mut CredentialRegistry,
        credential_id: String,
        provider_name: String,
        credential_type: u8,
        credential_hash: String,
        permission_level: u8,
        expires_at: String,
        metadata: String,
        ctx: &mut TxContext
    ) {
        let expires_timestamp: u64 = 0;
        if (string::length(&expires_at) > 0) {
            // Simple conversion from string to u64 (not fully implemented here)
            // In a real implementation, this would be a proper string to u64 conversion
            // For simplicity, we're just assuming expires_at is a valid u64 string
            expires_timestamp = 0;
        };
        
        let credential = Credential {
            id: object::new(ctx),
            credential_id,
            provider_name,
            credential_type,
            credential_hash,
            permission_level,
            is_verified: false,
            verification_proof: string::utf8(vector[]),
            created_at: tx_context::epoch_timestamp_ms(ctx),
            expires_at: expires_timestamp,
            metadata,
        };
        
        // Update registry
        registry.credential_count = registry.credential_count + 1;
        
        // Emit event
        event::emit(CredentialStored {
            credential_id: object::uid_to_address(&credential.id),
            provider_name: credential.provider_name,
            credential_type: credential.credential_type,
            permission_level: credential.permission_level,
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
        
        // Transfer credential to transaction sender
        transfer::transfer(credential, tx_context::sender(ctx));
    }

    /// Verify a credential
    public entry fun verify_credential(
        registry: &mut CredentialRegistry,
        credential_id: String,
        provider_name: String,
        public_key: String,
        timestamp: String,
        metadata: String,
        ctx: &mut TxContext
    ) {
        let timestamp_ms: u64 = 0;
        if (string::length(&timestamp) > 0) {
            // Simple conversion from string to u64 (not fully implemented here)
            // In a real implementation, this would be a proper string to u64 conversion
            timestamp_ms = tx_context::epoch_timestamp_ms(ctx);
        } else {
            timestamp_ms = tx_context::epoch_timestamp_ms(ctx);
        };
        
        // Default expiry in 30 days (approximately)
        let expiry_timestamp = timestamp_ms + 2592000000;
        
        let verification = CredentialVerification {
            id: object::new(ctx),
            credential_id,
            provider_name,
            timestamp: timestamp_ms,
            is_valid: true,
            verifier: tx_context::sender(ctx),
            expiry_timestamp,
            metadata,
        };
        
        // Update registry
        registry.verification_count = registry.verification_count + 1;
        
        // Emit event
        event::emit(CredentialVerified {
            verification_id: object::uid_to_address(&verification.id),
            credential_id: verification.credential_id,
            provider_name: verification.provider_name,
            verifier: verification.verifier,
            timestamp: verification.timestamp,
        });
        
        // Transfer verification to transaction sender
        transfer::transfer(verification, tx_context::sender(ctx));
    }

    /// Update a credential with verification
    public entry fun update_credential_verification(
        credential: &mut Credential,
        verification_id: String,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == credential.user, 0);
        credential.is_verified = true;
        credential.verification_proof = verification_id;
    }

    /// Revoke a credential verification
    public entry fun revoke_verification(
        verification: &mut CredentialVerification,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == verification.verifier, 0);
        verification.is_valid = false;
    }

    /// Delete a credential
    public entry fun delete_credential(
        registry: &mut CredentialRegistry,
        credential: Credential,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == credential.user, 0);
        
        // Update registry
        if (registry.credential_count > 0) {
            registry.credential_count = registry.credential_count - 1;
        };
        
        // Delete the credential
        let Credential { id, credential_id: _, provider_name: _, credential_type: _, 
                         credential_hash: _, permission_level: _, is_verified: _, 
                         verification_proof: _, created_at: _, expires_at: _, metadata: _ } = credential;
        object::delete(id);
    }

    /// Update credential permission level
    public entry fun update_credential_permission(
        credential: &mut Credential,
        permission_level: u8,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == credential.user, 0);
        credential.permission_level = permission_level;
    }

    /// Update credential expiry
    public entry fun update_credential_expiry(
        credential: &mut Credential,
        expires_at: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == credential.user, 0);
        credential.expires_at = expires_at;
    }

    /// Get credential details
    public fun get_credential_details(
        credential: &Credential
    ): (String, String, u8, u8, bool, String, u64, u64, String) {
        (
            credential.credential_id,
            credential.provider_name,
            credential.credential_type,
            credential.permission_level,
            credential.is_verified,
            credential.verification_proof,
            credential.created_at,
            credential.expires_at,
            credential.metadata
        )
    }

    /// Get verification details
    public fun get_verification_details(
        verification: &CredentialVerification
    ): (String, String, u64, bool, address, u64, String) {
        (
            verification.credential_id,
            verification.provider_name,
            verification.timestamp,
            verification.is_valid,
            verification.verifier,
            verification.expiry_timestamp,
            verification.metadata
        )
    }

    /// Get registry details
    public fun get_registry_details(
        registry: &CredentialRegistry
    ): (address, u64, u64) {
        (
            registry.owner,
            registry.credential_count,
            registry.verification_count
        )
    }
}