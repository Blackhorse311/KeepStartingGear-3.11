// ============================================================================
// Keep Starting Gear - Constants
// ============================================================================
// Centralized definition of all constants used throughout the mod.
// This ensures consistency and makes maintenance easier.
//
// USAGE:
// Import this file in any module that needs access to shared constants:
//   import { Constants } from "./Constants";
//   console.log(Constants.LOG_PREFIX);
//
// IMPORTANT: When updating the mod version, change it HERE and it will
// propagate to all modules automatically.
//
// AUTHOR: Blackhorse311
// LICENSE: MIT
// ============================================================================

import * as fs from "fs";
import * as path from "path";

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
 * Default configuration values
 */
const DEFAULT_CONFIG: ModConfig = {
    maxParentTraversalDepth: 20,
    maxFileReadRetries: 5,
    fileReadRetryDelayMs: 150,
    maxSnapshotFileSizeBytes: 10 * 1024 * 1024, // 10MB
    verboseLogging: false,
    minRestoreIntervalMs: 1000
};

/**
 * Loads configuration from config.json if it exists, otherwise uses defaults.
 * @param modDirectory - Path to the mod directory
 * @returns Merged configuration
 */
export function loadConfig(modDirectory: string): ModConfig {
    const configPath = path.join(modDirectory, "config.json");

    try {
        if (fs.existsSync(configPath)) {
            const configJson = fs.readFileSync(configPath, "utf8");
            const userConfig = JSON.parse(configJson) as Partial<ModConfig>;

            // Merge with defaults, validating each value
            return {
                maxParentTraversalDepth: validateNumber(
                    userConfig.maxParentTraversalDepth,
                    DEFAULT_CONFIG.maxParentTraversalDepth,
                    10, 100
                ),
                maxFileReadRetries: validateNumber(
                    userConfig.maxFileReadRetries,
                    DEFAULT_CONFIG.maxFileReadRetries,
                    1, 20
                ),
                fileReadRetryDelayMs: validateNumber(
                    userConfig.fileReadRetryDelayMs,
                    DEFAULT_CONFIG.fileReadRetryDelayMs,
                    50, 2000
                ),
                maxSnapshotFileSizeBytes: validateNumber(
                    userConfig.maxSnapshotFileSizeBytes,
                    DEFAULT_CONFIG.maxSnapshotFileSizeBytes,
                    1024, 100 * 1024 * 1024
                ),
                verboseLogging: typeof userConfig.verboseLogging === "boolean"
                    ? userConfig.verboseLogging
                    : DEFAULT_CONFIG.verboseLogging,
                minRestoreIntervalMs: validateNumber(
                    userConfig.minRestoreIntervalMs,
                    DEFAULT_CONFIG.minRestoreIntervalMs,
                    0, 60000
                )
            };
        }
    } catch {
        // Fall through to return defaults
    }

    return { ...DEFAULT_CONFIG };
}

/**
 * Validates a number is within range, returning default if invalid.
 */
function validateNumber(
    value: number | undefined,
    defaultValue: number,
    min: number,
    max: number
): number {
    if (typeof value !== "number" || isNaN(value)) {
        return defaultValue;
    }
    return Math.max(min, Math.min(max, value));
}

/**
 * Centralized constants for the Keep Starting Gear mod.
 * All constant values should be defined here to ensure consistency
 * across all modules and make maintenance easier.
 */
export const Constants = {
    // ========================================================================
    // Mod Identity
    // ========================================================================

    /**
     * Current mod version. Update this when releasing new versions.
     * Used for version compatibility checks with snapshots.
     */
    MOD_VERSION: "1.1.0",

    /**
     * Mod folder name. Must match the folder name in user/mods/ and BepInEx/plugins/.
     * This is used to construct paths to snapshot files.
     */
    MOD_FOLDER_NAME: "Blackhorse311-KeepStartingGear",

    /**
     * Prefix for all log messages. Makes it easy to filter mod logs in console.
     */
    LOG_PREFIX: "[KeepStartingGear]",

    // ========================================================================
    // EFT/SPT Constants
    // ========================================================================

    /**
     * Template ID for the Equipment container in EFT profiles.
     * This is a fixed ID defined by BSG - all players have this container.
     * Items in equipment slots have this as their parentId.
     *
     * @remarks
     * This ID should be validated at startup to ensure compatibility.
     * If BSG changes this in a future update, the mod will fail gracefully.
     */
    EQUIPMENT_TEMPLATE_ID: "55d7217a4bdc2d86028b456d",

    // ========================================================================
    // Exit Status Values
    // ========================================================================

    /**
     * Exit status values from EFT/SPT.
     * These determine whether the player died or survived.
     *
     * @remarks
     * We use a SURVIVAL whitelist rather than a DEATH blacklist.
     * This is safer because unknown statuses default to "death" behavior,
     * preventing accidental gear loss if new statuses are added.
     */
    EXIT_STATUS: {
        /** Player extracted successfully */
        SURVIVED: "Survived",
        /** Player was killed in raid */
        KILLED: "Killed",
        /** Player disconnected or left raid */
        LEFT: "Left",
        /** Player got "Run Through" status (not enough XP/time) */
        RUNNER: "Runner",
        /** Player ran out of time (MIA) */
        MISSING_IN_ACTION: "MissingInAction"
    },

    /**
     * Statuses that indicate survival (player keeps their loot).
     * Using a whitelist is safer than a death blacklist.
     */
    SURVIVAL_STATUSES: new Set<string>(["Survived", "Runner"]),

    // ========================================================================
    // Default Configuration (can be overridden by config.json)
    // ========================================================================

    /** Default configuration values */
    DEFAULTS: DEFAULT_CONFIG
} as const;

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
export function isValidEquipmentTemplateId(templateId: string): boolean {
    // MongoDB ObjectId: 24 hex characters
    return typeof templateId === "string" &&
           templateId.length === 24 &&
           /^[a-f0-9]+$/i.test(templateId);
}
