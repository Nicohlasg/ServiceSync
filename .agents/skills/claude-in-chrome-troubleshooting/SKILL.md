---
name: Codex-in-chrome-troubleshooting
description: Diagnose and fix Codex in Chrome MCP extension connectivity issues. Use when mcp__claude-in-chrome__* tools fail, return "Browser extension is not connected", or behave erratically.
risk: critical
source: community
---

# Codex in Chrome MCP Troubleshooting

Use this skill when Codex in Chrome MCP tools fail to connect or work unreliably.

## When to Use
- `mcp__claude-in-chrome__*` tools fail with "Browser extension is not connected"
- Browser automation works erratically or times out
- After updating Codex or Codex.app
- When switching between Codex CLI and Codex.app (Cowork)
- Native host process is running but MCP tools still fail

## When NOT to Use

- **Linux or Windows users** - This skill covers macOS-specific paths and tools (`~/Library/Application Support/`, `osascript`)
- General Chrome automation issues unrelated to the Codex extension
- Codex.app desktop issues (not browser-related)
- Network connectivity problems
- Chrome extension installation issues (use Chrome Web Store support)

## The Codex.app vs Codex Conflict (Primary Issue)

**Background:** When Codex.app added Cowork support (browser automation from the desktop app), it introduced a competing native messaging host that conflicts with Codex CLI.

### Two Native Hosts, Two Socket Formats

| Component | Native Host Binary | Socket Location |
|-----------|-------------------|-----------------|
| **Codex.app (Cowork)** | `/Applications/Codex.app/Contents/Helpers/chrome-native-host` | `/tmp/Codex-mcp-browser-bridge-$USER/<PID>.sock` |
| **Codex CLI** | `~/.local/share/Codex/versions/<version> --chrome-native-host` | `$TMPDIR/Codex-mcp-browser-bridge-$USER` (single file) |

### Why They Conflict

1. Both register native messaging configs in Chrome:
   - `com.anthropic.claude_browser_extension.json` → Codex.app helper
   - `com.anthropic.claude_code_browser_extension.json` → Codex wrapper

2. Chrome extension requests a native host by name
3. If the wrong config is active, the wrong binary runs
4. The wrong binary creates sockets in a format/location the MCP client doesn't expect
5. Result: "Browser extension is not connected" even though everything appears to be running

### The Fix: Disable Codex.app's Native Host

**If you use Codex CLI for browser automation (not Cowork):**

```bash
# Disable the Codex.app native messaging config
mv ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.anthropic.claude_browser_extension.json \
   ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.anthropic.claude_browser_extension.json.disabled

# Ensure the Codex config exists and points to the wrapper
cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json
```

**If you use Cowork (Codex.app) for browser automation:**

```bash
# Disable the Codex native messaging config
mv ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json \
   ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json.disabled
```

**You cannot use both simultaneously.** Pick one and disable the other.

### Toggle Script

Add this to `~/.zshrc` or run directly:

```bash
chrome-mcp-toggle() {
    local CONFIG_DIR=~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts
    local CLAUDE_APP="$CONFIG_DIR/com.anthropic.claude_browser_extension.json"
    local Codex="$CONFIG_DIR/com.anthropic.claude_code_browser_extension.json"

    if [[ -f "$CLAUDE_APP" && ! -f "$CLAUDE_APP.disabled" ]]; then
        # Currently using Codex.app, switch to Codex
        mv "$CLAUDE_APP" "$CLAUDE_APP.disabled"
        [[ -f "$Codex.disabled" ]] && mv "$Codex.disabled" "$Codex"
        echo "Switched to Codex CLI"
        echo "Restart Chrome and Codex to apply"
    elif [[ -f "$Codex" && ! -f "$Codex.disabled" ]]; then
        # Currently using Codex, switch to Codex.app
        mv "$Codex" "$Codex.disabled"
        [[ -f "$CLAUDE_APP.disabled" ]] && mv "$CLAUDE_APP.disabled" "$CLAUDE_APP"
        echo "Switched to Codex.app (Cowork)"
        echo "Restart Chrome to apply"
    else
        echo "Current state unclear. Check configs:"
        ls -la "$CONFIG_DIR"/com.anthropic*.json* 2>/dev/null
    fi
}
```

Usage: `chrome-mcp-toggle` then restart Chrome (and Codex if switching to CLI).

## Quick Diagnosis

```bash
# 1. Which native host binary is running?
ps aux | grep chrome-native-host | grep -v grep
# Codex.app: /Applications/Codex.app/Contents/Helpers/chrome-native-host
# Codex: ~/.local/share/Codex/versions/X.X.X --chrome-native-host

# 2. Where is the socket?
# For Codex (single file in TMPDIR):
ls -la "$(getconf DARWIN_USER_TEMP_DIR)/Codex-mcp-browser-bridge-$USER" 2>&1

# For Codex.app (directory with PID files):
ls -la /tmp/Codex-mcp-browser-bridge-$USER/ 2>&1

# 3. What's the native host connected to?
lsof -U 2>&1 | grep Codex-mcp-browser-bridge

# 4. Which configs are active?
ls ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.anthropic*.json
```

## Critical Insight

