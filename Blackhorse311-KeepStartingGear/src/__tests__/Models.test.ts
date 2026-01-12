// ============================================================================
// Keep Starting Gear - Models Tests
// ============================================================================
// Unit tests for the Models module, focusing on RestoreResult factory functions,
// interface structure validation, and utility functions.
//
// AUTHOR: Blackhorse311
// LICENSE: MIT
// ============================================================================

import {
    RestoreResult,
    RestoreResultFactory,
    InventorySnapshot,
    SnapshotItem,
    ProfileItem,
    ItemLocation,
    ItemUpd,
    deepCloneItemUpd,
    isValidSessionId,
    validateSnapshot
} from "../Models";

describe("RestoreResult", () => {
    describe("succeeded()", () => {
        it("should create successful result with itemsAdded", () => {
            const result = RestoreResult.succeeded(10);

            expect(result.success).toBe(true);
            expect(result.itemsAdded).toBe(10);
            expect(result.duplicatesSkipped).toBe(0);
            expect(result.nonManagedSkipped).toBe(0);
            expect(result.errorMessage).toBeUndefined();
        });

        it("should create successful result with all counts", () => {
            const result = RestoreResult.succeeded(15, 3, 2);

            expect(result.success).toBe(true);
            expect(result.itemsAdded).toBe(15);
            expect(result.duplicatesSkipped).toBe(3);
            expect(result.nonManagedSkipped).toBe(2);
            expect(result.errorMessage).toBeUndefined();
        });

        it("should handle zero items added", () => {
            const result = RestoreResult.succeeded(0, 5, 3);

            expect(result.success).toBe(true);
            expect(result.itemsAdded).toBe(0);
            expect(result.duplicatesSkipped).toBe(5);
            expect(result.nonManagedSkipped).toBe(3);
        });

        it("should return frozen object", () => {
            const result = RestoreResult.succeeded(10);
            expect(Object.isFrozen(result)).toBe(true);
        });
    });

    describe("failed()", () => {
        it("should create failed result with error message", () => {
            const result = RestoreResult.failed("No snapshot file found");

            expect(result.success).toBe(false);
            expect(result.itemsAdded).toBe(0);
            expect(result.duplicatesSkipped).toBe(0);
            expect(result.nonManagedSkipped).toBe(0);
            expect(result.errorMessage).toBe("No snapshot file found");
        });

        it("should handle empty error message", () => {
            const result = RestoreResult.failed("");

            expect(result.success).toBe(false);
            expect(result.errorMessage).toBe("");
        });

        it("should handle complex error messages", () => {
            const errorMsg = "JSON parse error: Unexpected token at position 123";
            const result = RestoreResult.failed(errorMsg);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toBe(errorMsg);
        });

        it("should return frozen object", () => {
            const result = RestoreResult.failed("error");
            expect(Object.isFrozen(result)).toBe(true);
        });
    });
});

describe("InventorySnapshot structure", () => {
    it("should accept minimal valid snapshot", () => {
        const snapshot: InventorySnapshot = {
            items: []
        };

        expect(snapshot.items).toEqual([]);
        expect(snapshot.sessionId).toBeUndefined();
        expect(snapshot.modVersion).toBeUndefined();
    });

    it("should accept full snapshot with all optional fields", () => {
        const snapshot: InventorySnapshot = {
            sessionId: "session123",
            profileId: "profile123",
            playerName: "TestPlayer",
            timestamp: "2024-01-15T12:00:00Z",
            takenInRaid: true,
            location: "factory4_day",
            items: [],
            includedSlots: ["FirstPrimaryWeapon", "SecondPrimaryWeapon"],
            emptySlots: ["Holster"],
            modVersion: "1.4.9"
        };

        expect(snapshot.sessionId).toBe("session123");
        expect(snapshot.includedSlots).toContain("FirstPrimaryWeapon");
        expect(snapshot.emptySlots).toContain("Holster");
        expect(snapshot.modVersion).toBe("1.4.9");
    });
});

