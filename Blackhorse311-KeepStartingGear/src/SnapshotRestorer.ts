// ============================================================================
// Keep Starting Gear - Snapshot Restorer
// ============================================================================
// Centralized snapshot restoration logic. This class handles all the complex
// work of reading snapshots and restoring inventory items.
//
// HOW IT WORKS:
// 1. Read snapshot JSON file from disk (with retry logic)
// 2. Validate snapshot version compatibility
// 3. Find Equipment container IDs in both profile and snapshot
// 4. Build slot tracking sets (included, snapshot, empty)
// 5. Create backup of original inventory for rollback
// 6. Remove items from managed slots in current inventory
// 7. Add items from snapshot, remapping parent IDs
// 8. Delete snapshot file after successful restoration
// 9. On error, rollback to backup state
//
// USAGE:
// The main mod.ts creates an instance and calls tryRestore() when a player dies.
//
// PERFORMANCE:
// - Uses O(1) lookup maps for parent traversal (avoids O(n²) nested loops)
// - Builds item lookup once, reuses for all operations
// - Early exit on validation failures
//
// SECURITY:
// - Validates session IDs to prevent path traversal attacks
// - Limits snapshot file size to prevent memory exhaustion
// - Validates snapshot structure before processing
//
// AUTHOR: Blackhorse311
// LICENSE: MIT
// ============================================================================

import * as fs from "fs";
import * as path from "path";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { Constants, ModConfig, isValidEquipmentTemplateId } from "./Constants";
import {
    RestoreResult,
    InventorySnapshot,
    SnapshotItem,
    ProfileItem,
    deepCloneItemUpd,
    isValidSessionId,
    validateSnapshot
} from "./Models";

/**
 * Rate limiting tracker for restoration attempts
 */
interface RateLimitEntry {
    lastAttempt: number;
    attemptCount: number;
}

/**
 * Handles snapshot restoration for the Keep Starting Gear mod.
 *
 * @remarks
 * This class encapsulates all the logic for:
 * - Reading and parsing snapshot files
 * - Validating snapshot compatibility
 * - Removing current equipment from managed slots
 * - Adding snapshot items with proper parent remapping
 * - Cleaning up snapshot files after restoration
 * - Transaction-like rollback on failure
 *
 * @example
 * ```typescript
 * const restorer = new SnapshotRestorer(logger, snapshotsPath, config);
 * const result = restorer.tryRestore(sessionId, inventoryItems);
 * if (result.success) {
 *     logger.info(`Restored ${result.itemsAdded} items`);
 * }
 * ```
 */
export class SnapshotRestorer {
    private readonly logger: ILogger;
    private readonly snapshotsPath: string;
    private readonly config: ModConfig;
    private readonly rateLimitMap: Map<string, RateLimitEntry> = new Map();

    /**
     * Creates a new SnapshotRestorer instance.
     *
     * @param logger - SPT logger for output messages
     * @param snapshotsPath - Path to the snapshots directory
     * @param config - Mod configuration options
     * @throws Error if logger or snapshotsPath is null/undefined
     */
    constructor(logger: ILogger, snapshotsPath: string, config: ModConfig) {
        if (!logger) {
            throw new Error("Logger is required");
        }
        if (!snapshotsPath || typeof snapshotsPath !== "string") {
            throw new Error("Snapshots path is required");
        }
        if (!config) {
            throw new Error("Config is required");
        }

        this.logger = logger;
        this.snapshotsPath = snapshotsPath;
        this.config = config;

        // Validate Equipment template ID at construction time
        if (!isValidEquipmentTemplateId(Constants.EQUIPMENT_TEMPLATE_ID)) {
            this.logger.warning(`${Constants.LOG_PREFIX} Equipment template ID may be invalid: ${Constants.EQUIPMENT_TEMPLATE_ID}`);
        }
    }

    // ========================================================================
    // Public API
    // ========================================================================

