// ============================================================================
// Keep Starting Gear - Snapshot Manager Service (SPT 3.11.4)
// ============================================================================

using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Blackhorse311.KeepStartingGear.Models;
using Newtonsoft.Json;

namespace Blackhorse311.KeepStartingGear.Services;

/// <summary>
/// Service responsible for managing inventory snapshots on disk.
/// </summary>
public class SnapshotManager
{
    private readonly string _snapshotDirectory;

    public static SnapshotManager Instance { get; private set; }

    public SnapshotManager()
    {
        _snapshotDirectory = Plugin.GetDataPath();
        EnsureSnapshotDirectoryExists();
        Instance = this;
    }

    private void EnsureSnapshotDirectoryExists()
    {
        try
        {
            if (!Directory.Exists(_snapshotDirectory))
            {
                Directory.CreateDirectory(_snapshotDirectory);
                Plugin.Log.LogDebug($"Created snapshot directory: {_snapshotDirectory}");
            }
        }
        catch (Exception ex)
        {
            Plugin.Log.LogError($"Failed to create snapshot directory: {ex.Message}");
        }
    }

    private string GetSnapshotFilePath(string sessionId)
    {
        return Path.Combine(_snapshotDirectory, $"{sessionId}.json");
    }

    public bool SaveSnapshot(InventorySnapshot snapshot)
    {
        try
        {
            if (!snapshot.IsValid())
            {
                Plugin.Log.LogError("Attempted to save invalid snapshot");
                return false;
            }

            // Deduplicate items to prevent crashes
            var seenIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var deduplicatedItems = new List<SerializedItem>();
            int duplicatesRemoved = 0;

            foreach (var item in snapshot.Items)
            {
                if (string.IsNullOrEmpty(item.Id))
                {
                    Plugin.Log.LogWarning("Skipping item with null/empty ID during save");
                    continue;
                }

                if (seenIds.Contains(item.Id))
                {
                    Plugin.Log.LogWarning($"[DUPLICATE REMOVED] Duplicate item ID: {item.Id}");
                    duplicatesRemoved++;
                    continue;
                }

                seenIds.Add(item.Id);
                deduplicatedItems.Add(item);
            }

            if (duplicatesRemoved > 0)
            {
                Plugin.Log.LogWarning($"Removed {duplicatesRemoved} duplicate item(s) from snapshot");
                snapshot.Items = deduplicatedItems;
            }

            string filePath = GetSnapshotFilePath(snapshot.SessionId);

            var settings = new JsonSerializerSettings
            {
                Formatting = Formatting.Indented,
                NullValueHandling = NullValueHandling.Include
            };

            string jsonContent = JsonConvert.SerializeObject(snapshot, settings);
            File.WriteAllText(filePath, jsonContent);

            if (Configuration.Settings.LogSnapshotCreation.Value)
            {
                Plugin.Log.LogDebug($"Snapshot saved: {snapshot}");
                Plugin.Log.LogDebug($"Included slots: {string.Join(", ", snapshot.IncludedSlots)}");
            }

            return true;
        }
        catch (Exception ex)
        {
            Plugin.Log.LogError($"Failed to save snapshot: {ex.Message}");
            return false;
        }
    }

    public InventorySnapshot LoadSnapshot(string sessionId)
    {
        try
        {
            string filePath = GetSnapshotFilePath(sessionId);

            if (!File.Exists(filePath))
            {
                Plugin.Log.LogDebug($"No snapshot found for session {sessionId}");
                return null;
            }

            string jsonContent = File.ReadAllText(filePath);
            var snapshot = JsonConvert.DeserializeObject<InventorySnapshot>(jsonContent);

            if (snapshot == null || !snapshot.IsValid())
            {
                Plugin.Log.LogError($"Invalid snapshot file for session {sessionId}");
                return null;
            }

            Plugin.Log.LogDebug($"Snapshot loaded: {snapshot}");
            return snapshot;
        }
        catch (Exception ex)
        {
            Plugin.Log.LogError($"Failed to load snapshot: {ex.Message}");
            return null;
        }
    }

    public bool SnapshotExists(string sessionId)
    {
        string filePath = GetSnapshotFilePath(sessionId);
        return File.Exists(filePath);
    }

    public InventorySnapshot GetMostRecentSnapshot()
    {
        try
        {
            EnsureSnapshotDirectoryExists();

            var snapshotFiles = Directory.GetFiles(_snapshotDirectory, "*.json");

            if (snapshotFiles.Length == 0)
            {
                Plugin.Log.LogDebug("No snapshot files found");
                return null;
            }

            string mostRecentFile = snapshotFiles
                .OrderByDescending(f => File.GetLastWriteTimeUtc(f))
                .FirstOrDefault();

            if (mostRecentFile == null)
            {
                return null;
            }

            Plugin.Log.LogDebug($"Most recent snapshot file: {Path.GetFileName(mostRecentFile)}");

            string jsonContent = File.ReadAllText(mostRecentFile);
            return JsonConvert.DeserializeObject<InventorySnapshot>(jsonContent);
        }
        catch (Exception ex)
        {
            Plugin.Log.LogError($"Failed to get most recent snapshot: {ex.Message}");
            return null;
        }
    }

    public bool ClearSnapshot(string sessionId)
    {
        try
        {
            string filePath = GetSnapshotFilePath(sessionId);

            if (File.Exists(filePath))
            {
                File.Delete(filePath);
                Plugin.Log.LogDebug($"Snapshot cleared for session {sessionId}");
                return true;
            }

            Plugin.Log.LogDebug($"No snapshot to clear for session {sessionId}");
            return true;
        }
        catch (Exception ex)
        {
            Plugin.Log.LogError($"Failed to clear snapshot: {ex.Message}");
            return false;
        }
    }
}
