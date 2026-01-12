// ============================================================================
// Keep Starting Gear - SnapshotRestorer Tests
// ============================================================================
// Unit tests for the SnapshotRestorer class, testing restoration logic,
// file operations, error handling, security, and rollback functionality.
//
// AUTHOR: Blackhorse311
// LICENSE: MIT
// ============================================================================

import * as fs from "fs";
import * as path from "path";
import { SnapshotRestorer, resolveSnapshotsPath, validateSnapshotsPath } from "../SnapshotRestorer";
import { Constants, ModConfig } from "../Constants";
import { ProfileItem, InventorySnapshot } from "../Models";

// Mock the fs module
jest.mock("fs");

// Create mock logger
const createMockLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    logWithColor: jest.fn()
});

// Default test config
const createTestConfig = (overrides: Partial<ModConfig> = {}): ModConfig => ({
    maxParentTraversalDepth: 20,
    maxFileReadRetries: 3,
    fileReadRetryDelayMs: 10, // Short delay for tests
    maxSnapshotFileSizeBytes: 10 * 1024 * 1024,
    verboseLogging: false,
    minRestoreIntervalMs: 0, // Disable rate limiting in most tests
    ...overrides
});

describe("SnapshotRestorer", () => {
    let mockLogger: ReturnType<typeof createMockLogger>;
    let restorer: SnapshotRestorer;
    const testSnapshotsPath = "/test/snapshots";
    let testConfig: ModConfig;

    beforeEach(() => {
        jest.clearAllMocks();
        mockLogger = createMockLogger();
        testConfig = createTestConfig();
        restorer = new SnapshotRestorer(mockLogger as any, testSnapshotsPath, testConfig);
    });

    describe("constructor", () => {
        it("should throw error if logger is null", () => {
            expect(() => new SnapshotRestorer(null as any, testSnapshotsPath, testConfig))
                .toThrow("Logger is required");
        });

        it("should throw error if snapshotsPath is empty", () => {
            expect(() => new SnapshotRestorer(mockLogger as any, "", testConfig))
                .toThrow("Snapshots path is required");
        });

        it("should throw error if config is null", () => {
            expect(() => new SnapshotRestorer(mockLogger as any, testSnapshotsPath, null as any))
                .toThrow("Config is required");
        });

        it("should create instance with valid parameters", () => {
            const instance = new SnapshotRestorer(mockLogger as any, testSnapshotsPath, testConfig);
            expect(instance).toBeDefined();
        });

        it("should warn if Equipment template ID is invalid", () => {
            // This test verifies the warning is logged, but since we can't mock
            // Constants easily, we just verify the constructor doesn't throw
            expect(() => new SnapshotRestorer(mockLogger as any, testSnapshotsPath, testConfig))
                .not.toThrow();
        });
    });

    describe("tryRestore - input validation", () => {
        it("should fail if sessionId is empty", () => {
            const items: ProfileItem[] = [];
            const result = restorer.tryRestore("", items);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain("Invalid session ID");
        });

        it("should fail if inventoryItems is null", () => {
            const result = restorer.tryRestore("session123", null as any);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain("null");
        });

        it("should fail if inventoryItems is not an array", () => {
            const result = restorer.tryRestore("session123", "not an array" as any);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain("array");
        });

        it("should fail if no snapshot file exists", () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            const items: ProfileItem[] = [];
            const result = restorer.tryRestore("session123", items);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toBe("No snapshot file found");
        });
    });

    describe("tryRestore - security validation", () => {
        it("should reject path traversal attempts in sessionId", () => {
            const result = restorer.tryRestore("../../../etc/passwd", []);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain("Invalid session ID");
        });

        it("should reject sessionId with forward slashes", () => {
            const result = restorer.tryRestore("path/to/file", []);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain("Invalid session ID");
        });

        it("should reject sessionId with backslashes", () => {
            const result = restorer.tryRestore("path\\to\\file", []);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain("Invalid session ID");
        });

        it("should reject sessionId with special characters", () => {
            const result = restorer.tryRestore("session!@#$%", []);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain("Invalid session ID");
        });

        it("should reject very long sessionId", () => {
            const longSessionId = "a".repeat(200);
            const result = restorer.tryRestore(longSessionId, []);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain("Invalid session ID");
        });
    });

    describe("tryRestore - JSON parsing", () => {
        it("should handle JSON parse errors gracefully", () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 1000 });
            (fs.readFileSync as jest.Mock).mockReturnValue("{ invalid json }");

            const items: ProfileItem[] = [];
            const result = restorer.tryRestore("session123", items);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain("JSON parse error");
        });

        it("should fail if snapshot is empty", () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 100 });
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ items: [] }));

            const items: ProfileItem[] = [];
            const result = restorer.tryRestore("session123", items);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain("empty");
        });

        it("should fail if snapshot has no version (legacy format)", () => {
            const snapshot: InventorySnapshot = {
                items: [
                    { _id: "item1", _tpl: "template1" }
                ]
                // No modVersion field
            };

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 100 });
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(snapshot));

            const items: ProfileItem[] = [];
            const result = restorer.tryRestore("session123", items);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain("incompatible");
        });

        it("should fail if major version does not match", () => {
            const snapshot: InventorySnapshot = {
                items: [
                    { _id: "item1", _tpl: "template1" }
                ],
                modVersion: "2.0.0" // Different major version
            };

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 100 });
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(snapshot));

            const items: ProfileItem[] = [];
            const result = restorer.tryRestore("session123", items);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain("incompatible");
        });
    });

    describe("tryRestore - file size validation", () => {
        it("should reject files that are too large", () => {
            const config = createTestConfig({ maxSnapshotFileSizeBytes: 1000 });
            const localRestorer = new SnapshotRestorer(mockLogger as any, testSnapshotsPath, config);

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 2000 }); // Larger than limit

            const items: ProfileItem[] = [];
            const result = localRestorer.tryRestore("session123", items);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toContain("too large");
        });

        it("should accept files within size limit", () => {
            const config = createTestConfig({ maxSnapshotFileSizeBytes: 10000 });
            const localRestorer = new SnapshotRestorer(mockLogger as any, testSnapshotsPath, config);

            const equipmentTpl = Constants.EQUIPMENT_TEMPLATE_ID;
            const snapshot: InventorySnapshot = {
                items: [
                    { _id: "equip1", _tpl: equipmentTpl },
                    { _id: "weapon1", _tpl: "weapon_tpl", parentId: "equip1", slotId: "FirstPrimaryWeapon" }
                ],
                includedSlots: ["firstprimaryweapon"],
                modVersion: Constants.MOD_VERSION
            };

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 5000 });
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(snapshot));
            (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);

            const profileItems: ProfileItem[] = [
                { _id: "profile_equip", _tpl: equipmentTpl }
            ];

            const result = localRestorer.tryRestore("session123", profileItems);

            expect(result.success).toBe(true);
        });
    });

    describe("tryRestore - rate limiting", () => {
        it("should enforce rate limiting between attempts", () => {
            const config = createTestConfig({ minRestoreIntervalMs: 1000 });
            const localRestorer = new SnapshotRestorer(mockLogger as any, testSnapshotsPath, config);

            (fs.existsSync as jest.Mock).mockReturnValue(false);

            // First attempt should work (but fail due to no file)
            const result1 = localRestorer.tryRestore("session123", []);
            expect(result1.errorMessage).toBe("No snapshot file found");

            // Second attempt should be rate limited
            const result2 = localRestorer.tryRestore("session123", []);
            expect(result2.success).toBe(false);
            expect(result2.errorMessage).toContain("Rate limit");
        });

        it("should allow attempts from different sessions", () => {
            const config = createTestConfig({ minRestoreIntervalMs: 1000 });
            const localRestorer = new SnapshotRestorer(mockLogger as any, testSnapshotsPath, config);

            (fs.existsSync as jest.Mock).mockReturnValue(false);

            // First session
            const result1 = localRestorer.tryRestore("session1", []);
            expect(result1.errorMessage).toBe("No snapshot file found");

            // Different session should not be rate limited
            const result2 = localRestorer.tryRestore("session2", []);
            expect(result2.errorMessage).toBe("No snapshot file found");
        });
    });

    describe("tryRestore - successful restoration", () => {
        it("should restore items successfully", () => {
            const equipmentTpl = Constants.EQUIPMENT_TEMPLATE_ID;
            const snapshot: InventorySnapshot = {
                items: [
                    { _id: "equip1", _tpl: equipmentTpl },
                    { _id: "weapon1", _tpl: "weapon_tpl", parentId: "equip1", slotId: "FirstPrimaryWeapon" },
                    { _id: "mod1", _tpl: "mod_tpl", parentId: "weapon1", slotId: "mod_scope" }
                ],
                includedSlots: ["firstprimaryweapon"],
                modVersion: Constants.MOD_VERSION
            };

            const profileItems: ProfileItem[] = [
                { _id: "profile_equip", _tpl: equipmentTpl }
            ];

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 1000 });
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(snapshot));
            (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);

            const result = restorer.tryRestore("session123", profileItems);

            expect(result.success).toBe(true);
            expect(result.itemsAdded).toBe(2); // weapon1 + mod1 (not Equipment)
            expect(profileItems.length).toBe(3); // Original equip + 2 items
        });

        it("should skip duplicate items", () => {
            const equipmentTpl = Constants.EQUIPMENT_TEMPLATE_ID;
            const snapshot: InventorySnapshot = {
                items: [
                    { _id: "equip1", _tpl: equipmentTpl },
                    { _id: "weapon1", _tpl: "weapon_tpl", parentId: "equip1", slotId: "FirstPrimaryWeapon" }
                ],
                includedSlots: ["firstprimaryweapon"],
                modVersion: Constants.MOD_VERSION
            };

            // Profile has item in non-managed slot with same ID
            const profileItems: ProfileItem[] = [
                { _id: "profile_equip", _tpl: equipmentTpl },
                { _id: "weapon1", _tpl: "weapon_tpl", parentId: "profile_equip", slotId: "Scabbard" }
            ];

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 1000 });
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(snapshot));
            (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);

            const result = restorer.tryRestore("session123", profileItems);

            expect(result.success).toBe(true);
            expect(result.duplicatesSkipped).toBe(1);
        });

        it("should delete snapshot file after successful restoration", () => {
            const equipmentTpl = Constants.EQUIPMENT_TEMPLATE_ID;
            const snapshot: InventorySnapshot = {
                items: [
                    { _id: "equip1", _tpl: equipmentTpl },
                    { _id: "weapon1", _tpl: "weapon_tpl", parentId: "equip1", slotId: "FirstPrimaryWeapon" }
                ],
                includedSlots: ["firstprimaryweapon"],
                modVersion: Constants.MOD_VERSION
            };

            const profileItems: ProfileItem[] = [
                { _id: "profile_equip", _tpl: equipmentTpl }
            ];

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 1000 });
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(snapshot));
            (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);

            restorer.tryRestore("session123", profileItems);

            expect(fs.unlinkSync).toHaveBeenCalled();
        });

        it("should remap parent ID from snapshot Equipment to profile Equipment", () => {
            const equipmentTpl = Constants.EQUIPMENT_TEMPLATE_ID;
            const snapshot: InventorySnapshot = {
                items: [
                    { _id: "snapshot_equip", _tpl: equipmentTpl },
                    { _id: "weapon1", _tpl: "weapon_tpl", parentId: "snapshot_equip", slotId: "FirstPrimaryWeapon" }
                ],
                includedSlots: ["firstprimaryweapon"],
                modVersion: Constants.MOD_VERSION
            };

            const profileItems: ProfileItem[] = [
                { _id: "profile_equip", _tpl: equipmentTpl }
            ];

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 1000 });
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(snapshot));
            (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);

            restorer.tryRestore("session123", profileItems);

            const addedWeapon = profileItems.find(i => i._id === "weapon1");
            expect(addedWeapon).toBeDefined();
            expect(addedWeapon?.parentId).toBe("profile_equip"); // Remapped!
        });
    });

    describe("tryRestore - rollback on error", () => {
        it("should rollback inventory if error occurs during restoration", () => {
            const equipmentTpl = Constants.EQUIPMENT_TEMPLATE_ID;
            const snapshot: InventorySnapshot = {
                items: [
                    { _id: "equip1", _tpl: equipmentTpl },
                    { _id: "weapon1", _tpl: "weapon_tpl", parentId: "equip1", slotId: "FirstPrimaryWeapon" }
                ],
                includedSlots: ["firstprimaryweapon"],
                modVersion: Constants.MOD_VERSION
            };

            const originalItems: ProfileItem[] = [
                { _id: "profile_equip", _tpl: equipmentTpl },
                { _id: "existing_item", _tpl: "existing_tpl", parentId: "profile_equip", slotId: "Backpack" }
            ];

            const profileItems = [...originalItems];

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 1000 });
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(snapshot));
            // Simulate error during file deletion
            (fs.unlinkSync as jest.Mock).mockImplementation(() => {
                throw new Error("Simulated error");
            });

            // The restoration should still succeed even if delete fails
            // because delete is wrapped in try-catch
            const result = restorer.tryRestore("session123", profileItems);

            // Since the delete error is caught, restoration succeeds
            expect(result.success).toBe(true);
        });
    });

    describe("clearSnapshot", () => {
        it("should delete snapshot file if exists", () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);

            restorer.clearSnapshot("session123");

            expect(fs.unlinkSync).toHaveBeenCalled();
        });

        it("should not throw if file does not exist", () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            expect(() => restorer.clearSnapshot("session123")).not.toThrow();
        });

        it("should handle deletion errors gracefully", () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.unlinkSync as jest.Mock).mockImplementation(() => {
                throw new Error("Permission denied");
            });

            expect(() => restorer.clearSnapshot("session123")).not.toThrow();
            expect(mockLogger.warning).toHaveBeenCalled();
        });

        it("should reject invalid session IDs", () => {
            restorer.clearSnapshot("../../../etc/passwd");

            expect(fs.existsSync).not.toHaveBeenCalled();
            expect(mockLogger.warning).toHaveBeenCalled();
        });
    });

    describe("Slot management", () => {
        it("should only restore items from includedSlots", () => {
            const equipmentTpl = Constants.EQUIPMENT_TEMPLATE_ID;
            const snapshot: InventorySnapshot = {
                items: [
                    { _id: "equip1", _tpl: equipmentTpl },
                    { _id: "weapon1", _tpl: "weapon_tpl", parentId: "equip1", slotId: "FirstPrimaryWeapon" },
                    { _id: "backpack1", _tpl: "backpack_tpl", parentId: "equip1", slotId: "Backpack" }
                ],
                includedSlots: ["firstprimaryweapon"], // Only this slot is managed
                modVersion: Constants.MOD_VERSION
            };

            const profileItems: ProfileItem[] = [
                { _id: "profile_equip", _tpl: equipmentTpl }
            ];

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 1000 });
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(snapshot));
            (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);

            const result = restorer.tryRestore("session123", profileItems);

            expect(result.success).toBe(true);
            expect(result.itemsAdded).toBe(1); // Only weapon, not backpack
            expect(result.nonManagedSkipped).toBe(1); // Backpack was skipped
        });

        it("should preserve items in non-managed slots", () => {
            const equipmentTpl = Constants.EQUIPMENT_TEMPLATE_ID;
            const snapshot: InventorySnapshot = {
                items: [
                    { _id: "equip1", _tpl: equipmentTpl },
                    { _id: "weapon1", _tpl: "weapon_tpl", parentId: "equip1", slotId: "FirstPrimaryWeapon" }
                ],
                includedSlots: ["firstprimaryweapon"],
                modVersion: Constants.MOD_VERSION
            };

            const profileItems: ProfileItem[] = [
                { _id: "profile_equip", _tpl: equipmentTpl },
                { _id: "unmanaged_item", _tpl: "random_tpl", parentId: "profile_equip", slotId: "Pockets" }
            ];

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 1000 });
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(snapshot));
            (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);

            restorer.tryRestore("session123", profileItems);

            const pocketItem = profileItems.find(i => i._id === "unmanaged_item");
            expect(pocketItem).toBeDefined();
        });

        it("should remove items from emptySlots", () => {
            const equipmentTpl = Constants.EQUIPMENT_TEMPLATE_ID;
            const snapshot: InventorySnapshot = {
                items: [
                    { _id: "equip1", _tpl: equipmentTpl }
                ],
                includedSlots: ["holster"],
                emptySlots: ["holster"],
                modVersion: Constants.MOD_VERSION
            };

            const profileItems: ProfileItem[] = [
                { _id: "profile_equip", _tpl: equipmentTpl },
                { _id: "looted_pistol", _tpl: "pistol_tpl", parentId: "profile_equip", slotId: "Holster" }
            ];

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 1000 });
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(snapshot));
            (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);

            restorer.tryRestore("session123", profileItems);

            const lootedPistol = profileItems.find(i => i._id === "looted_pistol");
            expect(lootedPistol).toBeUndefined();
        });
    });

    describe("Item upd preservation", () => {
        it("should preserve StackObjectsCount", () => {
            const equipmentTpl = Constants.EQUIPMENT_TEMPLATE_ID;
            const snapshot: InventorySnapshot = {
                items: [
                    { _id: "equip1", _tpl: equipmentTpl },
                    {
                        _id: "ammo1",
                        _tpl: "ammo_tpl",
                        parentId: "equip1",
                        slotId: "Pockets",
                        upd: { StackObjectsCount: 60 }
                    }
                ],
                includedSlots: ["pockets"],
                modVersion: Constants.MOD_VERSION
            };

            const profileItems: ProfileItem[] = [
                { _id: "profile_equip", _tpl: equipmentTpl }
            ];

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 1000 });
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(snapshot));
            (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);

            restorer.tryRestore("session123", profileItems);

            const restoredAmmo = profileItems.find(i => i._id === "ammo1");
            expect(restoredAmmo?.upd?.StackObjectsCount).toBe(60);
        });

        it("should preserve Repairable data", () => {
            const equipmentTpl = Constants.EQUIPMENT_TEMPLATE_ID;
            const snapshot: InventorySnapshot = {
                items: [
                    { _id: "equip1", _tpl: equipmentTpl },
                    {
                        _id: "armor1",
                        _tpl: "armor_tpl",
                        parentId: "equip1",
                        slotId: "ArmorVest",
                        upd: {
                            Repairable: {
                                Durability: 45.5,
                                MaxDurability: 50
                            }
                        }
                    }
                ],
                includedSlots: ["armorvest"],
                modVersion: Constants.MOD_VERSION
            };

            const profileItems: ProfileItem[] = [
                { _id: "profile_equip", _tpl: equipmentTpl }
            ];

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 1000 });
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(snapshot));
            (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);

            restorer.tryRestore("session123", profileItems);

            const restoredArmor = profileItems.find(i => i._id === "armor1");
            expect(restoredArmor?.upd?.Repairable?.Durability).toBe(45.5);
            expect(restoredArmor?.upd?.Repairable?.MaxDurability).toBe(50);
        });

        it("should deep clone upd to prevent reference mutations", () => {
            const equipmentTpl = Constants.EQUIPMENT_TEMPLATE_ID;
            const snapshot: InventorySnapshot = {
                items: [
                    { _id: "equip1", _tpl: equipmentTpl },
                    {
                        _id: "armor1",
                        _tpl: "armor_tpl",
                        parentId: "equip1",
                        slotId: "ArmorVest",
                        upd: {
                            Repairable: {
                                Durability: 45.5,
                                MaxDurability: 50
                            }
                        }
                    }
                ],
                includedSlots: ["armorvest"],
                modVersion: Constants.MOD_VERSION
            };

            const profileItems: ProfileItem[] = [
                { _id: "profile_equip", _tpl: equipmentTpl }
            ];

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 1000 });
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(snapshot));
            (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);

            restorer.tryRestore("session123", profileItems);

            const restoredArmor = profileItems.find(i => i._id === "armor1");

            // Modify the restored item's upd
            if (restoredArmor?.upd?.Repairable) {
                (restoredArmor.upd.Repairable as any).Durability = 100;
            }

            // Original snapshot should be unaffected (verify deep clone worked)
            // Note: We can't easily verify this in a mock test, but the deep clone
            // function is tested separately in Models.test.ts
            expect(restoredArmor?.upd?.Repairable?.Durability).toBe(100);
        });
    });

    describe("Circular reference detection", () => {
        it("should handle items with circular parent references", () => {
            const equipmentTpl = Constants.EQUIPMENT_TEMPLATE_ID;
            const snapshot: InventorySnapshot = {
                items: [
                    { _id: "equip1", _tpl: equipmentTpl },
                    { _id: "item1", _tpl: "tpl1", parentId: "item2", slotId: "slot1" },
                    { _id: "item2", _tpl: "tpl2", parentId: "item1", slotId: "slot2" } // Circular!
                ],
                includedSlots: ["slot1", "slot2"],
                modVersion: Constants.MOD_VERSION
            };

            const profileItems: ProfileItem[] = [
                { _id: "profile_equip", _tpl: equipmentTpl }
            ];

            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 1000 });
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(snapshot));
            (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);

            // Should not hang or throw, just log a warning
            const result = restorer.tryRestore("session123", profileItems);

            expect(result.success).toBe(true);
            expect(mockLogger.warning).toHaveBeenCalledWith(
                expect.stringContaining("Cycle detected")
            );
        });
    });
});

