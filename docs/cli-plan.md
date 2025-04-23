# Todo List CLI Implementation Plan for Sui Blockchain with Walrus Storage

## 1. Introduction and Overview

This implementation plan outlines the creation of a command-line interface (CLI) tool that allows users to interact with a todo list application built on the Sui blockchain while leveraging the Walrus storage protocol for efficient data management.

## 2. System Architecture

### 2.1 High-Level Architecture

The CLI tool will serve as an alternative interface to the web application, enabling users to manage their todos directly from the terminal. It will connect to both the Sui blockchain for transaction processing and the Walrus storage protocol for storing all todo data in a decentralized manner.

![Architecture Diagram]

The architecture consists of:
- CLI interface written in TypeScript
- Sui TypeScript SDK for blockchain interactions
- Walrus Protocol integration for decentralized storage of all todo content
- Smart contracts on Sui blockchain for access control and reference management

**Key Design Decision**: All todo data will be stored on Walrus, with the Sui blockchain maintaining only references to the data. This ensures true decentralization of user data.

### 2.2 Project Structure

```
sui-todo-cli/
├── src/
│   ├── commands/          # Command implementations
│   │   ├── add.ts
│   │   ├── list.ts
│   │   ├── update.ts
│   │   ├── complete.ts
│   │   ├── delete.ts
│   │   └── configure.ts
│   ├── services/          # Core services
│   │   ├── sui-service.ts # Sui blockchain interaction
│   │   ├── walrus-service.ts # Walrus protocol interactions
│   │   └── config-service.ts # Config management
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript type definitions
│   ├── constants.ts       # Constant values
│   └── index.ts           # Entry point
├── package.json
├── tsconfig.json
└── README.md
```

## 3. CLI Interface Design

### 3.1 Core Todo Management Commands

```
# Creating and managing todo items
waltodo create --name <list-name>                   - Create a new todo list (stored on Walrus)
waltodo add --list <list-name> --task <description> [options]  - Add a new todo item
  Options:
    -p, --priority <level>    Set priority level (high|medium|low)
    -d, --due <date>          Set due date (YYYY-MM-DD)
    -t, --tags <tags>         Add comma-separated tags
    --encrypt                 Encrypt this todo item using the Seal protocol
    --private                 Mark todo as private (stored locally only)
```

### 3.2 List and Item Management Commands

```
# Viewing and modifying todos
waltodo list [--list <list-name>] [options]         - List all todos
  Options:
    --completed               Show only completed items
    --pending                 Show only pending items
    --encrypted               Show encrypted items (requires authentication)
    --shared                  Show todos shared with you

waltodo update --list <list-name> --id <id> [options]  - Update a todo's content
waltodo complete --list <list-name> --id <id>          - Mark a todo as complete
waltodo uncomplete --list <list-name> --id <id>        - Mark a todo as incomplete
waltodo delete --list <list-name> --id <id>            - Delete a todo item
```

### 3.3 Blockchain and Sharing Commands

```
# Blockchain operations
waltodo publish --list <list-name>                    - Publish list to blockchain
waltodo sync --list <list-name>                       - Sync with blockchain state
waltodo share --list <list-name> --recipient <address> - Share a todo list
```

### 3.4 Configuration Commands

```
# Configuration and account
waltodo configure                    - Set up blockchain connection and wallet settings
waltodo account                      - Show current account information and balance
waltodo network [name]               - Switch between devnet, testnet, and mainnet
```

## 4. Technical Implementation

### 4.1 Development Environment Setup

#### Prerequisites

- Node.js (v16+)
- npm or pnpm
- Sui CLI 
- Walrus CLI

#### Initial Setup

```bash
# Create project directory
mkdir sui-todo-cli
cd sui-todo-cli

# Initialize package
npm init -y

# Install dependencies
npm install typescript @types/node ts-node --save-dev
npm install @mysten/sui commander chalk inquirer @inquirer/prompts

# Set up TypeScript
npx tsc --init
```

The `tsconfig.json` should include:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "types": ["node"],
    "resolveJsonModule": true
  },
  "exclude": ["node_modules"]
}
```

### 4.2 Walrus Storage Integration

The foundation of our design is storing all todo data in the Walrus decentralized storage:

#### Storing Todo Content

```typescript
// Store all todo content in Walrus
async function storeInWalrus(todoData: object) {
  // Initialize Walrus protocol client
  const walrusClient = new WalrusClient(suiClient);
  
  // Serialize and store the complete todo data
  const dataId = await walrusClient.store(JSON.stringify(todoData));
  
  return dataId;
}
```

#### Retrieving Todo Content

```typescript
// Retrieve todo content from Walrus
async function retrieveFromWalrus(dataId: string) {
  const walrusClient = new WalrusClient(suiClient);
  
  // Get content using the reference ID
  const serializedContent = await walrusClient.retrieve(dataId);
  
  // Parse the JSON data
  const todoData = JSON.parse(serializedContent);
  
  return todoData;
}
```

### 4.3 Blockchain Integration

#### Connecting to Sui Network

```typescript
import { SuiClient } from '@mysten/sui/client';