describe("SnapshotItem structure", () => {
    it("should accept minimal valid item", () => {
        const item: SnapshotItem = {
            _id: "item123",
            _tpl: "template456"
        };

        expect(item._id).toBe("item123");
        expect(item._tpl).toBe("template456");
        expect(item.parentId).toBeUndefined();
    });

    it("should accept item with grid location", () => {
        const location: ItemLocation = {
            x: 0,
            y: 0,
            r: 0
        };

        const item: SnapshotItem = {
            _id: "item123",
            _tpl: "template456",
            parentId: "container789",
            slotId: "main",
            location: location
        };

        expect(item.location).toEqual({ x: 0, y: 0, r: 0 });
    });

    it("should accept item with cartridge index location", () => {
        const item: SnapshotItem = {
            _id: "cartridge001",
            _tpl: "ammo_tpl",
            parentId: "magazine123",
            slotId: "cartridges",
            location: 5
        };

        expect(item.location).toBe(5);
    });

    it("should accept item with upd data", () => {
        const upd: ItemUpd = {
            StackObjectsCount: 30,
            SpawnedInSession: true,
            Repairable: {
                Durability: 85.5,
                MaxDurability: 100
            }
        };

        const item: SnapshotItem = {
            _id: "item123",
            _tpl: "template456",
            upd: upd
        };

        expect(item.upd?.StackObjectsCount).toBe(30);
        expect(item.upd?.SpawnedInSession).toBe(true);
        expect(item.upd?.Repairable?.Durability).toBe(85.5);
    });
});

describe("ProfileItem structure", () => {
    it("should be compatible with SnapshotItem for restoration", () => {
        const snapshotItem: SnapshotItem = {
            _id: "item123",
            _tpl: "template456",
            parentId: "equipment_id",
            slotId: "FirstPrimaryWeapon",
            upd: { StackObjectsCount: 1 }
        };

        // Simulate restoration: create ProfileItem from SnapshotItem
        const profileItem: ProfileItem = {
            _id: snapshotItem._id,
            _tpl: snapshotItem._tpl,
            parentId: "profile_equipment_id", // Remapped
            slotId: snapshotItem.slotId,
            upd: snapshotItem.upd
        };

        expect(profileItem._id).toBe(snapshotItem._id);
        expect(profileItem.parentId).toBe("profile_equipment_id");
    });
});

describe("ItemLocation", () => {
    it("should represent grid position correctly", () => {
        const location: ItemLocation = {
            x: 3,
            y: 2,
            r: 1,
            isSearched: true
        };

        expect(location.x).toBe(3);
        expect(location.y).toBe(2);
        expect(location.r).toBe(1);
        expect(location.isSearched).toBe(true);
    });

    it("should handle default rotation", () => {
        const location: ItemLocation = {
            x: 0,
            y: 0,
            r: 0
        };

        expect(location.r).toBe(0); // Horizontal
    });
});

describe("ItemUpd sub-types", () => {
    it("should support MedKit data", () => {
        const upd: ItemUpd = {
            MedKit: { HpResource: 1800 }
        };

        expect(upd.MedKit?.HpResource).toBe(1800);
    });

    it("should support FoodDrink data", () => {
        const upd: ItemUpd = {
            FoodDrink: { HpPercent: 75 }
        };

        expect(upd.FoodDrink?.HpPercent).toBe(75);
    });

    it("should support Key data", () => {
        const upd: ItemUpd = {
            Key: { NumberOfUsages: 10 }
        };

        expect(upd.Key?.NumberOfUsages).toBe(10);
    });

    it("should support Foldable data", () => {
        const upd: ItemUpd = {
            Foldable: { Folded: true }
        };

        expect(upd.Foldable?.Folded).toBe(true);
    });

    it("should support Resource data", () => {
        const upd: ItemUpd = {
            Resource: { Value: 50 }
        };

        expect(upd.Resource?.Value).toBe(50);
    });

    it("should support Light data", () => {
        const upd: ItemUpd = {
            Light: { IsActive: true, SelectedMode: 2 }
        };

        expect(upd.Light?.IsActive).toBe(true);
        expect(upd.Light?.SelectedMode).toBe(2);
    });

    it("should support Togglable data", () => {
        const upd: ItemUpd = {
            Togglable: { On: true }
        };

        expect(upd.Togglable?.On).toBe(true);
    });

    it("should support FireMode data", () => {
        const upd: ItemUpd = {
            FireMode: { FireMode: "fullauto" }
        };

        expect(upd.FireMode?.FireMode).toBe("fullauto");
    });

    it("should support Sight data", () => {
        const upd: ItemUpd = {
            Sight: {
                ScopesCurrentCalibPointIndexes: [0, 1],
                ScopesSelectedModes: [0],
                SelectedScope: 0
            }
        };

        expect(upd.Sight?.ScopesCurrentCalibPointIndexes).toEqual([0, 1]);
        expect(upd.Sight?.SelectedScope).toBe(0);
    });
});

