interface Coordinate {
    lng: number;
    lat: number;
}

type ParsedGeometry =
    | {type: "Point"; coordinates: Coordinate}
    | {type: "LineString"; coordinates: Coordinate[]}
    | {type: "Polygon"; coordinates: Coordinate[][]}
    | {type: "MultiPoint"; coordinates: Coordinate[]}
    | {type: "MultiLineString"; coordinates: Coordinate[][]}
    | {type: "MultiPolygon"; coordinates: Coordinate[][][]};

export function parseSpatialData(hexString: string): ParsedGeometry {
    const cleanHex = hexString.replace(/\s/g, "");
    const bytes = hexToBytes(cleanHex);

    let offset = 0;

    // Read byte order (1 byte)
    const byteOrder = bytes[offset++];
    const isLittleEndian = byteOrder === 1;

    // Read geometry type (4 bytes)
    const geomType = readUInt32(bytes, offset, isLittleEndian);
    offset += 4;

    // Check for SRID (PostGIS EWKB format)
    const hasSRID = (geomType & 0x20000000) !== 0;
    const baseType = geomType & 0x0000ffff;

    if (hasSRID) {
        offset += 4; // Skip SRID
    }

    const type = getGeometryType(baseType);

    switch (type) {
        case "Point":
            return {type, coordinates: parsePoint(bytes, offset, isLittleEndian).coordinates};
        case "LineString":
            return {type, coordinates: parseLineString(bytes, offset, isLittleEndian).coordinates};
        case "Polygon":
            return {type, coordinates: parsePolygon(bytes, offset, isLittleEndian).coordinates};
        case "MultiPoint":
            return {type, coordinates: parseMultiPoint(bytes, offset, isLittleEndian).coordinates};
        case "MultiLineString":
            return {type, coordinates: parseMultiLineString(bytes, offset, isLittleEndian).coordinates};
        case "MultiPolygon":
            return {type, coordinates: parseMultiPolygon(bytes, offset, isLittleEndian).coordinates};
    }

    function parsePoint(bytes: Uint8Array, offset: number, isLittleEndian: boolean) {
        const lng = readDouble(bytes, offset, isLittleEndian);
        const lat = readDouble(bytes, offset + 8, isLittleEndian);
        return {
            coordinates: {lng, lat},
            bytesRead: 16,
        };
    }

    function parseLineString(bytes: Uint8Array, offset: number, isLittleEndian: boolean) {
        const numPoints = readUInt32(bytes, offset, isLittleEndian);
        offset += 4;

        const coordinates: Coordinate[] = [];
        for (let i = 0; i < numPoints; i++) {
            const lng = readDouble(bytes, offset, isLittleEndian);
            const lat = readDouble(bytes, offset + 8, isLittleEndian);
            coordinates.push({lng, lat});
            offset += 16;
        }

        return {coordinates, bytesRead: 4 + numPoints * 16};
    }

    function parsePolygon(bytes: Uint8Array, offset: number, isLittleEndian: boolean) {
        const numRings = readUInt32(bytes, offset, isLittleEndian);
        offset += 4;
        let totalBytes = 4;

        const coordinates: Coordinate[][] = [];
        for (let i = 0; i < numRings; i++) {
            const result = parseLineString(bytes, offset, isLittleEndian);
            coordinates.push(result.coordinates as Coordinate[]);
            offset += result.bytesRead;
            totalBytes += result.bytesRead;
        }

        return {coordinates, bytesRead: totalBytes};
    }

    function parseMultiPoint(bytes: Uint8Array, offset: number, isLittleEndian: boolean) {
        const numPoints = readUInt32(bytes, offset, isLittleEndian);
        offset += 4;
        let totalBytes = 4;

        const coordinates: Coordinate[] = [];
        for (let i = 0; i < numPoints; i++) {
            offset += 5; // Skip byte order + type
            const result = parsePoint(bytes, offset, isLittleEndian);
            coordinates.push(result.coordinates as Coordinate);
            offset += result.bytesRead;
            totalBytes += 5 + result.bytesRead;
        }

        return {coordinates, bytesRead: totalBytes};
    }

    function parseMultiLineString(bytes: Uint8Array, offset: number, isLittleEndian: boolean) {
        const numLineStrings = readUInt32(bytes, offset, isLittleEndian);
        offset += 4;
        let totalBytes = 4;

        const coordinates: Coordinate[][] = [];
        for (let i = 0; i < numLineStrings; i++) {
            offset += 5; // Skip byte order + type
            const result = parseLineString(bytes, offset, isLittleEndian);
            coordinates.push(result.coordinates as Coordinate[]);
            offset += result.bytesRead;
            totalBytes += 5 + result.bytesRead;
        }

        return {coordinates, bytesRead: totalBytes};
    }

    function parseMultiPolygon(bytes: Uint8Array, offset: number, isLittleEndian: boolean) {
        const numPolygons = readUInt32(bytes, offset, isLittleEndian);
        offset += 4;
        let totalBytes = 4;

        const coordinates: Coordinate[][][] = [];
        for (let i = 0; i < numPolygons; i++) {
            offset += 5; // Skip byte order + type
            const result = parsePolygon(bytes, offset, isLittleEndian);
            coordinates.push(result.coordinates as Coordinate[][]);
            offset += result.bytesRead;
            totalBytes += 5 + result.bytesRead;
        }

        return {coordinates, bytesRead: totalBytes};
    }
}

