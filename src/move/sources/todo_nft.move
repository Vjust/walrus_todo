// Copyright (c) 2025, Walrus Todo Team
// SPDX-License-Identifier: MIT
//
// Module: todo_app::todo_nft
//
// Description:
// This smart contract module is part of the Walrus Todo application and enables the creation and management of TODO items as Non-Fungible Tokens (NFTs) on the Sui blockchain.
// By representing TODOs as NFTs, users can own unique digital assets that symbolize their tasks, which can be shared, displayed, or even traded if desired.
// This module integrates with Walrus storage to link TODO NFTs with images or other digital content, enhancing the visual and functional appeal of task management.
//
// Key Features:
// - **TODO NFT Creation**: Users can create unique TODO NFTs, each representing a specific task with a title, description, and associated digital content (like an image) stored on Walrus.
// - **Completion Tracking**: Allows marking a TODO NFT as completed, visually updating its status for the owner and others viewing it on the blockchain.
// - **Privacy Options**: Supports setting TODOs as private, hiding sensitive details like the title from public view while still maintaining blockchain transparency.
// - **Content Updates**: Enables updating the title, description, or associated digital content of a TODO NFT, ensuring flexibility as tasks evolve.
// - **Visual Display**: Configures how TODO NFTs appear in wallets and explorers with metadata like name, description, and image, making them easily recognizable.
// - **Event Notifications**: Emits events when TODOs are created or completed, allowing applications to notify users or update interfaces in real-time.
//
// Key Components:
// - **TodoNFT Struct**: Defines the properties of a TODO NFT, including title, description, completion status, privacy setting, and a link to content stored on Walrus.
// - **Display Setup**: Configures how TODO NFT metadata is shown in Sui-compatible wallets or explorers, enhancing user experience.
// - **Event Structs**: Includes structures for events like TODO creation and completion, facilitating integration with external systems or user interfaces.
// - **Functions**: Provides operations to create TODO NFTs, mark them as complete, update their details, and retrieve information for display or verification.
//
// This module works alongside other components of the Walrus Todo application to offer a unique blend of task management and digital ownership through blockchain technology.
module todo_app::todo_nft {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::display;
    use sui::package;
    use std::string::{Self, String};
    use sui::url::{Self, Url};

    // Walrus image URL format: https://blobid.walrus/

    // Error codes
    const EINVALID_BLOB_ID: u64 = 1;

    // One-time witness for the module
    struct TODO_NFT has drop {}

    // The Todo NFT structure
    struct TodoNFT has key, store {
        id: UID,
        title: String,
        description: String, 
        walrus_blob_id: String,
        completed: bool,
        image_url: Url,
        is_private: bool
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
            string::utf8(b"privacy"),
            string::utf8(b"external_url"),
            string::utf8(b"project_url")
        ];
        
        let values = vector[
            string::utf8(b"{title}"),
            string::utf8(b"{description}"),
            string::utf8(b"{image_url}"),
            string::utf8(b"Status: {completed}"),
            string::utf8(b"Private: {is_private}"),
            string::utf8(b"https://explorer.sui.io/object/{id}"),
            string::utf8(b"https://wal.app/")
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
        is_private: bool,
        ctx: &mut TxContext
    ) {
        let title_str = if (is_private) {
            string::utf8(b"Untitled")
        } else {
            string::utf8(title)
        };
        let description_str = string::utf8(description);
        let walrus_blob_id_str = string::utf8(walrus_blob_id);
        
        // Validate blob ID is not empty
        assert!(std::vector::length(&walrus_blob_id) > 0, EINVALID_BLOB_ID);
        
        // Construct image URL from Walrus blob ID using the correct aggregator URL
        let image_url_bytes = std::vector::empty<u8>();
        std::vector::append(&mut image_url_bytes, b"https://aggregator.walrus-testnet.walrus.space/v1/blobs/");
        std::vector::append(&mut image_url_bytes, walrus_blob_id);
        let image_url_str = url::new_unsafe_from_bytes(image_url_bytes);
        
        let todo = TodoNFT {
            id: object::new(ctx),
            title: title_str,
            description: description_str,
            walrus_blob_id: walrus_blob_id_str,
            completed: false,
            image_url: image_url_str,
            is_private: is_private
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

    // Update todo title
    public entry fun update_todo_title(todo: &mut TodoNFT, new_title: vector<u8>, ctx: &mut TxContext) {
        let new_title_str = string::utf8(new_title);
        todo.title = new_title_str;
    }

    // Update todo description
    public entry fun update_todo_description(todo: &mut TodoNFT, new_description: vector<u8>, ctx: &mut TxContext) {
        let new_description_str = string::utf8(new_description);
        todo.description = new_description_str;
    }

    // Update todo image URL
    public entry fun update_todo_image_url(todo: &mut TodoNFT, new_walrus_blob_id: vector<u8>, ctx: &mut TxContext) {
        // Validate new blob ID
        assert!(std::vector::length(&new_walrus_blob_id) > 0, EINVALID_BLOB_ID);
        
        // Update walrus blob ID
        todo.walrus_blob_id = string::utf8(new_walrus_blob_id);
        
        // Update image URL
        let image_url_bytes = std::vector::empty<u8>();
        std::vector::append(&mut image_url_bytes, b"https://aggregator.walrus-testnet.walrus.space/v1/blobs/");
        std::vector::append(&mut image_url_bytes, new_walrus_blob_id);
        todo.image_url = url::new_unsafe_from_bytes(image_url_bytes);
    }
}