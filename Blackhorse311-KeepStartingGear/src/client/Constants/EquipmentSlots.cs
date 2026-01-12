// ============================================================================
// Keep Starting Gear - Equipment Slot Constants (SPT 3.11.4)
// ============================================================================

using System;

namespace Blackhorse311.KeepStartingGear.Constants;

/// <summary>
/// Centralized constants for EFT equipment slot names.
/// </summary>
public static class EquipmentSlots
{
    // Weapon Slots
    public const string FirstPrimaryWeapon = "FirstPrimaryWeapon";
    public const string SecondPrimaryWeapon = "SecondPrimaryWeapon";
    public const string Holster = "Holster";
    public const string Scabbard = "Scabbard";

    // Armor & Protection Slots
    public const string Headwear = "Headwear";
    public const string Earpiece = "Earpiece";
    public const string FaceCover = "FaceCover";
    public const string ArmorVest = "ArmorVest";
    public const string Eyewear = "Eyewear";
    public const string ArmBand = "ArmBand";

    // Container Slots
    public const string TacticalVest = "TacticalVest";
    public const string Backpack = "Backpack";
    public const string SecuredContainer = "SecuredContainer";
    public const string Pockets = "Pockets";

    // Special Slots
    public const string Compass = "Compass";
    public const string SpecialSlot1 = "SpecialSlot1";
    public const string SpecialSlot2 = "SpecialSlot2";
    public const string SpecialSlot3 = "SpecialSlot3";

    public static readonly string[] AllSlots =
    {
        FirstPrimaryWeapon,
        SecondPrimaryWeapon,
        Holster,
        Scabbard,
        Headwear,
        Earpiece,
        FaceCover,
        ArmorVest,
        Eyewear,
        ArmBand,
        TacticalVest,
        Backpack,
        SecuredContainer,
        Pockets,
        Compass,
        SpecialSlot1,
        SpecialSlot2,
        SpecialSlot3
    };

    public static bool IsValidSlot(string slotName)
    {
        return Array.Exists(AllSlots, s => s.Equals(slotName, StringComparison.OrdinalIgnoreCase));
    }
}