// Connect to the appropriate Sui network
const client = new SuiClient({
  url: getFullnodeUrl('testnet') // Or mainnet as appropriate
});
```

#### Wallet Management

```typescript
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';

// Generate or import keypair
const keypair = Ed25519Keypair.fromSecretKey(
  fromB64('your-base64-private-key')
);

// Get address
const address = keypair.getPublicKey().toSuiAddress();
```

#### Transaction Handling

```typescript
// Example: Calling the smart contract to add a todo
const tx = new TransactionBlock();

// First store all todo data in Walrus
const todoData = {
  description,
  priority,
  dueDate,
  tags,
  createdAt: new Date().toISOString()
};

// Store entire todo data in Walrus
const walrusBlobId = await walrusClient.store(JSON.stringify(todoData));

// Only store the reference to the data in the blockchain
tx.moveCall({
  target: `${packageId}::todo_list::add_todo_reference`,
  arguments: [
    tx.pure(listId),
    tx.pure(walrusBlobId) // Reference to complete data stored in Walrus
  ]
});

const result = await client.signAndExecuteTransactionBlock({
  transactionBlock: tx,
  signer: keypair,
});
```

### 4.4 Smart Contract Architecture

```move
module todo_list {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    
    // Todo item structure - only stores references to data in Walrus
    struct TodoItem has key, store {
        id: UID,
        walrus_blob_id: vector<u8>, // Reference to complete data stored in Walrus
        completed: bool,
        created_at: u64
    }
    
    // Todo list structure
    struct TodoList has key {
        id: UID,
        owner: address,
        todos: Table<u64, TodoItem>,
        todo_count: u64
    }
    
    // Functions for add, update, complete, delete that manage references
    // Actual data manipulation happens off-chain via Walrus
    // ...
}
```

### 4.5 Command Implementation

```typescript
// Command: waltodo add --list "My Tasks" --task "Buy groceries"
async function addTodo(listName: string, description: string, options: any) {
  // Get the list ID
  const listId = await getListId(listName);
  
  // Create the complete todo data structure
  const todoData = {
    description,
    priority: options.priority || "medium",
    dueDate: options.due || null,
    tags: options.tags ? options.tags.split(',') : [],
    encrypted: options.encrypt || false,
    createdAt: new Date().toISOString(),
    completed: false
  };

  // Always store the complete data in Walrus
  const walrusBlobId = await storeInWalrus(todoData);

  // Construct transaction to call smart contract - only storing the reference
  const tx = new TransactionBlock();
  tx.moveCall({
    target: `${packageId}::todo_list::add_todo_reference`,
    arguments: [
      tx.object(listId),
      tx.pure(walrusBlobId)
    ]
  });

  // Execute transaction
  const result = await suiClient.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    signer: keypair,
  });

  console.log(`Todo added successfully! Transaction ID: ${result.digest}`);
}
```

## 5. User Experience Enhancements

### 5.1 Interactive Prompts

```typescript
import inquirer from 'inquirer';

// Example: Interactive prompt for adding a todo
async function interactiveAddTodo() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'What do you need to do?'
    },
    {
      type: 'confirm',
      name: 'priority',
      message: 'Is this a high priority task?',
      default: false
    }
  ]);

  // Process the user input
  await addTodo(answers.description, { priority: answers.priority });
}
```

### 5.2 Progress Indicators

```typescript
import ora from 'ora';

