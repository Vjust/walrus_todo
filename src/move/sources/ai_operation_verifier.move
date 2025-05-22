module walrus_todo::ai_operation_verifier {
    use std::string::{Self, String};
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use sui::event;

    /// Error codes
    const E_UNAUTHORIZED: u64 = 1;
    const E_INVALID_OPERATION: u64 = 2;
    const E_INVALID_PROVIDER: u64 = 3;
    const E_INVALID_HASH: u64 = 4;

    /// Events
    struct OperationVerified has copy, drop {
        provider: String,
        operation: String,
        verifier: address,
        timestamp: String,
        verification_id: String
    }

    /// The operation verification registry
    struct VerificationRegistry has key {
        id: UID,
        // Maps verification IDs to verification records
        verifications: Table<String, VerificationRecord>,
        // Maps provider and operation pairs to counts
        operation_counts: Table<String, u64>,
        admin: address
    }

    /// Verification record
    struct VerificationRecord has store, drop {
        provider: String,
        operation: String,
        input_hash: String,
        output_hash: String,
        metadata: String,
        timestamp: String,
        verifier: address
    }

    /// Admin capability
    struct AdminCap has key {
        id: UID
    }

    // === Initialization ===

    fun init(ctx: &mut TxContext) {
        // Create admin capability
        let admin_cap = AdminCap {
            id: object::new(ctx)
        };
        transfer::transfer(admin_cap, tx_context::sender(ctx));

        // Create and share the verification registry
        let registry = VerificationRegistry {
            id: object::new(ctx),
            verifications: table::new(ctx),
            operation_counts: table::new(ctx),
            admin: tx_context::sender(ctx)
        };
        transfer::share_object(registry);
    }

    // === Public Functions ===

    /// Verify an AI operation (hash only - more private)
    public entry fun verify_operation(
        registry: &mut VerificationRegistry,
        provider: String,
        operation: String,
        input_hash: String,
        output_hash: String,
        timestamp: String,
        ctx: &mut TxContext
    ) {
        // Validate inputs
        assert!(is_valid_provider(&provider), E_INVALID_PROVIDER);
        assert!(is_valid_operation(&operation), E_INVALID_OPERATION);
        assert!(string::length(&input_hash) == 64, E_INVALID_HASH); // SHA-256 hash length
        assert!(string::length(&output_hash) == 64, E_INVALID_HASH);
        assert!(string::length(&timestamp) > 0 && string::length(&timestamp) <= 32, E_INVALID_HASH); // Timestamp validation
        assert!(is_valid_hash_format(&input_hash), E_INVALID_HASH);
        assert!(is_valid_hash_format(&output_hash), E_INVALID_HASH);
        
        // Create a verification ID (combination of provider, operation, and hashes)
        let verification_id = generate_verification_id(&provider, &operation, &input_hash, &output_hash);
        
        // Create the verification record
        let record = VerificationRecord {
            provider,
            operation: operation,
            input_hash,
            output_hash,
            metadata: string::utf8(b"{}"), // Empty metadata for hash-only verification
            timestamp,
            verifier: tx_context::sender(ctx)
        };
        
        // Add to registry
        table::add(&mut registry.verifications, verification_id, record);
        
        // Update operation count
        let op_key = concat_strings(&provider, &operation);
        if (table::contains(&registry.operation_counts, op_key)) {
            let count = table::borrow_mut(&mut registry.operation_counts, op_key);
            *count = *count + 1;
        } else {
            table::add(&mut registry.operation_counts, op_key, 1);
        };
        
        // Emit verification event
        event::emit(OperationVerified {
            provider,
            operation,
            verifier: tx_context::sender(ctx),
            timestamp,
            verification_id
        });
    }

    /// Verify an AI operation with full metadata (less private)
    public entry fun verify_operation_full(
        registry: &mut VerificationRegistry,
        provider: String,
        operation: String,
        input_hash: String,
        output_hash: String,
        metadata: String,
        timestamp: String,
        ctx: &mut TxContext
    ) {
        // Validate inputs
        assert!(is_valid_provider(&provider), E_INVALID_PROVIDER);
        assert!(is_valid_operation(&operation), E_INVALID_OPERATION);
        assert!(string::length(&input_hash) == 64, E_INVALID_HASH);
        assert!(string::length(&output_hash) == 64, E_INVALID_HASH);
        assert!(string::length(&timestamp) > 0 && string::length(&timestamp) <= 32, E_INVALID_HASH); // Timestamp validation
        assert!(string::length(&metadata) <= 1024, E_INVALID_HASH); // Metadata size limit
        assert!(is_valid_hash_format(&input_hash), E_INVALID_HASH);
        assert!(is_valid_hash_format(&output_hash), E_INVALID_HASH);
        
        // Create a verification ID (combination of provider, operation, and hashes)
        let verification_id = generate_verification_id(&provider, &operation, &input_hash, &output_hash);
        
        // Create the verification record
        let record = VerificationRecord {
            provider,
            operation: operation,
            input_hash,
            output_hash,
            metadata,
            timestamp,
            verifier: tx_context::sender(ctx)
        };
        
        // Add to registry
        table::add(&mut registry.verifications, verification_id, record);
        
        // Update operation count
        let op_key = concat_strings(&provider, &operation);
        if (table::contains(&registry.operation_counts, op_key)) {
            let count = table::borrow_mut(&mut registry.operation_counts, op_key);
            *count = *count + 1;
        } else {
            table::add(&mut registry.operation_counts, op_key, 1);
        };
        
        // Emit verification event
        event::emit(OperationVerified {
            provider,
            operation,
            verifier: tx_context::sender(ctx),
            timestamp,
            verification_id
        });
    }

    /// Check if a verification exists and is valid
    public fun is_verification_valid(
        registry: &VerificationRegistry,
        verification_id: String
    ): bool {
        table::contains(&registry.verifications, verification_id)
    }

    /// Get operation counts for a provider
    public fun get_operation_count(
        registry: &VerificationRegistry,
        provider: String,
        operation: String
    ): u64 {
        let op_key = concat_strings(&provider, &operation);
        if (table::contains(&registry.operation_counts, op_key)) {
            *table::borrow(&registry.operation_counts, op_key)
        } else {
            0
        }
    }

    // === Helper Functions ===

    /// Generate a verification ID from operation parameters
    fun generate_verification_id(
        provider: &String,
        operation: &String,
        input_hash: &String,
        output_hash: &String
    ): String {
        // In a real implementation, this would be a cryptographic hash of the parameters
        // For simplicity, we're just concatenating them
        let result = concat_strings(provider, operation);
        result = concat_strings(&result, input_hash);
        result = concat_strings(&result, output_hash);
        result
    }

    /// Concatenate two strings
    fun concat_strings(a: &String, b: &String): String {
        let result = *a;
        string::append(&mut result, *b);
        result
    }

    /// Validate provider name format
    fun is_valid_provider(provider: &String): bool {
        // Implement proper validation; this is a simple length check
        let provider_length = string::length(provider);
        provider_length > 2 && provider_length < 20
    }

    /// Validate operation name format
    fun is_valid_operation(operation: &String): bool {
        // Implement proper validation; this is a simple length check
        let operation_length = string::length(operation);
        operation_length > 2 && operation_length < 30
    }

    /// Validate hash format (hexadecimal characters)
    fun is_valid_hash_format(hash: &String): bool {
        // For now, just check length (64 chars for SHA-256)
        // In production, would validate all characters are hex digits
        let hash_length = string::length(hash);
        hash_length == 64
    }
}