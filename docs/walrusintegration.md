# Walrus Integration for Todo List Apps

## 1. Introduction to Walrus

Walrus is a decentralized storage and data availability protocol built on the Sui Network. It separates on-chain metadata and coordination (handled by Sui smart contracts and objects) from off-chain storage (handled by Walrus-specific services and nodes). This design enables scalable, secure, and programmable storage for large data blobs (images, videos, files, etc), making it ideal for todo list applications with attachments.

## 2. System Architecture for Todo Apps

A Walrus-powered todo list app is structured in layers:
- **Frontend:** React/TypeScript application for user interface
- **Blockchain Layer:** Sui smart contracts (Move) for task ownership, completion status, and metadata
- **Storage Layer:** Walrus protocol for decentralized storage of task details and attachments
- **Aggregator/Publisher:** Services that expose HTTP APIs for blob upload/download

### Advantages vs. Traditional Todo Apps

| Feature            | Traditional Approach         | Walrus/Sui Approach                |
|--------------------|-----------------------------|------------------------------------|
| File Storage       | Centralized (AWS S3)        | Decentralized (multi-node, erasure coded)  |
| Metadata Storage   | SQL Database                | Immutable Sui blockchain           |
| Censorship Risk    | High (Single provider)      | Low (Global node distribution)     |
| Cost for 1GB Files | ~$23/month (S3 Standard)    | 0.08 WAL/GB/month                  |

0.08 WAL ≈ $0.0315 USD at the current exchange rate. (April 18, 2025)

## 3. Walrus Components

### On Sui (On-chain)
- **Walrus System Object:** Manages the storage infrastructure behind your todo app
- **Storage Resources:** Reserve space for your users' todo lists and attachments
- **Blob Resources:** Each todo item's content is represented as a blob resource
- **Events:** Track todo creation, updates, and completion through on-chain events