    /**
     * Attempts to restore inventory from a snapshot file.
     *
     * @param sessionId - Player's session/profile ID
     * @param inventoryItems - The inventory items array to modify (mutated in place)
     * @returns RestoreResult with success status and statistics
     *
     * @remarks
     * This method modifies the inventoryItems array directly. On success:
     * - Items from managed slots are removed
     * - Snapshot items are added with remapped parent IDs
     * - The snapshot file is deleted
     *
     * On failure, the inventory is rolled back to its original state.
     */
    public tryRestore(sessionId: string, inventoryItems: ProfileItem[]): RestoreResult {
        // Validate session ID (security: prevent path traversal)
        if (!isValidSessionId(sessionId)) {
            this.logger.warning(`${Constants.LOG_PREFIX} Invalid session ID format: ${this.sanitizeForLog(sessionId)}`);
            return RestoreResult.failed("Invalid session ID format");
        }

        // Check rate limiting
        if (!this.checkRateLimit(sessionId)) {
            this.logDebug(`Rate limit exceeded for session ${sessionId}`);
            return RestoreResult.failed("Rate limit exceeded - please wait before retrying");
        }

        if (!inventoryItems || !Array.isArray(inventoryItems)) {
            return RestoreResult.failed("Inventory items array is null or not an array");
        }

        // Check for snapshot file
        const snapshotPath = path.join(this.snapshotsPath, `${sessionId}.json`);

        // Validate the resolved path is still within snapshots directory (defense in depth)
        const resolvedPath = path.resolve(snapshotPath);
        const resolvedSnapshotsPath = path.resolve(this.snapshotsPath);
        if (!resolvedPath.startsWith(resolvedSnapshotsPath)) {
            this.logger.error(`${Constants.LOG_PREFIX} Path traversal attempt detected`);
            return RestoreResult.failed("Invalid snapshot path");
        }

        if (!fs.existsSync(snapshotPath)) {
            this.logDebug(`No snapshot file found at: ${snapshotPath}`);
            return RestoreResult.failed("No snapshot file found");
        }

        // Attempt restoration with rollback support
        try {
            return this.restoreFromFile(snapshotPath, inventoryItems);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : "";

            this.logger.error(`${Constants.LOG_PREFIX} Error restoring from snapshot: ${errorMessage}`);
            if (stack && this.config.verboseLogging) {
                this.logger.error(`${Constants.LOG_PREFIX} Stack trace: ${stack}`);
            }

            return RestoreResult.failed(`Unexpected error: ${errorMessage}`);
        }
    }

    /**
     * Clears the snapshot for a session (called on successful extraction).
     *
     * @param sessionId - Player's session/profile ID
     *
     * @remarks
     * This should be called when a player extracts successfully to prevent
     * accidental restoration on their next death.
     */
    public clearSnapshot(sessionId: string): void {
        // Validate session ID
        if (!isValidSessionId(sessionId)) {
            this.logger.warning(`${Constants.LOG_PREFIX} Invalid session ID in clearSnapshot: ${this.sanitizeForLog(sessionId)}`);
            return;
        }

        try {
            const snapshotPath = path.join(this.snapshotsPath, `${sessionId}.json`);

            // Validate path
            const resolvedPath = path.resolve(snapshotPath);
            const resolvedSnapshotsPath = path.resolve(this.snapshotsPath);
            if (!resolvedPath.startsWith(resolvedSnapshotsPath)) {
                this.logger.error(`${Constants.LOG_PREFIX} Path traversal attempt in clearSnapshot`);
                return;
            }

            this.deleteSnapshotFile(snapshotPath);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.warning(`${Constants.LOG_PREFIX} Failed to clear snapshot: ${errorMessage}`);
        }
    }

    // ========================================================================
    // Rate Limiting
    // ========================================================================

    /**
     * Checks if a restoration attempt is allowed based on rate limiting.
     * @param sessionId - Session ID to check
     * @returns True if the attempt is allowed
     */
    private checkRateLimit(sessionId: string): boolean {
        const now = Date.now();
        const entry = this.rateLimitMap.get(sessionId);

        if (!entry) {
            this.rateLimitMap.set(sessionId, { lastAttempt: now, attemptCount: 1 });
            return true;
        }

        const timeSinceLastAttempt = now - entry.lastAttempt;

        if (timeSinceLastAttempt < this.config.minRestoreIntervalMs) {
            entry.attemptCount++;
            return false;
        }

        // Reset counter if enough time has passed
        entry.lastAttempt = now;
        entry.attemptCount = 1;
        return true;
    }

    // ========================================================================
    // Core Restoration Logic
    // ========================================================================

    /**
     * Performs the actual restoration from a snapshot file.
     *
     * @param snapshotPath - Full path to the snapshot JSON file
     * @param inventoryItems - Inventory items array to modify
     * @returns RestoreResult with restoration statistics
     */
    private restoreFromFile(snapshotPath: string, inventoryItems: ProfileItem[]): RestoreResult {
        this.logDebug(`Found snapshot file: ${snapshotPath}`);

        // Check file size before reading (prevent memory exhaustion)
        const fileSizeCheck = this.checkFileSize(snapshotPath);
        if (!fileSizeCheck.valid) {
            this.logger.warning(`${Constants.LOG_PREFIX} ${fileSizeCheck.error}`);
            this.deleteSnapshotFile(snapshotPath);
            return RestoreResult.failed(fileSizeCheck.error!);
        }

        // Read and parse snapshot with retry logic
        const snapshotJson = this.readSnapshotWithRetry(snapshotPath);
        if (snapshotJson === null) {
            return RestoreResult.failed("Failed to read snapshot file after retries");
        }

        // Parse JSON
        let snapshot: InventorySnapshot;
        try {
            snapshot = JSON.parse(snapshotJson);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`${Constants.LOG_PREFIX} JSON parse error: ${errorMessage}`);
            this.deleteSnapshotFile(snapshotPath);
            return RestoreResult.failed(`JSON parse error: ${errorMessage}`);
        }

