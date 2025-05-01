module todo_app::todo_nft {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::display;
    use sui::package;
    use std::string::{Self, String};
    use sui::url::{Self, Url};

    // Default image URL for todos
    const DEFAULT_IMAGE_URL: vector<u8> = b"https://raw.githubusercontent.com/YOUR_ACTUAL_USERNAME/walrus_todo/main/assets/todo_bottle.png";

    // One-time witness for the module
    struct TODO_NFT has drop {}

    // The Todo NFT structure
    struct TodoNFT has key, store {
        id: UID,
        title: String,
        description: String, 
        walrus_blob_id: String,
        completed: bool,
        image_url: Url
    }

    // Events
    struct TodoCreated has copy, drop {
        id: address,
        title: String,
        walrus_blob_id: String
    }

    struct TodoCompleted has copy, drop {
        id: address,
        title: String
    }

    // Initialize the module with NFT display
    fun init(witness: TODO_NFT, ctx: &mut TxContext) {
        // Define display properties for the NFT
        let keys = vector[
            string::utf8(b"name"),
            string::utf8(b"description"),
            string::utf8(b"image_url"),
            string::utf8(b"status"),
            string::utf8(b"external_url"),
            string::utf8(b"project_url")
        ];
        
        let values = vector[
            string::utf8(b"{title}"),
            string::utf8(b"{description}"),
            string::utf8(b"{image_url}"),
            string::utf8(b"Status: {completed}"),
            string::utf8(b"https://explorer.sui.io/object/{id}"),
            string::utf8(b"https://github.com/yourusername/walrus_todo")
        ];
        
        // Create the Publisher for display
        let publisher = package::claim(witness, ctx);
        
        // Create the Display
        let display = display::new_with_fields<TodoNFT>(
            &publisher, keys, values, ctx
        );
        
        // Set display version
        display::update_version(&mut display);
        
        // Transfer objects to the transaction sender
        transfer::public_transfer(publisher, tx_context::sender(ctx));
        transfer::public_transfer(display, tx_context::sender(ctx));
    }

    // Create a new Todo NFT
    public entry fun create_todo(
        title: vector<u8>,
        description: vector<u8>,
        walrus_blob_id: vector<u8>,
        image_url: vector<u8>,
        ctx: &mut TxContext
    ) {
        let title_str = string::utf8(title);
        let description_str = string::utf8(description);
        let walrus_blob_id_str = string::utf8(walrus_blob_id);
        
        // Use provided image_url if not empty, otherwise use default
        let image_url_str = if (std::vector::length(&image_url) > 0) {
            url::new_unsafe_from_bytes(image_url)
        } else {
            url::new_unsafe_from_bytes(DEFAULT_IMAGE_URL)
        };
        
        let todo = TodoNFT {
            id: object::new(ctx),
            title: title_str,
            description: description_str,
            walrus_blob_id: walrus_blob_id_str,
            completed: false,
            image_url: image_url_str
        };

        // Emit creation event
        event::emit(TodoCreated {
            id: object::uid_to_address(&todo.id),
            title: title_str,
            walrus_blob_id: walrus_blob_id_str
        });

        // Transfer to transaction sender
        transfer::public_transfer(todo, tx_context::sender(ctx));
    }

    // Mark a Todo as complete
    public entry fun complete_todo(todo: &mut TodoNFT, _ctx: &mut TxContext) {
        todo.completed = true;
        
        // Emit completion event
        event::emit(TodoCompleted {
            id: object::uid_to_address(&todo.id),
            title: todo.title
        });
    }

    // Accessors
    public fun title(todo: &TodoNFT): &String {
        &todo.title
    }

    public fun description(todo: &TodoNFT): &String {
        &todo.description
    }

    public fun walrus_blob_id(todo: &TodoNFT): &String {
        &todo.walrus_blob_id
    }

    public fun is_completed(todo: &TodoNFT): bool {
        todo.completed
    }
    
    public fun image_url(todo: &TodoNFT): &Url {
        &todo.image_url
    }
}