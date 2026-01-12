// ============================================================================
// Keep Starting Gear - Inventory Snapshot Model (SPT 3.11.4)
// ============================================================================

using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace Blackhorse311.KeepStartingGear.Models;

/// <summary>
/// Represents a snapshot of a player's inventory at a specific point in time.
/// </summary>
public class InventorySnapshot
{
    [JsonProperty("sessionId")]
    public string SessionId { get; set; }

    [JsonProperty("timestamp")]
    public DateTime Timestamp { get; set; }

    [JsonProperty("location")]
    public string Location { get; set; }

    [JsonProperty("items")]
    public List<SerializedItem> Items { get; set; }

    [JsonProperty("includedSlots")]
    public List<string> IncludedSlots { get; set; }

    [JsonProperty("emptySlots")]
    public List<string> EmptySlots { get; set; }

    [JsonProperty("takenInRaid")]
    public bool TakenInRaid { get; set; }

    [JsonProperty("modVersion")]
    public string ModVersion { get; set; }

    public InventorySnapshot()
    {
        SessionId = string.Empty;
        Timestamp = DateTime.UtcNow;
        Location = string.Empty;
        Items = new List<SerializedItem>();
        IncludedSlots = new List<string>();
        EmptySlots = new List<string>();
        TakenInRaid = false;
        ModVersion = Plugin.PluginVersion;
    }

    public bool IsValid()
    {
        return !string.IsNullOrEmpty(SessionId) &&
               Items != null &&
               Items.Count > 0;
    }

    public override string ToString()
    {
        return $"Snapshot[Session={SessionId}, Location={Location}, Items={Items?.Count ?? 0}]";
    }
}
