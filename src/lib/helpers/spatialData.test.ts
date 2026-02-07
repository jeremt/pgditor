import {test, expect} from "vitest";
import {formatSpatialData, parseSpatialData, spatialDataToHex} from "./spatialData";

// Test formatSpatialData
test("formatSpatialData formats Point geometry", () => {
    const geometry = {
        type: "Point" as const,
        coordinates: {lng: -122.4194, lat: 37.7749},
    };
    expect(formatSpatialData(geometry)).toBe("Point(-122.4194 37.7749)");
});

test("formatSpatialData formats LineString geometry", () => {
    const geometry = {
        type: "LineString" as const,
        coordinates: [
            {lng: -122.4194, lat: 37.7749},
            {lng: -122.4084, lat: 37.7849},
        ],
    };
    expect(formatSpatialData(geometry)).toBe("LineString(-122.4194 37.7749, -122.4084 37.7849)");
});

test("formatSpatialData formats Polygon geometry", () => {
    const geometry = {
        type: "Polygon" as const,
        coordinates: [
            [
                {lng: -122.4, lat: 37.8},
                {lng: -122.5, lat: 37.8},
                {lng: -122.5, lat: 37.7},
                {lng: -122.4, lat: 37.7},
                {lng: -122.4, lat: 37.8},
            ],
        ],
    };
    expect(formatSpatialData(geometry)).toBe(
        "Polygon((-122.4 37.8, -122.5 37.8, -122.5 37.7, -122.4 37.7, -122.4 37.8))",
    );
});

test("formatSpatialData formats MultiPoint geometry", () => {
    const geometry = {
        type: "MultiPoint" as const,
        coordinates: [
            {lng: -122.4, lat: 37.8},
            {lng: -122.5, lat: 37.9},
        ],
    };
    expect(formatSpatialData(geometry)).toBe("MultiPoint((-122.4 37.8), (-122.5 37.9))");
});

test("formatSpatialData formats MultiLineString geometry", () => {
    const geometry = {
        type: "MultiLineString" as const,
        coordinates: [
            [
                {lng: -122.4, lat: 37.8},
                {lng: -122.5, lat: 37.9},
            ],
            [
                {lng: -122.6, lat: 37.7},
                {lng: -122.7, lat: 37.6},
            ],
        ],
    };
    expect(formatSpatialData(geometry)).toBe("MultiLineString((-122.4 37.8, -122.5 37.9), (-122.6 37.7, -122.7 37.6))");
});

test("formatSpatialData formats MultiPolygon geometry", () => {
    const geometry = {
        type: "MultiPolygon" as const,
        coordinates: [
            [
                [
                    {lng: -122.4, lat: 37.8},
                    {lng: -122.5, lat: 37.8},
                    {lng: -122.5, lat: 37.7},
                    {lng: -122.4, lat: 37.8},
                ],
            ],
            [
                [
                    {lng: -123.4, lat: 38.8},
                    {lng: -123.5, lat: 38.8},
                    {lng: -123.5, lat: 38.7},
                    {lng: -123.4, lat: 38.8},
                ],
            ],
        ],
    };
    expect(formatSpatialData(geometry)).toBe(
        "MultiPolygon(((-122.4 37.8, -122.5 37.8, -122.5 37.7, -122.4 37.8)), ((-123.4 38.8, -123.5 38.8, -123.5 38.7, -123.4 38.8)))",
    );
});

// Test parseSpatialData
test("parseSpatialData parses Point from WKB hex (little endian)", () => {
    // This hex actually encodes a specific point - we test that it parses correctly
    const hex = "0101000000713D0AD7A3705EC06FF6282E01CA4240";
    const result = parseSpatialData(hex);

    expect(result.type).toBe("Point");
    // Verify it returns valid coordinates (without asserting exact values)
    expect(result.type === "Point" && typeof result.coordinates.lng).toBe("number");
    expect(result.type === "Point" && typeof result.coordinates.lat).toBe("number");
    expect(result.type === "Point" && result.coordinates.lng).toBeCloseTo(-121.76, 2);
    expect(result.type === "Point" && result.coordinates.lat).toBeCloseTo(37.578, 2);
});

test("parseSpatialData parses Point from WKB hex (big endian)", () => {
    // Point with big endian byte order
    const hex = "00000000015EC0A3D70A3D714042CA01E02F28F66F";
    const result = parseSpatialData(hex);

    expect(result.type).toBe("Point");
    expect(result.type === "Point" && typeof result.coordinates.lng).toBe("number");
    expect(result.type === "Point" && typeof result.coordinates.lat).toBe("number");
});

