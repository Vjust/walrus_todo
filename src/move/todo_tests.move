#[test_only]
module todo_app::todo_tests {
    use sui::test_scenario;
    use sui::tx_context;
    use todo_app::todo::{Self, TodoList, Todo};

    const OWNER: address = @0xCAFE;
    const TEST_TASK: vector<u8> = b"Test todo";

    #[test]
    fun test_create_todo_list() {
        let scenario = test_scenario::begin(OWNER);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            todo::create_todo_list(ctx);
        };
        
        // Verify todo list was created
        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let todo_list = test_scenario::take_from_sender<TodoList>(&scenario);
            assert!(todo::owner(&todo_list) == OWNER, 0);
            test_scenario::return_to_sender(&scenario, todo_list);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_add_todo() {
        let scenario = test_scenario::begin(OWNER);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            todo::create_todo_list(ctx);
        };
        
        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let todo_list = test_scenario::take_from_sender<TodoList>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            
            todo::add_todo(&mut todo_list, TEST_TASK, ctx);
            assert!(todo::todo_count(&todo_list) == 1, 1);
            
            test_scenario::return_to_sender(&scenario, todo_list);
        };
        test_scenario::end(scenario);
    }

    #[test]
    fun test_complete_todo() {
        let scenario = test_scenario::begin(OWNER);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            todo::create_todo_list(ctx);
        };
        
        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let todo_list = test_scenario::take_from_sender<TodoList>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            
            todo::add_todo(&mut todo_list, TEST_TASK, ctx);
            let todo_id = todo::get_last_todo_id(&todo_list);
            todo::complete_todo(&mut todo_list, todo_id);
            
            assert!(todo::is_todo_completed(&todo_list, todo_id), 2);
            test_scenario::return_to_sender(&scenario, todo_list);
        };
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = todo::ETodoNotFound)]
    fun test_complete_nonexistent_todo() {
        let scenario = test_scenario::begin(OWNER);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            todo::create_todo_list(ctx);
        };
        
        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let todo_list = test_scenario::take_from_sender<TodoList>(&scenario);
            todo::complete_todo(&mut todo_list, 999);
            test_scenario::return_to_sender(&scenario, todo_list);
        };
        test_scenario::end(scenario);
    }
} 