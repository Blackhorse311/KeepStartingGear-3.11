// ============================================================================
// Keep Starting Gear - Main Plugin Entry Point (SPT 3.11.4)
// ============================================================================
// This is the main BepInEx plugin class that initializes the mod.
//
// ARCHITECTURE:
// The mod uses a hybrid client-server architecture:
// - Client (BepInEx): Captures snapshots, displays notifications, tracks limits
// - Server (SPT TypeScript): Intercepts raid end, restores inventory from snapshot
//
// AUTHOR: Blackhorse311
// LICENSE: MIT
// ============================================================================

using System;
using BepInEx;
using BepInEx.Logging;
using Blackhorse311.KeepStartingGear.Configuration;
using Blackhorse311.KeepStartingGear.Patches;
using UnityEngine;

namespace Blackhorse311.KeepStartingGear;

/// <summary>
/// Main plugin class for the Keep Starting Gear mod (SPT 3.11.4 version).
/// Inherits from BaseUnityPlugin to integrate with BepInEx mod loading system.
/// </summary>
[BepInPlugin(PluginGuid, PluginName, PluginVersion)]
public class Plugin : BaseUnityPlugin
{
    // ========================================================================
    // Plugin Metadata Constants
    // ========================================================================

    /// <summary>
    /// Unique identifier for this plugin.
    /// </summary>
    public const string PluginGuid = "com.blackhorse311.keepstartinggear";

    /// <summary>
    /// Human-readable name displayed in BepInEx plugin list
    /// </summary>
    public const string PluginName = "Blackhorse311-KeepStartingGear";

    /// <summary>
    /// Semantic version - matches server mod version
    /// </summary>
    public const string PluginVersion = "1.1.0";

    // ========================================================================
    // Static Accessors
    // ========================================================================

    /// <summary>
    /// Singleton instance of the plugin for global access from patches and services.
    /// </summary>
    public static Plugin Instance { get; private set; }

    /// <summary>
    /// BepInEx logger instance for outputting messages to the console and log file.
    /// </summary>
    public static ManualLogSource Log { get; private set; }

    // ========================================================================
    // Unity Lifecycle Methods
    // ========================================================================

    /// <summary>
    /// BepInEx entry point - called when the mod is first loaded.
    /// </summary>
    internal void Awake()
    {
        try
        {
            Instance = this;
            Log = Logger;

            // Prevent this GameObject from being destroyed when loading new scenes
            DontDestroyOnLoad(this);

            // Initialize the BepInEx configuration system (F12 menu)
            Settings.Init(Config);

            // Check if the mod is enabled
            if (!Settings.ModEnabled.Value)
            {
                Logger.LogInfo("Keep Starting Gear is disabled in configuration");
                return;
            }

            // Initialize services
            new Services.SnapshotManager();
            new Services.InventoryService();

            // Enable Harmony patches
            PatchManager.EnablePatches();

            Logger.LogInfo($"Keep Starting Gear v{PluginVersion} loaded (SPT 3.11.4)");
        }
        catch (Exception ex)
        {
            Logger.LogError($"CRITICAL ERROR during plugin load: {ex.Message}");
            Logger.LogError($"Stack trace: {ex.StackTrace}");
        }
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /// <summary>
    /// Gets the file system path where snapshot JSON files are stored.
    /// </summary>
    public static string GetDataPath()
    {
        return System.IO.Path.Combine(
            BepInEx.Paths.PluginPath,
            "Blackhorse311-KeepStartingGear",
            "snapshots"
        );
    }
}
