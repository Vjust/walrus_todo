# Environment Variables

This document describes the environment variables used by the application.

## Common

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|--------|
| `NODE_ENV` | Application environment (development, testing, staging, production) | No | `production` | `development` |
| `LOG_LEVEL` | Logging level (error, warn, info, debug, trace) | No | `info` | `info` |

## Blockchain

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|--------|
| `NETWORK` | Blockchain network (mainnet, testnet, devnet, local) | No | `testnet` | `testnet` |
| `WALLET_ADDRESS` | Default wallet address for blockchain operations | No | `""` | `0x1234567890abcdef1234567890abcdef` |
| `ENABLE_BLOCKCHAIN_VERIFICATION` | Enable blockchain verification for AI operations | No | `false` | `false` |

## Storage

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|--------|
| `STORAGE_PATH` | Local path for storing todo data | No | `Todos` | `Todos` |
| `TEMPORARY_STORAGE` | Temporary storage location for in-progress operations | No | `/tmp/waltodo` | `/tmp/waltodo` |
| `ENCRYPTED_STORAGE` | Enable encryption for local storage | No | `false` | `false` |

## AI

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|--------|
| `XAI_API_KEY` | API key for XAI (Grok) services | No | `xai-XYFzn2FrLWiRvzANPHEic81sKy0xQDIETGdNbnFj4TVG5XkAL7HfTd8ZRyFNqlwJK9nWcHVs3OjtLK6i` | `xai_api_key_12345` |
| `OPENAI_API_KEY` | API key for OpenAI services | No | `""` | `sk-openai123456789` |
| `ANTHROPIC_API_KEY` | API key for Anthropic (Claude) services | No | `""` | `sk-ant-api123456789` |
| `OLLAMA_API_KEY` | API key for Ollama services | No | `""` | `ollama_api_key_12345` |
| `AI_DEFAULT_PROVIDER` | Default AI provider for operations (xai, openai, anthropic) | No | `xai` | `xai` |
| `AI_DEFAULT_MODEL` | Default AI model to use for AI operations | No | `grok-3-mini-beta` | `grok-beta` |
| `AI_TEMPERATURE` | Temperature parameter for AI model output randomness (0.0-1.0) | No | `0.7` | `0.7` |
| `AI_MAX_TOKENS` | Maximum tokens to generate in AI responses | No | `2000` | `2000` |
| `AI_CACHE_ENABLED` | Enable caching of AI responses to reduce API calls | No | `true` | `true` |
| `AI_CACHE_TTL_MS` | Time-to-live for cached AI responses in milliseconds | No | `900000` | `900000` |

## Security

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|--------|
| `REQUIRE_SIGNATURE_VERIFICATION` | Require cryptographic signature verification for operations | No | `false` | `false` |

## Advanced

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|--------|
| `CREDENTIAL_KEY_ITERATIONS` | Number of iterations for PBKDF2 key derivation | No | `100000` | `100000` |
| `CREDENTIAL_AUTO_ROTATION_DAYS` | Days before credentials are auto-rotated | No | `90` | `90` |
| `CREDENTIAL_ROTATION_WARNING_DAYS` | Days before showing credential rotation warnings | No | `75` | `75` |
| `CREDENTIAL_MAX_FAILED_AUTH` | Maximum failed authentication attempts before temporary lockout | No | `5` | `5` |
| `RETRY_ATTEMPTS` | Number of retry attempts for failed operations | No | `3` | `3` |
| `RETRY_DELAY_MS` | Delay between retry attempts in milliseconds | No | `1000` | `1000` |
| `TIMEOUT_MS` | Timeout for network operations in milliseconds | No | `30000` | `30000` |

## Other

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|--------|
| `FULLNODE_URL` | Custom full node URL for the blockchain network | No | `https://fullnode.testnet.sui.io:443` | `https://fullnode.testnet.sui.io:443` |
| `TODO_PACKAGE_ID` | Package ID for the deployed Todo smart contract | No | `0x25a04efc88188231b2f9eb35310a5025c293c4211d2482fd24fe2c8e2dbc9f74` | `0x25a04efc88188231b2f9eb35310a5025c293c4211d2482fd24fe2c8e2dbc9f74` |
| `REGISTRY_ID` | Registry ID for the AI verification registry | No | `""` | `0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2` |

## Usage

Environment variables can be set in the following ways:

1. In a `.env` file in the project root
2. Directly in the environment
3. Through command-line flags for many options

### Priority Order

The application uses the following priority order for environment variables:

1. Command-line flags (highest priority)
2. Environment variables
3. Configuration file values
4. Default values (lowest priority)
