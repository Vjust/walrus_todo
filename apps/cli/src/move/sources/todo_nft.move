/// Module implementing NFT functionality for todos in the Walrus Todo application
module walrus_todo::todo_nft {
    use std::string::{Self, String};
    use std::option::{Self, Option};
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::url::{Self, Url};
    use sui::display::{Self, Display};
    use sui::package;
    use sui::event;

    // Error codes
    const E_NOT_OWNER: u64 = 1;
    const E_INVALID_METADATA: u64 = 2;
    const E_INVALID_STATE: u64 = 3;
    const E_ALREADY_COMPLETED: u64 = 4;
    const E_INVALID_TITLE: u64 = 5;
    const E_INVALID_DESCRIPTION: u64 = 6;
    const E_INVALID_IMAGE_URL: u64 = 7;

    // One-time witness for the module
    public struct TODO_NFT has drop {}

    /// Represents a todo as an NFT
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

    /// Event emitted when a new todo NFT is created
    public struct TodoNFTCreated has copy, drop {
        todo_id: address,
        title: String,
        owner: address,
        timestamp: u64
    }

    /// Event emitted when a todo NFT is completed
    public struct TodoNFTCompleted has copy, drop {
        todo_id: address,
        owner: address,
        timestamp: u64
    }

    /// Event emitted when a todo NFT's metadata is updated
    public struct TodoNFTUpdated has copy, drop {
        todo_id: address,
        owner: address,
        timestamp: u64
    }

    /// Event emitted when a todo NFT is transferred
    public struct TodoNFTTransferred has copy, drop {
        todo_id: address,
        from: address,
        to: address,
        timestamp: u64
    }

    /// Initialize the module with NFT display configuration
    fun init(witness: TODO_NFT, ctx: &mut TxContext) {
        let publisher = package::claim(witness, ctx);

        let fields = vector[
            string::utf8(b"name"),
            string::utf8(b"description"),
            string::utf8(b"image_url"),
            string::utf8(b"status"),
            string::utf8(b"created_at"),
            string::utf8(b"completed_at")
        ];

        let values = vector[
            string::utf8(b"{title}"),
            string::utf8(b"{description}"),
            string::utf8(b"{image_url}"),
            string::utf8(b"{completed}"),
            string::utf8(b"{created_at}"),
            string::utf8(b"{completed_at}")
        ];

        let mut display_obj: Display<TodoNFT> = display::new_with_fields<TodoNFT>(
            &publisher,
            fields,
            values,
            ctx
        );

        display::update_version<TodoNFT>(&mut display_obj);

        transfer::public_transfer(publisher, tx_context::sender(ctx));
        transfer::public_transfer(display_obj, tx_context::sender(ctx));
    }

    /// Creates a new todo NFT
    public entry fun create_todo_nft(
        title: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        metadata: vector<u8>,
        is_private: bool,
        ctx: &mut TxContext
    ) {
        // Validate inputs
        assert!(title.length() > 0 && title.length() <= 256, E_INVALID_TITLE);
        assert!(description.length() <= 1024, E_INVALID_DESCRIPTION);
        assert!(image_url.length() > 0, E_INVALID_IMAGE_URL);

        let title_str = string::utf8(title);
        let description_str = string::utf8(description);
        let image_url_obj = url::new_unsafe_from_bytes(image_url);
        let metadata_str = string::utf8(metadata);
        let current_time = tx_context::epoch_timestamp_ms(ctx);
        let owner = tx_context::sender(ctx);

        let todo_nft = TodoNFT {
            id: object::new(ctx),
            title: title_str,
            description: description_str,
            image_url: image_url_obj,
            completed: false,
            created_at: current_time,
            completed_at: option::none(),
            owner,
            metadata: metadata_str,
            is_private
        };

        let todo_id = object::id_address(&todo_nft);

        // Emit creation event
        event::emit(TodoNFTCreated {
            todo_id,
            title: title_str,
            owner,
            timestamp: current_time
        });

        // Transfer to sender
        transfer::public_transfer(todo_nft, owner);
    }

    /// Alternative create function for compatibility with tests
    public entry fun create_todo(
        title: vector<u8>,
        description: vector<u8>,
        walrus_blob_id: vector<u8>,
        is_private: bool,
        ctx: &mut TxContext
    ) {
        // Use walrus blob ID as image URL for now
        create_todo_nft(title, description, walrus_blob_id, vector::empty(), is_private, ctx);
    }

    /// Marks a todo NFT as completed
    public entry fun complete_todo(
        todo_nft: &mut TodoNFT,
        ctx: &mut TxContext
    ) {
        // Validate owner
        assert!(todo_nft.owner == tx_context::sender(ctx), E_NOT_OWNER);
        assert!(!todo_nft.completed, E_ALREADY_COMPLETED);

        let current_time = tx_context::epoch_timestamp_ms(ctx);
        todo_nft.completed = true;
        todo_nft.completed_at = option::some(current_time);

        let todo_id = object::id_address(todo_nft);

        // Emit completion event
        event::emit(TodoNFTCompleted {
            todo_id,
            owner: todo_nft.owner,
            timestamp: current_time
        });
    }