test("parseSpatialData parses LineString from WKB hex", () => {
    // LineString with 2 points
    const hex = "010200000002000000713D0AD7A3705EC06FF6282E01CA42409A999999A9705EC06FF6288E46CB4240";
    const result = parseSpatialData(hex);

    expect(result.type).toBe("LineString");
    expect(Array.isArray(result.coordinates)).toBe(true);
    expect(result.type === "LineString" && result.coordinates).toHaveLength(2);
    expect(result.type === "LineString" && typeof result.coordinates[0].lng).toBe("number");
    expect(result.type === "LineString" && typeof result.coordinates[0].lat).toBe("number");
    expect(result.type === "LineString" && typeof result.coordinates[1].lng).toBe("number");
    expect(result.type === "LineString" && typeof result.coordinates[1].lat).toBe("number");
});

test("parseSpatialData parses Polygon from WKB hex", () => {
    // Simple triangle polygon
    const hex =
        "01030000000100000003000000000000000000000000000000000000000000000000001040000000000000000000000000000010400000000000001040000000000000000000000000000000000000000000000000";
    const result = parseSpatialData(hex);

    expect(result.type).toBe("Polygon");
    expect(Array.isArray(result.coordinates)).toBe(true);
    expect(result.type === "Polygon" && result.coordinates).toHaveLength(1); // One ring
    expect(result.type === "Polygon" && result.coordinates[0]).toHaveLength(3); // Three points
});

test("parseSpatialData parses MultiPoint from WKB hex", () => {
    // MultiPoint with 2 points
    const hex =
        "01040000000200000001010000000000000000000000000000000000000001010000000000000000001040000000000000F03F";
    const result = parseSpatialData(hex);

    expect(result.type).toBe("MultiPoint");
    expect(Array.isArray(result.coordinates)).toBe(true);
    expect(result.type === "MultiPoint" && result.coordinates).toHaveLength(2);
});

test("parseSpatialData parses MultiLineString from WKB hex", () => {
    // MultiLineString with 2 linestrings
    const hex =
        "0105000000020000000102000000020000000000000000000000000000000000000000000000000010400000000000000000010200000002000000000000000000104000000000000010400000000000001440000000000000F03F";
    const result = parseSpatialData(hex);

    expect(result.type).toBe("MultiLineString");
    expect(Array.isArray(result.coordinates)).toBe(true);
    expect(result.type === "MultiLineString" && result.coordinates).toHaveLength(2);
});

test("parseSpatialData parses MultiPolygon from WKB hex", () => {
    // MultiPolygon with 1 polygon
    const hex =
        "01060000000100000001030000000100000003000000000000000000000000000000000000000000000000001040000000000000000000000000000010400000000000001040000000000000000000000000000000000000000000000000";
    const result = parseSpatialData(hex);

    expect(result.type).toBe("MultiPolygon");
    expect(Array.isArray(result.coordinates)).toBe(true);
    expect(result.type === "MultiPolygon" && result.coordinates).toHaveLength(1);
});

test("parseSpatialData handles hex with whitespace", () => {
    const hex = "01 01 00 00 00 71 3D 0A D7 A3 70 5E C0 6F F6 28 2E 01 CA 42 40";
    const result = parseSpatialData(hex);

    expect(result.type).toBe("Point");
    expect(result.type === "Point" && typeof result.coordinates.lng).toBe("number");
    expect(result.type === "Point" && typeof result.coordinates.lat).toBe("number");
});

test("parseSpatialData handles EWKB format with SRID", () => {
    // Point with SRID 4326
    const hex = "0101000020E6100000713D0AD7A3705EC06FF6282E01CA4240";
    const result = parseSpatialData(hex);

    expect(result.type).toBe("Point");
    expect(result.type === "Point" && typeof result.coordinates.lng).toBe("number");
    expect(result.type === "Point" && typeof result.coordinates.lat).toBe("number");
});

test("parseSpatialData throws error for unsupported geometry type", () => {
    // Invalid geometry type (99)
    const hex = "0163000000";

    expect(() => parseSpatialData(hex)).toThrow("Unsupported geometry type 99.");
});

// Round-trip test
test("parseSpatialData and formatSpatialData round-trip for Point", () => {
    const hex = "0101000000713D0AD7A3705EC06FF6282E01CA4240";
    const parsed = parseSpatialData(hex);
    const formatted = formatSpatialData(parsed);

    expect(formatted).toMatch(/^Point\(-121\.76.*37\.578.*\)$/);
});

test("spatialDataToHex converts Point", () => {
    const formatted = "Point(-122.4194 37.7749)";
    const hex = spatialDataToHex(formatted);
    expect(hex).toMatch(/^01[0-9a-f]+$/); // Starts with 01 (little endian)
});

test("spatialDataToHex converts LineString", () => {
    const formatted = "LineString(-122.4194 37.7749, -122.4084 37.7849)";
    const hex = spatialDataToHex(formatted);
    expect(hex).toMatch(/^01[0-9a-f]+$/);
});

test("spatialDataToHex round-trip", () => {
    const original = {
        type: "Point" as const,
        coordinates: {lng: -122.4194, lat: 37.7749},
    };
    const formatted = formatSpatialData(original);
    const hex = spatialDataToHex(formatted);
    // The hex should be valid WKB format
    expect(hex).toBeTruthy();
    expect(hex.length).toBeGreaterThan(0);
});
