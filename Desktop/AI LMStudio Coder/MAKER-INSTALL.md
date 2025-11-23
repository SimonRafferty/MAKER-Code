# MAKER Framework - Installation Guide

## Automatic Installation (Recommended)

### Windows

1. Navigate to the project directory:
```cmd
cd "C:\Users\simon\Desktop\AI LMStudio Coder"
```

2. Run the installer:
```cmd
installmaker.bat
```

This will:
- Install all dependencies
- Create a global `maker` command
- Add to your PATH
- Verify the installation

3. Open a new terminal and run from any folder:
```cmd
cd C:\your\project
maker
```

### macOS/Linux

1. Navigate to the project directory:
```bash
cd ~/path/to/AI\ LMStudio\ Coder
```

2. Run the installer:
```bash
./installmaker.sh
```

This will:
- Install all dependencies
- Make the CLI executable
- Create a symlink in /usr/local/bin
- Verify the installation

3. Run from any folder:
```bash
cd /your/project
maker
```

## Manual Installation

### Windows

1. Navigate to the project directory:
```cmd
cd "C:\Users\simon\Desktop\AI LMStudio Coder"
```

2. Install dependencies:
```cmd
npm install acorn acorn-walk axios chalk tiktoken
```

3. Run MAKER:
```cmd
node src/makerCLI.js
```

### macOS/Linux

1. Navigate to the project directory:
```bash
cd ~/path/to/AI\ LMStudio\ Coder
```

2. Install dependencies:
```bash
npm install acorn acorn-walk axios chalk tiktoken
```

3. Make CLI executable (optional):
```bash
chmod +x src/makerCLI.js
npm link
```

4. Run MAKER:
```bash
node src/makerCLI.js
# Or if you ran npm link:
maker
```

## Prerequisites Checklist

Before running MAKER, ensure:

- [x] Node.js 18+ installed (`node --version`)
- [x] LM Studio installed and running
- [x] A model loaded in LM Studio
- [x] Local server started in LM Studio (on port 1234)

## Testing the Installation

Run this command to test:

```bash
node src/makerCLI.js
```

You should see:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MAKER - Reliable Code Generation Framework
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Maximal Agentic decomposition
  first-to-ahead-by-K Error correction
  Red-flagging

  Type /help for available commands
  Type /mode to toggle MAKER mode
  Type exit to quit

✓ Connected to LMStudio

Model: your-model-name
Context window: 4096 tokens

[Normal] >
```

## First Steps

1. Set your context window:
```
/context 4096
```

2. Switch to MAKER mode:
```
/mode
```

3. Run a test:
```
/test
```

4. Try a simple task:
```
Write a function that checks if a number is even
```

## Project Structure

```
AI LMStudio Coder/
├── src/
│   ├── core/                    # Reusable components
│   │   ├── fileOperations.js
│   │   ├── tokenCounter.js
│   │   └── lmstudioClient.js
│   ├── maker/                   # MAKER framework
│   │   ├── ResponseValidator.js
│   │   ├── CodeClusterer.js
│   │   ├── VotingManager.js
│   │   ├── TaskDecomposer.js
│   │   └── MicroagentExecutor.js
│   └── makerCLI.js             # Main CLI
├── maker-package.json          # Package config
├── MAKER-README.md            # Documentation
└── MAKER-INSTALL.md           # This file
```

## Troubleshooting

### Error: Cannot find module 'acorn'

Run:
```bash
npm install
```

### Error: Cannot connect to LMStudio

1. Open LM Studio
2. Load a model
3. Click "Start Server" button
4. Verify it's running on port 1234

### Error: Context window not set

Run:
```
/context 4096
```

Replace 4096 with your model's context size.

### Module not found errors

Make sure you're in the correct directory:
```bash
cd "C:\Users\simon\Desktop\AI LMStudio Coder"
```

## Next Steps

See [MAKER-README.md](./MAKER-README.md) for:
- Usage examples
- Command reference
- Performance tips
- Architecture details

## Support

For issues or questions:
1. Check the README
2. Verify LM Studio is running
3. Check Node.js version (`node --version`)
4. Ensure all dependencies are installed (`npm list`)
