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

    /// Update a credential with verification
    public entry fun update_credential_verification(
        credential: &mut Credential,
        verification_id: String,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == credential.owner, E_UNAUTHORIZED);
        credential.is_verified = true;
        credential.verification_proof = verification_id;
    }

    /// Delete a credential
    public entry fun delete_credential(
        registry: &mut CredentialRegistry,
        credential: Credential,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == credential.owner, E_UNAUTHORIZED);
        
        // Update registry
        if (registry.credential_count > 0) {
            registry.credential_count = registry.credential_count - 1;
        };
        
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
        credential.permission_level = permission_level;
    }

    /// Update credential expiry
    public entry fun update_credential_expiry(
        credential: &mut Credential,
        expires_at: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == credential.owner, E_UNAUTHORIZED);
        credential.expires_at = expires_at;
    }
}
