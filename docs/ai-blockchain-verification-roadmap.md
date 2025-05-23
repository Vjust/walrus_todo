# AI Blockchain Verification Roadmap

## Overview

The WalTodo CLI includes placeholder implementations for advanced AI credential verification features that will be implemented in future releases. This document outlines the planned features and current status.

## Current Status

The AI credential management system currently provides:
- ✅ Secure local storage of API keys
- ✅ Encryption at rest
- ✅ Multi-provider support (XAI, OpenAI, Anthropic)
- ✅ Basic credential validation
- ✅ Permission management

## Planned Features (Not Yet Implemented)

### 1. Cryptographic Verification
**Location**: `CredentialVerificationService.ts:130`
**Status**: Placeholder implementation

This feature will provide:
- Digital signatures for credentials
- Cryptographic proof of credential authenticity
- Integration with provider-specific verification APIs

### 2. Blockchain Registration
**Location**: `CredentialVerificationService.ts:266`
**Status**: Placeholder implementation

This feature will provide:
- On-chain registration of AI credentials
- Immutable audit trail of credential usage
- Smart contract integration for credential management

### 3. Blockchain Revocation
**Location**: `CredentialVerificationService.ts:326`
**Status**: Placeholder implementation

This feature will provide:
- On-chain revocation registry
- Real-time revocation checking
- Automated credential rotation

### 4. Audit Blockchain Backup
**Location**: `AuditLogger.ts:225`
**Status**: Low priority placeholder

This feature will provide:
- Blockchain backup of critical audit logs
- Tamper-evident logging
- Compliance reporting features

## Implementation Timeline

These features are planned for future releases. The current implementation provides full functionality for AI operations without blockchain verification.

## Using AI Features Today

All AI features work correctly without blockchain verification:

```bash
# Add API credentials
waltodo ai credentials add xai --key YOUR_API_KEY

# Use AI features
waltodo add "New task" --ai
waltodo ai summarize
waltodo ai suggest

# The "verify" command currently shows a placeholder message
waltodo ai verify --provider xai  # Shows success but doesn't perform blockchain verification
```

## Contributing

If you're interested in implementing these features, please:
1. Review the blockchain integration in `src/move/sources/`
2. Check the existing credential management in `src/services/ai/credentials/`
3. Open an issue to discuss implementation approach