module walrus_todo::ai_verifier {
    use std::string::{Self, String};
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use sui::event;
    use std::vector;

    /// Error codes
    const E_UNAUTHORIZED: u64 = 1;
    const E_CREDENTIAL_EXISTS: u64 = 2;
    const E_CREDENTIAL_NOT_FOUND: u64 = 3;
    const E_INVALID_PROVIDER: u64 = 4;
    const E_INVALID_HASH: u64 = 5;
    const E_CREDENTIAL_REVOKED: u64 = 6;

    /// Events
    public struct CredentialRegistered has copy, drop {
        provider: String,
        registrar: address,
        timestamp: String
    }

    public struct CredentialRevoked has copy, drop {
        provider: String,
        revoker: address,
        timestamp: String
    }

    public struct CredentialVerified has copy, drop {
        provider: String,
        verifier: address,
        timestamp: String,
        success: bool
    }

    /// The credential registry object - stored as a shared object
    public struct CredentialRegistry has key {
        id: UID,
        // Maps provider names to credential hashes
        credentials: Table<String, Credential>,
        // Admin capability - only the deployer can manage this
        admin: address
    }

    /// Credential struct
    public struct Credential has store, drop {
        hash: String,
        provider: String,
        registered_at: String,
        revoked: bool,
        permissions: vector<String>
    }

    /// Admin capability
    public struct AdminCap has key {
        id: UID
    }

    // === Initialization ===

    fun init(ctx: &mut TxContext) {
        // Create admin capability
        let admin_cap = AdminCap {
            id: object::new(ctx)
        };
        transfer::transfer(admin_cap, tx_context::sender(ctx));

        // Create and share the credential registry
        let registry = CredentialRegistry {
            id: object::new(ctx),
            credentials: table::new(ctx),
            admin: tx_context::sender(ctx)
        };
        transfer::share_object(registry);
    }

    // === Public Functions ===

    /// Register a new credential for an AI provider
    public entry fun register_credential(
        registry: &mut CredentialRegistry,
        provider: String,
        hash: String,
        timestamp: String,
        ctx: &mut TxContext
    ) {
        // Validate the provider (implement additional validation as needed)
        assert!(is_valid_provider(&provider), E_INVALID_PROVIDER);
        
        // Verify the hash format
        assert!(string::length(&hash) == 64, E_INVALID_HASH);
        
        // Check if credential already exists
        assert!(!table::contains(&registry.credentials, provider), E_CREDENTIAL_EXISTS);
        
        // Create the credential
        let credential = Credential {
            hash,
            provider: provider,
            registered_at: timestamp,
            revoked: false,
            permissions: vector::empty()
        };
        
        // Add to registry
        table::add(&mut registry.credentials, provider, credential);
        
        // Emit registration event
        event::emit(CredentialRegistered {
            provider,
            registrar: tx_context::sender(ctx),
            timestamp
        });
    }

    /// Revoke a credential for an AI provider
    public entry fun revoke_credential(
        registry: &mut CredentialRegistry,
        provider: String,
        ctx: &mut TxContext
    ) {
        // Check if credential exists
        assert!(table::contains(&registry.credentials, provider), E_CREDENTIAL_NOT_FOUND);
        
        // Get mutable reference to credential
        let credential = table::borrow_mut(&mut registry.credentials, provider);
        
        // Mark as revoked
        credential.revoked = true;
        
        // Emit revocation event
        event::emit(CredentialRevoked {
            provider,
            revoker: tx_context::sender(ctx),
            timestamp: timestamp()
        });
    }

    /// Verify a credential based on its hash
    public fun verify_credential(
        registry: &CredentialRegistry,
        provider: String,
        hash: String,
        ctx: &mut TxContext
    ): bool {
        // Check if credential exists
        if (!table::contains(&registry.credentials, provider)) {
            return false
        };
        
        // Get reference to credential
        let credential = table::borrow(&registry.credentials, provider);
        
        // Check if revoked
        if (credential.revoked) {
            return false
        };
        
        // Check if hash matches
        let is_valid = credential.hash == hash;
        
        // Emit verification event
        event::emit(CredentialVerified {
            provider,
            verifier: tx_context::sender(ctx),
            timestamp: timestamp(),
            success: is_valid
        });
        
        is_valid
    }

    /// Check if a provider is registered
    public fun is_provider_registered(
        registry: &CredentialRegistry,
        provider: String
    ): bool {
        if (!table::contains(&registry.credentials, provider)) {
            return false
        };
        
        let credential = table::borrow(&registry.credentials, provider);
        !credential.revoked
    }

    // === Admin Functions ===

    /// Add a permission to a credential (admin only)
    public entry fun add_permission(
        _: &AdminCap,
        registry: &mut CredentialRegistry,
        provider: String,
        permission: String,
        ctx: &TxContext
    ) {
        // Only admin can call this
        assert!(tx_context::sender(ctx) == registry.admin, E_UNAUTHORIZED);
        
        // Check if credential exists
        assert!(table::contains(&registry.credentials, provider), E_CREDENTIAL_NOT_FOUND);
        
        // Get mutable reference to credential
        let credential = table::borrow_mut(&mut registry.credentials, provider);
        
        // Add permission if it doesn't already exist
        if (!vector::contains(&credential.permissions, &permission)) {
            vector::push_back(&mut credential.permissions, permission);
        };
    }

    /// Remove a permission from a credential (admin only)
    public entry fun remove_permission(
        _: &AdminCap,
        registry: &mut CredentialRegistry,
        provider: String,
        permission: String,
        ctx: &TxContext
    ) {
        // Only admin can call this
        assert!(tx_context::sender(ctx) == registry.admin, E_UNAUTHORIZED);
        
        // Check if credential exists
        assert!(table::contains(&registry.credentials, provider), E_CREDENTIAL_NOT_FOUND);
        
        // Get mutable reference to credential
        let credential = table::borrow_mut(&mut registry.credentials, provider);
        
        // Find and remove permission
        let (exists, index) = vector::index_of(&credential.permissions, &permission);
        if (exists) {
            vector::remove(&mut credential.permissions, index);
        };
    }

    // === Helper Functions ===

    /// Validate provider name format
    fun is_valid_provider(provider: &String): bool {
        // Implement proper validation; this is a simple length check
        let provider_length = string::length(provider);
        provider_length > 2 && provider_length < 20
    }

    /// Get current timestamp as a string
    fun timestamp(): String {
        // Note: In Move, timestamps are typically handled as u64 values
        // This is a simplified implementation - in production you'd convert
        // the epoch timestamp to a proper string format
        string::utf8(b"epoch_timestamp")
    }
}