You can inspect these objects using the Sui explorer. For more details, see the [quick reference to the Walrus Sui structures](https://docs.wal.app/dev-guide/sui-struct.html).

### Walrus-specific Services (Off-chain)
- **Client (CLI/SDK):** Used locally or by services to interact with Walrus. Provides a Command Line Interface (CLI), JSON API, and [HTTP API](https://docs.wal.app/usage/web-api.html).
- **Aggregator Services:** Allow reading todo data via HTTP requests.
- **Publisher Services:** Handle storing new todos and attachments to Walrus.
- **Storage Nodes:** Store encoded todo data and form the decentralized storage infrastructure.

End users of your todo app will typically interact with your application frontend, which in turn uses Aggregator and Publisher services via HTTP APIs.

## 4. Todo List Workflow with Walrus

### Lifecycle of Todos in Walrus

1. **Creation:**
    - User creates todo in frontend
    - Todo data is uploaded to Walrus Publisher/Aggregator
    - Walrus returns a blobId
    - blobId is registered with Sui smart contract (creates Blob Resource)
    - Smart contract emits a TodoCreated event
2. **Reading:**
    - App queries Sui for todo references
    - For each todo, retrieve the Walrus blobId
    - Fetch todo data from Walrus using blobId
    - Combine on-chain state (completed status) with off-chain data
3. **Updating:**
    - User updates todo in frontend
    - Updated todo data is uploaded to Walrus as a new blob
    - Smart contract is called to update the blobId reference (ensure atomicity or handle potential inconsistencies if one step fails)
    - Old blob can be marked for garbage collection
4. **Deleting:**
    - User marks todo as deleted in frontend
    - Smart contract is called to mark todo as deleted
    - Reference to Walrus blob is removed from on-chain storage
    - Smart contract emits a TodoDeleted event

### Implementation Example

#### 1. Task Creation
- Users input task details (text) and can optionally attach files (images, docs).
- **Frontend:** Captures input via a web form (e.g., Svelte/React).
- **Attachments:** Files are uploaded to a Walrus Publisher or Aggregator via HTTP API or SDK, which returns a `blob_id`.

#### 2. On-Chain Metadata Storage (Sui)
- Task data (text, due date, `blob_id`) is registered on Sui via a Move smart contract, creating or updating a Blob Resource:

```move
struct Task has key {
    id: UID,
    description: String,
    blob_id: String,
    completed: bool,
    owner: address
}
```

- This creates an immutable record of task ownership and status, and links on-chain state to off-chain storage.

#### 3. Efficient File Storage (Walrus)
Walrus automatically:
- Splits files into shards using erasure coding
- Distributes shards across multiple storage nodes
- Stores proof of availability on Sui (Availability Attestation)

## 5. Technical Implementation Details

### On-Chain Integration with Sui

Walrus integrates with Sui by representing each stored todo blob as an on-chain `Blob` object, always linked to a `Storage` object that reserves space for a set period (epochs).

**Key Sui Structures:**
```move
// Storage resource for a given period
public struct Storage has key, store {
    id: UID,
    start_epoch: u32,
    end_epoch: u32,
    storage_size: u64,
}

// Blob registered with storage, can be certified as available
public struct Blob has key, store {
    id: UID,
    registered_epoch: u32,
    blob_id: u256,
    size: u64,
    encoding_type: u8,
    certified_epoch: option::Option<u32>,
    storage: Storage,
    deletable: bool,
}
```

- **Blob Registration:** When a todo is uploaded, a Blob object is registered on Sui, referencing the blob ID and associated storage.
- **Certification:** Once enough shards are stored, the blob is certified (`certified_epoch` is set), guaranteeing its availability for the reserved period.
- **Deletable Blobs:** If `deletable` is true, blobs can be deleted to reclaim storage resources.
- **Events:** Sui emits events for BlobRegistered, BlobCertified, and BlobDeleted, which can be tracked for app logic and user notifications.

**Lifecycle Example:**
- On todo creation, a Blob is registered and linked to a Storage object.
- Certification ensures the blob is available for the full storage period.
- Deletion removes the on-chain reference, and most of the Sui is refunded.

For more, see the [Walrus Sui Structures Guide](https://docs.wal.app/dev-guide/sui-struct.html).

### Walrus Operations: Storing and Retrieving Todo Data

Walrus enables efficient, decentralized storage and retrieval of data blobs—ideal for persisting todo lists:

- **Blob Storage:** Each todo list is stored as a blob. The blob ID is generated deterministically from its content.
- **Storing Data:** Use Walrus client APIs or publisher endpoints to encode and store blobs. For web applications, interacting via the [Walrus HTTP API](https://docs.wal.app/usage/web-api.html) from a backend service or directly (if CORS configured) is common. SDKs might be used within backend services (e.g., Node.js).
- **Retrieving Data:** Blobs can be fetched using their blob ID. Walrus reconstructs the data from distributed storage nodes.
- **Availability & Certification:** Storage is guaranteed for a set number of epochs (e.g., 2 weeks on Mainnet).
- **Blob Size:** Individual blobs can be up to 13.3 GiB; larger attachments should be chunked.

**Example CLI Commands:**
- Generate a blob ID: `walrus blob-id <file path>`
- Check storage info: `walrus info`
- Check blob status: `walrus blob-status <blob id>`

For more details, see the [Walrus Operations Guide](https://docs.wal.app/dev-guide/dev-operations.html).

**Error Handling Considerations:**
- Implement robust error handling for Walrus operations (e.g., upload failures, network issues, blob not found).
- Handle potential failures during Sui transaction submission (e.g., insufficient gas, network errors, contract reverts).
- Consider retry mechanisms for transient network errors.

### Storage Costs and Optimization

Walrus storage costs have four main sources:

- **Storage Resources:** Paid in WAL tokens for reserved capacity multiplied by duration in epochs. The current rate is **0.08 WAL per GiB per epoch** (an epoch is currently ~2 weeks on Mainnet).
- **Upload Costs:** A small fee in WAL tokens for registering each blob. The current rate is **0.0001 WAL per blob**.
- **Sui Transactions:** Standard SUI gas fees apply for all on-chain actions like registering blobs or managing storage resources.
- **On-Chain Objects:** Standard SUI storage fees are required for the on-chain `Blob` and `Storage` objects. Most of this cost is refundable when the objects are deleted.

**Cost Management Tips:**
- Acquire larger storage resources at once to minimize SUI gas fees per GiB.
- Use the subsidy contract (default in CLI) for potentially lower WAL costs when available.
- Delete and burn expired or unneeded blobs and their associated `Blob` objects to reclaim SUI storage fees.
- Group multiple blob operations (e.g., registering several blobs) into a single Sui transaction where possible.

For the latest pricing details and examples, see the [Walrus Costs Guide](https://docs.wal.app/dev-guide/costs.html).

## 6. Data Security and Encryption

All todo data stored on Walrus is public and discoverable by default. For sensitive tasks or personal information:

### Encryption with Seal

For robust encryption and onchain access control, use [Seal](https://github.com/MystenLabs/seal):
- Encrypts data using threshold encryption (no single party holds the full key)
- Allows onchain access policies to control who can decrypt and under what conditions
- Enables secure sharing of todo lists with specific team members

**Use Cases for Todo Apps:**
- Secure personal tasks with sensitive information
- Share encrypted todo lists with a trusted team
- Create time-locked tasks that reveal details only at specific times

For more, see the [Seal design docs](https://github.com/MystenLabs/seal/blob/main/Design.md) and [Using Seal guide](https://github.com/MystenLabs/seal/blob/main/UsingSeal.md).

## 7. Hosting Your Todo App with Walrus Sites

### Overview

Walrus Sites allow you to host your todo list frontend directly on Walrus, leveraging Sui and Walrus for a fully decentralized experience.

**Key benefits:**
- **No servers required:** Simply publish your built frontend files to Walrus
- **Decentralized & censorship-resistant:** Your site is stored on Walrus, ensuring high availability
- **Sui Integration:** Sites are owned by Sui addresses and can use [SuiNS](https://suins.io/) for human-readable names
- **Programmable:** While sites are static, they can integrate with Sui wallets and smart contracts for dynamic functionality

### Deployment Process

1. Build your frontend (React, Svelte, etc.) as a static site
2. Use the [Walrus site-builder tool](https://docs.wal.app/walrus-sites/overview.html) to publish your site to Walrus
3. Share your Walrus Site link (e.g., `https://yourname.wal.app`) with users
4. Integrate Sui wallet support for user authentication and onchain todo management

### Technical Details

**How Walrus Sites Store and Serve Content:**
- All site resources (HTML, CSS, JS, images, etc.) are stored as blobs on Walrus
- Each site is represented by an object on Sui, which references these blobs
- When a user visits your site, a portal (like [https://wal.app](https://wal.app)) resolves the name, fetches resources from Sui, and serves content from Walrus

**Known Limitations:**
- All site content is public; never store secrets in your site files
- See the [official restrictions documentation](https://docs.wal.app/walrus-sites/restrictions.html) for more details

### Custom Domains and SuiNS

You can use SuiNS to give your todo app a memorable name:

1. Go to [suins.io](https://suins.io) (mainnet) or [testnet.suins.io](https://testnet.suins.io) (testnet)
2. Purchase a domain name with your Sui wallet (e.g., `mytodoapp`)
3. Link it to your Walrus Site
4. Your site will be accessible at `https://mytodoapp.wal.app`

For custom domains (e.g., `mytodoapp.com`), see the [custom domain guide](https://docs.wal.app/walrus-sites/bring-your-own-domain.html).

## 8. Development Environment and Tools

**Core Tools for Todo App Development:**
- **Sui Tools:** Sui CLI, wallet with SUI tokens, Sui fullnodes (utilize Sui Testnet for development and testing)
- **Walrus Tools:** Walrus client binary, SDK, or HTTP API, WAL tokens (use Testnet endpoints and faucet for development)
- **Frontend:** React/TypeScript, Sui dApp Kit for wallet integration
- **Encryption (Optional):** Seal SDK for sensitive todos
- **Deployment:** Walrus site builder for hosting the frontend

**Development Stack:**

*   **Smart Contracts:**
  *   **Tools:** Sui CLI, Move language, VS Code (or preferred editor)
  *   **Purpose:** Define on-chain logic for task ownership, completion status, permissions, and linking to Walrus blobs.
*   **Storage Layer:**
  *   **Tools:** Walrus CLI (or SDK/API), Sui wallet (for managing storage resources)
  *   **Purpose:** Store the actual content of todos and any associated file attachments decentrally using Walrus.
*   **Encryption (Optional):**
  *   **Tools:** Seal SDK
  *   **Purpose:** Encrypt sensitive todo data before storing it on Walrus, using threshold encryption and on-chain access control.
*   **Data Access:**
  *   **Tools:** Walrus HTTP API, potentially custom backend APIs (Aggregators/Publishers)
  *   **Purpose:** Provide endpoints for the frontend to upload (write) and download (read) todo data and attachments from Walrus.
*   **Frontend Application:**
  *   **Tools:** React, TypeScript, Sui JS SDK (or similar for wallet interaction)
  *   **Purpose:** Build the user interface, handle user input, interact with the Sui wallet, and communicate with data access APIs.
*   **Deployment (Frontend Hosting):**
  *   **Tools:** Walrus site builder tool
  *   **Purpose:** Host the static frontend application directly on the decentralized Walrus network as a Walrus Site. (Test deployment on Testnet first).

For details on Walrus architecture, encoding, and operations, see the [Walrus documentation](https://docs.wal.app).

---

## Additional Resources

- [Walrus HTTP API](https://docs.wal.app/usage/web-api.html)
- [Walrus CLI](https://docs.wal.app/usage/client-cli.html)
- [Walrus JSON API](https://docs.wal.app/usage/json-api.html)
- [Sui Developer Documentation](https://docs.sui.io/build)
- [Seal Encryption SDK](https://github.com/MystenLabs/seal)
- [Walrus Sites Documentation](https://docs.wal.app/walrus-sites/intro.html)


