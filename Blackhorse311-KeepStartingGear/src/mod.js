"use strict";
// ============================================================================
// Keep Starting Gear - SPT 3.11.4 Server Mod
// ============================================================================
// The cure for gear fear. Protect your loadout. Die without consequences.
//
// This server-side mod intercepts raid end events and restores player gear
// from snapshots when they die. It works with the client-side BepInEx mod
// that creates gear snapshots at raid start.
//
// HOW IT WORKS:
// 1. Client mod creates a snapshot at raid start (saved as JSON)
// 2. Player enters raid and plays normally
// 3. If player dies, this mod intercepts the raid save request
// 4. We restore inventory from the snapshot BEFORE normal death processing
// 5. SPT processes the raid end with the restored inventory
// 6. Result: Player keeps their starting gear, no "Run-Through" penalty
//
// KEY INSIGHT:
// By modifying the inventory data BEFORE SPT's normal processing, we avoid
// the "Run-Through" status penalty that would occur if we restored items
// after death processing. SPT just sees a dead player with inventory.
//
// ARCHITECTURE:
// - mod.ts: Main entry point, route registration, raid end handling
// - Constants.ts: Centralized constants and configuration
// - Models.ts: TypeScript interfaces for data structures
// - SnapshotRestorer.ts: Core restoration logic (extracted for maintainability)
//
// SPT VERSION: 3.11.x
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
exports.mod = void 0;
const path = __importStar(require("path"));
const Constants_1 = require("./Constants");
const Models_1 = require("./Models");
const SnapshotRestorer_1 = require("./SnapshotRestorer");
/**
 * Keep Starting Gear - Main Mod Class
 *
 * Implements SPT's mod lifecycle interfaces to hook into the server.
 * - IPreSptLoadMod: Register route hooks before database loads
 * - IPostDBLoadMod: Resolve dependencies after database loads
 *
 * @remarks
 * The mod uses a static router hook on `/raid/profile/save` to intercept
 * raid end events. This allows us to modify the player's inventory before
 * SPT's normal death processing occurs.
 *
 * @example
 * Lifecycle:
 * 1. preSptLoad() - Register route hook
 * 2. postDBLoad() - Resolve dependencies, initialize restorer
 * 3. onRaidEnd() - Called for each raid end, handles restoration
 */