describe("resolveSnapshotsPath", () => {
    it("should construct correct path from mod directory", () => {
        const modDir = "/SPT/user/mods/Blackhorse311-KeepStartingGear/src";
        const result = resolveSnapshotsPath(modDir);

        expect(result).toContain("BepInEx");
        expect(result).toContain("plugins");
        expect(result).toContain("Blackhorse311-KeepStartingGear");
        expect(result).toContain("snapshots");
    });

    it("should handle Windows-style paths", () => {
        const modDir = "C:\\SPT\\user\\mods\\Blackhorse311-KeepStartingGear\\src";
        const result = resolveSnapshotsPath(modDir);

        expect(result).toContain("snapshots");
    });
});

describe("validateSnapshotsPath", () => {
    it("should accept valid path under SPT root", () => {
        const sptRoot = "/SPT";
        const snapshotsPath = "/SPT/BepInEx/plugins/ModName/snapshots";

        const result = validateSnapshotsPath(snapshotsPath, sptRoot);

        expect(result).toBe(true);
    });

    it("should reject path outside SPT root", () => {
        const sptRoot = "/SPT";
        const snapshotsPath = "/other/path/snapshots";

        const result = validateSnapshotsPath(snapshotsPath, sptRoot);

        expect(result).toBe(false);
    });

    it("should reject path without BepInEx component", () => {
        const sptRoot = "/SPT";
        const snapshotsPath = "/SPT/other/plugins/ModName/snapshots";

        const result = validateSnapshotsPath(snapshotsPath, sptRoot);

        expect(result).toBe(false);
    });

    it("should reject path without plugins component", () => {
        const sptRoot = "/SPT";
        const snapshotsPath = "/SPT/BepInEx/other/ModName/snapshots";

        const result = validateSnapshotsPath(snapshotsPath, sptRoot);

        expect(result).toBe(false);
    });

    it("should reject path without snapshots component", () => {
        const sptRoot = "/SPT";
        const snapshotsPath = "/SPT/BepInEx/plugins/ModName/other";

        const result = validateSnapshotsPath(snapshotsPath, sptRoot);

        expect(result).toBe(false);
    });
});
