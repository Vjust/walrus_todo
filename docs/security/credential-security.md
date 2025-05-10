# Credential Security Implementation

This document describes the security architecture and implementation for API credential storage in the walrus-todo application.

## Overview

The secure credential storage system provides a robust mechanism for storing API keys and other sensitive credentials with the following security features:

- Strong encryption using AES-256-GCM with authenticated encryption and associated data (AEAD)
- Key derivation using PBKDF2 with salt for enhanced security
- Provider-specific API key validation and format checking
- Permission levels with access control
- Credential rotation support
- Blockchain-based verification (optional)
- Expiration management
- File system security with restrictive permissions

## Architecture

The secure credential system consists of these main components:

1. **VaultManager**: Handles low-level encryption, decryption, and secure storage
2. **EnhancedCredentialManager**: Manages credential operations, validation, and metadata
3. **ApiKeyValidator**: Provides provider-specific validation rules and key sanitation
4. **CredentialVerifier**: Handles optional blockchain validation of credentials
5. **AIProviderFactory**: Securely retrieves credentials for AI model creation

## Security Features

### Encryption

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: PBKDF2 with 10,000 iterations and SHA-256
- **Salt & IV**: Unique random salt and initialization vector for each credential
- **Authentication**: GCM authentication tag to prevent tampering
- **Additional Authentication Data**: Uses AAD to further secure encrypted data

### Storage

- **Separation of Concerns**: Credentials and metadata stored separately
- **Restrictive Permissions**: Files stored with 0o600 permissions (owner read/write only)
- **No Plaintext Storage**: API keys never stored in plaintext configuration files
- **Master Key Security**: Encryption master key stored with restrictive permissions
- **In-Memory Cache**: Metadata cached for performance while values remain encrypted

### Validation

- **Provider-Specific Rules**: Each provider has custom validation rules
- **Format Checking**: Validates key format, length, and patterns
- **Common Error Detection**: Detects and prevents common errors (quotes, "Bearer" prefix)
- **Sanitization**: Provides tools to clean and format keys for storage

### Access Control

- **Permission Levels**: Supports hierarchical access levels (NO_ACCESS, READ_ONLY, STANDARD, ADVANCED, ADMIN)
- **Operation Validation**: Validates permission level required for operations
- **Expiration**: Supports automatic expiration of credentials
- **Rotation Reminders**: Configurable reminders for credential rotation

### Integration

- **Environment Variable Fallback**: Transparently falls back to environment variables if no stored credential
- **User-Friendly Messages**: Clear setup instructions in error messages
- **Async API**: All operations use async/await for non-blocking operation

## Implementation Details

### File Structure

```
src/
├── services/
│   └── ai/
│       ├── credentials/
│       │   ├── EnhancedCredentialManager.ts  # Main credential management
│       │   ├── ApiKeyValidator.ts            # Validation rules
│       │   ├── CredentialVerifier.ts         # Blockchain verification
│       │   └── index.ts                      # Export manager singleton
│       ├── AIProviderFactory.ts              # Secure credential retrieval
```

### Secure Directory Structure

```
~/.config/ai-credentials/
├── .master.key                # Master encryption key
├── secrets/                   # Encrypted secrets directory
│   ├── index.json             # Encrypted secret index
│   └── {credential-id}.enc    # Individual encrypted credentials
```

### API Key Validation Rules

Provider-specific validation rules ensure keys are properly formatted:

| Provider  | Pattern | Min Length | Description |
|-----------|---------|------------|-------------|
| XAI       | `^xai-[A-Za-z0-9]{24,}$` | 28 | XAI keys start with "xai-" |
| OpenAI    | `^sk-[A-Za-z0-9]{32,}$` | 35 | OpenAI keys start with "sk-" |
| Anthropic | `^sk-ant-[A-Za-z0-9]{24,}$` | 32 | Anthropic keys start with "sk-ant-" |

## Credential Workflow

1. **Adding a credential**:
   - Validate key format based on provider rules
   - Generate a unique ID for the credential
   - Encrypt using AES-256-GCM with a unique salt and IV
   - Store in secure location with metadata
   - Optionally verify on blockchain

2. **Retrieving a credential**:
   - Check metadata cache or storage
   - Verify permissions for operation
   - Check expiration
   - Retrieve and decrypt credential
   - Update usage timestamp

3. **Rotating a credential**:
   - Validate new credential
   - Revoke old credential (if blockchain-verified)
   - Store new credential with preserved metadata
   - Update verification status

## Security Best Practices

- **No hardcoded keys**: All credentials stored securely, never in code
- **Defense in depth**: Multiple security layers for credential protection
- **Least privilege**: Permission system restricts access to credentials
- **Strong encryption**: Industry-standard encryption with authenticated encryption
- **Secure defaults**: Sensible default security settings
- **Key rotation**: Support for regular key rotation with reminders
- **Format validation**: Strict validation prevents mistakes
- **Secure permissions**: File system permissions limit access

## Usage

```typescript
// Get the singleton instance
import { credentialManager } from './services/ai/credentials';

// Store a credential with enhanced security
await credentialManager.storeCredential(
  'xai', 
  'xai-yourapikeyhere',
  AIPermissionLevel.STANDARD, // Permission level
  CredentialType.API_KEY, // Type of credential
  {
    verify: true, // Enable blockchain verification
    expiryDays: 90, // Set expiration
    rotationReminder: 60, // Remind after 60 days
    metadata: { usage: 'development' }
  }
);

// Retrieve a credential
const apiKey = await credentialManager.getCredential('xai', {
  verifyOnChain: true, // Check blockchain verification
  requiredPermissionLevel: AIPermissionLevel.STANDARD,
  operation: 'summarize'
});

// Rotate a credential
await credentialManager.rotateCredential(
  'xai',
  'xai-yournewapikeyhere',
  { 
    preserveMetadata: true,
    verify: true
  }
);
```

## Future Enhancements

- Hardware Security Module (HSM) integration
- Multi-factor authentication for sensitive credentials
- Credential sharing through secure channels
- Environment-specific credential segregation
- Audit logging for credential usage
- Remote credential vault integration