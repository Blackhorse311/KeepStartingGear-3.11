"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidEquipmentTemplateId = exports.Constants = exports.loadConfig = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
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
function loadConfig(modDirectory) {
    const configPath = path.join(modDirectory, "config.json");
    try {
        if (fs.existsSync(configPath)) {
            const configJson = fs.readFileSync(configPath, "utf8");
            const userConfig = JSON.parse(configJson);
            // Merge with defaults, validating each value
            return {
                maxParentTraversalDepth: validateNumber(userConfig.maxParentTraversalDepth, DEFAULT_CONFIG.maxParentTraversalDepth, 10, 100),
                maxFileReadRetries: validateNumber(userConfig.maxFileReadRetries, DEFAULT_CONFIG.maxFileReadRetries, 1, 20),
                fileReadRetryDelayMs: validateNumber(userConfig.fileReadRetryDelayMs, DEFAULT_CONFIG.fileReadRetryDelayMs, 50, 2000),
                maxSnapshotFileSizeBytes: validateNumber(userConfig.maxSnapshotFileSizeBytes, DEFAULT_CONFIG.maxSnapshotFileSizeBytes, 1024, 100 * 1024 * 1024),
                verboseLogging: typeof userConfig.verboseLogging === "boolean"
                    ? userConfig.verboseLogging
                    : DEFAULT_CONFIG.verboseLogging,
                minRestoreIntervalMs: validateNumber(userConfig.minRestoreIntervalMs, DEFAULT_CONFIG.minRestoreIntervalMs, 0, 60000)
            };
        }
    }
    catch {
        // Fall through to return defaults
    }
    return { ...DEFAULT_CONFIG };
}
exports.loadConfig = loadConfig;
/**
 * Validates a number is within range, returning default if invalid.
 */
function validateNumber(value, defaultValue, min, max) {
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
exports.Constants = {
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
    SURVIVAL_STATUSES: new Set(["Survived", "Runner"]),
    // ========================================================================
    // Default Configuration (can be overridden by config.json)
    // ========================================================================
    /** Default configuration values */
    DEFAULTS: DEFAULT_CONFIG
};
/**
 * Validates that the Equipment template ID appears valid.
 * @param templateId - The template ID to validate
 * @returns True if the ID looks like a valid MongoDB ObjectId
 */
function isValidEquipmentTemplateId(templateId) {
    // MongoDB ObjectId: 24 hex characters
    return typeof templateId === "string" &&
        templateId.length === 24 &&
        /^[a-f0-9]+$/i.test(templateId);
}
exports.isValidEquipmentTemplateId = isValidEquipmentTemplateId;
//# sourceMappingURL=Constants.js.map