    /// Updates the metadata of a todo NFT
    public entry fun update_metadata(
        todo_nft: &mut TodoNFT,
        new_metadata: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Validate owner
        assert!(todo_nft.owner == tx_context::sender(ctx), E_NOT_OWNER);
        assert!(new_metadata.length() <= 2048, E_INVALID_METADATA);

        todo_nft.metadata = string::utf8(new_metadata);
        
        let todo_id = object::id_address(todo_nft);
        let current_time = tx_context::epoch_timestamp_ms(ctx);

        // Emit update event
        event::emit(TodoNFTUpdated {
            todo_id,
            owner: todo_nft.owner,
            timestamp: current_time
        });
    }

    /// Updates the title and description of a todo NFT
    public entry fun update_todo_content(
        todo_nft: &mut TodoNFT,
        new_title: vector<u8>,
        new_description: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Validate owner
        assert!(todo_nft.owner == tx_context::sender(ctx), E_NOT_OWNER);
        assert!(new_title.length() > 0 && new_title.length() <= 256, E_INVALID_TITLE);
        assert!(new_description.length() <= 1024, E_INVALID_DESCRIPTION);

        todo_nft.title = string::utf8(new_title);
        todo_nft.description = string::utf8(new_description);
        
        let todo_id = object::id_address(todo_nft);
        let current_time = tx_context::epoch_timestamp_ms(ctx);

        // Emit update event
        event::emit(TodoNFTUpdated {
            todo_id,
            owner: todo_nft.owner,
            timestamp: current_time
        });
    }

    /// Custom transfer function with event emission
    public entry fun transfer_todo_nft(
        mut todo_nft: TodoNFT,
        recipient: address,
        ctx: &mut TxContext
    ) {
        // Validate current owner
        assert!(todo_nft.owner == tx_context::sender(ctx), E_NOT_OWNER);

        let todo_id = object::id_address(&todo_nft);
        let from = todo_nft.owner;
        let current_time = tx_context::epoch_timestamp_ms(ctx);

        // Emit transfer event before changing owner
        event::emit(TodoNFTTransferred {
            todo_id,
            from,
            to: recipient,
            timestamp: current_time
        });

        // Update owner in NFT
        todo_nft.owner = recipient;

        // Transfer NFT
        transfer::public_transfer(todo_nft, recipient);
    }

    // === Getter Functions ===

    /// Returns the title of a todo NFT
    public fun title(todo_nft: &TodoNFT): &String {
        &todo_nft.title
    }

    /// Returns the description of a todo NFT
    public fun description(todo_nft: &TodoNFT): &String {
        &todo_nft.description
    }

    /// Returns the image URL of a todo NFT
    public fun image_url(todo_nft: &TodoNFT): &Url {
        &todo_nft.image_url
    }

    /// Returns the image URL as a string (for compatibility)
    public fun walrus_blob_id(todo_nft: &TodoNFT): String {
        let ascii_url = url::inner_url(&todo_nft.image_url);
        string::from_ascii(ascii_url)
    }

    /// Returns whether a todo NFT is completed
    public fun is_completed(todo_nft: &TodoNFT): bool {
        todo_nft.completed
    }

    /// Returns the creation timestamp of a todo NFT
    public fun created_at(todo_nft: &TodoNFT): u64 {
        todo_nft.created_at
    }

    /// Returns the completion timestamp of a todo NFT (if completed)
    public fun completed_at(todo_nft: &TodoNFT): &Option<u64> {
        &todo_nft.completed_at
    }

    /// Returns the owner of a todo NFT
    public fun owner(todo_nft: &TodoNFT): address {
        todo_nft.owner
    }

    /// Returns the metadata of a todo NFT
    public fun metadata(todo_nft: &TodoNFT): &String {
        &todo_nft.metadata
    }

    /// Returns whether a todo NFT is private
    public fun is_private(todo_nft: &TodoNFT): bool {
        todo_nft.is_private
    }

    /// Returns the UID of a todo NFT
    public fun uid(todo_nft: &TodoNFT): &UID {
        &todo_nft.id
    }

    /// Returns a summary of the todo NFT status
    public fun get_todo_summary(todo_nft: &TodoNFT): (String, String, bool, u64, address) {
        (
            todo_nft.title,
            todo_nft.description,
            todo_nft.completed,
            todo_nft.created_at,
            todo_nft.owner
        )
    }

    /// Checks if a todo NFT can be completed
    public fun can_complete(todo_nft: &TodoNFT, sender: address): bool {
        todo_nft.owner == sender && !todo_nft.completed
    }

    /// Checks if a todo NFT can be updated by a sender
    public fun can_update(todo_nft: &TodoNFT, sender: address): bool {
        todo_nft.owner == sender
    }

    /// Returns the time elapsed since creation (in milliseconds)
    public fun time_since_creation(todo_nft: &TodoNFT, current_time: u64): u64 {
        if (current_time >= todo_nft.created_at) {
            current_time - todo_nft.created_at
        } else {
            0
        }
    }

    /// Returns the time elapsed since completion (in milliseconds)
    public fun time_since_completion(todo_nft: &TodoNFT, current_time: u64): u64 {
        if (option::is_some(&todo_nft.completed_at)) {
            let completed_time = *option::borrow(&todo_nft.completed_at);
            if (current_time >= completed_time) {
                current_time - completed_time
            } else {
                0
            }
        } else {
            0
        }
    }
}