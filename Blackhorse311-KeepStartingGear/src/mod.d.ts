import { DependencyContainer } from "tsyringe";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
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
declare class KeepStartingGearMod implements IPreSptLoadMod, IPostDBLoadMod {
    /** SPT logger for console output */
    private logger;
    /** Snapshot restorer instance */
    private restorer;
    /** Path to snapshot files */
    private snapshotsPath;
    /** Mod configuration */
    private config;
    /** Whether the mod initialized successfully */
    private initialized;
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
    preSptLoad(container: DependencyContainer): void;
    /**
     * Called after the SPT database is loaded.
     * This is where we resolve dependencies and initialize.
     *
     * @param container - Dependency injection container
     */
    postDBLoad(container: DependencyContainer): void;
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
    private onRaidEnd;
    /**
     * Handles player death - attempts to restore from snapshot.
     *
     * @param sessionID - Player's session/profile ID
     * @param info - Raid end data
     */
    private handlePlayerDeath;
    /**
     * Handles player survival - clears snapshot to prevent accidental restoration.
     *
     * @param sessionID - Player's session/profile ID
     */
    private handlePlayerSurvival;
    /**
     * Checks if the exit status indicates survival.
     * Uses a WHITELIST approach - only known survival statuses return true.
     * This is safer than a death blacklist because unknown statuses
     * will trigger restoration (preventing accidental gear loss).
     *
     * @param exitStatus - Exit status string from raid end
     * @returns True if the player survived, false if they died or status is unknown
     */
    private isSurvivalExit;
}
/**
 * Export the mod instance for SPT to load.
 * SPT looks for `mod` export in the main module.
 */
export declare const mod: KeepStartingGearMod;
export {};
//# sourceMappingURL=mod.d.ts.map