# Keep Starting Gear

**The cure for gear fear.** Protect your loadout. Die without consequences.

[![SPT 3.11.x](https://img.shields.io/badge/SPT-3.11.x-green.svg)](https://sp-tarkov.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Note:** This is the legacy TypeScript version for SPT 3.11.x. For SPT 4.0+, use the main C# mod.

---

## What It Does

Keep Starting Gear saves your equipment when you enter a raid and restores it if you die. Extract successfully? Keep your loot. Die? Get your starting gear back.

**No Run-Through penalty. No exploits. Just protection.**

### 30 Seconds to Understand

```
Enter Raid → Gear auto-saved → Die → Gear restored
                              → Extract → Keep your loot
```

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Automatic Snapshots** | Gear saved at raid start by client mod |
| **Full Restoration** | Durability, ammo counts, medical uses - all preserved |
| **No Penalties** | Server-side restoration bypasses "Run-Through" status |
| **Slot Control** | Client mod controls which slots are protected |
| **Modded Items** | Works with any custom weapons, armor, and equipment |
| **Transaction Safety** | Automatic rollback if restoration fails |
| **Configurable** | Adjust retry logic, logging, and limits via config.json |

---

## Requirements

- SPT 3.11.x (tested on 3.11.4)
- Client-side BepInEx mod (creates gear snapshots)

---

## Quick Start

### Installation

1. Download the latest release
2. Extract the archive directly into your SPT root folder (where SPT.Server.exe is located)
3. The folder structure should look like:

```
[SPT Root]/
├── BepInEx/
│   └── plugins/
│       └── Blackhorse311-KeepStartingGear/
│           ├── Blackhorse311.KeepStartingGear.dll  (client mod)
│           └── snapshots/                          (created automatically)
└── user/
    └── mods/
        └── Blackhorse311-KeepStartingGear/
            ├── package.json
            ├── config.json
            └── src/
                ├── mod.js
                ├── Constants.js
                ├── Models.js
                └── SnapshotRestorer.js
```

### Verifying Installation

Start the SPT server and look for:
```
[KeepStartingGear] v1.1.0 loaded
[KeepStartingGear] Snapshots path: [path]
```

---

## How It Works

### Technical Flow

```
Client: Raid Start → Create Snapshot → Save JSON
                          ↓
Server: Raid End → Check Exit Status
                          ↓
         Death? → Restore from Snapshot → Delete Snapshot
                          ↓
         Extract? → Delete Snapshot → Keep Loot
```

### Exit Status Handling

The mod uses a **survival whitelist** for safety:

| Status | Behavior |
|--------|----------|
| `Survived` | Player extracted - snapshot cleared, loot kept |
| `Runner` | Run-through - snapshot cleared, loot kept |
| `Killed` | Player died - restore from snapshot |
| `Left` | Player disconnected - restore from snapshot |
| `MissingInAction` | Raid timer expired - restore from snapshot |
| *Unknown* | Treated as death - restore from snapshot |

Using a whitelist means unknown statuses default to restoration, preventing accidental gear loss.

---

## Configuration

Edit `config.json` in the mod folder to customize behavior:

```json
{
    "maxParentTraversalDepth": 20,
    "maxFileReadRetries": 5,
    "fileReadRetryDelayMs": 150,
    "maxSnapshotFileSizeBytes": 10485760,
    "verboseLogging": false,
    "minRestoreIntervalMs": 1000
}
```

### Configuration Reference

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `maxParentTraversalDepth` | 20 | 10-100 | Max depth for tracing item parent chains |
| `maxFileReadRetries` | 5 | 1-20 | File read retry attempts for handling file locks |
| `fileReadRetryDelayMs` | 150 | 50-2000 | Base delay between retries (exponential backoff) |
| `maxSnapshotFileSizeBytes` | 10MB | 1KB-100MB | Maximum allowed snapshot file size |
| `verboseLogging` | false | - | Enable detailed debug logging |
| `minRestoreIntervalMs` | 1000 | 0-60000 | Minimum time between restoration attempts |

---

## Architecture

| File | Purpose |
|------|---------|
| `mod.ts` | Main entry point, route hooks, raid end handling |
| `Constants.ts` | Centralized constants and configuration loading |
| `Models.ts` | TypeScript interfaces, validation, and utility functions |
| `SnapshotRestorer.ts` | Core restoration logic with rollback support |

### Key Design Patterns

- **O(1) Item Lookup** - Uses hash maps for efficient parent traversal
- **Retry Logic** - Handles file locking from concurrent access
- **Transaction Rollback** - Automatic backup/restore on errors
- **Version Validation** - Ensures snapshot compatibility
- **Duplicate Prevention** - Skips items that already exist
- **Slot Management** - Respects user-configured slot preferences
- **Security Validation** - Path traversal protection, input sanitization

---

## Building from Source

### Prerequisites

- Node.js 18+
- npm

### Build Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type-check without emitting
npm run build:check

# Compile TypeScript
npm run build
```

### Output

Compiled JavaScript files are placed in `src/`:
- `mod.js` - Main entry point (referenced by package.json)
- `Constants.js` - Shared constants and configuration
- `Models.js` - Type definitions and utilities
- `SnapshotRestorer.js` - Restoration logic

---

## Compatibility

| Component | Status | Notes |
|-----------|--------|-------|
| **SPT 3.11.x** | ✅ Supported | Tested on 3.11.4 |
| **SPT 4.0+** | ❌ Not Compatible | Use the C# version |
| **Custom Items** | ✅ Full Support | Works with any modded gear |
| **SVM** | ⚠️ Partial | Disable Safe Exit & Softcore Mode |

---

## SVM (Server Value Modifier) Compatibility

If using SVM alongside Keep Starting Gear, you **MUST** disable:

| Setting | Required Value | Reason |
|---------|---------------|--------|
| **Safe Exit** | **OFF** | Interferes with death detection |
| **Softcore Mode** | **OFF** | Conflicts with gear restoration |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Mod not loading | Ensure `package.json` exists in mod folder |
| Gear not restoring | Verify BOTH client AND server mods are installed |
| Snapshot errors | Check BepInEx console for client errors |
| Version mismatch | Update both client and server mods |
| "Rate limit exceeded" | Wait a moment before dying again (protection against spam) |
| File size errors | Check for corrupted snapshots in BepInEx/plugins/.../snapshots/ |

### Enabling Debug Logging

Set `"verboseLogging": true` in `config.json` to see detailed logs in the server console.

---

## Security Features

- **Session ID Validation** - Prevents path traversal attacks
- **File Size Limits** - Prevents memory exhaustion from large files
- **Input Sanitization** - Safe logging of user-provided data
- **Path Validation** - Ensures file operations stay within allowed directories

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for full version history.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Credits

**Author:** Blackhorse311

**Thanks to:**
- SPT Team - For the amazing SPT project
- BepInEx Team - For the modding framework
- Community bug reporters - For helping improve the mod

---

## Support

### Bug Reports

Please include:
- SPT and mod versions
- Steps to reproduce
- Server console log
- Client log: `BepInEx/LogOutput.log`

Report issues at: https://github.com/Blackhorse311/KeepStartingGear/issues