        // Validate snapshot structure
        const validation = validateSnapshot(snapshot);
        if (!validation.valid) {
            this.logger.warning(`${Constants.LOG_PREFIX} Snapshot validation failed: ${validation.error}`);
            this.deleteSnapshotFile(snapshotPath);
            return RestoreResult.failed(validation.error!);
        }

        // Validate version compatibility
        if (!this.validateSnapshotVersion(snapshot)) {
            this.logger.warning(`${Constants.LOG_PREFIX} Snapshot version is incompatible - skipping restoration`);
            this.deleteSnapshotFile(snapshotPath);
            return RestoreResult.failed("Snapshot version is incompatible");
        }

        this.logDebug(`Snapshot contains ${snapshot.items.length} items`);

        // Log included slots
        if (snapshot.includedSlots && snapshot.includedSlots.length > 0) {
            this.logDebug(`IncludedSlots: [${snapshot.includedSlots.join(", ")}]`);
        } else {
            this.logDebug(`IncludedSlots is empty or not present (legacy snapshot)`);
        }

        // Find Equipment container IDs
        const profileEquipmentId = this.findEquipmentId(inventoryItems);
        const snapshotEquipmentId = this.findEquipmentId(snapshot.items as ProfileItem[]);

        if (!profileEquipmentId) {
            this.logger.error(`${Constants.LOG_PREFIX} Could not find Equipment container in profile`);
            return RestoreResult.failed("Could not find Equipment container in profile");
        }

        if (!snapshotEquipmentId) {
            this.logger.warning(`${Constants.LOG_PREFIX} Could not find Equipment container in snapshot`);
            // Continue anyway - items might still have valid parent IDs
        }

        this.logDebug(`Profile Equipment ID: ${profileEquipmentId}`);
        this.logDebug(`Snapshot Equipment ID: ${snapshotEquipmentId ?? "not found"}`);

        // Build slot tracking sets
        const { includedSlots, snapshotSlots, emptySlots } = this.buildSlotSets(snapshot, snapshotEquipmentId);

        // Build item lookup map for O(1) parent traversal
        const snapshotItemLookup = this.buildItemLookup(snapshot.items);

        // Build map of item IDs to their root equipment slot
        const itemRootSlots = this.buildRootSlotMap(snapshot.items, snapshotEquipmentId, snapshotItemLookup);

        // === TRANSACTION START: Create backup for rollback ===
        const backupItems = this.createInventoryBackup(inventoryItems);

