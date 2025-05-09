# AI Features Guide

WalTodo integrates powerful AI capabilities through LangChain and XAI (Grok) to enhance your todo management experience. This guide explains how to use these AI-powered features effectively.

## Setting Up

To use the AI features, you need an XAI API key:

1. Get an API key from XAI

2. Set up the environment (choose one option):

   - **Option 1**: Create a `.env` file in the project root (copy from `.env.example`):
     ```bash
     cp .env.example .env
     # Then edit the .env file to add your XAI API key
     ```

   - **Option 2**: Set it as an environment variable:
     ```bash
     export XAI_API_KEY=your-api-key
     ```

   - **Option 3**: Provide it directly when using AI commands:
     ```bash
     waltodo ai summarize --apiKey your-api-key
     ```

## AI Command

The `ai` command provides several operations to apply AI to your todos:

### Summarize

Get a concise summary of your todo list:

```bash
# Summarize default list
waltodo ai summarize

# Summarize a specific list
waltodo ai summarize -l work
```

The summary includes:
- Count of completed vs. incomplete tasks
- Key themes or categories
- Urgent (high priority) tasks

### Categorize

Get AI-suggested tags for a todo:

```bash
# View suggested tags
waltodo ai categorize -i "todo-123"

# Apply suggested tags automatically
waltodo ai categorize -i "todo-123" --apply
```

You can also identify todos by title:

```bash
waltodo ai categorize -i "Prepare presentation"
```

### Prioritize

Get AI-suggested priority for a todo:

```bash
# View suggested priority
waltodo ai prioritize -i "todo-123"

# Apply suggested priority automatically
waltodo ai prioritize -i "todo-123" --apply
```

### Suggest

Generate related task suggestions based on your existing todos:

```bash
# Get 3 task suggestions (default)
waltodo ai suggest

# Get 5 task suggestions for a specific list
waltodo ai suggest -l work -c 5

# Add suggested tasks automatically
waltodo ai suggest --apply
```

### Analyze

Get productivity insights about your todo list:

```bash
# Analyze default list
waltodo ai analyze

# Analyze a specific list
waltodo ai analyze -l work
```

The analysis includes:
- Completion rate
- Average time to completion
- Patterns in task types and priorities
- Suggestions for improving productivity

## AI-Enhanced Todo Creation

When adding new todos, you can use the `--ai` flag to automatically suggest tags and priority:

```bash
# Add a todo with AI enhancement
waltodo add "Prepare quarterly report" --ai

# Add a todo with AI and specify API key
waltodo add "Review code PR" --ai --apiKey YOUR_XAI_API_KEY
```

The AI will analyze the todo title and:
1. Suggest relevant tags
2. Recommend an appropriate priority level
3. Apply these suggestions to the new todo

## Technical Implementation

The AI features are implemented using:

- **LangChain**: For structured prompting and LLM interaction
- **XAI (Grok)**: As the underlying LLM
- **PromptTemplate**: To craft effective prompts for different AI operations
- **JSON parsing**: To handle structured outputs like tags and task suggestions

The integration is designed to be:
- **Robust**: Handles parsing errors and invalid responses
- **Flexible**: Works with different list and todo structures
- **Extensible**: Can be easily expanded with new AI capabilities

## Troubleshooting

### Common Issues

1. **"XAI API key is required" error**:
   - Create a `.env` file with your XAI API key
   - Set the `XAI_API_KEY` environment variable
   - Or provide the key with the `--apiKey` flag

2. **AI suggestions not appearing**:
   - Check that you have a valid API key
   - Ensure the todo title has enough context for AI to analyze
   - Try using the `--verbose` flag to see more details

3. **Parsing errors**:
   - If you see "Failed to parse tags" or similar errors, this means the AI response
     wasn't in the expected format
   - Try again, as LLM responses can vary

4. **Performance Issues**:
   - AI operations require network calls and may take a few seconds
   - Consider using the `--apply` flag to automatically apply suggestions
     and reduce the number of API calls

## Future Enhancements

Planned AI features include:
- **Smart Due Date Suggestion**: Analyze todo content to recommend appropriate deadlines
- **Task Dependency Detection**: Identify relationships between todos
- **Context-Aware Categorization**: Adapt tag suggestions based on existing tags in your lists
- **Completion Time Prediction**: Estimate how long tasks might take based on similar completed todos