# AI Integration Guide for WalTodo

This document explains how AI capabilities were integrated into the WalTodo CLI application using LangChain and XAI (Grok).

## Overview

WalTodo now offers AI-powered features for todo management through two main interfaces:

1. **Enhanced `add` command**: Uses AI to suggest tags and priority when creating todos
2. **Dedicated `ai` command**: Provides specialized AI operations like summarizing, categorizing, prioritizing, suggesting, and analyzing todos

## Architecture

### AI Service

The core of the AI integration is the `AiService` class in `src/services/ai/aiService.ts`. This service:

- Connects to the XAI API using the LangChain framework
- Provides methods for different AI operations on todos
- Handles response parsing and error management

### Environment Configuration

AI operations require an XAI API key, which can be provided in several ways:
- In the `.env` file as `XAI_API_KEY`
- As a command-line parameter with the `--apiKey` flag
- Through the constants in `src/constants.ts`

## Usage

### Adding Todos with AI

```bash
# Add a todo and let AI suggest tags and priority
waltodo add "Fix API authentication" --ai

# Add a todo with AI using a specific API key
waltodo add "Implement rate limiting" --ai --apiKey YOUR_API_KEY
```

### Using AI Operations

```bash
# Summarize a todo list
waltodo ai summarize

# Get tag suggestions for a specific todo
waltodo ai categorize -i "todo_id_or_title"

# Get priority suggestions for a todo
waltodo ai prioritize -i "todo_id_or_title"

# Get related task suggestions
waltodo ai suggest -l work -c 5

# Analyze productivity patterns in your todos
waltodo ai analyze
```

## Implementation Notes

### Message Format for XAI

The XAI API requires using the `HumanMessage` format with a content object:

```typescript
// Correct format
const message = new HumanMessage({ content: template });

// Incorrect format
const message = new HumanMessage(template);
```

### Response Parsing

AI responses may include markdown formatting, especially for JSON responses. The service handles this by:

1. Extracting content from markdown code blocks
2. Parsing JSON content carefully
3. Providing helpful error messages when parsing fails

### Error Handling

The AI service includes robust error handling:
- API key validation
- Response parsing errors
- Connection issues
- Default values for when the AI response is invalid

## Troubleshooting

### API Key Issues

If you encounter API key errors:
- Ensure the `.env` file contains a valid `XAI_API_KEY`
- Try passing the key directly with the `--apiKey` flag
- Check console output for API key detection messages

### JSON Parsing Errors

If you see JSON parsing errors:
- The AI might be returning formatted text instead of raw JSON
- Check the AI service logs for the raw response
- The service will attempt to extract JSON from markdown code blocks

## Testing

Use the included test scripts to verify AI functionality:
- `test-ai-integration.sh`: Tests basic AI integration
- `test-fixed-ai.sh`: Tests the fixed version of the AI integration

## Performance Considerations

AI operations require API calls, which can introduce latency. Consider:
- Using the `--ai` flag selectively when adding many todos
- Caching AI suggestions for similar todos
- Batching AI operations when possible