export function formatSpatialData(geometry: ParsedGeometry): string {
    return `${geometry.type}(${formatCoordinates(geometry.coordinates, geometry.type)})`;
}

function formatCoordinates(
    coords: Coordinate | Coordinate[] | Coordinate[][] | Coordinate[][][],
    geometryType: string,
): string {
    // Point: {lng, lat} - no parentheses around the coordinate
    if (!Array.isArray(coords)) {
        return `${coords.lng} ${coords.lat}`;
    }

    // Check if it's an array of Coordinates (LineString/MultiPoint)
    if (coords.length > 0 && !Array.isArray(coords[0])) {
        const coordList = (coords as Coordinate[]).map((c) => `${c.lng} ${c.lat}`).join(", ");

        // MultiPoint wraps each coordinate in parentheses
        if (geometryType === "MultiPoint") {
            return (coords as Coordinate[]).map((c) => `(${c.lng} ${c.lat})`).join(", ");
        }
        // LineString doesn't wrap coordinates
        return coordList;
    }

    // Check if it's an array of array of Coordinates (Polygon/MultiLineString)
    if (coords.length > 0 && Array.isArray(coords[0]) && !Array.isArray(coords[0][0])) {
        return (coords as Coordinate[][])
            .map((ring) => `(${ring.map((c) => `${c.lng} ${c.lat}`).join(", ")})`)
            .join(", ");
    }

    // MultiPolygon: array of array of array of Coordinates
    // Each polygon gets wrapped in double parens: ((...))
    return (coords as Coordinate[][][])
        .map(
            (polygon) =>
                `(${polygon.map((ring) => `(${ring.map((c) => `${c.lng} ${c.lat}`).join(", ")})`).join(", ")})`,
        )
        .join(", ");
}

// Utility functions
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

function readUInt32(bytes: Uint8Array, offset: number, isLittleEndian: boolean): number {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 4);
    return view.getUint32(0, isLittleEndian);
}

function readDouble(bytes: Uint8Array, offset: number, isLittleEndian: boolean): number {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
    return view.getFloat64(0, isLittleEndian);
}

function getGeometryType(type: number) {
    const types = {
        1: "Point",
        2: "LineString",
        3: "Polygon",
        4: "MultiPoint",
        5: "MultiLineString",
        6: "MultiPolygon",
    } as const;
    const typeName = types[type as 1 | 2 | 3 | 4 | 5 | 6];
    if (typeName === undefined) {
        throw new Error(`Unsupported geometry type ${type}.`);
    }
    return typeName;
}

export function spatialDataToHex(formattedString: string): string {
    const parsed = parsePostGISString(formattedString);
    return geometryToWKB(parsed);
}

function parsePostGISString(str: string): ParsedGeometry {
    // Extract geometry type and coordinates string
    const match = str.match(/^(\w+)\((.+)\)$/);
    if (!match) {
        throw new Error(`Invalid PostGIS string: ${str}`);
    }

    const [, type, coordsStr] = match;

    switch (type) {
        case "Point":
            return {
                type: "Point",
                coordinates: parsePoint(coordsStr),
            };
        case "LineString":
            return {
                type: "LineString",
                coordinates: parseLineString(coordsStr),
            };
        case "Polygon":
            return {
                type: "Polygon",
                coordinates: parsePolygon(coordsStr),
            };
        case "MultiPoint":
            return {
                type: "MultiPoint",
                coordinates: parseMultiPoint(coordsStr),
            };
        case "MultiLineString":
            return {
                type: "MultiLineString",
                coordinates: parseMultiLineString(coordsStr),
            };
        case "MultiPolygon":
            return {
                type: "MultiPolygon",
                coordinates: parseMultiPolygon(coordsStr),
            };
        default:
            throw new Error(`Unsupported geometry type: ${type}`);
    }
    function parsePoint(str: string): Coordinate {
        const [lng, lat] = str.trim().split(/\s+/).map(Number);
        return {lng, lat};
    }

    function parseLineString(str: string): Coordinate[] {
        return str.split(",").map((pair) => {
            const [lng, lat] = pair.trim().split(/\s+/).map(Number);
            return {lng, lat};
        });
    }

    function parsePolygon(str: string): Coordinate[][] {
        // Remove outer parentheses and split by rings
        const rings = splitRings(str);
        return rings.map((ring) => parseLineString(ring));
    }

    function parseMultiPoint(str: string): Coordinate[] {
        // Each point is wrapped in parentheses: (-122.4 37.8), (-122.5 37.9)
        return str.split(/\),\s*\(/).map((s) => {
            const cleaned = s.replace(/[()]/g, "").trim();
            return parsePoint(cleaned);
        });
    }

    function parseMultiLineString(str: string): Coordinate[][] {
        const lineStrings = splitRings(str);
        return lineStrings.map((ls) => parseLineString(ls));
    }

    function parseMultiPolygon(str: string): Coordinate[][][] {
        // Split by top-level polygons: ((ring)), ((ring))
        const polygons: string[] = [];
        let depth = 0;
        let currentPolygon = "";

        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === "(") depth++;
            if (char === ")") depth--;

            currentPolygon += char;

            // When we close a polygon (depth returns to 0 after opening)
            if (depth === 0 && currentPolygon.trim()) {
                polygons.push(currentPolygon.trim());
                currentPolygon = "";
                // Skip comma and space
                if (str[i + 1] === "," && str[i + 2] === " ") {
                    i += 2;
                }
            }
        }

        return polygons.map((polygon) => {
            // Remove outer parens from ((ring1), (ring2))
            const inner = polygon.slice(1, -1);
            const rings = splitRings(inner);
            return rings.map((ring) => parseLineString(ring));
        });
    }
}

