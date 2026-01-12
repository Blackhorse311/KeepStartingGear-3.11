/**
 * Configuration options that can be overridden by config.json
 */
export interface ModConfig {
    /** Maximum depth for parent traversal when tracing items to root slots */
    maxParentTraversalDepth: number;
    /** Maximum number of retries when reading snapshot files */
    maxFileReadRetries: number;
    /** Base delay in milliseconds between file read retries */
    fileReadRetryDelayMs: number;
    /** Maximum snapshot file size in bytes (default 10MB) */
    maxSnapshotFileSizeBytes: number;
    /** Enable verbose debug logging */
    verboseLogging: boolean;
    /** Minimum time between restoration attempts per session (rate limiting) */
    minRestoreIntervalMs: number;
}
/**
 * Loads configuration from config.json if it exists, otherwise uses defaults.
 * @param modDirectory - Path to the mod directory
 * @returns Merged configuration
 */
export declare function loadConfig(modDirectory: string): ModConfig;
/**
 * Centralized constants for the Keep Starting Gear mod.
 * All constant values should be defined here to ensure consistency
 * across all modules and make maintenance easier.
 */
export declare const Constants: {
    /**
     * Current mod version. Update this when releasing new versions.
     * Used for version compatibility checks with snapshots.
     */
    readonly MOD_VERSION: "1.1.0";
    /**
     * Mod folder name. Must match the folder name in user/mods/ and BepInEx/plugins/.
     * This is used to construct paths to snapshot files.
     */
    readonly MOD_FOLDER_NAME: "Blackhorse311-KeepStartingGear";
    /**
     * Prefix for all log messages. Makes it easy to filter mod logs in console.
     */
    readonly LOG_PREFIX: "[KeepStartingGear]";
    /**
     * Template ID for the Equipment container in EFT profiles.
     * This is a fixed ID defined by BSG - all players have this container.
     * Items in equipment slots have this as their parentId.
     *
     * @remarks
     * This ID should be validated at startup to ensure compatibility.
     * If BSG changes this in a future update, the mod will fail gracefully.
     */
    readonly EQUIPMENT_TEMPLATE_ID: "55d7217a4bdc2d86028b456d";
    /**
     * Exit status values from EFT/SPT.
     * These determine whether the player died or survived.
     *
     * @remarks
     * We use a SURVIVAL whitelist rather than a DEATH blacklist.
     * This is safer because unknown statuses default to "death" behavior,
     * preventing accidental gear loss if new statuses are added.
     */
    readonly EXIT_STATUS: {
        /** Player extracted successfully */
        readonly SURVIVED: "Survived";
        /** Player was killed in raid */
        readonly KILLED: "Killed";
        /** Player disconnected or left raid */
        readonly LEFT: "Left";
        /** Player got "Run Through" status (not enough XP/time) */
        readonly RUNNER: "Runner";
        /** Player ran out of time (MIA) */
        readonly MISSING_IN_ACTION: "MissingInAction";
    };
    /**
     * Statuses that indicate survival (player keeps their loot).
     * Using a whitelist is safer than a death blacklist.
     */
    readonly SURVIVAL_STATUSES: Set<string>;
    /** Default configuration values */
    readonly DEFAULTS: ModConfig;
};
/**
 * Type for exit status values.
 * Provides type safety when working with exit statuses.
 */
export type ExitStatus = typeof Constants.EXIT_STATUS[keyof typeof Constants.EXIT_STATUS];
/**
 * Validates that the Equipment template ID appears valid.
 * @param templateId - The template ID to validate
 * @returns True if the ID looks like a valid MongoDB ObjectId
 */
export declare function isValidEquipmentTemplateId(templateId: string): boolean;
//# sourceMappingURL=Constants.d.ts.map