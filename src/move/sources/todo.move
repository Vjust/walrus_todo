module todo_app::todo {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::dynamic_field as df;
    use std::string::{Self, String};
    // use std::vector;

    // Error codes
    const ETodoNotFound: u64 = 0;
    const ENotAuthorized: u64 = 1;

    // ===== Structs =====

    // A Todo item
    struct Todo has store {
        id: u64,
        task: String,
        completed: bool,
        created_at: u64
    }

    // A list of todos
    struct TodoList has key {
        id: UID,
        owner: address,
        last_id: u64,
        created_at: u64
    }

    // ===== Public Functions =====

    // Create a new todo list
    public entry fun create_todo_list(ctx: &mut TxContext) {
        let todo_list = TodoList {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            last_id: 0,
            created_at: tx_context::epoch(ctx)
        };

        transfer::share_object(todo_list);
    }

    // Add a new todo to the list
    public entry fun add_todo(list: &mut TodoList, task: vector<u8>, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(list.owner == sender, ENotAuthorized);

        let id = list.last_id + 1;
        let todo = Todo {
            id,
            task: string::utf8(task),
            completed: false,
            created_at: tx_context::epoch(ctx)
        };

        df::add(&mut list.id, id, todo);
        list.last_id = id;
    }

    // Mark a todo as completed
    public entry fun complete_todo(list: &mut TodoList, todo_id: u64) {
        assert!(df::exists_(&list.id, todo_id), ETodoNotFound);
        
        let todo = df::borrow_mut<u64, Todo>(&mut list.id, todo_id);
        todo.completed = true;
    }

    // ===== Accessor Functions =====

    // Get the owner of a todo list
    public fun owner(list: &TodoList): address {
        list.owner
    }

    // Get the number of todos in a list
    public fun todo_count(list: &TodoList): u64 {
        list.last_id
    }

    // Get the last todo ID
    public fun get_last_todo_id(list: &TodoList): u64 {
        list.last_id
    }

    // Check if a todo is completed
    public fun is_todo_completed(list: &TodoList, todo_id: u64): bool {
        assert!(df::exists_(&list.id, todo_id), ETodoNotFound);
        let todo = df::borrow<u64, Todo>(&list.id, todo_id);
        todo.completed
    }
}