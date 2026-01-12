// ============================================================================
// Keep Starting Gear - Constants Tests
// ============================================================================
// Unit tests for the Constants module, ensuring all expected values are present
// and correctly defined.
//
// AUTHOR: Blackhorse311
// LICENSE: MIT
// ============================================================================

import { Constants, ExitStatus, loadConfig, isValidEquipmentTemplateId, ModConfig } from "../Constants";
import * as fs from "fs";
import * as path from "path";

// Mock fs module
jest.mock("fs");

describe("Constants", () => {
    describe("Mod Identity", () => {
        it("should have a valid mod version", () => {
            expect(Constants.MOD_VERSION).toBeDefined();
            expect(Constants.MOD_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
        });

        it("should have correct folder name", () => {
            expect(Constants.MOD_FOLDER_NAME).toBe("Blackhorse311-KeepStartingGear");
        });

        it("should have a log prefix", () => {
            expect(Constants.LOG_PREFIX).toBe("[KeepStartingGear]");
        });
    });

    describe("EFT/SPT Constants", () => {
        it("should have correct Equipment template ID", () => {
            // This is the official BSG template ID for Equipment container
            expect(Constants.EQUIPMENT_TEMPLATE_ID).toBe("55d7217a4bdc2d86028b456d");
        });

        it("should have 24-character Equipment template ID", () => {
            // MongoDB ObjectId format
            expect(Constants.EQUIPMENT_TEMPLATE_ID).toHaveLength(24);
        });

        it("should have valid Equipment template ID format", () => {
            expect(isValidEquipmentTemplateId(Constants.EQUIPMENT_TEMPLATE_ID)).toBe(true);
        });
    });

    describe("Default Configuration", () => {
        it("should have reasonable parent traversal depth", () => {
            expect(Constants.DEFAULTS.maxParentTraversalDepth).toBeGreaterThanOrEqual(10);
            expect(Constants.DEFAULTS.maxParentTraversalDepth).toBeLessThanOrEqual(50);
        });

        it("should have reasonable file read retries", () => {
            expect(Constants.DEFAULTS.maxFileReadRetries).toBeGreaterThanOrEqual(1);
            expect(Constants.DEFAULTS.maxFileReadRetries).toBeLessThanOrEqual(20);
        });

        it("should have reasonable retry delay", () => {
            expect(Constants.DEFAULTS.fileReadRetryDelayMs).toBeGreaterThanOrEqual(50);
            expect(Constants.DEFAULTS.fileReadRetryDelayMs).toBeLessThanOrEqual(2000);
        });

        it("should have reasonable max file size", () => {
            expect(Constants.DEFAULTS.maxSnapshotFileSizeBytes).toBeGreaterThanOrEqual(1024);
            expect(Constants.DEFAULTS.maxSnapshotFileSizeBytes).toBeLessThanOrEqual(100 * 1024 * 1024);
        });

        it("should have verboseLogging defaulting to false", () => {
            expect(Constants.DEFAULTS.verboseLogging).toBe(false);
        });

        it("should have reasonable rate limit interval", () => {
            expect(Constants.DEFAULTS.minRestoreIntervalMs).toBeGreaterThanOrEqual(0);
            expect(Constants.DEFAULTS.minRestoreIntervalMs).toBeLessThanOrEqual(60000);
        });
    });

    describe("Exit Status Values", () => {
        it("should have all expected exit statuses", () => {
            expect(Constants.EXIT_STATUS.SURVIVED).toBe("Survived");
            expect(Constants.EXIT_STATUS.KILLED).toBe("Killed");
            expect(Constants.EXIT_STATUS.LEFT).toBe("Left");
            expect(Constants.EXIT_STATUS.RUNNER).toBe("Runner");
            expect(Constants.EXIT_STATUS.MISSING_IN_ACTION).toBe("MissingInAction");
        });

        it("should have exactly 5 exit statuses", () => {
            const statusCount = Object.keys(Constants.EXIT_STATUS).length;
            expect(statusCount).toBe(5);
        });

        it("should be usable with ExitStatus type", () => {
            const status: ExitStatus = Constants.EXIT_STATUS.SURVIVED;
            expect(status).toBe("Survived");
        });
    });

    describe("Survival Statuses Whitelist", () => {
        it("should contain Survived status", () => {
            expect(Constants.SURVIVAL_STATUSES.has("Survived")).toBe(true);
        });

        it("should contain Runner status", () => {
            expect(Constants.SURVIVAL_STATUSES.has("Runner")).toBe(true);
        });

        it("should NOT contain Killed status", () => {
            expect(Constants.SURVIVAL_STATUSES.has("Killed")).toBe(false);
        });

        it("should NOT contain Left status", () => {
            expect(Constants.SURVIVAL_STATUSES.has("Left")).toBe(false);
        });

        it("should NOT contain MissingInAction status", () => {
            expect(Constants.SURVIVAL_STATUSES.has("MissingInAction")).toBe(false);
        });

        it("should return false for unknown statuses", () => {
            expect(Constants.SURVIVAL_STATUSES.has("UnknownStatus")).toBe(false);
        });
    });
});

describe("isValidEquipmentTemplateId", () => {
    it("should accept valid 24-char hex string", () => {
        expect(isValidEquipmentTemplateId("55d7217a4bdc2d86028b456d")).toBe(true);
        expect(isValidEquipmentTemplateId("000000000000000000000000")).toBe(true);
        expect(isValidEquipmentTemplateId("ffffffffffffffffffffffff")).toBe(true);
        expect(isValidEquipmentTemplateId("ABCDEF1234567890abcdef12")).toBe(true);
    });

    it("should reject strings that are too short", () => {
        expect(isValidEquipmentTemplateId("55d7217a4bdc2d86028b456")).toBe(false);
        expect(isValidEquipmentTemplateId("")).toBe(false);
        expect(isValidEquipmentTemplateId("abc")).toBe(false);
    });

    it("should reject strings that are too long", () => {
        expect(isValidEquipmentTemplateId("55d7217a4bdc2d86028b456d0")).toBe(false);
    });

    it("should reject non-hex characters", () => {
        expect(isValidEquipmentTemplateId("55d7217a4bdc2d86028b456g")).toBe(false);
        expect(isValidEquipmentTemplateId("55d7217a4bdc2d86028b456!")).toBe(false);
        expect(isValidEquipmentTemplateId("55d7217a 4bdc2d86028b456d")).toBe(false);
    });

    it("should reject non-string inputs", () => {
        expect(isValidEquipmentTemplateId(null as unknown as string)).toBe(false);
        expect(isValidEquipmentTemplateId(undefined as unknown as string)).toBe(false);
        expect(isValidEquipmentTemplateId(123 as unknown as string)).toBe(false);
    });
});

describe("loadConfig", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return defaults when config file does not exist", () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        const config = loadConfig("/test/mod");

        expect(config.maxParentTraversalDepth).toBe(Constants.DEFAULTS.maxParentTraversalDepth);
        expect(config.maxFileReadRetries).toBe(Constants.DEFAULTS.maxFileReadRetries);
        expect(config.verboseLogging).toBe(false);
    });

    it("should merge user config with defaults", () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
            verboseLogging: true,
            maxFileReadRetries: 10
        }));

        const config = loadConfig("/test/mod");

        expect(config.verboseLogging).toBe(true);
        expect(config.maxFileReadRetries).toBe(10);
        expect(config.maxParentTraversalDepth).toBe(Constants.DEFAULTS.maxParentTraversalDepth);
    });

    it("should validate and clamp out-of-range values", () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
            maxParentTraversalDepth: 5, // Below minimum of 10
            maxFileReadRetries: 100 // Above maximum of 20
        }));

        const config = loadConfig("/test/mod");

        expect(config.maxParentTraversalDepth).toBe(10); // Clamped to min
        expect(config.maxFileReadRetries).toBe(20); // Clamped to max
    });

    it("should handle invalid JSON gracefully", () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue("{ invalid json }");

        const config = loadConfig("/test/mod");

        // Should return defaults on parse error
        expect(config.maxParentTraversalDepth).toBe(Constants.DEFAULTS.maxParentTraversalDepth);
    });

    it("should handle non-numeric values gracefully", () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
            maxParentTraversalDepth: "not a number",
            verboseLogging: "not a boolean"
        }));

        const config = loadConfig("/test/mod");

        expect(config.maxParentTraversalDepth).toBe(Constants.DEFAULTS.maxParentTraversalDepth);
        expect(config.verboseLogging).toBe(Constants.DEFAULTS.verboseLogging);
    });
});

describe("Constants immutability", () => {
    it("should be defined as const", () => {
        // TypeScript's "as const" makes the object readonly
        // We verify the values exist and are strings
        expect(typeof Constants.MOD_VERSION).toBe("string");
        expect(typeof Constants.MOD_FOLDER_NAME).toBe("string");
        expect(typeof Constants.LOG_PREFIX).toBe("string");
        expect(typeof Constants.EQUIPMENT_TEMPLATE_ID).toBe("string");
    });

    it("should have SURVIVAL_STATUSES as a Set", () => {
        expect(Constants.SURVIVAL_STATUSES).toBeInstanceOf(Set);
        expect(Constants.SURVIVAL_STATUSES.size).toBe(2);
    });
});
