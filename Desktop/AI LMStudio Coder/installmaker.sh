#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "================================================================"
echo "  MAKER Framework Installation"
echo "================================================================"
echo ""
echo "  Installing MAKER - Reliable Code Generation Framework"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Node.js is not installed or not in PATH."
    echo ""
    echo "Please install Node.js 18 or higher from:"
    echo "https://nodejs.org/"
    echo ""
    exit 1
fi

# Check Node.js version
echo -e "[1/5] Checking Node.js version..."
NODE_VERSION=$(node --version)
echo "      Node.js version: $NODE_VERSION"

NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${YELLOW}[WARNING]${NC} Node.js version 18 or higher is recommended."
    echo "          Current version: $NODE_VERSION"
    echo ""
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} npm is not installed or not in PATH."
    echo "       npm should come with Node.js installation."
    echo ""
    exit 1
fi

# Install dependencies
echo ""
echo "[2/5] Installing dependencies..."
echo ""

npm install acorn acorn-walk axios chalk tiktoken --save

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}[ERROR]${NC} Failed to install dependencies."
    echo ""
    exit 1
fi

# Get the absolute path to the project directory
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo ""
echo "[3/5] Creating global command 'maker'..."

# Make the CLI executable
chmod +x "$PROJECT_DIR/src/makerCLI.js"

echo "      Made executable: $PROJECT_DIR/src/makerCLI.js"

# Create symlink or add to PATH
echo ""
echo "[4/5] Setting up global command..."

# Try to create symlink in /usr/local/bin (requires sudo)
if [ -w "/usr/local/bin" ]; then
    ln -sf "$PROJECT_DIR/src/makerCLI.js" "/usr/local/bin/maker"
    echo -e "      ${GREEN}✓${NC} Created symlink: /usr/local/bin/maker"
else
    # Try with sudo
    echo "      Creating symlink requires sudo access..."
    sudo ln -sf "$PROJECT_DIR/src/makerCLI.js" "/usr/local/bin/maker"

    if [ $? -eq 0 ]; then
        echo -e "      ${GREEN}✓${NC} Created symlink: /usr/local/bin/maker"
    else
        echo -e "${YELLOW}[WARNING]${NC} Could not create symlink in /usr/local/bin"
        echo ""
        echo "You can still run MAKER using:"
        echo "  node $PROJECT_DIR/src/makerCLI.js"
        echo ""
        echo "Or add this to your ~/.bashrc or ~/.zshrc:"
        echo "  export PATH=\"\$PATH:$PROJECT_DIR/src\""
        echo "  alias maker='node $PROJECT_DIR/src/makerCLI.js'"
        echo ""
    fi
fi

# Test the installation
echo ""
echo "[5/5] Verifying installation..."

# Check if makerCLI.js exists
if [ -f "$PROJECT_DIR/src/makerCLI.js" ]; then
    echo -e "      ${GREEN}✓${NC} makerCLI.js found"
else
    echo -e "      ${RED}✗${NC} makerCLI.js missing"
    exit 1
fi

# Check dependencies
node -e "try { require('acorn'); console.log('      ✓ acorn installed'); } catch(e) { console.log('      ✗ acorn missing'); process.exit(1); }" || exit 1
node -e "try { require('acorn-walk'); console.log('      ✓ acorn-walk installed'); } catch(e) { console.log('      ✗ acorn-walk missing'); process.exit(1); }" || exit 1
node -e "try { require('axios'); console.log('      ✓ axios installed'); } catch(e) { console.log('      ✗ axios missing'); process.exit(1); }" || exit 1
node -e "try { require('chalk'); console.log('      ✓ chalk installed'); } catch(e) { console.log('      ✗ chalk missing'); process.exit(1); }" || exit 1
node -e "try { require('tiktoken'); console.log('      ✓ tiktoken installed'); } catch(e) { console.log('      ✗ tiktoken missing'); process.exit(1); }" || exit 1

echo ""
echo "================================================================"
echo "  Installation Complete!"
echo "================================================================"
echo ""
echo "  MAKER Framework is now installed."
echo ""
echo "  Usage:"
echo "    1. Navigate to any project folder:"
echo "       cd /path/to/your/project"
echo ""
echo "    2. Run MAKER:"
echo "       maker"
echo ""
echo "  Quick Start:"
echo "    maker              Start MAKER in current folder"
echo "    /help              Show available commands"
echo "    /mode              Toggle MAKER mode"
echo "    /context 4096      Set context window"
echo "    /test              Test voting system"
echo ""
echo "  Before using:"
echo "    - Make sure LM Studio is running"
echo "    - Load a model in LM Studio"
echo "    - Start the local server (port 1234)"
echo ""
echo "  Documentation:"
echo "    - MAKER-README.md     Complete user guide"
echo "    - MAKER-INSTALL.md    Installation help"
echo "    - MAKER-SUMMARY.md    Technical overview"
echo ""
echo "================================================================"
echo ""
