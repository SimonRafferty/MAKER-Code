# MAKER Framework - File Inventory

## Installation Scripts

```
installmaker.bat           Windows installer - adds 'maker' to PATH
installmaker.sh            macOS/Linux installer - creates symlink
```

## Core Components (Reused)

```
src/core/
├── fileOperations.js      File I/O utilities (124 lines)
├── tokenCounter.js        Token counting with tiktoken (165 lines)
└── lmstudioClient.js      LM Studio API client (355 lines)
```

## MAKER Framework

```
src/maker/
├── ResponseValidator.js   Red-flagging component (411 lines)
├── CodeClusterer.js       AST similarity clustering (440 lines)
├── VotingManager.js       First-to-ahead-by-k voting (381 lines)
├── TaskDecomposer.js      Task decomposition (385 lines)
└── MicroagentExecutor.js  Workflow orchestration (412 lines)
```

## Main Application

```
src/makerCLI.js           CLI interface (447 lines)
```

## Documentation

```
QUICKSTART.md             Quick start guide
MAKER-README.md           Complete user documentation
MAKER-INSTALL.md          Installation instructions
MAKER-SUMMARY.md          Technical overview and architecture
MAKER-FILES.md            This file - inventory of all files
```

## Configuration

```
maker-package.json        NPM package configuration
```

## Total Line Count

```
Installation:         2 files
Core components:      3 files (644 lines)
MAKER framework:      5 files (2,029 lines)
CLI:                  1 file (447 lines)
Documentation:        5 files
Configuration:        1 file

Total code:          ~3,120 lines
Total files:         17 files
```

## File Purposes

### Installation

**installmaker.bat / installmaker.sh**
- Installs dependencies
- Creates global `maker` command
- Adds to system PATH
- Verifies installation

### Core (Reusable Infrastructure)

**fileOperations.js**
- Safe file reading/writing
- Path validation
- JSON utilities

**tokenCounter.js**
- Token counting (tiktoken)
- Message token calculation
- Text truncation

**lmstudioClient.js**
- HTTP client for LM Studio
- Streaming support
- Retry logic
- Context window management

### MAKER Components

**ResponseValidator.js** (Red-Flagging)
- Syntax validation (acorn)
- Hallucination detection
- Completeness checking
- Confidence scoring

**CodeClusterer.js** (Similarity Analysis)
- AST feature extraction
- Multi-dimensional similarity
- Greedy clustering
- Handles invalid syntax

**VotingManager.js** (Voting Algorithm)
- Candidate generation
- Optimal k calculation
- First-to-ahead-by-k
- Multiple voting modes

**TaskDecomposer.js** (Decomposition)
- AI-assisted task breakdown
- Dependency graphs
- Execution ordering
- Complexity estimation

**MicroagentExecutor.js** (Orchestration)
- Complete MAKER workflow
- Minimal context building
- Progress tracking
- Error handling

### Application

**makerCLI.js** (User Interface)
- Interactive CLI
- Dual-mode operation
- Command handling
- Configuration management

## Dependencies

```json
{
  "acorn": "^8.11.0",          // JavaScript parser
  "acorn-walk": "^8.3.0",      // AST traversal
  "axios": "^1.6.0",           // HTTP client
  "chalk": "^5.3.0",           // Terminal colors
  "tiktoken": "^1.0.0"         // Token counting
}
```

## Installation Files Generated

After running installer:

**Windows:**
```
maker.bat                 Global command wrapper
```

**macOS/Linux:**
```
/usr/local/bin/maker     Symlink to makerCLI.js
```

## Usage

```bash
# Install
installmaker.bat          # Windows
./installmaker.sh         # macOS/Linux

# Run from any folder
cd /your/project
maker
```

## File Sizes (Approximate)

```
Code files:      ~3,120 lines
Documentation:   ~1,500 lines
Configuration:   ~50 lines

Total project:   ~4,670 lines
```

## Key Algorithms by File

**ResponseValidator.js:**
- Syntax validation (acorn.parse)
- Pattern matching (regex)
- Bracket balancing (stack)
- Confidence calculation (weighted)

**CodeClusterer.js:**
- AST similarity (multi-metric)
- Jaccard similarity (set intersection)
- Greedy clustering (graph algorithm)
- Feature extraction (tree walk)

**VotingManager.js:**
- k optimization: k = Θ(ln s)
- Candidate generation (with variation)
- Vote counting (cluster-based)
- Confidence scoring (margin-based)

**TaskDecomposer.js:**
- LLM prompting (structured)
- Dependency parsing (graph)
- Topological sort (Kahn's algorithm)
- Complexity metrics (graph properties)

**MicroagentExecutor.js:**
- Context minimization (filtering)
- Sequential execution (async)
- State management (tracking)
- Error recovery (graceful)

## Architecture Diagram

```
User
  ↓
makerCLI.js
  ↓
MicroagentExecutor
  ↓
  ├→ TaskDecomposer → [Step 1] [Step 2] [Step 3] ...
  ↓
  └→ For each step:
      ↓
      VotingManager
        ↓
        ├→ Generate candidates
        ├→ ResponseValidator (filter)
        ├→ CodeClusterer (group)
        └→ Vote (select winner)
      ↓
      Apply result
```

## File Relationships

```
makerCLI.js
├── imports: core/lmstudioClient.js
├── imports: core/tokenCounter.js
├── imports: core/fileOperations.js
├── imports: maker/MicroagentExecutor.js
├── imports: maker/VotingManager.js
├── imports: maker/ResponseValidator.js
└── imports: maker/CodeClusterer.js

MicroagentExecutor.js
├── imports: maker/VotingManager.js
└── imports: maker/TaskDecomposer.js

VotingManager.js
├── imports: maker/ResponseValidator.js
└── imports: maker/CodeClusterer.js

All files import:
├── core/tokenCounter.js
└── core/lmstudioClient.js (most)
```

## Next Steps

1. Run installer: `installmaker.bat` or `./installmaker.sh`
2. Read: `QUICKSTART.md` for immediate usage
3. Reference: `MAKER-README.md` for detailed guide
4. Explore: Individual component files for implementation

---

All files are ready to use! Run the installer and type `maker` from any folder.
