type Point = {
    type: "Point";
    coordinates: [number, number];
    crs?: {
        type: string;
        properties: {
            name: string;
        };
    };
};

type LineString = {
    type: "LineString";
    coordinates: [number, number][];
    crs?: {
        type: string;
        properties: {
            name: string;
        };
    };
};

type Polygon = {
    type: "Polygon";
    coordinates: [number, number][][];
    crs?: {
        type: string;
        properties: {
            name: string;
        };
    };
};

type MultiPoint = {
    type: "MultiPoint";
    coordinates: [number, number][];
    crs?: {
        type: string;
        properties: {
            name: string;
        };
    };
};

type MultiLineString = {
    type: "MultiLineString";
    coordinates: [number, number][][];
    crs?: {
        type: string;
        properties: {
            name: string;
        };
    };
};

type MultiPolygon = {
    type: "MultiPolygon";
    coordinates: [number, number][][][];
    crs?: {
        type: string;
        properties: {
            name: string;
        };
    };
};

export type GeoJSONGeometry = Point | LineString | Polygon | MultiPoint | MultiLineString | MultiPolygon;

export const formatGeometryData = (geom: GeoJSONGeometry): string => {
    const formatCoordinate = (coord: [number, number]): string => {
        return coord.join(" ");
    };

    const formatCoordinates = (coords: [number, number][]): string => {
        return coords.map(formatCoordinate).join(", ");
    };

    const formatPolygon = (rings: [number, number][][]): string => {
        return rings.map((ring) => `(${formatCoordinates(ring)})`).join(", ");
    };

    switch (geom.type) {
        case "Point":
            return `Point(${formatCoordinate(geom.coordinates)})`;

        case "LineString":
            return `LineString(${formatCoordinates(geom.coordinates)})`;

        case "Polygon":
            return `Polygon(${formatPolygon(geom.coordinates)})`;

        case "MultiPoint":
            return `MultiPoint(${formatCoordinates(geom.coordinates)})`;

        case "MultiLineString":
            return `MultiLineString(${formatPolygon(geom.coordinates)})`;

        case "MultiPolygon":
            const polygons = geom.coordinates.map((polygon) => `(${formatPolygon(polygon)})`).join(", ");
            return `MultiPolygon(${polygons})`;
    }
};
