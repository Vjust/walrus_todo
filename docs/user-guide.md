# Walrus Todo User Guide

## Introduction

Welcome to the Walrus Todo User Guide. Walrus Todo is a command-line interface (CLI) tool designed to help you manage your TODO lists with the added benefits of blockchain technology. By integrating with the Sui Network and Walrus decentralized storage, Walrus Todo offers a secure, scalable, and innovative way to handle your tasks, including features like NFT integration for unique task representation and decentralized storage for data persistence.

This guide provides an overview of the Walrus Todo project, explains the functionality of its major components, and demonstrates how they work together to deliver a seamless TODO management experience. Whether you're a user looking to organize tasks or a client exploring the capabilities of this tool, this document will help you understand the key features and benefits of Walrus Todo.

## Project Overview

Walrus Todo is built to address the limitations of traditional TODO applications by leveraging blockchain and decentralized storage technologies. Here's what sets it apart:

- **Decentralized Storage**: Unlike traditional apps that rely on centralized servers (e.g., AWS S3), Walrus Todo uses Walrus, a decentralized storage protocol on the Sui Network, to store TODO data and attachments securely across multiple nodes.
- **Immutable Metadata**: Task ownership, status, and metadata are stored on the Sui blockchain, ensuring transparency and immutability.
- **Cost Efficiency**: Storage costs are significantly lower compared to traditional cloud services, with Walrus charging approximately 0.08 WAL per GB per month (about $0.0315 USD as of April 2025).
- **Enhanced Security**: Options for encryption ensure sensitive TODO data remains private, even on a public decentralized network.

The tool is designed as a CLI, making it easy to integrate into scripts and workflows, and it supports a range of operations from creating and updating tasks to sharing them with others and managing storage resources.

## CLI Commands

The Walrus Todo CLI provides a comprehensive set of commands to manage your TODO lists. Below is a summary of the primary commands and their functionalities:

- **Basic Operations**:
  - `wal_todo add <wallet-spec> <todo-file> <blob-path>`: Add a new TODO item from a JSON file to the specified blockchain storage path.
  - `wal_todo ls`: List all your TODO items, providing an overview of tasks associated with your account.
  - `wal_todo share <blob-id or todo-id> <address>`: Share a TODO item with another user by specifying the TODO or blob ID and the recipient's blockchain address.
  - `wal_todo rm <blob-id or todo-id>`: Remove a TODO item, deleting it from your list and potentially reclaiming storage space.

- **TODO Management**:
  - Create, read, update, and delete (CRUD) operations for managing individual tasks.
  - Mark tasks as complete to track progress.
  - Share tasks with contacts for collaboration.

- **Storage Management**:
  - `walrus-todo storage`: Display a summary of your storage allocation, including total size, used space, and expiration details.
  - `walrus-todo storage --detail`: Show detailed information about all storage objects, including status indicators (active, almost full, expiring soon, expired).
  - `walrus-todo storage --analyze`: Analyze storage efficiency and receive recommendations for optimizing usage and reducing costs with WAL token savings.

These commands are designed to be intuitive, allowing users to manage tasks and storage resources efficiently from the terminal.

## Backend Services and Utilities

Walrus Todo is supported by a robust backend that handles the interaction between the CLI, blockchain, and storage layers. Key components include:

- **Todo Service**: Manages the core functionality of TODO items, including creation, updates, deletion, and retrieval. It interfaces with both Sui for metadata and Walrus for data storage.
- **Config Service**: Handles user configuration settings, such as wallet specifications and network preferences, ensuring seamless connectivity to the Sui Network.
- **Storage Utilities**: Tools like `sui-nft-storage` and `walrus-storage` manage the interaction with blockchain storage, optimizing data placement and retrieval. Utilities also include smart storage reuse and best-fit algorithms to minimize costs.
- **Image and NFT Utilities**: Support for uploading images and creating NFTs associated with TODO items, adding a unique digital collectible aspect to task management.

These services and utilities work behind the scenes to ensure data integrity, optimize storage costs, and provide a smooth user experience through the CLI.

## Blockchain Integration

Walrus Todo integrates with the Sui Network and Walrus protocol to provide decentralized storage and metadata management. Here's how these technologies are utilized:

- **Sui Network (On-Chain)**:
  - Stores metadata for TODO items, such as ownership, completion status, and links to storage blobs, in immutable smart contracts written in Move language.
  - Key structures include `Storage` objects for reserving space and `Blob` objects for representing TODO content, ensuring data availability for specified periods.
  - Emits events for TODO creation, updates, and deletion, which can be tracked for application logic and user notifications.

- **Walrus Protocol (Off-Chain)**:
  - Provides decentralized storage for TODO data and attachments, using erasure coding to split data into shards distributed across multiple storage nodes.
  - Offers cost-effective storage at 0.08 WAL per GB per epoch (approximately 2 weeks on Mainnet), with additional small fees for blob registration.
  - Supports retrieval of TODO content via blob IDs, which are linked to on-chain metadata for a complete view of tasks.

- **Security and Encryption**:
  - By default, data on Walrus is public, but sensitive TODOs can be encrypted using Seal, a threshold encryption system that allows on-chain access control policies for secure sharing.

This integration ensures that your TODO data is both secure and accessible, with metadata immutably recorded on the blockchain and content stored decentrally for resilience against censorship and data loss.

## How Components Work Together

The components of Walrus Todo interact in a layered architecture to deliver a cohesive TODO management system:

1. **User Interaction via CLI**: Users interact with Walrus Todo through the command-line interface, issuing commands to add, list, share, or manage TODOs and storage resources.
2. **Backend Processing**: The CLI communicates with backend services like Todo Service and Config Service to process user requests, handling data serialization and user settings.
3. **Blockchain and Storage Operations**:
   - Metadata (e.g., task ownership, status) is registered or updated on the Sui Network via smart contracts.
   - TODO content and attachments are uploaded to Walrus decentralized storage, with blob IDs returned and linked to on-chain records.
   - When retrieving TODOs, the system queries Sui for metadata and uses associated blob IDs to fetch content from Walrus.
4. **Optimization and Security**: Storage utilities optimize data placement to reduce costs, while encryption options ensure sensitive data remains private.

This workflow ensures that users experience a seamless interface for managing tasks, while the backend handles the complexity of blockchain transactions, decentralized storage, and data security.

## Conclusion

Walrus Todo combines the simplicity of a CLI tool with the power of blockchain and decentralized storage technologies to offer a unique TODO management solution. By understanding the CLI commands, backend services, and blockchain integration outlined in this guide, users and clients can fully leverage the capabilities of Walrus Todo for personal organization or collaborative projects. This tool not only enhances data security and reduces storage costs but also introduces innovative features like NFT integration, making task management both functional and engaging.