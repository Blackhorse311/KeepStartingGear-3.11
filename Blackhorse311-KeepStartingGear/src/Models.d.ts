/**
 * Result of a snapshot restoration operation.
 * Provides detailed information about what happened during restoration.
 */
export interface RestoreResult {
    /** Whether the restoration was successful */
    readonly success: boolean;
    /** Number of items added during restoration */
    readonly itemsAdded: number;
    /** Number of duplicate items that were skipped */
    readonly duplicatesSkipped: number;
    /** Number of items skipped because they were in non-managed slots */
    readonly nonManagedSkipped: number;
    /** Error message if restoration failed (undefined on success) */
    readonly errorMessage?: string;
}
/**
 * Factory class for creating RestoreResult instances.
 * Uses static methods for clarity and to avoid interface/const name collision.
 */
export declare class RestoreResultFactory {
    /**
     * Creates a successful restoration result.
     * @param itemsAdded - Number of items that were restored
     * @param duplicatesSkipped - Number of duplicate items skipped
     * @param nonManagedSkipped - Number of non-managed slot items skipped
     * @returns A successful RestoreResult
     */
    static succeeded(itemsAdded: number, duplicatesSkipped?: number, nonManagedSkipped?: number): RestoreResult;
    /**
     * Creates a failed restoration result.
     * @param errorMessage - Description of why restoration failed
     * @returns A failed RestoreResult
     */
    static failed(errorMessage: string): RestoreResult;
}
export declare const RestoreResult: typeof RestoreResultFactory;
/**
 * Represents a snapshot of inventory items.
 * Mirrors the client-side InventorySnapshot class for JSON compatibility.
 *
 * @remarks
 * Snapshots are created by the BepInEx client mod and saved as JSON files.
 * The server mod reads these files to restore gear when the player dies.
 */
export interface InventorySnapshot {
    /** Player's session/profile ID */
    readonly sessionId?: string;
    /** Profile ID (may be same as sessionId) */
    readonly profileId?: string;
    /** Player's character name */
    readonly playerName?: string;
    /** ISO timestamp when the snapshot was taken */
    readonly timestamp?: string;
    /** Whether snapshot was taken during raid */
    readonly takenInRaid?: boolean;
    /** Map/location where snapshot was taken */
    readonly location?: string;
    /** List of all captured items */
    readonly items: readonly SnapshotItem[];
    /**
     * List of slot names that were included in the snapshot config.
     * This is the authoritative list of slots the mod manages.
     */
    readonly includedSlots?: readonly string[];
    /**
     * List of slot names that were enabled but empty at snapshot time.
     * Items in these slots should be REMOVED during restoration
     * (they weren't there when the snapshot was taken).
     */
    readonly emptySlots?: readonly string[];
    /** Mod version that created this snapshot */
    readonly modVersion?: string;
}
/**
 * Represents a single item in the snapshot.
 * Uses underscore-prefixed properties to match SPT's JSON format.
 *
 * @remarks
 * The client uses _id and _tpl (with underscores) to match SPT's format.
 * This ensures direct compatibility with profile inventory items.
 */
export interface SnapshotItem {
    /** Unique item instance ID */
    readonly _id: string;
    /** Item template ID (defines what type of item this is) */
    readonly _tpl: string;
    /** Parent container's ID */
    readonly parentId?: string;
    /** Slot or grid ID within parent */
    readonly slotId?: string;
    /**
     * Item location - can be either:
     * - ItemLocation object for grid items (backpack, rig, pockets)
     * - number for cartridges in magazines (position index)
     */
    readonly location?: ItemLocation | number;
    /** Update/state data (stack count, durability, etc.) */
    readonly upd?: ItemUpd;
}
/**
 * Represents an item's position within a grid container.
 * Used for items in backpacks, rigs, pockets, and other grid-based storage.
 *
 * @remarks
 * Grid coordinates start at (0,0) in the top-left corner.
 * The rotation value determines whether the item is placed
 * horizontally or vertically in the grid.
 */
export interface ItemLocation {
    /** X coordinate (horizontal position), 0 is leftmost */
    readonly x: number;
    /** Y coordinate (vertical position), 0 is topmost */
    readonly y: number;
    /** Rotation: 0 = horizontal (default), 1 = vertical (90 degrees) */
    readonly r: number;
    /** Whether this item has been searched/inspected */
    readonly isSearched?: boolean;
}
/**
 * Item update/state data containing dynamic properties.
 * Not all properties apply to all items.
 *
 * @remarks
 * Examples:
 * - StackObjectsCount: Only for stackable items (ammo, money, meds)
 * - SpawnedInSession: True if item was found during current raid (FIR)
 * - Foldable: Only for weapons with folding stocks
 * - MedKit: Medical item durability/HP remaining
 * - Repairable: Armor and weapon durability
 */
