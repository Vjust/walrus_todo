"use strict";
/**
 * Sui Blockchain Service
 * Handles interaction with Sui blockchain
 * Manages smart contract calls and transaction submission
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.suiService = void 0;
const ed25519_1 = require("@mysten/sui/keypairs/ed25519");
const transactions_1 = require("@mysten/sui/transactions");
const client_1 = require("@mysten/sui/client");
const bcs_1 = require("@mysten/sui/bcs");
const utils_1 = require("@mysten/sui/utils");
const config_service_1 = require("./config-service");
const constants_1 = require("../constants");
/**
 * Manages blockchain operations for todo lists
 * Handles transaction submission and state synchronization
 */
class SuiService {
    constructor() {
        const config = config_service_1.configService.getConfig();
        this.client = new client_1.SuiClient({ url: constants_1.NETWORK_URLS[config.network] });
    }
    getKeypair() {
        const config = config_service_1.configService.getConfig();
        if (!config.privateKey) {
            throw new Error('Private key not configured. Run `waltodo configure` first.');
        }
        return ed25519_1.Ed25519Keypair.fromSecretKey((0, utils_1.fromB64)(config.privateKey));
    }
    /**
     * Publishes a todo list to the blockchain
     * @param listName - Name of the todo list
     * @param todoList - Todo list data to publish
     * @returns Promise<void>
     */
    async publishList(listName, todoList) {
        const tx = new transactions_1.Transaction();
        // Create new todo list on chain with references to Walrus blobs
        tx.moveCall({
            target: `${constants_1.PACKAGE_CONFIG.ID}::${constants_1.PACKAGE_CONFIG.MODULE}::create_list`,
            arguments: [
                bcs_1.bcs.string().serialize(listName),
                bcs_1.bcs.u64().serialize(BigInt(todoList.version)),
                bcs_1.bcs.vector(bcs_1.bcs.string()).serialize(todoList.todos.map(todo => todo.walrusBlobId || ''))
            ]
        });
        const keypair = this.getKeypair();
        await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: {
                showEffects: true
            }
        });
    }
    /**
     * Retrieves todo list state from blockchain
     * @param listName - Name of the todo list
     * @returns Promise<TodoList | null>
     */
    async getListState(listName) {
        const config = config_service_1.configService.getConfig();
        try {
            // Query the blockchain for list data
            const objects = await this.client.getOwnedObjects({
                owner: config.walletAddress,
                filter: {
                    MatchAll: [
                        { StructType: `${constants_1.PACKAGE_CONFIG.ID}::${constants_1.PACKAGE_CONFIG.MODULE}::TodoList` }
                    ]
                }
            });
            // Find the specific list
            for (const obj of objects.data) {
                if (!obj.data)
                    continue;
                const details = await this.client.getObject({
                    id: obj.data.objectId,
                    options: { showContent: true }
                });
                const content = details.data?.content;
                if (content && 'fields' in content) {
                    const fields = content.fields;
                    if (fields.name === listName) {
                        return {
                            id: obj.data.objectId,
                            name: fields.name,
                            owner: config.walletAddress,
                            todos: [], // Actual todos are stored in Walrus, these are just references
                            version: parseInt(fields.version),
                            collaborators: fields.collaborators || []
                        };
                    }
                }
            }
            return null;
        }
        catch (error) {
            console.error('Error getting list state:', error);
            return null;
        }
    }
    async updateListVersion(listId, newVersion) {
        const tx = new transactions_1.Transaction();
        tx.moveCall({
            target: `${constants_1.PACKAGE_CONFIG.ID}::${constants_1.PACKAGE_CONFIG.MODULE}::update_version`,
            arguments: [
                tx.object(listId),
                bcs_1.bcs.u64().serialize(BigInt(newVersion))
            ]
        });
        const keypair = this.getKeypair();
        await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: {
                showEffects: true
            }
        });
    }
}
// Singleton instance
exports.suiService = new SuiService();
