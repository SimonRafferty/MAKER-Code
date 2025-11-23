@echo off
setlocal enabledelayedexpansion

echo.
echo ================================================================
echo   MAKER Framework Installation
echo ================================================================
echo.
echo   Installing MAKER - Reliable Code Generation Framework
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo.
    echo Please install Node.js 18 or higher from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check Node.js version
echo [1/5] Checking Node.js version...
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo       Node.js version: %NODE_VERSION%

REM Extract major version number
set NODE_VERSION_NUM=%NODE_VERSION:~1%
for /f "tokens=1 delims=." %%a in ("%NODE_VERSION_NUM%") do set NODE_MAJOR=%%a

if %NODE_MAJOR% LSS 18 (
    echo [WARNING] Node.js version 18 or higher is recommended.
    echo           Current version: %NODE_VERSION%
    echo.
)

REM Check if npm is available
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed or not in PATH.
    echo        npm should come with Node.js installation.
    echo.
    pause
    exit /b 1
)

REM Install dependencies
echo.
echo [2/5] Installing dependencies...
echo.

call npm install acorn acorn-walk axios chalk tiktoken --save

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to install dependencies.
    echo.
    pause
    exit /b 1
)

echo.
echo [3/5] Creating global command 'maker'...

REM Get the absolute path to the project directory
set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

REM Create a batch file in the project directory that will be the global command
set "MAKER_BAT=%PROJECT_DIR%\maker.bat"

echo @echo off > "%MAKER_BAT%"
echo node "%PROJECT_DIR%\src\makerCLI.js" %%* >> "%MAKER_BAT%"

echo       Created: %MAKER_BAT%

REM Add to PATH if not already there
echo.
echo [4/5] Adding to PATH...

REM Check if already in PATH
echo %PATH% | find /i "%PROJECT_DIR%" >nul
if %ERRORLEVEL% EQU 0 (
    echo       Already in PATH: %PROJECT_DIR%
    echo       Skipping PATH modification.
) else (
    echo       Adding to PATH: %PROJECT_DIR%

    REM Add to user PATH (permanent)
    for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "USER_PATH=%%b"

    if defined USER_PATH (
        REM Check if USER_PATH already contains our directory
        echo !USER_PATH! | find /i "%PROJECT_DIR%" >nul
        if !ERRORLEVEL! EQU 0 (
            echo       Already in user PATH.
        ) else (
            REM Add to existing PATH
            setx PATH "!USER_PATH!;%PROJECT_DIR%" >nul
            echo       Added to user PATH successfully.
            echo.
            echo       [IMPORTANT] You may need to restart your terminal/command prompt
            echo                   for the PATH changes to take effect.
        )
    ) else (
        REM Create new PATH
        setx PATH "%PROJECT_DIR%" >nul
        echo       Created user PATH with project directory.
        echo.
        echo       [IMPORTANT] You may need to restart your terminal/command prompt
        echo                   for the PATH changes to take effect.
    )

    REM Update PATH for current session
    set "PATH=%PATH%;%PROJECT_DIR%"
)

REM Test the installation
echo.
echo [5/5] Verifying installation...

if exist "%MAKER_BAT%" (
    echo       ✓ maker.bat created
) else (
    echo       ✗ Failed to create maker.bat
    goto :error
)

REM Check dependencies
node -e "try { require('acorn'); console.log('       ✓ acorn installed'); } catch(e) { console.log('       ✗ acorn missing'); process.exit(1); }" || goto :error
node -e "try { require('acorn-walk'); console.log('       ✓ acorn-walk installed'); } catch(e) { console.log('       ✗ acorn-walk missing'); process.exit(1); }" || goto :error
node -e "try { require('axios'); console.log('       ✓ axios installed'); } catch(e) { console.log('       ✗ axios missing'); process.exit(1); }" || goto :error
node -e "try { require('chalk'); console.log('       ✓ chalk installed'); } catch(e) { console.log('       ✗ chalk missing'); process.exit(1); }" || goto :error
node -e "try { require('tiktoken'); console.log('       ✓ tiktoken installed'); } catch(e) { console.log('       ✗ tiktoken missing'); process.exit(1); }" || goto :error

echo.
echo ================================================================
echo   Installation Complete!
echo ================================================================
echo.
echo   MAKER Framework is now installed.
echo.
echo   Usage:
echo     1. Navigate to any project folder:
echo        cd C:\path\to\your\project
echo.
echo     2. Run MAKER:
echo        maker
echo.
echo   Quick Start:
echo     maker              Start MAKER in current folder
echo     /help              Show available commands
echo     /mode              Toggle MAKER mode
echo     /context 4096      Set context window
echo     /test              Test voting system
echo.
echo   Before using:
echo     - Make sure LM Studio is running
echo     - Load a model in LM Studio
echo     - Start the local server (port 1234)
echo.
echo   Documentation:
echo     - MAKER-README.md     Complete user guide
echo     - MAKER-INSTALL.md    Installation help
echo     - MAKER-SUMMARY.md    Technical overview
echo.
echo   If 'maker' command is not found, restart your terminal.
echo.
echo ================================================================
echo.
pause
exit /b 0

:error
echo.
echo [ERROR] Installation verification failed.
echo.
echo Please check:
echo   1. Node.js is properly installed
echo   2. You have internet connection (for npm packages)
echo   3. You have write permissions in this directory
echo.
echo Try running this installer again, or install manually:
echo   npm install acorn acorn-walk axios chalk tiktoken
echo.
pause
exit /b 1