class KeepStartingGearMod {
    // ========================================================================
    // Dependencies (resolved in postDBLoad)
    // ========================================================================
    /** SPT logger for console output */
    logger = null;
    /** Snapshot restorer instance */
    restorer = null;
    /** Path to snapshot files */
    snapshotsPath = "";
    /** Mod configuration */
    config = null;
    /** Whether the mod initialized successfully */
    initialized = false;
    // ========================================================================
    // SPT Mod Lifecycle
    // ========================================================================
    /**
     * Called before the SPT database is loaded.
     * This is where we register our route hooks.
     *
     * @param container - Dependency injection container
     *
     * @remarks
     * We hook into `/raid/profile/save` which is called when a raid ends.
     * Using the "spt" namespace means our hook runs alongside SPT's handler,
     * allowing us to modify the request data before normal processing.
     */
    preSptLoad(container) {
        const staticRouterModService = container.resolve("StaticRouterModService");
        // Register hook for raid end processing
        staticRouterModService.registerStaticRouter(`${Constants_1.Constants.MOD_FOLDER_NAME}-RaidSave`, [
            {
                url: "/raid/profile/save",
                action: (url, info, sessionID, output) => {
                    // Process BEFORE the default handler
                    // We modify info.profile.Inventory directly
                    this.onRaidEnd(sessionID, info);
                    return output;
                }
            }
        ], "spt" // Use SPT namespace to run alongside default handler
        );
    }
    /**
     * Called after the SPT database is loaded.
     * This is where we resolve dependencies and initialize.
     *
     * @param container - Dependency injection container
     */
    postDBLoad(container) {
        try {
            // Resolve dependencies
            this.logger = container.resolve("WinstonLogger");
            if (!this.logger) {
                console.error("[KeepStartingGear] Failed to resolve logger");
                return;
            }
            // Load configuration
            const modDirectory = path.dirname(__dirname);
            this.config = (0, Constants_1.loadConfig)(modDirectory);
            // Validate Equipment template ID
            if (!(0, Constants_1.isValidEquipmentTemplateId)(Constants_1.Constants.EQUIPMENT_TEMPLATE_ID)) {
                this.logger.error(`${Constants_1.Constants.LOG_PREFIX} Equipment template ID appears invalid: ${Constants_1.Constants.EQUIPMENT_TEMPLATE_ID}`);
                this.logger.error(`${Constants_1.Constants.LOG_PREFIX} The mod may not function correctly. Please verify the template ID.`);
            }
            // Resolve snapshots path
            // The mod is located at: SPT/user/mods/Blackhorse311-KeepStartingGear/
            // Snapshots are at: SPT/BepInEx/plugins/Blackhorse311-KeepStartingGear/snapshots/
            this.snapshotsPath = (0, SnapshotRestorer_1.resolveSnapshotsPath)(__dirname);
            // Create restorer instance
            this.restorer = new SnapshotRestorer_1.SnapshotRestorer(this.logger, this.snapshotsPath, this.config);
            this.initialized = true;
            // Log startup
            this.logger.info(`${Constants_1.Constants.LOG_PREFIX} v${Constants_1.Constants.MOD_VERSION} loaded`);
            this.logger.info(`${Constants_1.Constants.LOG_PREFIX} Snapshots path: ${this.snapshotsPath}`);
            if (this.config.verboseLogging) {
                this.logger.info(`${Constants_1.Constants.LOG_PREFIX} Verbose logging enabled`);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const logFn = this.logger ? this.logger.error.bind(this.logger) : console.error;
            logFn(`[KeepStartingGear] Failed to initialize: ${errorMessage}`);
            this.initialized = false;
        }
    }
    // ========================================================================
    // Raid End Processing
    // ========================================================================
    /**
     * Called when a raid ends (for any reason: death, extract, disconnect).
     *
     * @param sessionID - Player's session/profile ID
     * @param info - Raid end data including exit status and profile
     *
     * @remarks
     * This method:
     * 1. Validates that the mod is properly initialized
     * 2. Validates the session ID format (security)
     * 3. Checks if this is a PMC raid (Scavs use separate inventory)
     * 4. Checks if the player died (extract = keep loot)
     * 5. If died, attempts to restore from snapshot
     * 6. If extracted, clears any snapshot to prevent accidental restoration
     */
    onRaidEnd(sessionID, info) {
        // Check if mod is initialized
        if (!this.initialized || !this.logger || !this.restorer || !this.config) {
            // Silently skip - mod failed to initialize
            return;
        }
        try {
            // Validate session ID
            if (!(0, Models_1.isValidSessionId)(sessionID)) {
                this.logger.warning(`${Constants_1.Constants.LOG_PREFIX} Invalid session ID format - skipping`);
                return;
            }
            const exitStatus = info.exit;
            const isScav = info.isPlayerScav;
            if (this.config.verboseLogging) {
                this.logger.debug(`${Constants_1.Constants.LOG_PREFIX} Raid end for session ${sessionID}`);
                this.logger.debug(`${Constants_1.Constants.LOG_PREFIX} Exit status: ${exitStatus}, Is Scav: ${isScav}`);
            }
            // Only process PMC raids (Scavs use separate inventory)
            if (isScav) {
                if (this.config.verboseLogging) {
                    this.logger.debug(`${Constants_1.Constants.LOG_PREFIX} Scav raid - skipping restoration`);
                }
                return;
            }
            // Check if player survived (using whitelist - safer than death blacklist)
            const playerSurvived = this.isSurvivalExit(exitStatus);
            if (playerSurvived) {
                this.handlePlayerSurvival(sessionID);
            }
            else {
                this.handlePlayerDeath(sessionID, info);
            }
        }
        catch (error) {
            // Log error but don't crash - let SPT continue processing
            const errorMessage = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : "";
            this.logger.error(`${Constants_1.Constants.LOG_PREFIX} Error in onRaidEnd: ${errorMessage}`);
            if (stack && this.config.verboseLogging) {
                this.logger.error(`${Constants_1.Constants.LOG_PREFIX} Stack trace: ${stack}`);
            }
        }
    }
    /**
     * Handles player death - attempts to restore from snapshot.
     *
     * @param sessionID - Player's session/profile ID
     * @param info - Raid end data
     */
    handlePlayerDeath(sessionID, info) {
        if (!this.logger || !this.restorer || !this.config) {
            return;
        }
        if (this.config.verboseLogging) {
            this.logger.debug(`${Constants_1.Constants.LOG_PREFIX} PMC death detected - checking for snapshot...`);
        }
        // Validate profile structure
        if (!info.profile) {
            this.logger.error(`${Constants_1.Constants.LOG_PREFIX} Cannot access profile - profile is null`);
            return;
        }
        if (!info.profile.Inventory) {
            this.logger.error(`${Constants_1.Constants.LOG_PREFIX} Cannot access profile inventory - Inventory is null`);
            return;
        }
        // Get inventory items from profile
        const inventoryItems = info.profile.Inventory.items;
        if (!inventoryItems || !Array.isArray(inventoryItems)) {
            this.logger.error(`${Constants_1.Constants.LOG_PREFIX} Cannot access profile inventory items`);
            return;
        }
        if (inventoryItems.length === 0) {
            this.logger.warning(`${Constants_1.Constants.LOG_PREFIX} Profile inventory is empty`);
            return;
        }
        // Attempt restoration
        const result = this.restorer.tryRestore(sessionID, inventoryItems);
        if (result.success) {
            this.logger.info(`${Constants_1.Constants.LOG_PREFIX} Inventory restored from snapshot!`);
            this.logger.info(`${Constants_1.Constants.LOG_PREFIX} Restored ${result.itemsAdded} items`);
            if (result.duplicatesSkipped > 0 && this.config.verboseLogging) {
                this.logger.debug(`${Constants_1.Constants.LOG_PREFIX} Skipped ${result.duplicatesSkipped} duplicate items`);
            }
            if (result.nonManagedSkipped > 0 && this.config.verboseLogging) {
                this.logger.debug(`${Constants_1.Constants.LOG_PREFIX} Skipped ${result.nonManagedSkipped} items from non-managed slots`);
            }
        }
        else if (result.errorMessage && result.errorMessage !== "No snapshot file found") {
            // Log actual errors (not just "no snapshot" which is expected for new raids)
            this.logger.warning(`${Constants_1.Constants.LOG_PREFIX} Restoration failed: ${result.errorMessage}`);
        }
        else if (this.config.verboseLogging) {
            this.logger.debug(`${Constants_1.Constants.LOG_PREFIX} No snapshot found - normal death processing`);
        }
    }
    /**
     * Handles player survival - clears snapshot to prevent accidental restoration.
     *
     * @param sessionID - Player's session/profile ID
     */
    handlePlayerSurvival(sessionID) {
        if (!this.logger || !this.restorer || !this.config) {
            return;
        }
        if (this.config.verboseLogging) {
            this.logger.debug(`${Constants_1.Constants.LOG_PREFIX} Player survived/extracted - clearing snapshot`);
        }
        this.restorer.clearSnapshot(sessionID);
    }
    /**
     * Checks if the exit status indicates survival.
     * Uses a WHITELIST approach - only known survival statuses return true.
     * This is safer than a death blacklist because unknown statuses
     * will trigger restoration (preventing accidental gear loss).
     *
     * @param exitStatus - Exit status string from raid end
     * @returns True if the player survived, false if they died or status is unknown
     */
    isSurvivalExit(exitStatus) {
        // Use the survival whitelist from Constants
        return Constants_1.Constants.SURVIVAL_STATUSES.has(exitStatus);
    }
}
// ============================================================================
// Module Export
// ============================================================================
/**
 * Export the mod instance for SPT to load.
 * SPT looks for `mod` export in the main module.
 */
exports.mod = new KeepStartingGearMod();
//# sourceMappingURL=mod.js.map