**MCP connects at startup.** If the browser bridge wasn't ready when Codex started, the connection will fail for the entire session. The fix is usually: ensure Chrome + extension are running with correct config, THEN restart Codex.

## Full Reset Procedure (Codex CLI)

```bash
# 1. Ensure correct config is active
mv ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.anthropic.claude_browser_extension.json \
   ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.anthropic.claude_browser_extension.json.disabled 2>/dev/null

# 2. Update the wrapper to use latest Codex version
cat > ~/.Codex/chrome/chrome-native-host << 'EOF'
#!/bin/bash
LATEST=$(ls -t ~/.local/share/Codex/versions/ 2>/dev/null | head -1)
exec "$HOME/.local/share/Codex/versions/$LATEST" --chrome-native-host
EOF
chmod +x ~/.Codex/chrome/chrome-native-host

# 3. Kill existing native host and clean sockets
pkill -f chrome-native-host
rm -rf /tmp/Codex-mcp-browser-bridge-$USER/
rm -f "$(getconf DARWIN_USER_TEMP_DIR)/Codex-mcp-browser-bridge-$USER"

# 4. Restart Chrome
osascript -e 'quit app "Google Chrome"' && sleep 2 && open -a "Google Chrome"

# 5. Wait for Chrome, click Codex extension icon

# 6. Verify correct native host is running
ps aux | grep chrome-native-host | grep -v grep
# Should show: ~/.local/share/Codex/versions/X.X.X --chrome-native-host

# 7. Verify socket exists
ls -la "$(getconf DARWIN_USER_TEMP_DIR)/Codex-mcp-browser-bridge-$USER"

# 8. Restart Codex
```

## Other Common Causes

### Multiple Chrome Profiles

If you have the Codex extension installed in multiple Chrome profiles, each spawns its own native host and socket. This can cause confusion.

**Fix:** Only enable the Codex extension in ONE Chrome profile.

### Multiple Codex Sessions

Running multiple Codex instances can cause socket conflicts.

**Fix:** Only run one Codex session at a time, or use `/mcp` to reconnect after closing other sessions.

### Hardcoded Version in Wrapper

The wrapper at `~/.Codex/chrome/chrome-native-host` may have a hardcoded version that becomes stale after updates.

**Diagnosis:**
```bash
cat ~/.Codex/chrome/chrome-native-host
# Bad: exec "/Users/.../.local/share/Codex/versions/2.0.76" --chrome-native-host
# Good: Uses $(ls -t ...) to find latest
```

**Fix:** Use the dynamic version wrapper shown in the Full Reset Procedure above.

### TMPDIR Not Set

Codex expects `TMPDIR` to be set to find the socket.

```bash
# Check
echo $TMPDIR
# Should show: /var/folders/XX/.../T/

# Fix: Add to ~/.zshrc
export TMPDIR="${TMPDIR:-$(getconf DARWIN_USER_TEMP_DIR)}"
```

## Diagnostic Deep Dive

```bash
echo "=== Native Host Binary ==="
ps aux | grep chrome-native-host | grep -v grep

echo -e "\n=== Socket (Codex location) ==="
ls -la "$(getconf DARWIN_USER_TEMP_DIR)/Codex-mcp-browser-bridge-$USER" 2>&1

echo -e "\n=== Socket (Codex.app location) ==="
ls -la /tmp/Codex-mcp-browser-bridge-$USER/ 2>&1

echo -e "\n=== Native Host Open Files ==="
pgrep -f chrome-native-host | xargs -I {} lsof -p {} 2>/dev/null | grep -E "(sock|Codex-mcp)"

echo -e "\n=== Active Native Messaging Configs ==="
ls ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.anthropic*.json 2>/dev/null

echo -e "\n=== Custom Wrapper Contents ==="
cat ~/.Codex/chrome/chrome-native-host 2>/dev/null || echo "No custom wrapper"

echo -e "\n=== TMPDIR ==="
echo "TMPDIR=$TMPDIR"
echo "Expected: $(getconf DARWIN_USER_TEMP_DIR)"
```

## File Reference

| File | Purpose |
|------|---------|
| `~/.Codex/chrome/chrome-native-host` | Custom wrapper script for Codex |
| `/Applications/Codex.app/Contents/Helpers/chrome-native-host` | Codex.app (Cowork) native host |
| `~/.local/share/Codex/versions/<version>` | Codex binary (run with `--chrome-native-host`) |
| `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.anthropic.claude_browser_extension.json` | Config for Codex.app native host |
| `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json` | Config for Codex native host |
| `$TMPDIR/Codex-mcp-browser-bridge-$USER` | Socket file (Codex) |
| `/tmp/Codex-mcp-browser-bridge-$USER/<PID>.sock` | Socket files (Codex.app) |

## Summary

1. **Primary issue:** Codex.app (Cowork) and Codex use different native hosts with incompatible socket formats
2. **Fix:** Disable the native messaging config for whichever one you're NOT using
3. **After any fix:** Must restart Chrome AND Codex (MCP connects at startup)
4. **One profile:** Only have Codex extension in one Chrome profile
5. **One session:** Only run one Codex instance

---

*Original skill by [@jeffzwang](https://github.com/jeffzwang) from [@ExaAILabs](https://github.com/ExaAILabs). Enhanced and updated for current versions of Codex Desktop and Codex.*