async function executeWithSpinner(transactionPromise, message) {
  const spinner = ora(message).start();
  try {
    const result = await transactionPromise;
    spinner.succeed('Transaction completed successfully!');
    return result;
  } catch (error) {
    spinner.fail(`Transaction failed: ${error.message}`);
    throw error;
  }
}
```

## 6. Collaborative Features

### 6.1 Shared Object Fundamentals

Sui's architecture provides four distinct ownership models:
1. **Single Owner**: Exclusive control by one address
2. **Object-Owned**: Child objects in parent-child hierarchies
3. **Shared Immutable**: Read-only access for all
4. **Shared Mutable**: Coordinated write access through consensus

For collaborative todo lists, we utilize **shared mutable objects** combined with custom authorization logic to enable multi-party editing while maintaining security.

Unlike owned objects that bypass consensus, shared object transactions require sequencing through Sui's consensus mechanism. This ensures:
```math
\forall t_1,t_2 \in T: (t_1 \prec t_2) \lor (t_2 \prec t_1)
```
Where T represents transactions modifying the shared todo list. This linearizability guarantee prevents race conditions in collaborative editing.

### 6.2 Capability-Based Access Control

In the context of Sui and Move programming, "capabilities" refers to a design pattern that implements access control through dedicated objects rather than direct address-based permissions. A capability is essentially a token of authority that grants its holder the right to perform specific actions.

#### Key Characteristics of Capabilities

1. **Object-Oriented Permissions**: Unlike traditional role-based access control that ties permissions directly to user addresses, capabilities exist as separate objects that can be:
   - Passed as arguments to functions
   - Stored in other objects
   - Transferred between users
   - Created with fine-grained permission scopes

2. **Principle of Least Privilege**: Capabilities allow for minimal permission grants, where users receive only the specific access rights they need.

3. **Compositional Security**: Different capabilities can be combined to create complex access control systems.

#### Implementation in Todo Application

```move
// A capability that grants the right to edit a specific todo list
struct EditCapability has key {
    id: UID,
    list_id: ID,
    permission_level: u8  // Could be different levels (read-only, edit, admin)
}

// A capability that grants the right to add collaborators
struct AdminCapability has key {
    id: UID,
    list_id: ID
}
```

#### Capability Flow

1. **Creation**: When a user creates a todo list, they automatically receive the primary capabilities:

```move
public fun create_list(ctx: &mut TxContext) {
    // Create the list...
    
    // Create and transfer capabilities to the creator
    let edit_cap = EditCapability {
        id: object::new(ctx),
        list_id: object::id(&list),
        permission_level: 2  // Admin level
    };
    
    transfer::transfer(edit_cap, tx_context::sender(ctx));
}
```

2. **Delegation**: List owners can share specific capabilities with others:

```move
public fun delegate_edit_access(
    admin_cap: &AdminCapability,
    recipient: address,
    list_id: ID,
    ctx: &mut TxContext
) {
    // Verify admin cap matches the list
    assert!(admin_cap.list_id == list_id, EInvalidCapability);
    
    // Create a limited capability for the collaborator
    let edit_cap = EditCapability {
        id: object::new(ctx),
        list_id,
        permission_level: 1  // Edit but not admin
    };
    
    transfer::transfer(edit_cap, recipient);
}
```

3. **Verification**: Operations check for the required capability:

```move
public fun add_todo_item(
    list: &mut TodoList,
    edit_cap: &EditCapability,
    description: String
) {
    // Verify capability matches this list and has sufficient permission
    assert!(edit_cap.list_id == object::id(list), EInvalidCapability);
    assert!(edit_cap.permission_level >= 1, EInsufficientPermission);
    
    // Add the todo item
    // ...
}
```

4. **Revocation**: Capabilities can be revoked by the admin:

```move
public fun revoke_capability(
    admin_cap: &AdminCapability,
    edit_cap: EditCapability
) {
    // Verify admin has authority over this capability
    assert!(admin_cap.list_id == edit_cap.list_id, EInvalidCapability);
    
    // Destroy the capability
    let EditCapability { id, list_id: _, permission_level: _ } = edit_cap;
    object::delete(id);
}
```

### 6.3 Collaborative Contract Architecture

```move
module todo_list::collaborative {
    use sui::object::{Self, UID};
    use sui::dynamic_field;
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;

    struct TodoList has key {
        id: UID,
        items: vector<TodoItem>,
        collaborators: vector<address>,
        version: u64
    }

    struct TodoItem {
        description: vector<u8>,
        completed: bool,
        created_at: u64
    }

    struct EditCapability has key {
        id: UID,
        list_id: ID
    }
}
```

### 6.4 Transaction Flow for Collaborative Editing

```move
public entry fun add_item(
    list: &mut TodoList,
    description: vector<u8>,
    ctx: &mut TxContext
) acquires EditCapability {
    assert!(is_collaborator(list, tx_context::sender(ctx)), 0);
    
    let new_item = TodoItem {
        description,
        completed: false,
        created_at: timestamp::now()
    };
    
    vector::push_back(&mut list.items, new_item);
    list.version = list.version + 1;
}
```

### 6.5 Conflict Resolution Strategy

Using optimistic concurrency control:
```move
public fun update_item(
    list: &mut TodoList,
    item_index: u64,
    new_description: vector<u8>,
    client_version: u64
) {
    assert!(list.version == client_version, EVersionMismatch);
    // Proceed with update
}
```

### 6.6 Advanced Implementation Techniques

#### Delta-State Updates

Delta-state updates allow for efficient synchronization of changes by transmitting only the differences (deltas) rather than the entire state. This approach minimizes data transfer, reduces processing overhead, and ensures faster updates in collaborative environments.
```move
struct TodoDelta {
    added: vector<TodoItem>,
    removed: vector<u64>,
    updated: vector<(u64, vector<u8>)>
}