export interface ItemUpd {
    /** Stack count for stackable items */
    readonly StackObjectsCount?: number;
    /** True if item was found in raid (FIR status) */
    readonly SpawnedInSession?: boolean;
    /** Folding state for weapons with folding stocks */
    readonly Foldable?: UpdFoldable;
    /** Medical item durability */
    readonly MedKit?: UpdMedKit;
    /** Armor/weapon durability */
    readonly Repairable?: UpdRepairable;
    /** Consumable resource (fuel, etc.) */
    readonly Resource?: UpdResource;
    /** Food and drink resource */
    readonly FoodDrink?: UpdFoodDrink;
    /** Custom tag/name applied by player */
    readonly Tag?: UpdTag;
    /** Dogtag metadata */
    readonly Dogtag?: UpdDogtag;
    /** Key usage information */
    readonly Key?: UpdKey;
    /** Light state */
    readonly Light?: UpdLight;
    /** Togglable state */
    readonly Togglable?: UpdTogglable;
    /** Fire mode */
    readonly FireMode?: UpdFireMode;
    /** Sight scope info */
    readonly Sight?: UpdSight;
}
/** Folding state for weapons */
export interface UpdFoldable {
    readonly Folded: boolean;
}
/** Medical item durability */
export interface UpdMedKit {
    readonly HpResource: number;
}
/** Armor/weapon durability */
export interface UpdRepairable {
    readonly Durability: number;
    readonly MaxDurability: number;
}
/** Consumable resource */
export interface UpdResource {
    readonly Value: number;
}
/** Food and drink resource */
export interface UpdFoodDrink {
    readonly HpPercent: number;
}
/** Custom item tag */
export interface UpdTag {
    readonly Name: string;
    readonly Color: number;
}
/** Dogtag metadata */
export interface UpdDogtag {
    readonly AccountId?: string;
    readonly ProfileId?: string;
    readonly Nickname?: string;
    readonly Side?: string;
    readonly Level?: number;
    readonly Time?: string;
    readonly Status?: string;
    readonly KillerAccountId?: string;
    readonly KillerProfileId?: string;
    readonly KillerName?: string;
    readonly WeaponName?: string;
}
/** Key usage information */
export interface UpdKey {
    readonly NumberOfUsages: number;
}
/** Light state */
export interface UpdLight {
    readonly IsActive: boolean;
    readonly SelectedMode: number;
}
/** Togglable state */
export interface UpdTogglable {
    readonly On: boolean;
}
/** Fire mode */
export interface UpdFireMode {
    readonly FireMode: string;
}
/** Sight scope info */
export interface UpdSight {
    readonly ScopesCurrentCalibPointIndexes: readonly number[];
    readonly ScopesSelectedModes: readonly number[];
    readonly SelectedScope: number;
}
/**
 * Health status data from raid end
 */
export interface HealthData {
    /** Whether the player is alive */
    readonly IsAlive: boolean;
    /** Health of each body part */
    readonly Health: Record<string, {
        Current: number;
        Maximum: number;
    }>;
    /** Hydration level */
    readonly Hydration: {
        Current: number;
        Maximum: number;
    };
    /** Energy level */
    readonly Energy: {
        Current: number;
        Maximum: number;
    };
}
/**
 * Request data for the /raid/profile/save endpoint.
 * Contains all information about how the raid ended.
 */
export interface ISaveProgressRequestData {
    /** Exit status (Survived, Killed, Left, etc.) */
    readonly exit: string;
    /** Player's profile data including inventory */
    profile: ProfileData;
    /** True if this was a Scav raid */
    readonly isPlayerScav: boolean;
    /** Health status at raid end */
    readonly health: HealthData;
    /** Insurance information */
    readonly insurance?: readonly InsuranceItem[];
}
/**
 * Insurance item data
 */
export interface InsuranceItem {
    readonly id: string;
    readonly durability?: number;
}
/**
 * Profile data from raid end request.
 */
export interface ProfileData {
    /** Player's inventory */
    Inventory?: InventoryData;
    /** Profile ID */
    readonly _id?: string;
    /** Account ID */
    readonly aid?: string;
    /** Player info */
    readonly Info?: {
        readonly Nickname?: string;
        readonly Side?: string;
        readonly Level?: number;
    };
}
/**
 * Inventory data containing all items.
 */
export interface InventoryData {
    /** List of all inventory items */
    items: ProfileItem[];
    /** Equipment container ID */
    readonly equipment?: string;
    /** Stash container ID */
    readonly stash?: string;
    /** Quest raid items container ID */
    readonly questRaidItems?: string;
    /** Quest stash items container ID */
    readonly questStashItems?: string;
    /** Sorting table container ID */
    readonly sortingTable?: string;
    /** Fast panel bindings */
    readonly fastPanel?: Record<string, string>;
}
/**
 * A single item in the profile inventory.
 * Similar to SnapshotItem but used in profile context.
 */
export interface ProfileItem {
    _id: string;
    _tpl: string;
    parentId?: string;
    slotId?: string;
    location?: ItemLocation | number;
    upd?: ItemUpd;
}
/**
 * Deep clones an ItemUpd object to prevent reference mutations.
 * @param upd - The ItemUpd to clone
 * @returns A deep copy of the ItemUpd
 */
export declare function deepCloneItemUpd(upd: ItemUpd | undefined): ItemUpd | undefined;
/**
 * Validates a session ID to prevent path traversal attacks.
 * @param sessionId - The session ID to validate
 * @returns True if the session ID is safe to use in file paths
 */
export declare function isValidSessionId(sessionId: string): boolean;
/**
 * Validates basic snapshot structure.
 * @param snapshot - The snapshot to validate
 * @returns Object with valid flag and optional error message
 */
export declare function validateSnapshot(snapshot: unknown): {
    valid: boolean;
    error?: string;
};
//# sourceMappingURL=Models.d.ts.map