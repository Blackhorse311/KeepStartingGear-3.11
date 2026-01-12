// ============================================================================
// Keep Starting Gear - Configuration Settings (SPT 3.11.4)
// ============================================================================
// Manages all user-configurable settings via BepInEx ConfigFile system.
// Settings are accessible via the F12 Configuration Manager in-game.
//
// AUTHOR: Blackhorse311
// LICENSE: MIT
// ============================================================================

using System;
using System.Collections.Generic;
using BepInEx.Configuration;
using UnityEngine;

namespace Blackhorse311.KeepStartingGear.Configuration;

/// <summary>
/// Predefined configuration presets for different playstyles.
/// </summary>
public enum ConfigPreset
{
    Custom,
    Casual,
    Hardcore
}

/// <summary>
/// Defines the snapshot behavior mode for the mod.
/// </summary>
public enum SnapshotMode
{
    AutoOnly,
    AutoPlusManual,
    ManualOnly
}

/// <summary>
/// Static class that manages all mod configuration settings.
/// </summary>
public static class Settings
{
    // Category Names
    private const string CategoryPresets = "0. Quick Setup";
    private const string CategoryGeneral = "1. General";
    private const string CategorySnapshot = "2. Snapshot Behavior";
    private const string CategoryKeybind = "3. Keybind";
    private const string CategoryInventory = "4. Inventory Slots";
    private const string CategoryLogging = "5. Logging";

    // ========================================================================
    // Preset Settings
    // ========================================================================

    public static ConfigEntry<ConfigPreset> ActivePreset { get; private set; }
    private static bool _applyingPreset;

    // ========================================================================
    // General Settings
    // ========================================================================

    public static ConfigEntry<bool> ModEnabled { get; private set; }

    // ========================================================================
    // Snapshot Behavior Settings
    // ========================================================================

    public static ConfigEntry<SnapshotMode> SnapshotModeOption { get; private set; }
    public static ConfigEntry<bool> ExcludeFIRItems { get; private set; }
    public static ConfigEntry<int> ManualSnapshotCooldown { get; private set; }
    public static ConfigEntry<bool> WarnOnSnapshotOverwrite { get; private set; }
    public static ConfigEntry<bool> SnapshotOnMapTransfer { get; private set; }
    public static ConfigEntry<bool> PlaySnapshotSound { get; private set; }
    public static ConfigEntry<bool> ShowNotifications { get; private set; }
    public static ConfigEntry<bool> ExcludeInsuredItems { get; private set; }
    public static ConfigEntry<int> MaxManualSnapshots { get; private set; }

    // ========================================================================
    // Keybind Settings
    // ========================================================================

    public static ConfigEntry<KeyboardShortcut> SnapshotKeybind { get; private set; }

    // ========================================================================
    // Inventory Slot Settings
    // ========================================================================

    public static ConfigEntry<bool> SaveFirstPrimaryWeapon { get; private set; }
    public static ConfigEntry<bool> SaveSecondPrimaryWeapon { get; private set; }
    public static ConfigEntry<bool> SaveHolster { get; private set; }
    public static ConfigEntry<bool> SaveScabbard { get; private set; }
    public static ConfigEntry<bool> SaveHeadwear { get; private set; }
    public static ConfigEntry<bool> SaveEarpiece { get; private set; }
    public static ConfigEntry<bool> SaveFaceCover { get; private set; }
    public static ConfigEntry<bool> SaveEyewear { get; private set; }
    public static ConfigEntry<bool> SaveArmBand { get; private set; }
    public static ConfigEntry<bool> SaveTacticalVest { get; private set; }
    public static ConfigEntry<bool> SaveArmorVest { get; private set; }
    public static ConfigEntry<bool> SavePockets { get; private set; }
    public static ConfigEntry<bool> SaveBackpack { get; private set; }
    public static ConfigEntry<bool> SaveSecuredContainer { get; private set; }
    public static ConfigEntry<bool> SaveCompass { get; private set; }
    public static ConfigEntry<bool> SaveSpecialSlot1 { get; private set; }
    public static ConfigEntry<bool> SaveSpecialSlot2 { get; private set; }
    public static ConfigEntry<bool> SaveSpecialSlot3 { get; private set; }