public fun apply_delta(
    list: &mut TodoList,
    delta: TodoDelta
) {
    // Process added items and append them to the list
    for item in &delta.added {
        vector::push_back(&mut list.items, *item);
    }

    // Process removed items by their indices
    for index in &delta.removed {
        vector::remove(&mut list.items, *index);
    }

    // Process updated items and modify the corresponding entries
    for (index, new_description) in &delta.updated {
        list.items[*index].description = *new_description;
public fun link_lists(
    project: &mut Project,
    list_id: ID
) {
    // Check if the list ID already exists in the component_lists
    let exists = vector::contains(&project.component_lists, &list_id);
    assert!(!exists, "List ID is already linked to the project");

    vector::push_back(
        &mut project.component_lists,
        list_id
    );
}
    id: UID,
    component_lists: vector<ID>
}

public fun link_lists(
    project: &mut Project,
    list_id: ID
) {
    vector::push_back(
        &mut project.component_lists,
        list_id
    );
}
```



## 7. Conclusion: Bringing It All Together

This document has laid out a comprehensive approach to building a decentralized todo application that leverages both the Sui blockchain and Walrus storage protocol. By combining these technologies, we've designed a system that offers the best of both worlds:

### 7.1 The Power of Hybrid Architecture

The hybrid architecture we've outlined provides several key advantages:

1. **Decentralized Data Storage**: By storing all todo content on Walrus, we ensure that user data remains truly decentralized and resistant to censorship.

2. **Efficient Blockchain Utilization**: By only storing references on-chain, we minimize gas costs and blockchain bloat while maintaining verifiable links to our data.

3. **Encryption and Privacy**: The integration with Walrus's Seal protocol allows for encrypted storage of sensitive todos when needed.

4. **Collaboration Through Shared Objects**: Sui's shared object model enables true multi-user interaction without sacrificing security or performance.

### 7.2 From CLI to Full Application Suite

This CLI implementation serves as a cornerstone of a broader application ecosystem:

1. **Multi-Platform Support**: While web interfaces are common, the CLI provides power users with a fast, scriptable interface.

2. **Integration Potential**: The modular structure enables future integrations with calendar apps, project management tools, and notification systems.

3. **Extensibility**: The command structure can be expanded to support additional features like recurring tasks, priorities, and more detailed metadata.

### 7.3 Next Steps Beyond Implementation

After completing the implementation plan outlined in this document, several exciting directions could be explored:

1. **Mobile Apps**: Develop companion mobile applications that leverage the same blockchain and storage architecture.

2. **Smart Integrations**: Create integrations with popular productivity tools and calendaring systems.

3. **Advanced Collaborative Features**: Implement real-time collaboration using Sui's shared objects and optimistic concurrency patterns.

4. **Incentive Mechanisms**: Explore adding token-based incentives for task completion or contribution to shared lists.

By combining efficient CLI interfaces with powerful blockchain capabilities and decentralized storage, this todo application demonstrates how web3 technologies can enhance everyday productivity tools while providing users with true ownership and control of their data.

## References

[1] Shared Objects - Sui Documentation https://docs.sui.io/concepts/object-ownership/shared  
[2] Build on Sui Blockchain: A Comprehensive Deep Dive https://metaschool.so/articles/build-on-sui-blockchain/  
[3] Ownership - The Move Book https://move-book.com/object/ownership.html  
[4] Shared versus Owned Objects - Sui Documentation https://docs.sui.io/guides/developer/sui-101/shared-owned  
[5] A Study on Shared Objects in Sui Smart Contracts - arXiv https://arxiv.org/abs/2406.15002  
[6] Ownership - Sui Move Intro Course https://intro.sui-book.com/unit-two/lessons/2_ownership.html  
[7] Shared Object - Sui Move by Example https://examples.sui-book.com/basics/shared-object.html  
[8] Objects.md at main - GitHub https://github.com/dsrvlabs/sui-mystenlabs/blob/main/doc/src/learn/objects.md  
[9] Object Ownership - Sui Documentation https://docs.sui.io/concepts/object-ownership  
[10] All About Objects - The Sui Blog https://blog.sui.io/all-about-objects/