describe("deepCloneItemUpd", () => {
    it("should return undefined for undefined input", () => {
        expect(deepCloneItemUpd(undefined)).toBeUndefined();
    });

    it("should clone primitive values", () => {
        const upd: ItemUpd = {
            StackObjectsCount: 30,
            SpawnedInSession: true
        };

        const clone = deepCloneItemUpd(upd);

        expect(clone?.StackObjectsCount).toBe(30);
        expect(clone?.SpawnedInSession).toBe(true);
    });

    it("should create independent copy of Repairable", () => {
        const upd: ItemUpd = {
            Repairable: { Durability: 85.5, MaxDurability: 100 }
        };

        const clone = deepCloneItemUpd(upd);

        expect(clone?.Repairable?.Durability).toBe(85.5);
        expect(clone?.Repairable).not.toBe(upd.Repairable); // Different reference
    });

    it("should create independent copy of Sight arrays", () => {
        const upd: ItemUpd = {
            Sight: {
                ScopesCurrentCalibPointIndexes: [0, 1, 2],
                ScopesSelectedModes: [0],
                SelectedScope: 0
            }
        };

        const clone = deepCloneItemUpd(upd);

        expect(clone?.Sight?.ScopesCurrentCalibPointIndexes).toEqual([0, 1, 2]);
        expect(clone?.Sight?.ScopesCurrentCalibPointIndexes).not.toBe(
            upd.Sight?.ScopesCurrentCalibPointIndexes
        ); // Different reference
    });

    it("should clone all upd properties", () => {
        const upd: ItemUpd = {
            StackObjectsCount: 10,
            SpawnedInSession: false,
            Foldable: { Folded: true },
            MedKit: { HpResource: 1000 },
            Repairable: { Durability: 50, MaxDurability: 100 },
            Resource: { Value: 25 },
            FoodDrink: { HpPercent: 80 },
            Tag: { Name: "MyGun", Color: 1 },
            Key: { NumberOfUsages: 5 },
            Light: { IsActive: true, SelectedMode: 1 },
            Togglable: { On: false },
            FireMode: { FireMode: "single" }
        };

        const clone = deepCloneItemUpd(upd);

        expect(clone?.StackObjectsCount).toBe(10);
        expect(clone?.Foldable?.Folded).toBe(true);
        expect(clone?.MedKit?.HpResource).toBe(1000);
        expect(clone?.Repairable?.Durability).toBe(50);
        expect(clone?.Resource?.Value).toBe(25);
        expect(clone?.FoodDrink?.HpPercent).toBe(80);
        expect(clone?.Tag?.Name).toBe("MyGun");
        expect(clone?.Key?.NumberOfUsages).toBe(5);
        expect(clone?.Light?.IsActive).toBe(true);
        expect(clone?.Togglable?.On).toBe(false);
        expect(clone?.FireMode?.FireMode).toBe("single");
    });
});

