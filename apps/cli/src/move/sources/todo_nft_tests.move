// Copyright (c) 2025, Walrus Todo Team
// SPDX-License-Identifier: MIT
//
// Module: todo_app::todo_nft_tests
//
// Description:
// This module is part of the Walrus Todo application and contains test functions for the TODO NFT smart contract on the Sui blockchain.
// These tests are designed to ensure that the TODO NFT functionality works as expected, verifying the creation and management of TODO items as unique digital assets.
// This module is crucial for developers to validate the integrity and reliability of the TODO NFT features before deployment to the blockchain.
//
// Key Features:
// - **NFT Creation Test**: Verifies that a TODO NFT can be created with the correct details such as title, description, and associated digital content identifier.
// - **NFT Completion Test**: Confirms that a TODO NFT can be marked as completed, ensuring the status update is accurately reflected in the NFT's properties.
// - **Simulation Environment**: Uses a test scenario framework to simulate blockchain transactions and interactions, mimicking real-world usage without actual blockchain deployment.
//
// Key Components:
// - **Test Functions**: Includes specific tests like 'test_create_todo_nft' for creating TODO NFTs and 'test_complete_todo_nft' for marking them as completed.
// - **Assertions**: Employs checks within tests to ensure that the NFT properties match expected values after operations are performed.
// - **Test Scenario**: Utilizes Sui's test scenario module to create a controlled environment for testing, ensuring accurate and repeatable results.
//
// This module supports the development process by providing a means to test and refine the TODO NFT smart contract, ensuring a robust user experience in the Walrus Todo application.
#[test_only]
module walrus_todo::todo_nft_tests {
    use sui::test_scenario;
    use sui::tx_context;
    use walrus_todo::todo_nft::{Self, TodoNFT};
    use std::string;
    use sui::object;

    const OWNER: address = @0xCAFE;
    
    #[test]
    fun test_create_todo_nft() {
        let scenario = test_scenario::begin(OWNER);
        
        // Create a todo NFT
        {
            let ctx = test_scenario::ctx(&mut scenario);
            todo_nft::create_todo(
                b"Test Todo",
                b"A test todo description",
                b"test-walrus-blob-id-123",
                false, // is_private
                ctx
            );
        };
        
        // Verify todo NFT was created with correct values
        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let todo = test_scenario::take_from_sender<TodoNFT>(&scenario);
            
            let todo_id = object::id_address(&todo);
            let ctx_sender = tx_context::sender(test_scenario::ctx(&mut scenario));
            
            assert!(todo_id == ctx_sender, 0);
            assert!(todo_nft::title(&todo) == &string::utf8(b"Test Todo"), 1);
            assert!(todo_nft::description(&todo) == &string::utf8(b"A test todo description"), 2);
            assert!(todo_nft::walrus_blob_id(&todo) == &string::utf8(b"test-walrus-blob-id-123"), 3);
            assert!(!todo_nft::is_completed(&todo), 4);
            
            test_scenario::return_to_sender(&scenario, todo);
        };
        
        test_scenario::end(scenario);
    }
    
    #[test]
    fun test_complete_todo_nft() {
        let scenario = test_scenario::begin(OWNER);
        
        // Create a todo NFT
        {
            let ctx = test_scenario::ctx(&mut scenario);
            todo_nft::create_todo(
                b"Test Todo",
                b"A test todo description",
                b"test-walrus-blob-id-123",
                false, // is_private
                ctx
            );
        };
        
        // Mark todo as completed
        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let todo = test_scenario::take_from_sender<TodoNFT>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            
            todo_nft::complete_todo(&mut todo, ctx);
            assert!(todo_nft::is_completed(&todo), 0);
            
            test_scenario::return_to_sender(&scenario, todo);
        };
        
        test_scenario::end(scenario);
    }
}