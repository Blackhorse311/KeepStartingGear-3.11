"use strict";
// ============================================================================
// Keep Starting Gear - Data Models
// ============================================================================
// Type definitions for snapshot data and inventory items.
// These interfaces mirror the client-side structure for JSON compatibility.
//
// SPT PROFILE ITEM STRUCTURE:
// {
//   "_id": "unique-item-id",
//   "_tpl": "template-id",
//   "parentId": "parent-container-id",
//   "slotId": "Backpack" or "main" etc,
//   "location": { "x": 0, "y": 0, "r": 0 } or integer for cartridges,
//   "upd": { "StackObjectsCount": 30, ... }
// }
//
// AUTHOR: Blackhorse311
// LICENSE: MIT
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSnapshot = exports.isValidSessionId = exports.deepCloneItemUpd = exports.RestoreResult = exports.RestoreResultFactory = void 0;
/**
 * Factory class for creating RestoreResult instances.
 * Uses static methods for clarity and to avoid interface/const name collision.
 */
class RestoreResultFactory {
    /**
     * Creates a successful restoration result.
     * @param itemsAdded - Number of items that were restored
     * @param duplicatesSkipped - Number of duplicate items skipped
     * @param nonManagedSkipped - Number of non-managed slot items skipped
     * @returns A successful RestoreResult
     */
    static succeeded(itemsAdded, duplicatesSkipped = 0, nonManagedSkipped = 0) {
        return Object.freeze({
            success: true,
            itemsAdded,
            duplicatesSkipped,
            nonManagedSkipped
        });
    }
    /**
     * Creates a failed restoration result.
     * @param errorMessage - Description of why restoration failed
     * @returns A failed RestoreResult
     */
    static failed(errorMessage) {
        return Object.freeze({
            success: false,
            itemsAdded: 0,
            duplicatesSkipped: 0,
            nonManagedSkipped: 0,
            errorMessage
        });
    }
}
exports.RestoreResultFactory = RestoreResultFactory;
// Keep backward compatibility with old factory pattern
exports.RestoreResult = RestoreResultFactory;
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Deep clones an ItemUpd object to prevent reference mutations.
 * @param upd - The ItemUpd to clone
 * @returns A deep copy of the ItemUpd
 */
function deepCloneItemUpd(upd) {
    if (upd === undefined) {
        return undefined;
    }
    const clone = {};
    // Clone each property deeply
    if (upd.StackObjectsCount !== undefined) {
        clone.StackObjectsCount = upd.StackObjectsCount;
    }
    if (upd.SpawnedInSession !== undefined) {
        clone.SpawnedInSession = upd.SpawnedInSession;
    }
    if (upd.Foldable !== undefined) {
        clone.Foldable = { Folded: upd.Foldable.Folded };
    }
    if (upd.MedKit !== undefined) {
        clone.MedKit = { HpResource: upd.MedKit.HpResource };
    }
    if (upd.Repairable !== undefined) {
        clone.Repairable = {
            Durability: upd.Repairable.Durability,
            MaxDurability: upd.Repairable.MaxDurability
        };
    }
    if (upd.Resource !== undefined) {
        clone.Resource = { Value: upd.Resource.Value };
    }
    if (upd.FoodDrink !== undefined) {
        clone.FoodDrink = { HpPercent: upd.FoodDrink.HpPercent };
    }
    if (upd.Tag !== undefined) {
        clone.Tag = { Name: upd.Tag.Name, Color: upd.Tag.Color };
    }
    if (upd.Key !== undefined) {
        clone.Key = { NumberOfUsages: upd.Key.NumberOfUsages };
    }
    if (upd.Light !== undefined) {
        clone.Light = {
            IsActive: upd.Light.IsActive,
            SelectedMode: upd.Light.SelectedMode
        };
    }
    if (upd.Togglable !== undefined) {
        clone.Togglable = { On: upd.Togglable.On };
    }
    if (upd.FireMode !== undefined) {
        clone.FireMode = { FireMode: upd.FireMode.FireMode };
    }
    if (upd.Sight !== undefined) {
        clone.Sight = {
            ScopesCurrentCalibPointIndexes: [...upd.Sight.ScopesCurrentCalibPointIndexes],
            ScopesSelectedModes: [...upd.Sight.ScopesSelectedModes],
            SelectedScope: upd.Sight.SelectedScope
        };
    }
    if (upd.Dogtag !== undefined) {
        clone.Dogtag = { ...upd.Dogtag };
    }
    return clone;
}
exports.deepCloneItemUpd = deepCloneItemUpd;
/**
 * Validates a session ID to prevent path traversal attacks.
 * @param sessionId - The session ID to validate
 * @returns True if the session ID is safe to use in file paths
 */
function isValidSessionId(sessionId) {
    if (typeof sessionId !== "string" || sessionId.length === 0) {
        return false;
    }
    // Session IDs should be alphanumeric with possible hyphens/underscores
    // Reject any path separators or special characters
    const safePattern = /^[a-zA-Z0-9_-]+$/;
    if (!safePattern.test(sessionId)) {
        return false;
    }
    // Reject common path traversal patterns
    if (sessionId.includes("..") ||
        sessionId.includes("/") ||
        sessionId.includes("\\") ||
        sessionId.includes("\0")) {
        return false;
    }
    // Reasonable length limit
    if (sessionId.length > 128) {
        return false;
    }
    return true;
}
exports.isValidSessionId = isValidSessionId;
/**
 * Validates basic snapshot structure.
 * @param snapshot - The snapshot to validate
 * @returns Object with valid flag and optional error message
 */
function validateSnapshot(snapshot) {
    if (snapshot === null || typeof snapshot !== "object") {
        return { valid: false, error: "Snapshot is null or not an object" };
    }
    const snap = snapshot;
    if (!Array.isArray(snap.items)) {
        return { valid: false, error: "Snapshot items is not an array" };
    }
    if (snap.items.length === 0) {
        return { valid: false, error: "Snapshot is empty" };
    }
    // Validate each item has required fields
    for (let i = 0; i < snap.items.length; i++) {
        const item = snap.items[i];
        if (typeof item !== "object" || item === null) {
            return { valid: false, error: `Item at index ${i} is not an object` };
        }
        if (typeof item._id !== "string" || item._id.length === 0) {
            return { valid: false, error: `Item at index ${i} has invalid _id` };
        }
        if (typeof item._tpl !== "string" || item._tpl.length === 0) {
            return { valid: false, error: `Item at index ${i} has invalid _tpl` };
        }
    }
    return { valid: true };
}
exports.validateSnapshot = validateSnapshot;
//# sourceMappingURL=Models.js.map