# MAKER Framework - Quick Start Guide

## 1. Install (One-Time Setup)

### Windows
```cmd
cd "C:\Users\simon\Desktop\AI LMStudio Coder"
installmaker.bat
```

### macOS/Linux
```bash
cd ~/path/to/AI\ LMStudio\ Coder
./installmaker.sh
```

**What it does:**
- Installs dependencies (acorn, axios, chalk, tiktoken)
- Creates global `maker` command
- Adds to PATH
- You can run `maker` from any folder!

## 2. Setup LM Studio

1. **Start LM Studio**
2. **Load a model** (any coding-capable model)
3. **Start the local server** (click the server button)
   - Default: `http://localhost:1234`

## 3. Run MAKER

Open any project folder:

```bash
cd C:\your\coding\project
maker
```

You'll see:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MAKER - Reliable Code Generation Framework
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Connected to LMStudio

Model: your-model-name
Context window: 4096 tokens

[Normal] >
```

## 4. Basic Commands

```bash
/help              # Show all commands
/context 4096      # Set context window (do this first!)
/mode              # Toggle MAKER mode on/off
/test              # Test the voting system
/config            # Show configuration
/k 3               # Set voting threshold
exit               # Exit
```

## 5. Two Modes

### Normal Mode (Fast)
Direct queries, no voting:

```
[Normal] > What is a closure in JavaScript?
[Normal] > Write a function to check if a string is a palindrome
```

**Use for:** Quick questions, simple code snippets

### MAKER Mode (Reliable)
Full framework with voting:

```
[Normal] > /mode
[MAKER] > Create a binary search tree with insert and find methods
```

**Use for:** Complex tasks, critical code, multi-step implementations

## 6. Your First Task

Try this simple example:

```bash
# 1. Start MAKER
maker

# 2. Set context
/context 4096

# 3. Test voting
/test

# 4. Try MAKER mode
/mode
Write a function that validates email addresses and returns detailed error messages

# 5. Watch it work!
```

You'll see:
1. **Task decomposition** - Breaks into steps
2. **Candidate generation** - Creates 5 solutions per step
3. **Red-flagging** - Filters bad responses
4. **Clustering** - Groups similar solutions
5. **Voting** - Picks the best with confidence score

## 7. Example Output

```
[MAKER] > Write a function that reverses a string

[Task Decomposition] Breaking down task...
  Decomposed into 1 subtasks

[Subtask 1/1] Write a function that reverses a string
[MAKER Voting] k=3, max_candidates=5
[Step 1/4] Generating candidates...
  Generated 5 candidates
[Step 2/4] Applying red-flagging...
  5/5 candidates passed validation
[Step 3/4] Clustering similar responses...
  Formed 2 clusters
    Cluster 1: 3 members (avg similarity: 0.89)
    Cluster 2: 2 members (avg similarity: 0.92)
[Step 4/4] Running first-to-ahead-by-k voting...
  ✓ Winner found! (margin: 3 >= k: 3)

function reverseString(str) {
  return str.split('').reverse().join('');
}

  ✓ Completed with confidence: 87.5%

Success rate: 100.0%
Average confidence: 87.5%
```

## 8. Tips

**For Speed:**
- Use Normal mode
- Lower k: `/k 2`

**For Reliability:**
- Use MAKER mode
- Higher k: `/k 5`
- More candidates (edit config)

**For Best Results:**
- Be specific in task descriptions
- Use MAKER mode for complex/critical tasks
- Set appropriate context window

## 9. Troubleshooting

**"Cannot connect to LMStudio"**
- Check LM Studio is running
- Load a model
- Start the local server

**"Context window not set"**
```
/context 4096
```

**"maker: command not found" (after install)**
- Restart your terminal
- Or run directly: `node src/makerCLI.js`

## 10. What Makes MAKER Different?

Traditional LLM:
- 1 attempt
- ~70% success rate
- No error correction

MAKER Framework:
- Multiple candidates (5+)
- Voting for best solution
- Red-flagging bad responses
- ~95%+ success rate
- Scales to complex tasks

## Next Steps

1. ✅ Run `installmaker.bat` or `./installmaker.sh`
2. ✅ Start LM Studio
3. ✅ Run `maker` from any folder
4. ✅ Try `/test` command
5. ✅ Switch to MAKER mode with `/mode`
6. ✅ Give it a coding task!

---

📖 **Full Documentation:**
- [MAKER-README.md](./MAKER-README.md) - Complete guide
- [MAKER-INSTALL.md](./MAKER-INSTALL.md) - Installation help
- [MAKER-SUMMARY.md](./MAKER-SUMMARY.md) - Technical details

📄 **Research Paper:**
- [Solving a Million-Step Problem with Zero Errors](https://arxiv.org/pdf/2511.09030) - Original research

🚀 **Ready to build reliable code with MAKER!**
