/// Simple TodoNFT module for Walrus Todo application
/// Creates transferable NFT-based todos on the Sui blockchain
module walrus_todo::todo_nft {
    use std::string::{Self, String};
    use sui::event;
    use sui::url::{Self, Url};

    /// TodoNFT represents a todo item as an NFT
    public struct TodoNFT has key, store {
        id: UID,
        title: String,
        description: String,
        image_url: Url,
        completed: bool,
        created_at: u64,
        completed_at: Option<u64>,
        owner: address,
        metadata: String,
        is_private: bool
    }

    /// Event: TodoNFT created
    public struct TodoNFTCreated has copy, drop {
        todo_id: address,
        title: String,
        owner: address,
        timestamp: u64
    }

    /// Event: TodoNFT completed
    public struct TodoNFTCompleted has copy, drop {
        todo_id: address,
        owner: address,
        timestamp: u64
    }

    /// Event: TodoNFT updated
    public struct TodoNFTUpdated has copy, drop {
        todo_id: address,
        owner: address,
        timestamp: u64
    }

    /// Create a new TodoNFT
    public entry fun create_todo(
        title: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        metadata: vector<u8>,
        is_private: bool,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let todo_id = object::new(ctx);
        let todo_address = object::uid_to_address(&todo_id);
        
        let todo = TodoNFT {
            id: todo_id,
            title: string::utf8(title),
            description: string::utf8(description),
            image_url: url::new_unsafe_from_bytes(image_url),
            completed: false,
            created_at: tx_context::epoch_timestamp_ms(ctx),
            completed_at: option::none(),
            owner: sender,
            metadata: string::utf8(metadata),
            is_private
        };

        // Emit creation event
        event::emit(TodoNFTCreated {
            todo_id: todo_address,
            title: todo.title,
            owner: sender,
            timestamp: todo.created_at
        });

        transfer::public_transfer(todo, sender);
    }

    /// Complete a TodoNFT
    public entry fun complete_todo(
        todo_nft: &mut TodoNFT,
        ctx: &mut TxContext
    ) {
        assert!(!todo_nft.completed, 0); // Todo already completed
        
        todo_nft.completed = true;
        todo_nft.completed_at = option::some(tx_context::epoch_timestamp_ms(ctx));

        // Emit completion event
        event::emit(TodoNFTCompleted {
            todo_id: object::uid_to_address(&todo_nft.id),
            owner: tx_context::sender(ctx),
            timestamp: tx_context::epoch_timestamp_ms(ctx)
        });
    }

    /// Update TodoNFT content
    public entry fun update_todo_content(
        todo_nft: &mut TodoNFT,
        new_title: vector<u8>,
        new_description: vector<u8>,
        ctx: &mut TxContext
    ) {
        todo_nft.title = string::utf8(new_title);
        todo_nft.description = string::utf8(new_description);

        // Emit update event
        event::emit(TodoNFTUpdated {
            todo_id: object::uid_to_address(&todo_nft.id),
            owner: tx_context::sender(ctx),
            timestamp: tx_context::epoch_timestamp_ms(ctx)
        });
    }

    /// Delete a TodoNFT
    public entry fun delete_todo(
        todo_nft: TodoNFT,
        _ctx: &mut TxContext
    ) {
        let TodoNFT { 
            id, 
            title: _, 
            description: _, 
            image_url: _, 
            completed: _, 
            created_at: _, 
            completed_at: _, 
            owner: _, 
            metadata: _, 
            is_private: _ 
        } = todo_nft;
        
        object::delete(id);
    }

    // === View Functions ===

    /// Get TodoNFT title
    public fun get_title(todo_nft: &TodoNFT): String {
        todo_nft.title
    }

    /// Get TodoNFT description  
    public fun get_description(todo_nft: &TodoNFT): String {
        todo_nft.description
    }

    /// Check if TodoNFT is completed
    public fun is_completed(todo_nft: &TodoNFT): bool {
        todo_nft.completed
    }

    /// Get TodoNFT owner
    public fun get_owner(todo_nft: &TodoNFT): address {
        todo_nft.owner
    }

    /// Get TodoNFT metadata
    public fun get_metadata(todo_nft: &TodoNFT): String {
        todo_nft.metadata
    }
}