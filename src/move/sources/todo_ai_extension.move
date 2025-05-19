module walrus_todo::todo_ai_extension {
    use std::string::{Self, String};
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use sui::event;
    use sui::dynamic_field as df;
    use std::vector; // Add this line

    use walrus_todo::ai_operation_verifier::{Self, VerificationRegistry};

    /// Error codes
    const E_UNAUTHORIZED: u64 = 1;
    const E_TODO_NOT_FOUND: u64 = 2;
    const E_VERIFICATION_NOT_FOUND: u64 = 3;
    const E_INVALID_TODO_ID: u64 = 4;
    const E_INVALID_VERIFICATION_ID: u64 = 5;

    /// Events
    struct VerificationLinked has copy, drop {
        todo_id: String,
        verification_id: String,
        operation: String,
        timestamp: String
    }

    /// Registry for linking todos to AI verifications
    struct TodoAIRegistry has key {
        id: UID,
        // Maps todo IDs to a table of verification IDs
        todo_verifications: Table<String, Table<String, VerificationLink>>,
        admin: address
    }

    /// Verification link record
    struct VerificationLink has store, drop {
        todo_id: String,
        verification_id: String,
        operation: String,
        timestamp: String
    }

    // Dynamic field keys
    struct AIVerificationKey has store, copy, drop {}

    // === Initialization ===

    fun init(ctx: &mut TxContext) {
        // Create and share the todo AI registry
        let registry = TodoAIRegistry {
            id: object::new(ctx),
            todo_verifications: table::new(ctx),
            admin: tx_context::sender(ctx)
        };
        transfer::share_object(registry);
    }

    // === Public Functions ===

    /// Link a verification to a todo
    public entry fun link_verification_to_todo(
        registry: &mut TodoAIRegistry,
        todo_id: String,
        verification_id: String,
        operation: String, 
        timestamp: String,
        ctx: &mut TxContext
    ) {
        // Validate inputs
        assert!(string::length(&todo_id) > 0, E_INVALID_TODO_ID);
        assert!(string::length(&verification_id) > 0, E_INVALID_VERIFICATION_ID);
        
        // Create inner table if it does not exist
        if (!table::contains(&registry.todo_verifications, todo_id)) {
            table::add(
                &mut registry.todo_verifications, 
                todo_id, 
                table::new(ctx)
            );
        };
        
        // Get the inner table
        let inner_table = table::borrow_mut(
            &mut registry.todo_verifications, 
            todo_id
        );
        
        // Create the verification link
        let link = VerificationLink {
            todo_id: todo_id,
            verification_id: verification_id,
            operation,
            timestamp
        };
        
        // Add to inner table
        table::add(inner_table, verification_id, link);
        
        // Emit verification link event
        event::emit(VerificationLinked {
            todo_id,
            verification_id,
            operation,
            timestamp
        });
    }

    /// Check if a todo has a verification for an operation
    public fun has_verification_for_operation(
        registry: &TodoAIRegistry,
        todo_id: String,
        operation: String
    ): bool {
        // Check if todo exists in registry
        if (!table::contains(&registry.todo_verifications, todo_id)) {
            return false
        };
        
        // Get the inner table
        let inner_table = table::borrow(
            &registry.todo_verifications, 
            todo_id
        );
        
        // Iterate through verification links to find matching operation
        let i = 0;
        let size = table::length(inner_table);
        let keys = table::keys_vector(inner_table); // Use keys_vector
        
        while (i < size) {
            let verification_id = *vector::borrow(&keys, i);
            let link = table::borrow(inner_table, verification_id);
            
            if (link.operation == operation) {
                return true
            };
            
            i = i + 1;
        };
        
        false
    }

    /// Get verification IDs for a todo
    public fun get_verifications_for_todo(
        registry: &TodoAIRegistry,
        todo_id: String
    ): vector<String> { // Use vector<String>
        let result = vector::empty<String>();
        
        // Check if todo exists in registry
        if (!table::contains(&registry.todo_verifications, todo_id)) {
            return result
        };
        
        // Get the inner table keys (verification IDs)
        let inner_table = table::borrow(
            &registry.todo_verifications, 
            todo_id
        );
        
        // Return all verification IDs
        table::keys_vector(inner_table) // Use keys_vector
    }

    /// Verify that a specific todo has a valid AI verification for an operation
    public fun verify_todo_operation(
        todo_registry: &TodoAIRegistry,
        verification_registry: &VerificationRegistry,
        todo_id: String,
        operation: String
    ): bool {
        // Check if todo has verifications
        if (!table::contains(&todo_registry.todo_verifications, todo_id)) {
            return false
        };
        
        // Get the inner table
        let inner_table = table::borrow(
            &todo_registry.todo_verifications, 
            todo_id
        );
        
        // Iterate through verification links to find matching operation
        let i = 0;
        let size = table::length(inner_table);
        let keys = table::keys_vector(inner_table); // Use keys_vector
        
        while (i < size) {
            let verification_id = *vector::borrow(&keys, i);
            let link = table::borrow(inner_table, verification_id);
            
            if (link.operation == operation) {
                // Verify this verification ID is valid in the verification registry
                return ai_operation_verifier::is_verification_valid(
                    verification_registry,
                    verification_id
                )
            };
            
            i = i + 1;
        };
        
        false
    }

    // === Helper Functions ===

    /// Add a verification field to a todo object
    public fun add_verification_to_todo<T: key + store>( // Add store ability
        todo: &mut T,
        verification_id: String
    ) {
        let uid = object::uid_mut(todo); // Get UID from todo
        if (df::exists_<AIVerificationKey>(uid)) { // Use UID
            let current_verifications = df::borrow_mut<AIVerificationKey, vector<String>>( // Use vector<String>
                uid, 
                AIVerificationKey {}
            );
            vector::push_back(current_verifications, verification_id);
        } else {
            let verifications = vector::singleton(verification_id);
            df::add(uid, AIVerificationKey {}, verifications); // Use UID
        }
    }

    /// Get verifications for a todo object
    public fun get_todo_verifications<T: key>(
        todo: &T
    ): vector<String> { // Use vector<String>
        let uid = object::uid_as_inner(todo); // Get UID from todo
        if (df::exists_<AIVerificationKey>(uid)) { // Use UID
            *df::borrow<AIVerificationKey, vector<String>>( // Use vector<String>
                uid, 
                AIVerificationKey {}
            )
        } else {
            vector::empty<String>()
        }
    }
}
