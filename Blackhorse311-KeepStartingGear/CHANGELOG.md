# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-10

### Added

- **Configuration File Support**: Added `config.json` for user-customizable settings without modifying code
  - `maxParentTraversalDepth` - Limit for tracing item parent chains (10-100, default: 20)
  - `maxFileReadRetries` - File read retry attempts (1-20, default: 5)
  - `fileReadRetryDelayMs` - Delay between retries (50-2000ms, default: 150)
  - `maxSnapshotFileSizeBytes` - Maximum snapshot file size (default: 10MB)
  - `verboseLogging` - Enable detailed debug logging (default: false)
  - `minRestoreIntervalMs` - Rate limiting between restore attempts (default: 1000ms)

- **Transaction Rollback**: Inventory is now fully rolled back to original state if any error occurs during restoration, preventing partial data loss

- **Rate Limiting**: Added protection against rapid repeated restoration attempts

- **Path Traversal Protection**: Session IDs are now validated to prevent directory traversal attacks

- **Snapshot Validation**: Added comprehensive validation of snapshot structure before processing

- **Deep Clone for Item Data**: Item update data (durability, ammo counts, etc.) is now deep cloned to prevent reference mutations

- **Cycle Detection**: Parent chain traversal now detects and handles circular references

- **File Size Limits**: Large snapshot files are rejected to prevent memory exhaustion

### Fixed

- **Critical: Busy-Wait Sleep**: Replaced CPU-intensive busy-wait loop with more efficient delay implementation

- **Critical: Partial Restoration Data Loss**: Added transaction-like backup/rollback to prevent inventory corruption on errors

- **Critical: Race Condition**: Increased file read retries and added content validation for partially-written files

- **Version Validation**: Fixed confusing version references in code comments

- **Equipment Container Validation**: Added proper null checks for profile structure

- **Shallow Copy Bug**: Fixed shallow copy of `upd` objects that could cause reference mutations

- **Exit Status Handling**: Changed from death blacklist to survival whitelist for safer handling of unknown statuses

### Changed

- **TypeScript Strict Mode**: Enabled all strict TypeScript checks for better type safety
- **Survival Status Whitelist**: Now uses whitelist (`Survived`, `Runner`) instead of death blacklist - unknown statuses trigger restoration
- **Improved Error Messages**: More descriptive error messages throughout
- **Better Logging Control**: Debug logging now controlled by `verboseLogging` config option

### Security

- **Session ID Validation**: Rejects session IDs with path separators, special characters, or excessive length
- **Path Validation**: Ensures resolved snapshot paths stay within the snapshots directory
- **Input Sanitization**: All user-provided data is sanitized before logging

### Technical

- Refactored `RestoreResult` to use a factory class pattern
- Added comprehensive JSDoc documentation throughout
- Created utility functions for deep cloning and validation
- All 130 unit tests passing

### Compatibility

- SPT 3.11.x (tested on 3.11.4)

---

## [1.0.0] - 2025-01-09

### Added

- Initial SPT 3.11.4 compatible version
- Full restoration logic ported from C# version
- Comprehensive documentation
- Modular architecture (Constants, Models, SnapshotRestorer)
- File read retry logic for handling file locking
- Version validation for snapshot compatibility
- O(1) item lookup performance using hash maps
- Duplicate item prevention
- Slot-based management respecting user configuration

### Technical Details

- TypeScript source with compiled JavaScript output
- Uses SPT's static router system for raid end interception
- JSON-based snapshot format compatible with client mod
- Support for all item properties (durability, ammo, medical uses, etc.)

### Compatibility

- SPT 3.11.x (tested on 3.11.4)