    // ========================================================================
    // Logging Settings
    // ========================================================================

    public static ConfigEntry<bool> EnableDebugMode { get; private set; }
    public static ConfigEntry<bool> LogSnapshotCreation { get; private set; }
    public static ConfigEntry<bool> LogSnapshotRestoration { get; private set; }
    public static ConfigEntry<bool> VerboseCaptureLogging { get; private set; }

    // ========================================================================
    // Initialization
    // ========================================================================

    public static void Init(ConfigFile config)
    {
        int order = 1000;

        // Preset Settings
        ActivePreset = config.Bind(
            CategoryPresets,
            "Configuration Preset",
            ConfigPreset.Casual,
            new ConfigDescription(
                "Quick setup presets:\n" +
                "• Casual: Auto-snapshot, all items protected (recommended)\n" +
                "• Hardcore: Manual snapshots only, FIR & insured items excluded\n" +
                "• Custom: You've modified settings manually",
                null,
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );
        ActivePreset.SettingChanged += OnPresetChanged;

        // General Settings
        ModEnabled = config.Bind(
            CategoryGeneral,
            "Enable KSG Mod",
            true,
            new ConfigDescription(
                "Master switch to enable or disable Keep Starting Gear.\n" +
                "Changes take effect at the start of your next raid.",
                null,
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );

        // Snapshot Behavior Settings
        order = 950;
        SnapshotModeOption = config.Bind(
            CategorySnapshot,
            "Snapshot Mode",
            SnapshotMode.AutoOnly,
            new ConfigDescription(
                "Controls when snapshots are taken:\n" +
                "• Auto Only: Automatic snapshot at raid start\n" +
                "• Auto + Manual: Auto at start, plus manual via keybind\n" +
                "• Manual Only: Only manual snapshots via keybind",
                null,
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );

        ExcludeFIRItems = config.Bind(
            CategorySnapshot,
            "Exclude Found-in-Raid Items",
            false,
            new ConfigDescription(
                "When enabled, FIR items will NOT be included in snapshots.\n" +
                "Prevents exploiting the mod to duplicate FIR items.",
                null,
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );

        ManualSnapshotCooldown = config.Bind(
            CategorySnapshot,
            "Manual Snapshot Cooldown (seconds)",
            0,
            new ConfigDescription(
                "Cooldown between manual snapshots. Set to 0 for no cooldown.",
                new AcceptableValueRange<int>(0, 600),
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );

        WarnOnSnapshotOverwrite = config.Bind(
            CategorySnapshot,
            "Warn on Snapshot Overwrite",
            true,
            new ConfigDescription(
                "Show warning when manual snapshot replaces auto-snapshot.",
                null,
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );

        SnapshotOnMapTransfer = config.Bind(
            CategorySnapshot,
            "Re-Snapshot on Map Transfer",
            false,
            new ConfigDescription(
                "Take new snapshot when transferring between maps.",
                null,
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );

        PlaySnapshotSound = config.Bind(
            CategorySnapshot,
            "Play Snapshot Sound",
            true,
            new ConfigDescription(
                "Play camera shutter sound when snapshot is taken.",
                null,
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );

        ShowNotifications = config.Bind(
            CategorySnapshot,
            "Show On-Screen Notifications",
            true,
            new ConfigDescription(
                "Show on-screen notifications for snapshots and restoration.",
                null,
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );

        ExcludeInsuredItems = config.Bind(
            CategorySnapshot,
            "Exclude Insured Items",
            false,
            new ConfigDescription(
                "When enabled, insured items will NOT be in snapshots.\n" +
                "Lets insurance handle those items normally.",
                null,
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );

        MaxManualSnapshots = config.Bind(
            CategorySnapshot,
            "Max Manual Snapshots",
            1,
            new ConfigDescription(
                "Maximum manual snapshots per raid in Auto+Manual mode.",
                new AcceptableValueRange<int>(1, 10),
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );

        // Keybind Settings
        SnapshotKeybind = config.Bind(
            CategoryKeybind,
            "Manual Snapshot Keybind",
            new KeyboardShortcut(KeyCode.F8, KeyCode.LeftControl, KeyCode.LeftAlt),
            new ConfigDescription(
                "Keybind for manual snapshots (Auto+Manual or Manual Only modes)",
                null,
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );

        // Inventory Slot Settings
        order = 900;
        SaveFirstPrimaryWeapon = BindInventorySlot(config, "First Primary Weapon", ref order);
        SaveSecondPrimaryWeapon = BindInventorySlot(config, "Second Primary Weapon", ref order);
        SaveHolster = BindInventorySlot(config, "Holster", ref order);
        SaveScabbard = BindInventorySlot(config, "Scabbard", ref order);
        SaveHeadwear = BindInventorySlot(config, "Headwear", ref order);
        SaveEarpiece = BindInventorySlot(config, "Earpiece", ref order);
        SaveFaceCover = BindInventorySlot(config, "Face Cover", ref order);
        SaveEyewear = BindInventorySlot(config, "Eyewear", ref order);
        SaveArmBand = BindInventorySlot(config, "Arm Band", ref order);
        SaveTacticalVest = BindInventorySlot(config, "Tactical Vest", ref order);
        SaveArmorVest = BindInventorySlot(config, "Armor Vest", ref order);
        SavePockets = BindInventorySlot(config, "Pockets", ref order);
        SaveBackpack = BindInventorySlot(config, "Backpack", ref order);

        SaveSecuredContainer = config.Bind(
            CategoryInventory,
            "Restore Secure Container to Snapshot",
            true,
            new ConfigDescription(
                "When ENABLED: Secure container restored to snapshot state.\n" +
                "Items added during raid (after snapshot) will be LOST.\n\n" +
                "When DISABLED: Normal behavior - secure container kept.\n" +
                "TIP: Disable to keep items you find during raids.",
                null,
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );

        SaveCompass = BindInventorySlot(config, "Compass", ref order);
        SaveSpecialSlot1 = BindInventorySlot(config, "Special Slot 1", ref order);
        SaveSpecialSlot2 = BindInventorySlot(config, "Special Slot 2", ref order);
        SaveSpecialSlot3 = BindInventorySlot(config, "Special Slot 3", ref order);

        // Logging Settings
        order = 100;
        EnableDebugMode = config.Bind(
            CategoryLogging,
            "Debug Mode",
            false,
            new ConfigDescription(
                "Enable verbose debug logging",
                null,
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );

        LogSnapshotCreation = config.Bind(
            CategoryLogging,
            "Log Snapshot Creation",
            true,
            new ConfigDescription(
                "Log when inventory snapshots are created",
                null,
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );

        LogSnapshotRestoration = config.Bind(
            CategoryLogging,
            "Log Snapshot Restoration",
            true,
            new ConfigDescription(
                "Log when inventory snapshots are restored",
                null,
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );

        VerboseCaptureLogging = config.Bind(
            CategoryLogging,
            "Verbose Capture Logging",
            false,
            new ConfigDescription(
                "Extremely detailed logging during capture (WARNING: lots of output)",
                null,
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );

        Plugin.Log.LogDebug("Settings initialized");
    }

    private static ConfigEntry<bool> BindInventorySlot(ConfigFile config, string slotName, ref int order)
    {
        return config.Bind(
            CategoryInventory,
            slotName,
            true,
            new ConfigDescription(
                $"Include {slotName} in snapshot",
                null,
                new ConfigurationManagerAttributes { Order = order-- }
            )
        );
    }

    public static Dictionary<string, ConfigEntry<bool>> GetInventorySlots()
    {
        return new Dictionary<string, ConfigEntry<bool>>
        {
            { "FirstPrimaryWeapon", SaveFirstPrimaryWeapon },
            { "SecondPrimaryWeapon", SaveSecondPrimaryWeapon },
            { "Holster", SaveHolster },
            { "Scabbard", SaveScabbard },
            { "Headwear", SaveHeadwear },
            { "Earpiece", SaveEarpiece },
            { "FaceCover", SaveFaceCover },
            { "Eyewear", SaveEyewear },
            { "ArmBand", SaveArmBand },
            { "TacticalVest", SaveTacticalVest },
            { "ArmorVest", SaveArmorVest },
            { "Pockets", SavePockets },
            { "Backpack", SaveBackpack },
            { "SecuredContainer", SaveSecuredContainer },
            { "Compass", SaveCompass },
            { "SpecialSlot1", SaveSpecialSlot1 },
            { "SpecialSlot2", SaveSpecialSlot2 },
            { "SpecialSlot3", SaveSpecialSlot3 }
        };
    }

    // ========================================================================
    // Preset Methods
    // ========================================================================

    private static void OnPresetChanged(object sender, EventArgs e)
    {
        if (_applyingPreset) return;
        var preset = ActivePreset.Value;
        if (preset == ConfigPreset.Custom) return;
        ApplyPreset(preset);
        Plugin.Log.LogDebug($"Applied {preset} preset");
    }

    public static void ApplyPreset(ConfigPreset preset)
    {
        _applyingPreset = true;
        try
        {
            switch (preset)
            {
                case ConfigPreset.Casual:
                    ApplyCasualPreset();
                    break;
                case ConfigPreset.Hardcore:
                    ApplyHardcorePreset();
                    break;
            }
        }
        finally
        {
            _applyingPreset = false;
        }
    }

    private static void ApplyCasualPreset()
    {
        SnapshotModeOption.Value = SnapshotMode.AutoOnly;
        ExcludeFIRItems.Value = false;
        ExcludeInsuredItems.Value = false;
        SnapshotOnMapTransfer.Value = false;
        PlaySnapshotSound.Value = true;
        WarnOnSnapshotOverwrite.Value = true;

        // All slots enabled
        SaveFirstPrimaryWeapon.Value = true;
        SaveSecondPrimaryWeapon.Value = true;
        SaveHolster.Value = true;
        SaveScabbard.Value = true;
        SaveHeadwear.Value = true;
        SaveEarpiece.Value = true;
        SaveFaceCover.Value = true;
        SaveEyewear.Value = true;
        SaveArmBand.Value = true;
        SaveTacticalVest.Value = true;
        SaveArmorVest.Value = true;
        SavePockets.Value = true;
        SaveBackpack.Value = true;
        SaveSecuredContainer.Value = true;
        SaveCompass.Value = true;
        SaveSpecialSlot1.Value = true;
        SaveSpecialSlot2.Value = true;
        SaveSpecialSlot3.Value = true;
    }

    private static void ApplyHardcorePreset()
    {
        SnapshotModeOption.Value = SnapshotMode.ManualOnly;
        ExcludeFIRItems.Value = true;
        ExcludeInsuredItems.Value = true;
        SnapshotOnMapTransfer.Value = false;
        PlaySnapshotSound.Value = true;
        WarnOnSnapshotOverwrite.Value = true;

        // All slots still enabled
        SaveFirstPrimaryWeapon.Value = true;
        SaveSecondPrimaryWeapon.Value = true;
        SaveHolster.Value = true;
        SaveScabbard.Value = true;
        SaveHeadwear.Value = true;
        SaveEarpiece.Value = true;
        SaveFaceCover.Value = true;
        SaveEyewear.Value = true;
        SaveArmBand.Value = true;
        SaveTacticalVest.Value = true;
        SaveArmorVest.Value = true;
        SavePockets.Value = true;
        SaveBackpack.Value = true;
        SaveSecuredContainer.Value = true;
        SaveCompass.Value = true;
        SaveSpecialSlot1.Value = true;
        SaveSpecialSlot2.Value = true;
        SaveSpecialSlot3.Value = true;
    }
}

/// <summary>
/// Attributes for BepInEx Configuration Manager integration.
/// </summary>
internal sealed class ConfigurationManagerAttributes
{
    public int? Order { get; set; }
    public bool? IsAdvanced { get; set; }
    public bool? Browsable { get; set; }
    public bool? ReadOnly { get; set; }
}