describe("isValidSessionId", () => {
    describe("valid session IDs", () => {
        it("should accept alphanumeric strings", () => {
            expect(isValidSessionId("abc123")).toBe(true);
            expect(isValidSessionId("ABC123")).toBe(true);
            expect(isValidSessionId("session123")).toBe(true);
        });

        it("should accept strings with hyphens and underscores", () => {
            expect(isValidSessionId("session-123")).toBe(true);
            expect(isValidSessionId("session_123")).toBe(true);
            expect(isValidSessionId("session-123_abc")).toBe(true);
        });

        it("should accept typical session IDs", () => {
            expect(isValidSessionId("5f8a9b2c1d3e4f5a6b7c8d9e")).toBe(true);
            expect(isValidSessionId("pmc-profile-12345")).toBe(true);
        });
    });

    describe("invalid session IDs", () => {
        it("should reject empty strings", () => {
            expect(isValidSessionId("")).toBe(false);
        });

        it("should reject path traversal attempts", () => {
            expect(isValidSessionId("../../../etc/passwd")).toBe(false);
            expect(isValidSessionId("..\\..\\windows")).toBe(false);
            expect(isValidSessionId("session/../hack")).toBe(false);
        });

        it("should reject strings with path separators", () => {
            expect(isValidSessionId("path/to/file")).toBe(false);
            expect(isValidSessionId("path\\to\\file")).toBe(false);
        });

        it("should reject strings with null bytes", () => {
            expect(isValidSessionId("session\0hack")).toBe(false);
        });

        it("should reject strings with special characters", () => {
            expect(isValidSessionId("session!@#$")).toBe(false);
            expect(isValidSessionId("session<script>")).toBe(false);
            expect(isValidSessionId("session;drop table")).toBe(false);
        });

        it("should reject very long strings", () => {
            const longString = "a".repeat(129);
            expect(isValidSessionId(longString)).toBe(false);
        });

        it("should reject non-string inputs", () => {
            expect(isValidSessionId(null as unknown as string)).toBe(false);
            expect(isValidSessionId(undefined as unknown as string)).toBe(false);
            expect(isValidSessionId(123 as unknown as string)).toBe(false);
            expect(isValidSessionId({} as unknown as string)).toBe(false);
        });
    });

    describe("edge cases", () => {
        it("should accept strings at maximum length", () => {
            const maxLengthString = "a".repeat(128);
            expect(isValidSessionId(maxLengthString)).toBe(true);
        });

        it("should accept single character", () => {
            expect(isValidSessionId("a")).toBe(true);
        });
    });
});

describe("validateSnapshot", () => {
    it("should accept valid snapshot with items", () => {
        const snapshot = {
            items: [
                { _id: "item1", _tpl: "template1" },
                { _id: "item2", _tpl: "template2" }
            ]
        };

        const result = validateSnapshot(snapshot);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
    });

    it("should reject null snapshot", () => {
        const result = validateSnapshot(null);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("null");
    });

    it("should reject non-object snapshot", () => {
        const result = validateSnapshot("not an object");
        expect(result.valid).toBe(false);
    });

    it("should reject snapshot without items array", () => {
        const result = validateSnapshot({ items: "not an array" });
        expect(result.valid).toBe(false);
        expect(result.error).toContain("not an array");
    });

    it("should reject empty snapshot", () => {
        const result = validateSnapshot({ items: [] });
        expect(result.valid).toBe(false);
        expect(result.error).toContain("empty");
    });

    it("should reject items with missing _id", () => {
        const snapshot = {
            items: [
                { _tpl: "template1" }
            ]
        };

        const result = validateSnapshot(snapshot);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("_id");
    });

    it("should reject items with missing _tpl", () => {
        const snapshot = {
            items: [
                { _id: "item1" }
            ]
        };

        const result = validateSnapshot(snapshot);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("_tpl");
    });

    it("should reject items with empty _id", () => {
        const snapshot = {
            items: [
                { _id: "", _tpl: "template1" }
            ]
        };

        const result = validateSnapshot(snapshot);
        expect(result.valid).toBe(false);
    });

    it("should reject non-object items", () => {
        const snapshot = {
            items: ["not an object"]
        };

        const result = validateSnapshot(snapshot);
        expect(result.valid).toBe(false);
    });
});
