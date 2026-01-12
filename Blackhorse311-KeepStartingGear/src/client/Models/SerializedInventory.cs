// ============================================================================
// Keep Starting Gear - Serialized Inventory Models (SPT 3.11.4)
// ============================================================================

using System;
using Newtonsoft.Json;
using Blackhorse311.KeepStartingGear.Converters;

namespace Blackhorse311.KeepStartingGear.Models;

/// <summary>
/// Represents a serialized inventory item in JSON format.
/// </summary>
public class SerializedItem
{
    [JsonProperty("_id")]
    public string Id { get; set; }

    [JsonProperty("_tpl")]
    public string Tpl { get; set; }

    [JsonProperty("parentId")]
    public string ParentId { get; set; }

    [JsonProperty("slotId")]
    public string SlotId { get; set; }

    [JsonIgnore]
    public ItemLocation Location { get; set; }

    [JsonIgnore]
    public int? LocationIndex { get; set; }

    [JsonProperty("location", NullValueHandling = NullValueHandling.Ignore)]
    [JsonConverter(typeof(LocationConverter))]
    public LocationConverter.LocationResult LocationData
    {
        get
        {
            if (LocationIndex.HasValue)
                return new LocationConverter.LocationResult { CartridgeIndex = LocationIndex.Value };
            if (Location != null)
                return new LocationConverter.LocationResult { GridLocation = Location };
            return null;
        }
        set
        {
            if (value == null)
            {
                Location = null;
                LocationIndex = null;
                return;
            }
            if (value.IsCartridge)
            {
                LocationIndex = value.CartridgeIndex;
                Location = null;
            }
            else if (value.IsGrid)
            {
                Location = value.GridLocation;
                LocationIndex = null;
            }
        }
    }

    public void SetGridLocation(ItemLocation location)
    {
        Location = location;
        LocationIndex = null;
    }

    public void SetCartridgeIndex(int index)
    {
        if (index < 0)
            throw new ArgumentOutOfRangeException(nameof(index), "Cartridge index cannot be negative");
        LocationIndex = index;
        Location = null;
    }

    [JsonProperty("upd")]
    public ItemUpd Upd { get; set; }
}

/// <summary>
/// Grid position for items in containers.
/// </summary>
public class ItemLocation
{
    [JsonProperty("x")]
    public int X { get; set; }

    [JsonProperty("y")]
    public int Y { get; set; }

    [JsonProperty("r")]
    public int R { get; set; }

    [JsonProperty("isSearched")]
    public bool IsSearched { get; set; }
}

/// <summary>
/// Item update/state data.
/// </summary>
public class ItemUpd
{
    [JsonProperty("StackObjectsCount")]
    public long? StackObjectsCount { get; set; }

    [JsonProperty("SpawnedInSession")]
    public bool SpawnedInSession { get; set; }

    [JsonProperty("Foldable")]
    public UpdFoldable Foldable { get; set; }

    [JsonProperty("MedKit")]
    public UpdMedKit MedKit { get; set; }

    [JsonProperty("Repairable")]
    public UpdRepairable Repairable { get; set; }

    [JsonProperty("Resource")]
    public UpdResource Resource { get; set; }

    [JsonProperty("FoodDrink")]
    public UpdFoodDrink FoodDrink { get; set; }

    [JsonProperty("Tag")]
    public Tag Tag { get; set; }

    [JsonProperty("Dogtag")]
    public UpdDogtag Dogtag { get; set; }

    [JsonProperty("Key")]
    public UpdKey Key { get; set; }
}

public class UpdMedKit
{
    [JsonProperty("HpResource")]
    public double HpResource { get; set; }
}

public class UpdRepairable
{
    [JsonProperty("Durability")]
    public double Durability { get; set; }

    [JsonProperty("MaxDurability")]
    public double MaxDurability { get; set; }
}

public class UpdResource
{
    [JsonProperty("Value")]
    public double Value { get; set; }
}

public class UpdFoodDrink
{
    [JsonProperty("HpPercent")]
    public double HpPercent { get; set; }
}

public class UpdFoldable
{
    [JsonProperty("Folded")]
    public bool Folded { get; set; }
}

public class Tag
{
    [JsonProperty("Name")]
    public string Name { get; set; }

    [JsonProperty("Color")]
    public int Color { get; set; }
}

public class UpdDogtag
{
    [JsonProperty("AccountId")]
    public string AccountId { get; set; }

    [JsonProperty("ProfileId")]
    public string ProfileId { get; set; }

    [JsonProperty("Nickname")]
    public string Nickname { get; set; }

    [JsonProperty("Side")]
    public string Side { get; set; }

    [JsonProperty("Level")]
    public int Level { get; set; }

    [JsonProperty("Time")]
    public string Time { get; set; }

    [JsonProperty("Status")]
    public string Status { get; set; }

    [JsonProperty("KillerAccountId")]
    public string KillerAccountId { get; set; }

    [JsonProperty("KillerProfileId")]
    public string KillerProfileId { get; set; }

    [JsonProperty("KillerName")]
    public string KillerName { get; set; }

    [JsonProperty("WeaponName")]
    public string WeaponName { get; set; }
}

public class UpdKey
{
    [JsonProperty("NumberOfUsages")]
    public int NumberOfUsages { get; set; }
}