function splitRings(str: string): string[] {
    const rings: string[] = [];
    let depth = 0;
    let currentRing = "";

    for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (char === "(") {
            depth++;
            if (depth === 1) continue; // Skip opening paren
        }

        if (char === ")") {
            depth--;
            if (depth === 0) {
                rings.push(currentRing.trim());
                currentRing = "";
                // Skip comma and space after closing paren
                if (str[i + 1] === "," && str[i + 2] === " ") {
                    i += 2;
                }
                continue;
            }
        }

        if (depth > 0) {
            currentRing += char;
        }
    }

    return rings;
}

function geometryToWKB(geometry: ParsedGeometry): string {
    const buffer: number[] = [];

    // Byte order (1 = little endian)
    buffer.push(1);

    // Geometry type codes
    const typeMap: Record<string, number> = {
        Point: 1,
        LineString: 2,
        Polygon: 3,
        MultiPoint: 4,
        MultiLineString: 5,
        MultiPolygon: 6,
    };

    const typeCode = typeMap[geometry.type];
    writeUInt32LE(buffer, typeCode);

    switch (geometry.type) {
        case "Point":
            writePoint(buffer, geometry.coordinates);
            break;
        case "LineString":
            writeLineString(buffer, geometry.coordinates);
            break;
        case "Polygon":
            writePolygon(buffer, geometry.coordinates);
            break;
        case "MultiPoint":
            writeMultiPoint(buffer, geometry.coordinates);
            break;
        case "MultiLineString":
            writeMultiLineString(buffer, geometry.coordinates);
            break;
        case "MultiPolygon":
            writeMultiPolygon(buffer, geometry.coordinates);
            break;
    }

    return buffer.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function writePoint(buffer: number[], coord: Coordinate): void {
    writeDouble(buffer, coord.lng);
    writeDouble(buffer, coord.lat);
}

function writeLineString(buffer: number[], coords: Coordinate[]): void {
    writeUInt32LE(buffer, coords.length);
    coords.forEach((coord) => writePoint(buffer, coord));
}

function writePolygon(buffer: number[], rings: Coordinate[][]): void {
    writeUInt32LE(buffer, rings.length);
    rings.forEach((ring) => writeLineString(buffer, ring));
}

function writeMultiPoint(buffer: number[], coords: Coordinate[]): void {
    writeUInt32LE(buffer, coords.length);
    coords.forEach((coord) => {
        buffer.push(1); // Byte order
        writeUInt32LE(buffer, 1); // Point type
        writePoint(buffer, coord);
    });
}

function writeMultiLineString(buffer: number[], lineStrings: Coordinate[][]): void {
    writeUInt32LE(buffer, lineStrings.length);
    lineStrings.forEach((ls) => {
        buffer.push(1); // Byte order
        writeUInt32LE(buffer, 2); // LineString type
        writeLineString(buffer, ls);
    });
}

function writeMultiPolygon(buffer: number[], polygons: Coordinate[][][]): void {
    writeUInt32LE(buffer, polygons.length);
    polygons.forEach((polygon) => {
        buffer.push(1); // Byte order
        writeUInt32LE(buffer, 3); // Polygon type
        writePolygon(buffer, polygon);
    });
}

function writeUInt32LE(buffer: number[], value: number): void {
    buffer.push(value & 0xff);
    buffer.push((value >> 8) & 0xff);
    buffer.push((value >> 16) & 0xff);
    buffer.push((value >> 24) & 0xff);
}

function writeDouble(buffer: number[], value: number): void {
    const float64 = new Float64Array([value]);
    const bytes = new Uint8Array(float64.buffer);
    for (let i = 0; i < 8; i++) {
        buffer.push(bytes[i]);
    }
}