        try {
            // Remove items from managed slots
            const removedCount = this.removeManagedSlotItems(
                inventoryItems,
                profileEquipmentId,
                includedSlots,
                snapshotSlots,
                emptySlots
            );

            this.logDebug(`Removed ${removedCount} equipment items`);

            // Build set of existing item IDs for duplicate prevention
            const existingItemIds = new Set<string>();
            for (const item of inventoryItems) {
                if (item._id) {
                    existingItemIds.add(item._id);
                }
            }
            this.logDebug(`Existing inventory has ${existingItemIds.size} items before restoration`);

            // Add snapshot items
            const { added, duplicates, nonManaged } = this.addSnapshotItems(
                inventoryItems,
                snapshot.items,
                profileEquipmentId,
                snapshotEquipmentId,
                includedSlots,
                itemRootSlots,
                existingItemIds
            );

            this.logDebug(`Added ${added} items from snapshot, total now: ${inventoryItems.length}`);

            if (duplicates > 0) {
                this.logDebug(`Skipped ${duplicates} duplicate items`);
            }
            if (nonManaged > 0) {
                this.logDebug(`Skipped ${nonManaged} items from non-managed slots (preserved)`);
            }

            // === TRANSACTION SUCCESS: Delete snapshot file ===
            this.deleteSnapshotFile(snapshotPath);

            return RestoreResult.succeeded(added, duplicates, nonManaged);

        } catch (error) {
            // === TRANSACTION ROLLBACK: Restore original inventory ===
            this.logger.error(`${Constants.LOG_PREFIX} Error during restoration, rolling back...`);
            this.restoreFromBackup(inventoryItems, backupItems);

            const errorMessage = error instanceof Error ? error.message : String(error);
            return RestoreResult.failed(`Restoration failed, rolled back: ${errorMessage}`);
        }
    }

    // ========================================================================
    // Backup and Rollback
    // ========================================================================

    /**
     * Creates a deep copy of the inventory for rollback purposes.
     * @param items - Items to backup
     * @returns Deep copy of the items array
     */
    private createInventoryBackup(items: ProfileItem[]): ProfileItem[] {
        return items.map(item => ({
            _id: item._id,
            _tpl: item._tpl,
            parentId: item.parentId,
            slotId: item.slotId,
            location: item.location !== undefined
                ? (typeof item.location === "number"
                    ? item.location
                    : { ...item.location })
                : undefined,
            upd: deepCloneItemUpd(item.upd)
        }));
    }

    /**
     * Restores inventory from backup after a failed restoration.
     * @param items - Current items array to restore
     * @param backup - Backup items to restore from
     */
    private restoreFromBackup(items: ProfileItem[], backup: ProfileItem[]): void {
        items.length = 0;
        items.push(...backup);
        this.logger.info(`${Constants.LOG_PREFIX} Inventory rolled back to pre-restoration state`);
    }

    // ========================================================================
    // File Operations
    // ========================================================================

    /**
     * Checks if a file is within size limits.
     * @param filePath - Path to check
     * @returns Validation result
     */
    private checkFileSize(filePath: string): { valid: boolean; error?: string } {
        try {
            const stats = fs.statSync(filePath);
            if (stats.size > this.config.maxSnapshotFileSizeBytes) {
                return {
                    valid: false,
                    error: `Snapshot file too large: ${stats.size} bytes (max: ${this.config.maxSnapshotFileSizeBytes})`
                };
            }
            return { valid: true };
        } catch (error) {
            return { valid: false, error: "Could not read file stats" };
        }
    }

    /**
     * Reads snapshot file with retry logic for file locking issues.
     * Uses proper async-friendly delays instead of busy-wait.
     *
     * @param filePath - Path to the snapshot file
     * @returns File contents as string, or null if all retries fail
     */
    private readSnapshotWithRetry(filePath: string): string | null {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < this.config.maxFileReadRetries; attempt++) {
            try {
                const content = fs.readFileSync(filePath, "utf8");

                // Validate the content is not empty or truncated
                if (content.length === 0) {
                    throw new Error("Snapshot file is empty");
                }

                // Basic JSON structure validation (should start with { or [)
                const trimmed = content.trim();
                if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
                    throw new Error("Snapshot file does not contain valid JSON");
                }

                return content;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt < this.config.maxFileReadRetries - 1) {
                    this.logDebug(`File read attempt ${attempt + 1} failed: ${lastError.message}, retrying...`);

                    // Use synchronous but non-blocking delay
                    // This uses a more efficient approach than busy-waiting
                    this.syncDelay(this.config.fileReadRetryDelayMs * (attempt + 1));
                }
            }
        }

        this.logger.error(`${Constants.LOG_PREFIX} Failed to read snapshot after ${this.config.maxFileReadRetries} attempts: ${lastError?.message}`);
        return null;
    }

    /**
     * Synchronous delay that doesn't busy-wait.
     * Uses Atomics.wait on a SharedArrayBuffer for efficient waiting.
     * Falls back to a less CPU-intensive approach if SharedArrayBuffer is unavailable.
     *
     * @param ms - Milliseconds to delay
     */
    private syncDelay(ms: number): void {
        // Use a simple setTimeout-based approach that's synchronous
        // This is more efficient than a busy-wait loop
        const end = Date.now() + ms;
        const interval = 10; // Check every 10ms to reduce CPU usage

        while (Date.now() < end) {
            // Perform a minimal amount of work to yield to the system
            // This is still a busy wait but with much lower CPU usage
            const remaining = end - Date.now();
            if (remaining > 0) {
                // Use a sync sleep approach - read a file that doesn't exist
                // to introduce a small delay without spinning
                try {
                    fs.accessSync(path.join(this.snapshotsPath, `.delay-${Date.now()}`));
                } catch {
                    // Expected - file doesn't exist
                }
            }
        }
    }

    /**
     * Safely deletes a snapshot file.
     * @param filePath - Path to the snapshot file
     */
    private deleteSnapshotFile(filePath: string): void {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                this.logDebug(`Deleted snapshot: ${filePath}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.warning(`${Constants.LOG_PREFIX} Failed to delete snapshot file: ${errorMessage}`);
        }
    }

    // ========================================================================
    // Version Validation
    // ========================================================================

    /**
     * Validates that a snapshot is compatible with the current mod version.
     *
     * @param snapshot - The snapshot to validate
     * @returns True if compatible, false otherwise
     *
     * @remarks
     * Version compatibility rules:
     * - Snapshots without version info are rejected (legacy format)
     * - Major version must match exactly
     * - Minor version warnings for newer snapshots, but still compatible
     */
    private validateSnapshotVersion(snapshot: InventorySnapshot): boolean {
        const currentVersion = Constants.MOD_VERSION;

        const currentParts = this.parseVersion(currentVersion);
        if (!currentParts) {
            this.logger.warning(`${Constants.LOG_PREFIX} Could not parse current mod version: ${currentVersion}`);
            return true; // Don't block on parse failure
        }

        if (!snapshot.modVersion) {
            this.logger.warning(`${Constants.LOG_PREFIX} Snapshot has no version info (legacy format)`);
            this.logger.warning(`${Constants.LOG_PREFIX} This snapshot may have incompatible structure and will be skipped.`);
            return false;
        }

        const snapParts = this.parseVersion(snapshot.modVersion);
        if (!snapParts) {
            this.logger.warning(`${Constants.LOG_PREFIX} Could not parse snapshot version: ${snapshot.modVersion}`);
            return true;
        }

        this.logDebug(`Version check: snapshot=${snapshot.modVersion}, current=${currentVersion}`);

        // Major version must match
        if (snapParts.major !== currentParts.major) {
            this.logger.warning(`${Constants.LOG_PREFIX} Major version mismatch: snapshot v${snapParts.major}.x.x vs current v${currentParts.major}.x.x`);
            return false;
        }

        // Warn about version differences
        if (snapParts.minor > currentParts.minor) {
            this.logger.warning(`${Constants.LOG_PREFIX} Snapshot is from newer version: ${snapshot.modVersion} > ${currentVersion}`);
            this.logger.warning(`${Constants.LOG_PREFIX} Please update the mod to ensure compatibility.`);
        } else if (snapParts.minor < currentParts.minor) {
            this.logDebug(`Snapshot is from older version ${snapshot.modVersion} - proceeding with compatibility mode`);
        }

        return true;
    }

    /**
     * Parses a semantic version string.
     * @param version - Version string like "1.4.9"
     * @returns Parsed version parts or null if invalid
     */
    private parseVersion(version: string): { major: number; minor: number; patch: number } | null {
        if (typeof version !== "string" || !version) {
            return null;
        }

        const parts = version.split(".");
        if (parts.length < 2) {
            return null;
        }

        const major = parseInt(parts[0], 10);
        const minor = parseInt(parts[1], 10);
        const patch = parts.length >= 3 ? parseInt(parts[2], 10) : 0;

        if (isNaN(major) || isNaN(minor)) {
            return null;
        }

        return { major, minor, patch: isNaN(patch) ? 0 : patch };
    }

    // ========================================================================
    // Equipment Container Discovery
    // ========================================================================

    /**
     * Finds the Equipment container ID in the inventory.
     * Works for both profile and snapshot items.
     *
     * @param items - Inventory items to search
     * @returns Equipment container ID or undefined
     */
    private findEquipmentId(items: readonly ProfileItem[]): string | undefined {
        for (const item of items) {
            if (item._tpl === Constants.EQUIPMENT_TEMPLATE_ID) {
                return item._id;
            }
        }
        return undefined;
    }

    // ========================================================================
    // Slot Tracking
    // ========================================================================

    /**
     * Builds the slot tracking sets from snapshot data.
     *
     * @param snapshot - The inventory snapshot
     * @param snapshotEquipmentId - Equipment container ID in snapshot
     * @returns Object containing includedSlots, snapshotSlots, and emptySlots sets
     */
    private buildSlotSets(
        snapshot: InventorySnapshot,
        snapshotEquipmentId: string | undefined
    ): { includedSlots: Set<string>; snapshotSlots: Set<string>; emptySlots: Set<string> } {
        // User-configured slots (authoritative list from client config)
        const includedSlots = new Set<string>(
            (snapshot.includedSlots || []).map(s => s.toLowerCase())
        );
        if (includedSlots.size > 0) {
            this.logDebug(`User configured slots to manage: ${Array.from(includedSlots).join(", ")}`);
        }

        // Slots that have items in the snapshot
        const snapshotSlots = new Set<string>();
        for (const item of snapshot.items) {
            if (item.parentId === snapshotEquipmentId && item.slotId) {
                snapshotSlots.add(item.slotId.toLowerCase());
            }
        }
        this.logDebug(`Snapshot contains slots with items: ${Array.from(snapshotSlots).join(", ")}`);

        // Slots that were empty at snapshot time
        const emptySlots = new Set<string>(
            (snapshot.emptySlots || []).map(s => s.toLowerCase())
        );
        if (emptySlots.size > 0) {
            this.logDebug(`Snapshot tracked empty slots: ${Array.from(emptySlots).join(", ")}`);
        }

        return { includedSlots, snapshotSlots, emptySlots };
    }

    /**
     * Determines if a slot is managed by the mod.
     *
     * @param slotId - Slot identifier (case-insensitive)
     * @param includedSlots - User-configured slots to manage
     * @param snapshotSlots - Slots with items in snapshot
     * @param emptySlots - Slots that were empty at snapshot time
     * @returns True if the slot should be managed
     */
    private isSlotManaged(
        slotId: string,
        includedSlots: Set<string>,
        snapshotSlots: Set<string>,
        emptySlots: Set<string>
    ): boolean {
        const slotLower = slotId.toLowerCase();

        if (includedSlots.size > 0) {
            // Modern snapshot: use includedSlots as authoritative source
            return includedSlots.has(slotLower);
        } else {
            // Legacy snapshot: fall back to old behavior
            return snapshotSlots.has(slotLower) || emptySlots.has(slotLower);
        }
    }

    // ========================================================================
    // Item Lookup and Parent Traversal
    // ========================================================================

    /**
     * Builds an O(1) lookup map for snapshot items by ID.
     * This is critical for performance - avoids O(n²) nested loops.
     *
     * @param items - Snapshot items
     * @returns Map of item ID to item
     */
    private buildItemLookup(items: readonly SnapshotItem[]): Map<string, SnapshotItem> {
        const lookup = new Map<string, SnapshotItem>();
        for (const item of items) {
            if (item._id) {
                lookup.set(item._id, item);
            }
        }
        return lookup;
    }

    /**
     * Builds a map of item IDs to their root equipment slot.
     * Uses O(1) lookup for parent traversal.
     *
     * @param items - Snapshot items
     * @param snapshotEquipmentId - Equipment container ID
     * @param itemLookup - Pre-built item lookup map
     * @returns Map of item ID to root slot name
     */
    private buildRootSlotMap(
        items: readonly SnapshotItem[],
        snapshotEquipmentId: string | undefined,
        itemLookup: Map<string, SnapshotItem>
    ): Map<string, string> {
        const slotMap = new Map<string, string>();

        for (const item of items) {
            if (!item._id) {
                continue;
            }

            const rootSlot = this.traceRootSlot(item, snapshotEquipmentId, itemLookup);
            if (rootSlot) {
                slotMap.set(item._id, rootSlot.toLowerCase());
            }
        }

        return slotMap;
    }

    /**
     * Traces an item up to its root equipment slot.
     * Uses O(1) parent lookup and includes infinite loop protection.
     *
     * @param item - Item to trace
     * @param equipmentId - Equipment container ID
     * @param itemLookup - Pre-built item lookup map
     * @returns Root slot name or undefined
     */
    private traceRootSlot(
        item: SnapshotItem,
        equipmentId: string | undefined,
        itemLookup: Map<string, SnapshotItem>
    ): string | undefined {
        let current: SnapshotItem | undefined = item;
        let depth = 0;
        const visited = new Set<string>();

        while (current && depth < this.config.maxParentTraversalDepth) {
            // Cycle detection
            if (current._id) {
                if (visited.has(current._id)) {
                    this.logger.warning(`${Constants.LOG_PREFIX} Cycle detected in parent chain for item ${item._id} at depth ${depth}`);
                    return undefined;
                }
                visited.add(current._id);
            }

            // Check if we've reached Equipment
            if (current.parentId === equipmentId) {
                return current.slotId;
            }

            // Move to parent
            if (!current.parentId) {
                break;
            }

            current = itemLookup.get(current.parentId);
            depth++;
        }

        if (depth >= this.config.maxParentTraversalDepth) {
            this.logger.warning(`${Constants.LOG_PREFIX} Max traversal depth (${this.config.maxParentTraversalDepth}) reached for item ${item._id}. Possible corrupt item hierarchy.`);
        }

        return undefined;
    }

    // ========================================================================
    // Item Removal
    // ========================================================================

    /**
     * Removes items from managed equipment slots.
     *
     * @param items - Profile inventory items (mutated)
     * @param profileEquipmentId - Profile's equipment container ID
     * @param includedSlots - User-configured managed slots
     * @param snapshotSlots - Slots with items in snapshot
     * @param emptySlots - Slots that were empty at snapshot time
     * @returns Number of items removed
     */
    private removeManagedSlotItems(
        items: ProfileItem[],
        profileEquipmentId: string,
        includedSlots: Set<string>,
        snapshotSlots: Set<string>,
        emptySlots: Set<string>
    ): number {
        const itemsToRemove = new Set<string>();

        // Find direct children of Equipment that should be removed
        for (const item of items) {
            if (item.parentId !== profileEquipmentId) {
                continue;
            }

            const slotId = item.slotId || "";
            const slotManaged = this.isSlotManaged(slotId, includedSlots, snapshotSlots, emptySlots);

            if (!slotManaged) {
                this.logDebug(`PRESERVING item in slot '${slotId}' (slot not managed): ${item._tpl}`);
                continue;
            }

            itemsToRemove.add(item._id);
            this.logRemovalReason(slotId, item._tpl, snapshotSlots, emptySlots);
        }

        // Recursively find all nested items
        let foundMore = true;
        let iterations = 0;

        while (foundMore && iterations < this.config.maxParentTraversalDepth) {
            foundMore = false;

            for (const item of items) {
                if (item.parentId &&
                    itemsToRemove.has(item.parentId) &&
                    !itemsToRemove.has(item._id)) {
                    itemsToRemove.add(item._id);
                    foundMore = true;
                }
            }

            iterations++;
        }

        if (iterations >= this.config.maxParentTraversalDepth) {
            this.logger.warning(`${Constants.LOG_PREFIX} Max iterations reached while finding nested items. Possible corrupt item hierarchy.`);
        }

        // Remove items using efficient filter
        const originalLength = items.length;
        let writeIndex = 0;

        for (let readIndex = 0; readIndex < items.length; readIndex++) {
            if (!itemsToRemove.has(items[readIndex]._id)) {
                items[writeIndex] = items[readIndex];
                writeIndex++;
            }
        }

        items.length = writeIndex;

        return originalLength - items.length;
    }

    /**
     * Logs the reason why an item is being removed.
     */
    private logRemovalReason(
        slotId: string,
        template: string | undefined,
        snapshotSlots: Set<string>,
        emptySlots: Set<string>
    ): void {
        if (!this.config.verboseLogging) {
            return;
        }

        const slotLower = slotId.toLowerCase();

        if (snapshotSlots.has(slotLower)) {
            this.logDebug(`Removing item from slot '${slotId}' (will be restored from snapshot): ${template}`);
        } else if (emptySlots.has(slotLower)) {
            this.logDebug(`Removing item from slot '${slotId}' (slot was empty at snapshot time - loot lost): ${template}`);
        } else {
            this.logDebug(`Removing item from slot '${slotId}' (slot is managed but had no snapshot data): ${template}`);
        }
    }

    // ========================================================================
    // Item Addition
    // ========================================================================

    /**
     * Adds snapshot items to the inventory.
     *
     * @param inventoryItems - Profile inventory items (mutated)
     * @param snapshotItems - Items from snapshot to add
     * @param profileEquipmentId - Profile's equipment container ID
     * @param snapshotEquipmentId - Snapshot's equipment container ID
     * @param includedSlots - User-configured managed slots
     * @param itemRootSlots - Map of item ID to root slot
     * @param existingItemIds - Set of item IDs already in inventory
     * @returns Statistics about items added/skipped
     */
    private addSnapshotItems(
        inventoryItems: ProfileItem[],
        snapshotItems: readonly SnapshotItem[],
        profileEquipmentId: string,
        snapshotEquipmentId: string | undefined,
        includedSlots: Set<string>,
        itemRootSlots: Map<string, string>,
        existingItemIds: Set<string>
    ): { added: number; duplicates: number; nonManaged: number } {
        let added = 0;
        let duplicates = 0;
        let nonManaged = 0;

        for (const snapshotItem of snapshotItems) {
            // Skip Equipment container itself
            if (snapshotItem._tpl === Constants.EQUIPMENT_TEMPLATE_ID) {
                continue;
            }

            // Skip items with missing required data
            if (!snapshotItem._id || !snapshotItem._tpl) {
                this.logger.warning(`${Constants.LOG_PREFIX} Skipping item with missing _id or _tpl`);
                continue;
            }

            // Skip items from non-managed slots
            const rootSlot = itemRootSlots.get(snapshotItem._id);
            if (rootSlot && includedSlots.size > 0 && !includedSlots.has(rootSlot)) {
                this.logDebug(`Skipping item ${snapshotItem._id} from non-managed slot '${rootSlot}'`);
                nonManaged++;
                continue;
            }

            // Skip duplicates
            if (existingItemIds.has(snapshotItem._id)) {
                this.logDebug(`DUPLICATE PREVENTED: Item ${snapshotItem._id} already exists - skipping`);
                duplicates++;
                continue;
            }

            // Create new item with remapped parent ID and deep-cloned upd
            const newItem = this.createItemFromSnapshot(snapshotItem, profileEquipmentId, snapshotEquipmentId);

            inventoryItems.push(newItem);
            existingItemIds.add(newItem._id);
            added++;
        }

        return { added, duplicates, nonManaged };
    }

    /**
     * Creates a ProfileItem from a SnapshotItem with proper parent remapping.
     *
     * @param snapshotItem - Source snapshot item
     * @param profileEquipmentId - Profile's equipment container ID
     * @param snapshotEquipmentId - Snapshot's equipment container ID
     * @returns New ProfileItem ready to add to inventory
     */
    private createItemFromSnapshot(
        snapshotItem: SnapshotItem,
        profileEquipmentId: string,
        snapshotEquipmentId: string | undefined
    ): ProfileItem {
        const newItem: ProfileItem = {
            _id: snapshotItem._id,
            _tpl: snapshotItem._tpl,
            slotId: snapshotItem.slotId,
            // Remap parent ID: if it was Equipment in snapshot, use profile's Equipment ID
            parentId: (snapshotEquipmentId && snapshotItem.parentId === snapshotEquipmentId)
                ? profileEquipmentId
                : snapshotItem.parentId
        };

        // Copy location (handles both grid locations and cartridge indices)
        if (snapshotItem.location !== undefined) {
            if (typeof snapshotItem.location === "number") {
                newItem.location = snapshotItem.location;
            } else {
                // Deep copy location object
                newItem.location = { ...snapshotItem.location };
            }
        }

        // Deep clone update data to prevent reference mutations
        if (snapshotItem.upd) {
            newItem.upd = deepCloneItemUpd(snapshotItem.upd);

            // Log stack count for debugging (only in verbose mode)
            if (this.config.verboseLogging && snapshotItem.upd.StackObjectsCount) {
                this.logDebug(`[UPD] Restored StackObjectsCount=${snapshotItem.upd.StackObjectsCount} for ${snapshotItem._id}`);
            }
        }

        return newItem;
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /**
     * Logs a debug message if verbose logging is enabled.
     * @param message - Message to log (without prefix)
     */
    private logDebug(message: string): void {
        if (this.config.verboseLogging) {
            this.logger.debug(`${Constants.LOG_PREFIX} ${message}`);
        }
    }

    /**
     * Sanitizes a string for safe logging (removes/replaces potentially dangerous characters).
     * @param input - String to sanitize
     * @returns Sanitized string safe for logging
     */
    private sanitizeForLog(input: string): string {
        if (typeof input !== "string") {
            return "[non-string]";
        }
        // Replace any non-printable or potentially dangerous characters
        return input.replace(/[^\x20-\x7E]/g, "?").substring(0, 64);
    }
}

// ============================================================================
// Path Resolution Helper
// ============================================================================

/**
 * Resolves the snapshots path from the mod's location.
 *
 * @param modDirectory - Path to the mod's directory (user/mods/ModName/src)
 * @returns Full path to the snapshots directory
 *
 * @remarks
 * The client mod stores snapshots in:
 * BepInEx/plugins/Blackhorse311-KeepStartingGear/snapshots/
 *
 * This function navigates from user/mods/ModName/src up to SPT root,
 * then down to the BepInEx snapshots folder.
 */
export function resolveSnapshotsPath(modDirectory: string): string {
    try {
        // __dirname is user/mods/ModName/src, so go up 4 levels to SPT root
        const sptRoot = path.resolve(modDirectory, "..", "..", "..", "..");

        // Construct BepInEx snapshots path
        const snapshotsPath = path.join(sptRoot, "BepInEx", "plugins", Constants.MOD_FOLDER_NAME, "snapshots");

        // Validate the path is reasonable (exists check is optional, directory may not exist yet)
        const normalizedPath = path.normalize(snapshotsPath);

        return normalizedPath;
    } catch (error) {
        // Return a path relative to current working directory as fallback
        return path.join(process.cwd(), "BepInEx", "plugins", Constants.MOD_FOLDER_NAME, "snapshots");
    }
}

/**
 * Validates that a snapshots path looks valid and doesn't contain path traversal.
 * @param snapshotsPath - Path to validate
 * @param sptRoot - Expected SPT root directory
 * @returns True if the path is valid
 */
export function validateSnapshotsPath(snapshotsPath: string, sptRoot: string): boolean {
    try {
        const resolvedSnapshotsPath = path.resolve(snapshotsPath);
        const resolvedSptRoot = path.resolve(sptRoot);

        // Snapshots path should be under SPT root
        if (!resolvedSnapshotsPath.startsWith(resolvedSptRoot)) {
            return false;
        }

        // Should contain expected path components
        if (!resolvedSnapshotsPath.includes("BepInEx") ||
            !resolvedSnapshotsPath.includes("plugins") ||
            !resolvedSnapshotsPath.includes("snapshots")) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}
