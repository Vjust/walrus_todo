/// Module implementing NFT functionality for todos in the Walrus Todo application
module walrus_todo::todo_nft {
    use std::string::{Self, String};
    use std::option::{Self, Option};
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::url::{Self, Url};
    use sui::display;
    use sui::package;
    use sui::event;

    // Error codes
    const E_NOT_OWNER: u64 = 1;
    const E_INVALID_METADATA: u64 = 2;
    const E_INVALID_STATE: u64 = 3;
    const E_ALREADY_COMPLETED: u64 = 4;

    // One-time witness for the module
    struct TODO_NFT has drop {}

    /// Represents a todo as an NFT
    struct TodoNFT has key, store {
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
    struct TodoNFTCreated has copy, drop {
        todo_id: address,
        title: String,
        owner: address,
        timestamp: u64
    }

    /// Event emitted when a todo NFT is completed
    struct TodoNFTCompleted has copy, drop {
        todo_id: address,
        timestamp: u64
    }

    /// Event emitted when a todo NFT's metadata is updated
    struct TodoNFTUpdated has copy, drop {
        todo_id: address,
        timestamp: u64
    }

    /// Initialize the module with NFT display configuration
    fun init(witness: TODO_NFT, ctx: &mut TxContext) {
        let publisher = package::claim(witness, ctx);
        let display = display::new_with_fields(
            &publisher,
            vector[
                string::utf8(b"name"),
                string::utf8(b"description"),
                string::utf8(b"image_url"),
                string::utf8(b"status"),
                string::utf8(b"created_at"),
                string::utf8(b"completed_at"),
            ],
            vector[
                string::utf8(b"{title}"),
                string::utf8(b"{description}"),
                string::utf8(b"{image_url}"),
                string::utf8(b"{completed}"),
                string::utf8(b"{created_at}"),
                string::utf8(b"{completed_at}"),
            ],
            ctx
        );
        display::update_version(&mut display);
        transfer::public_transfer(publisher, tx_context::sender(ctx));
        transfer::public_transfer(display, tx_context::sender(ctx));
    }

    /// Creates a new todo NFT
    public entry fun create_todo_nft(
        title: String,
        description: String,
        image_url: vector<u8>,
        metadata: String,
        is_private: bool,
        ctx: &mut TxContext
    ) {
        let todo = TodoNFT {
            id: object::new(ctx),
            title,
            description,
            image_url: url::new_unsafe_from_bytes(image_url),
            completed: false,
            created_at: tx_context::epoch_timestamp_ms(ctx),
            completed_at: option::none(),
            owner: tx_context::sender(ctx),
            metadata,
            is_private
        };

        event::emit(TodoNFTCreated {
            todo_id: object::uid_to_address(&todo.id),
            title: todo.title,
            owner: todo.owner,
            timestamp: todo.created_at
        });

        transfer::transfer(todo, tx_context::sender(ctx));
    }

    /// Marks a todo NFT as completed
    public entry fun complete_todo_nft(
        todo: &mut TodoNFT,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == todo.owner, E_NOT_OWNER);
        assert!(!todo.completed, E_ALREADY_COMPLETED);

        todo.completed = true;
        todo.completed_at = option::some(tx_context::epoch_timestamp_ms(ctx));

        event::emit(TodoNFTCompleted {
            todo_id: object::uid_to_address(&todo.id),
            timestamp: tx_context::epoch_timestamp_ms(ctx)
        });
    }

    /// Updates a todo NFT's metadata
    public entry fun update_todo_nft(
        todo: &mut TodoNFT,
        title: Option<String>,
        description: Option<String>,
        image_url: Option<vector<u8>>,
        metadata: Option<String>,
        is_private: Option<bool>,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == todo.owner, E_NOT_OWNER);

        if (option::is_some(&title)) {
            todo.title = option::extract(&mut title);
        };
        if (option::is_some(&description)) {
            todo.description = option::extract(&mut description);
        };
        if (option::is_some(&image_url)) {
            todo.image_url = url::new_unsafe_from_bytes(option::extract(&mut image_url));
        };
        if (option::is_some(&metadata)) {
            todo.metadata = option::extract(&mut metadata);
        };
        if (option::is_some(&is_private)) {
            todo.is_private = option::extract(&mut is_private);
        };

        event::emit(TodoNFTUpdated {
            todo_id: object::uid_to_address(&todo.id),
            timestamp: tx_context::epoch_timestamp_ms(ctx)
        });
    }

    /// Transfers ownership of a todo NFT
    public entry fun transfer_todo_nft(
        todo: TodoNFT,
        recipient: address,
        _ctx: &mut TxContext
    ) {
        transfer::transfer(todo, recipient);
    }

    /// Burns (deletes) a todo NFT
    public entry fun burn_todo_nft(
        todo: TodoNFT,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == todo.owner, E_NOT_OWNER);
        let TodoNFT { id, title: _, description: _, image_url: _, completed: _,
                     created_at: _, completed_at: _, owner: _, metadata: _,
                     is_private: _ } = todo;
        object::delete(id);
    }

    // === Accessor Functions ===

    /// Returns whether the todo NFT is completed
    public fun is_completed(todo: &TodoNFT): bool {
        todo.completed
    }

    /// Returns whether the todo NFT is private
    public fun is_private(todo: &TodoNFT): bool {
        todo.is_private
    }

    /// Returns the owner of the todo NFT
    public fun get_owner(todo: &TodoNFT): address {
        todo.owner
    }

    /// Returns the creation timestamp of the todo NFT
    public fun get_created_at(todo: &TodoNFT): u64 {
        todo.created_at
    }

    /// Returns the completion timestamp of the todo NFT if completed
    public fun get_completed_at(todo: &TodoNFT): Option<u64> {
        todo.completed_at
    }

    /// Returns the title of the todo NFT (only if public or called by owner)
    public fun get_title(todo: &TodoNFT, ctx: &TxContext): String {
        assert!(!todo.is_private || tx_context::sender(ctx) == todo.owner, E_NOT_OWNER);
        todo.title
    }

    /// Returns the description of the todo NFT (only if public or called by owner)
    public fun get_description(todo: &TodoNFT, ctx: &TxContext): String {
        assert!(!todo.is_private || tx_context::sender(ctx) == todo.owner, E_NOT_OWNER);
        todo.description
    }

    /// Returns the metadata of the todo NFT (only if public or called by owner)
    public fun get_metadata(todo: &TodoNFT, ctx: &TxContext): String {
        assert!(!todo.is_private || tx_context::sender(ctx) == todo.owner, E_NOT_OWNER);
        todo.metadata
    }
}