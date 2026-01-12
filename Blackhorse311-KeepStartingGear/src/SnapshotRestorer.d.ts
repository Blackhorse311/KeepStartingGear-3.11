import { ILogger } from "@spt/models/spt/utils/ILogger";
import { ModConfig } from "./Constants";
import { RestoreResult, ProfileItem } from "./Models";
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
export declare class SnapshotRestorer {
    private readonly logger;
    private readonly snapshotsPath;
    private readonly config;
    private readonly rateLimitMap;
    /**
     * Creates a new SnapshotRestorer instance.
     *
     * @param logger - SPT logger for output messages
     * @param snapshotsPath - Path to the snapshots directory
     * @param config - Mod configuration options
     * @throws Error if logger or snapshotsPath is null/undefined
     */
    constructor(logger: ILogger, snapshotsPath: string, config: ModConfig);
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
    tryRestore(sessionId: string, inventoryItems: ProfileItem[]): RestoreResult;
    /**
     * Clears the snapshot for a session (called on successful extraction).
     *
     * @param sessionId - Player's session/profile ID
     *
     * @remarks
     * This should be called when a player extracts successfully to prevent
     * accidental restoration on their next death.
     */
    clearSnapshot(sessionId: string): void;
    /**
     * Checks if a restoration attempt is allowed based on rate limiting.
     * @param sessionId - Session ID to check
     * @returns True if the attempt is allowed
     */
    private checkRateLimit;
    /**
     * Performs the actual restoration from a snapshot file.
     *
     * @param snapshotPath - Full path to the snapshot JSON file
     * @param inventoryItems - Inventory items array to modify
     * @returns RestoreResult with restoration statistics
     */
    private restoreFromFile;
    /**
     * Creates a deep copy of the inventory for rollback purposes.
     * @param items - Items to backup
     * @returns Deep copy of the items array
     */
    private createInventoryBackup;
    /**
     * Restores inventory from backup after a failed restoration.
     * @param items - Current items array to restore
     * @param backup - Backup items to restore from
     */
    private restoreFromBackup;
    /**
     * Checks if a file is within size limits.
     * @param filePath - Path to check
     * @returns Validation result
     */
    private checkFileSize;
    /**
     * Reads snapshot file with retry logic for file locking issues.
     * Uses proper async-friendly delays instead of busy-wait.
     *
     * @param filePath - Path to the snapshot file
     * @returns File contents as string, or null if all retries fail
     */
    private readSnapshotWithRetry;
    /**
     * Synchronous delay that doesn't busy-wait.
     * Uses Atomics.wait on a SharedArrayBuffer for efficient waiting.
     * Falls back to a less CPU-intensive approach if SharedArrayBuffer is unavailable.
     *
     * @param ms - Milliseconds to delay
     */
    private syncDelay;
    /**
     * Safely deletes a snapshot file.
     * @param filePath - Path to the snapshot file
     */
    private deleteSnapshotFile;
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
    private validateSnapshotVersion;
    /**
     * Parses a semantic version string.
     * @param version - Version string like "1.4.9"
     * @returns Parsed version parts or null if invalid
     */
    private parseVersion;
    /**
     * Finds the Equipment container ID in the inventory.
     * Works for both profile and snapshot items.
     *
     * @param items - Inventory items to search
     * @returns Equipment container ID or undefined
     */
    private findEquipmentId;
    /**
     * Builds the slot tracking sets from snapshot data.
     *
     * @param snapshot - The inventory snapshot
     * @param snapshotEquipmentId - Equipment container ID in snapshot
     * @returns Object containing includedSlots, snapshotSlots, and emptySlots sets
     */
    private buildSlotSets;
    /**
     * Determines if a slot is managed by the mod.
     *
     * @param slotId - Slot identifier (case-insensitive)
     * @param includedSlots - User-configured slots to manage
     * @param snapshotSlots - Slots with items in snapshot
     * @param emptySlots - Slots that were empty at snapshot time
     * @returns True if the slot should be managed
     */
    private isSlotManaged;
    /**
     * Builds an O(1) lookup map for snapshot items by ID.
     * This is critical for performance - avoids O(n²) nested loops.
     *
     * @param items - Snapshot items
     * @returns Map of item ID to item
     */
    private buildItemLookup;
    /**
     * Builds a map of item IDs to their root equipment slot.
     * Uses O(1) lookup for parent traversal.
     *
     * @param items - Snapshot items
     * @param snapshotEquipmentId - Equipment container ID
     * @param itemLookup - Pre-built item lookup map
     * @returns Map of item ID to root slot name
     */
    private buildRootSlotMap;
    /**
     * Traces an item up to its root equipment slot.
     * Uses O(1) parent lookup and includes infinite loop protection.
     *
     * @param item - Item to trace
     * @param equipmentId - Equipment container ID
     * @param itemLookup - Pre-built item lookup map
     * @returns Root slot name or undefined
     */
    private traceRootSlot;
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
    private removeManagedSlotItems;
    /**
     * Logs the reason why an item is being removed.
     */
    private logRemovalReason;
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
    private addSnapshotItems;
    /**
     * Creates a ProfileItem from a SnapshotItem with proper parent remapping.
     *
     * @param snapshotItem - Source snapshot item
     * @param profileEquipmentId - Profile's equipment container ID
     * @param snapshotEquipmentId - Snapshot's equipment container ID
     * @returns New ProfileItem ready to add to inventory
     */
    private createItemFromSnapshot;
    /**
     * Logs a debug message if verbose logging is enabled.
     * @param message - Message to log (without prefix)
     */
    private logDebug;
    /**
     * Sanitizes a string for safe logging (removes/replaces potentially dangerous characters).
     * @param input - String to sanitize
     * @returns Sanitized string safe for logging
     */
    private sanitizeForLog;
}
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
export declare function resolveSnapshotsPath(modDirectory: string): string;
/**
 * Validates that a snapshots path looks valid and doesn't contain path traversal.
 * @param snapshotsPath - Path to validate
 * @param sptRoot - Expected SPT root directory
 * @returns True if the path is valid
 */
export declare function validateSnapshotsPath(snapshotsPath: string, sptRoot: string): boolean;
//# sourceMappingURL=SnapshotRestorer.d.ts.map