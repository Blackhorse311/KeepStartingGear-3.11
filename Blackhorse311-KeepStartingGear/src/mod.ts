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

import { DependencyContainer } from "tsyringe";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { StaticRouterModService } from "@spt/services/mod/staticRouter/StaticRouterModService";
import * as path from "path";

import { Constants, ModConfig, loadConfig, isValidEquipmentTemplateId } from "./Constants";
import { ISaveProgressRequestData, isValidSessionId } from "./Models";
import { SnapshotRestorer, resolveSnapshotsPath } from "./SnapshotRestorer";

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
class KeepStartingGearMod implements IPreSptLoadMod, IPostDBLoadMod {
    // ========================================================================
    // Dependencies (resolved in postDBLoad)
    // ========================================================================

    /** SPT logger for console output */
    private logger: ILogger | null = null;

    /** Snapshot restorer instance */
    private restorer: SnapshotRestorer | null = null;

    /** Path to snapshot files */
    private snapshotsPath: string = "";

    /** Mod configuration */
    private config: ModConfig | null = null;

    /** Whether the mod initialized successfully */
    private initialized: boolean = false;

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
    public preSptLoad(container: DependencyContainer): void {
        const staticRouterModService = container.resolve<StaticRouterModService>("StaticRouterModService");

        // Register hook for raid end processing
        staticRouterModService.registerStaticRouter(
            `${Constants.MOD_FOLDER_NAME}-RaidSave`,
            [
                {
                    url: "/raid/profile/save",
                    action: (
                        url: string,
                        info: ISaveProgressRequestData,
                        sessionID: string,
                        output: string
                    ): string => {
                        // Process BEFORE the default handler
                        // We modify info.profile.Inventory directly
                        this.onRaidEnd(sessionID, info);
                        return output;
                    }
                }
            ],
            "spt" // Use SPT namespace to run alongside default handler
        );
    }

