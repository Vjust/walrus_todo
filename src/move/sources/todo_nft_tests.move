#[test_only]
module todo_app::todo_nft_tests {
    use sui::test_scenario;
    use sui::tx_context;
    use todo_app::todo_nft::{Self, TodoNFT};
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