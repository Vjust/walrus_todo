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
        timestamp: u64
    }

    /// Event emitted when a todo NFT's metadata is updated
    public struct TodoNFTUpdated has copy, drop {
        todo_id: address,
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

        let display_obj: Display<TodoNFT> = display::new_with_fields<TodoNFT>(
            &publisher,
            fields,
            values,
            ctx
        );

        display::update_version<TodoNFT>(&mut display_obj);

        transfer::public_transfer(publisher, tx_context::sender(ctx));
        transfer::public_transfer(display_obj, tx_context::sender(ctx));
    }

    // ... rest of the implementation remains the same ...
}
