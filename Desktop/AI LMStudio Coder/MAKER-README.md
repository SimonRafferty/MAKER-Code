# MAKER Framework

**Reliable Code Generation with Zero-Error Scaling**

Command-line implementation of the MAKER framework for solving complex coding tasks with high reliability using local LLMs via LM Studio.

## What is MAKER?

MAKER is a framework from the research paper ["Solving a Million-Step Problem with Zero Errors"](https://arxiv.org/pdf/2511.09030) that achieves reliable code generation through:

1. **Maximal Agentic Decomposition (MAD)**: Breaking tasks into smallest possible atomic steps
2. **First-to-ahead-by-K Voting**: Generating multiple solutions and voting to select the best
3. **Red-flagging**: Filtering out unreliable responses using syntax checking and pattern matching

### Key Benefits

- **High Reliability**: Achieves near-zero error rates on complex multi-step tasks
- **Cost-Effective**: Uses voting instead of expensive reasoning models
- **Scalable**: Error rates remain stable as problem size grows
- **Local**: Runs entirely on your machine via LM Studio

## Features

- **Dual Mode Operation**:
  - Normal mode for quick queries
  - MAKER mode for reliable multi-step tasks

- **Smart Voting**:
  - AST-based code similarity clustering
  - Automatic k-value calculation
  - Confidence scoring

- **Quality Control**:
  - Syntax validation (acorn parser)
  - Length and completeness checks
  - Hallucination detection

- **Task Management**:
  - AI-assisted task decomposition
  - Minimal context per step
  - Dependency tracking

## Prerequisites

- Node.js 18+
- LM Studio running locally
- A loaded model in LM Studio with local server started

## Installation

1. Install dependencies:

```bash
npm install
```

2. Make the CLI executable (optional):

```bash
npm link
```

Now you can run `maker` from anywhere.

## Usage

### Quick Start

1. Start LM Studio and load a model
2. Start the local server in LM Studio
3. Run MAKER:

```bash
node src/makerCLI.js
```

Or if you ran `npm link`:

```bash
maker
```

### Commands

- `/help` - Show available commands
- `/context <size>` - Set context window size (e.g., `/context 4096`)
- `/mode` - Toggle between Normal and MAKER modes
- `/config` - Show current configuration
- `/k <value>` - Set voting threshold (default: 3)
- `/test` - Run a voting test
- `exit` - Exit the program

### Modes

#### Normal Mode

Fast, direct queries to the LLM. Good for:
- Quick questions
- Simple code snippets
- Exploratory conversations

Example:
```
[Normal] > What is a closure in JavaScript?
```

#### MAKER Mode

Full framework with decomposition and voting. Best for:
- Multi-step coding tasks
- Critical operations
- Complex implementations

Example:
```
[MAKER] > Create a function that validates email addresses using regex and returns error details
```

The framework will:
1. Decompose the task into atomic steps
2. Execute each step with voting
3. Track confidence and reliability
4. Provide detailed progress

### Configuration

#### Setting Context Window

```
/context 4096
```

Common values:
- 2048 - Small models
- 4096 - Medium models
- 8192 - Large models
- 32768 - Very large models

#### Adjusting Voting Threshold (k)

```
/k 5
```

- Lower k (2-3): Faster, less reliable
- Higher k (5-7): Slower, more reliable
- Default: 3 (good balance)

From the paper: k scales with log(steps), so complex tasks benefit from higher k.

## How It Works

### 1. Task Decomposition

```
Original: "Create a user authentication system"

Decomposed:
  Step 1: Create password hashing function
  Step 2: Create user validation function
  Step 3: Create login function
  Step 4: Create session management
```

### 2. Voting

For each step:
1. Generate N candidates (default: 5)
2. Filter invalid responses (red-flagging)
3. Cluster similar solutions by AST similarity
4. Vote using first-to-ahead-by-k
5. Return winning solution

### 3. Red-Flagging

Filters out responses with:
- Syntax errors (via acorn parser)
- Excessive length (>1500 tokens = confused)
- Incompleteness markers (..., truncated, etc.)
- Hallucination patterns ("I can't", "I'm sorry", etc.)
- Unbalanced brackets

### 4. Code Clustering

Groups similar solutions using:
- AST structural similarity
- Token overlap (Jaccard similarity)
- Function signature matching
- Import/export analysis

## Examples

### Example 1: Quick Test

```bash
maker
> /mode           # Switch to MAKER mode
> /test          # Run voting test
```

This generates 5 candidates for a prime number function and shows voting results.

### Example 2: Simple Task

```bash
maker
> /mode          # Switch to MAKER mode
> Write a function that reverses a string without using built-in reverse
```

Output:
```
[Task Decomposition] Breaking down task...
  Decomposed into 1 subtasks

[Phase 2] Execution with k=3 voting threshold

[Subtask 1/1] Write a function that reverses a string...
[MAKER Voting] k=3, max_candidates=5
[Step 1/4] Generating candidates...
  Generated 5 candidates
[Step 2/4] Applying red-flagging...
  5/5 candidates passed validation
[Step 3/4] Clustering similar responses...
  Formed 2 clusters
[Step 4/4] Running first-to-ahead-by-k voting...
  ✓ Winner found! (margin: 3 >= k: 3)

  ✓ Completed with confidence: 85.3%

Success rate: 100.0%
Average confidence: 85.3%
```

### Example 3: Complex Task

```bash
> /k 5           # Higher k for critical task
> /mode
> Implement a binary search tree with insert, delete, and find methods
```

The framework will decompose this into ~6-8 atomic steps and vote on each.

## Performance Tips

### For Speed
- Use Normal mode for exploration
- Lower k value (k=2)
- Fewer candidates (3-4)

### For Reliability
- Use MAKER mode
- Higher k value (k=5+)
- More candidates (7-10)
- Higher context window

### For Cost (API calls)
- Normal mode uses: 1 call
- MAKER mode uses: ~(steps × candidates) calls
  - Example: 5 steps × 5 candidates = 25 calls
  - But each call is smaller and simpler

## Architecture

```
src/
├── core/
│   ├── fileOperations.js      # File I/O utilities
│   ├── tokenCounter.js        # Token counting (tiktoken)
│   └── lmstudioClient.js      # LMStudio API client
├── maker/
│   ├── ResponseValidator.js   # Red-flagging
│   ├── CodeClusterer.js       # AST similarity
│   ├── VotingManager.js       # First-to-ahead-by-k
│   ├── TaskDecomposer.js      # Decomposition
│   └── MicroagentExecutor.js  # Orchestration
└── makerCLI.js               # CLI interface
```

## Troubleshooting

### "Cannot connect to LMStudio"

1. Make sure LMStudio is running
2. Check that a model is loaded
3. Verify the local server is started
4. Default URL is `http://localhost:1234/v1`

### "Context window not set"

Run:
```
/context 4096
```

Or let it auto-detect:
```
# Restart MAKER after loading model in LMStudio
```

### "All candidates failed validation"

This means all generated solutions had syntax errors or were flagged as unreliable:

- Try increasing candidates: `/k` value higher
- Simplify the task description
- Break task manually into smaller steps
- Check if model is appropriate for coding

### Voting never reaches threshold

The margin between top candidates is less than k:

- Lower k value: `/k 2`
- Increase candidates to get more diversity
- Task may be ambiguous - rephrase

## Research Paper

Based on: ["Solving a Million-Step Problem with Zero Errors"](https://arxiv.org/pdf/2511.09030)

**Paper Link:** https://arxiv.org/pdf/2511.09030

Key findings:
- Cost scales as O(s log s) where s = number of steps
- Per-step reliability improves exponentially with k
- Maximal decomposition is better than batching
- Works with small models (gpt-4o-mini)
- Solved Towers of Hanoi with 20 disks (1,048,575 steps) with zero errors

## License

MIT

## Contributing

This is an implementation of the MAKER research framework adapted for practical code generation with local LLMs.

---

Built for [LM Studio](https://lmstudio.ai/) • Inspired by MAKER research paper
