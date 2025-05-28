module walrus_todo::todo {
    use std::string::String;
    use std::option::Option;
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::dynamic_field as df;
    use sui::table::{Self, Table};
    use sui::event;

    // Error codes
    const E_NOT_OWNER: u64 = 1;
    const E_TODO_NOT_FOUND: u64 = 2;
    const E_INVALID_STATUS: u64 = 3;

    // Todo status constants
    const STATUS_PENDING: u8 = 0;
    const STATUS_IN_PROGRESS: u8 = 1;
    const STATUS_COMPLETED: u8 = 2;
    const STATUS_ARCHIVED: u8 = 3;

    /// Represents a single todo item
    public struct Todo has key, store {
        id: UID,
        title: String,
        description: String,
        status: u8,
        created_at: u64,
        updated_at: u64,
        owner: address,
        priority: u8,
        due_date: Option<u64>
    }

    /// Represents a collection of todos
    public struct TodoList has key {
        id: UID,
        name: String,
        owner: address,
        created_at: u64,
        updated_at: u64,
        todos: Table<ID, Todo>
    }
    
    /// Event emitted when a new todo is created
    public struct TodoCreated has copy, drop {
        todo_id: ID,
        title: String,
        owner: address,
        timestamp: u64
    }

    /// Event emitted when a todo is marked as completed
    public struct TodoCompleted has copy, drop {
        todo_id: ID,
        owner: address,
        timestamp: u64
    }
    
    /// Creates a new todo list
    public entry fun create_list(
        name: String,
        ctx: &mut TxContext
    ) {
        let list = TodoList {
            id: object::new(ctx),
            name,
            owner: tx_context::sender(ctx),
            created_at: tx_context::epoch_timestamp_ms(ctx),
            updated_at: tx_context::epoch_timestamp_ms(ctx),
            todos: table::new(ctx)
        };
        transfer::share_object(list);
    }
    
    /// Creates a new todo item in a list
    public entry fun create_todo(
        list: &mut TodoList,
        title: String,
        description: String,
        priority: u8,
        due_date: Option<u64>,
        ctx: &mut TxContext
    ) {
        assert!(list.owner == tx_context::sender(ctx), E_NOT_OWNER);
        
        let todo = Todo {
            id: object::new(ctx),
            title,
            description,
            status: STATUS_PENDING,
            created_at: tx_context::epoch_timestamp_ms(ctx),
            updated_at: tx_context::epoch_timestamp_ms(ctx),
            owner: tx_context::sender(ctx),
            priority,
            due_date
        };

        let todo_id = object::id(&todo);
        table::add(&mut list.todos, todo_id, todo);
        list.updated_at = tx_context::epoch_timestamp_ms(ctx);

        event::emit(TodoCreated {
            todo_id,
            title,
            owner: tx_context::sender(ctx),
            timestamp: tx_context::epoch_timestamp_ms(ctx)
        });
    }

    /// Updates the status of a todo item
    public entry fun update_status(
        list: &mut TodoList,
        todo_id: ID,
        new_status: u8,
        ctx: &mut TxContext
    ) {
        assert!(list.owner == tx_context::sender(ctx), E_NOT_OWNER);
        assert!(table::contains(&list.todos, todo_id), E_TODO_NOT_FOUND);
        assert!(
            new_status == STATUS_PENDING ||
            new_status == STATUS_IN_PROGRESS ||
            new_status == STATUS_COMPLETED ||
            new_status == STATUS_ARCHIVED,
            E_INVALID_STATUS
        );

        let todo = table::borrow_mut(&mut list.todos, todo_id);
        let old_status = todo.status;
        todo.status = new_status;
        todo.updated_at = tx_context::epoch_timestamp_ms(ctx);
        list.updated_at = tx_context::epoch_timestamp_ms(ctx);

        if (new_status == STATUS_COMPLETED) {
            event::emit(TodoCompleted {
                todo_id,
                owner: todo.owner,
                timestamp: tx_context::epoch_timestamp_ms(ctx)
            });
        };
    }

    /// Returns whether a todo exists in a list
    public fun todo_exists(list: &TodoList, todo_id: ID): bool {
        table::contains(&list.todos, todo_id)
    }

    /// Returns the owner of a todo list
    public fun get_list_owner(list: &TodoList): address {
        list.owner
    }

    /// Returns the number of todos in a list
    public fun get_todo_count(list: &TodoList): u64 {
        table::length(&list.todos)
    }

    /// Returns whether a todo is completed
    public fun is_completed(list: &TodoList, todo_id: ID): bool {
        assert!(table::contains(&list.todos, todo_id), E_TODO_NOT_FOUND);
        let todo = table::borrow(&list.todos, todo_id);
        todo.status == STATUS_COMPLETED
    }
}