    /**
     * Called after the SPT database is loaded.
     * This is where we resolve dependencies and initialize.
     *
     * @param container - Dependency injection container
     */
    public postDBLoad(container: DependencyContainer): void {
        try {
            // Resolve dependencies
            this.logger = container.resolve<ILogger>("WinstonLogger");

            if (!this.logger) {
                console.error("[KeepStartingGear] Failed to resolve logger");
                return;
            }

            // Load configuration
            const modDirectory = path.dirname(__dirname);
            this.config = loadConfig(modDirectory);

            // Validate Equipment template ID
            if (!isValidEquipmentTemplateId(Constants.EQUIPMENT_TEMPLATE_ID)) {
                this.logger.error(`${Constants.LOG_PREFIX} Equipment template ID appears invalid: ${Constants.EQUIPMENT_TEMPLATE_ID}`);
                this.logger.error(`${Constants.LOG_PREFIX} The mod may not function correctly. Please verify the template ID.`);
            }

            // Resolve snapshots path
            // The mod is located at: SPT/user/mods/Blackhorse311-KeepStartingGear/
            // Snapshots are at: SPT/BepInEx/plugins/Blackhorse311-KeepStartingGear/snapshots/
            this.snapshotsPath = resolveSnapshotsPath(__dirname);

            // Create restorer instance
            this.restorer = new SnapshotRestorer(this.logger, this.snapshotsPath, this.config);

            this.initialized = true;

            // Log startup
            this.logger.info(`${Constants.LOG_PREFIX} v${Constants.MOD_VERSION} loaded`);
            this.logger.info(`${Constants.LOG_PREFIX} Snapshots path: ${this.snapshotsPath}`);

            if (this.config.verboseLogging) {
                this.logger.info(`${Constants.LOG_PREFIX} Verbose logging enabled`);
            }

        } catch (error) {
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
    private onRaidEnd(sessionID: string, info: ISaveProgressRequestData): void {
        // Check if mod is initialized
        if (!this.initialized || !this.logger || !this.restorer || !this.config) {
            // Silently skip - mod failed to initialize
            return;
        }

        try {
            // Validate session ID
            if (!isValidSessionId(sessionID)) {
                this.logger.warning(`${Constants.LOG_PREFIX} Invalid session ID format - skipping`);
                return;
            }

            const exitStatus = info.exit;
            const isScav = info.isPlayerScav;

            if (this.config.verboseLogging) {
                this.logger.debug(`${Constants.LOG_PREFIX} Raid end for session ${sessionID}`);
                this.logger.debug(`${Constants.LOG_PREFIX} Exit status: ${exitStatus}, Is Scav: ${isScav}`);
            }

            // Only process PMC raids (Scavs use separate inventory)
            if (isScav) {
                if (this.config.verboseLogging) {
                    this.logger.debug(`${Constants.LOG_PREFIX} Scav raid - skipping restoration`);
                }
                return;
            }

            // Check if player survived (using whitelist - safer than death blacklist)
            const playerSurvived = this.isSurvivalExit(exitStatus);

            if (playerSurvived) {
                this.handlePlayerSurvival(sessionID);
            } else {
                this.handlePlayerDeath(sessionID, info);
            }
        } catch (error) {
            // Log error but don't crash - let SPT continue processing
            const errorMessage = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : "";

            this.logger.error(`${Constants.LOG_PREFIX} Error in onRaidEnd: ${errorMessage}`);
            if (stack && this.config.verboseLogging) {
                this.logger.error(`${Constants.LOG_PREFIX} Stack trace: ${stack}`);
            }
        }
    }

    /**
     * Handles player death - attempts to restore from snapshot.
     *
     * @param sessionID - Player's session/profile ID
     * @param info - Raid end data
     */
    private handlePlayerDeath(sessionID: string, info: ISaveProgressRequestData): void {
        if (!this.logger || !this.restorer || !this.config) {
            return;
        }

        if (this.config.verboseLogging) {
            this.logger.debug(`${Constants.LOG_PREFIX} PMC death detected - checking for snapshot...`);
        }

        // Validate profile structure
        if (!info.profile) {
            this.logger.error(`${Constants.LOG_PREFIX} Cannot access profile - profile is null`);
            return;
        }

        if (!info.profile.Inventory) {
            this.logger.error(`${Constants.LOG_PREFIX} Cannot access profile inventory - Inventory is null`);
            return;
        }

        // Get inventory items from profile
        const inventoryItems = info.profile.Inventory.items;
        if (!inventoryItems || !Array.isArray(inventoryItems)) {
            this.logger.error(`${Constants.LOG_PREFIX} Cannot access profile inventory items`);
            return;
        }

        if (inventoryItems.length === 0) {
            this.logger.warning(`${Constants.LOG_PREFIX} Profile inventory is empty`);
            return;
        }

        // Attempt restoration
        const result = this.restorer.tryRestore(sessionID, inventoryItems);

        if (result.success) {
            this.logger.info(`${Constants.LOG_PREFIX} Inventory restored from snapshot!`);
            this.logger.info(`${Constants.LOG_PREFIX} Restored ${result.itemsAdded} items`);

            if (result.duplicatesSkipped > 0 && this.config.verboseLogging) {
                this.logger.debug(`${Constants.LOG_PREFIX} Skipped ${result.duplicatesSkipped} duplicate items`);
            }
            if (result.nonManagedSkipped > 0 && this.config.verboseLogging) {
                this.logger.debug(`${Constants.LOG_PREFIX} Skipped ${result.nonManagedSkipped} items from non-managed slots`);
            }
        } else if (result.errorMessage && result.errorMessage !== "No snapshot file found") {
            // Log actual errors (not just "no snapshot" which is expected for new raids)
            this.logger.warning(`${Constants.LOG_PREFIX} Restoration failed: ${result.errorMessage}`);
        } else if (this.config.verboseLogging) {
            this.logger.debug(`${Constants.LOG_PREFIX} No snapshot found - normal death processing`);
        }
    }

    /**
     * Handles player survival - clears snapshot to prevent accidental restoration.
     *
     * @param sessionID - Player's session/profile ID
     */
    private handlePlayerSurvival(sessionID: string): void {
        if (!this.logger || !this.restorer || !this.config) {
            return;
        }

        if (this.config.verboseLogging) {
            this.logger.debug(`${Constants.LOG_PREFIX} Player survived/extracted - clearing snapshot`);
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
    private isSurvivalExit(exitStatus: string): boolean {
        // Use the survival whitelist from Constants
        return Constants.SURVIVAL_STATUSES.has(exitStatus);
    }
}

// ============================================================================
// Module Export
// ============================================================================

/**
 * Export the mod instance for SPT to load.
 * SPT looks for `mod` export in the main module.
 */
export const mod = new KeepStartingGearMod();
