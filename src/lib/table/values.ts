import type {PgColumn} from "./pgContext.svelte";

export const defaultValues = {
    smallint: 0,
    integer: 0,
    bigint: 0n, // BigInt for 64-bit integers
    int2: 0,
    int4: 0,
    int8: 0n, // BigInt for 64-bit integers
    smallserial: 1,
    serial: 1,
    bigserial: 1n,

    float4: 0.0,
    float8: 0.0,

    numeric: "0.0",

    // 🔤 Character
    character: "",
    character_varying: "",
    text: "",
    varchar: "",

    // 📅 Date / Time
    date: "1970-01-01",
    time: "00:00:00",
    timetz: "00:00:00+00",
    timestamp: "1970-01-01 00:00:00",
    timestamptz: "1970-01-01 00:00:00+00",
    interval: "0 days",

    // ✅ Boolean
    boolean: false,
    bool: false,

    // 🧩 Geometric
    point: {x: 0, y: 0},
    line: "[0,0,0]",
    lseg: "[(0,0),(1,1)]",
    box: "((0,0),(1,1))",
    path: "((0,0),(1,1))",
    polygon: "((0,0),(1,1),(1,0))",
    circle: "<(0,0),1>",

    // 🌐 Network
    cidr: "192.168.0.0/24",
    inet: "127.0.0.1",
    macaddr: "00:00:00:00:00:00",
    macaddr8: "00:00:00:00:00:00:00:00",

    // 💾 Binary
    bytea: new Uint8Array([]), // or Uint8Array

    // 🧱 Bit Strings
    bit: "0",
    varbit: "0",

    // 📜 Text Search
    tsvector: "'example':1",
    tsquery: "'example'",

    // 🧬 JSON / XML
    json: {},
    jsonb: {},
    xml: "<root></root>",

    // 🗂️ UUID
    uuid: crypto.randomUUID(),

    // 📚 Arrays
    integer_array: [0],
    text_array: [""],
    uuid_array: [crypto.randomUUID()],

    // 🗝️ Range Types
    int4range: "[0,10)",
    int8range: "[0,10)",
    numrange: "[0.0,1.0)",
    tsrange: "['1970-01-01 00:00:00','1970-01-02 00:00:00')",
    tstzrange: "['1970-01-01 00:00:00+00','1970-01-02 00:00:00+00')",
    daterange: "['1970-01-01','1970-01-02')",

    // 🧮 Composite (placeholder)
    composite: {field1: null},

    // 📦 System / Special Types
    oid: 0,
    regclass: "pg_class",
    regtype: "text",
    regproc: "now",
    pg_lsn: "0/00000000",
    txid_snapshot: "0:0:",
    jsonpath: "$.example",

    // 🧠 Vector (pgvector extension)
    vector: [0.0, 0.0, 0.0],
} as const;

export type PgType = keyof typeof defaultValues;

export const sqlToValue = (column: Pick<PgColumn, "data_type">, sql: string): unknown => {
    // strip explicit type casts
    if (sql.startsWith("'") && sql.endsWith(`'::${column.data_type}`)) {
        const result = sql.slice(1, sql.length - `'::${column.data_type}`.length);
        return sqlToValue(column, result);
    }
    if (column.data_type === "json" || column.data_type === "jsonb") {
        return JSON.parse(sql);
    }
    return sql;
};

export const valueTypeIsInteger = (data_type: PgType) => {
    return (
        data_type === "smallint" ||
        data_type === "integer" ||
        data_type === "bigint" ||
        data_type === "int2" ||
        data_type === "int4" ||
        data_type === "int8" ||
        data_type === "smallserial" ||
        data_type === "serial" ||
        data_type === "bigserial"
    );
};

export const valueTypeIsFloat = (data_type: PgType) => {
    return data_type === "float4" || data_type === "float8";
};

export const valueTypeIsNumber = (data_type: PgType) => {
    return valueTypeIsFloat(data_type) || valueTypeIsInteger(data_type);
};

export const valueTypeIsBoolean = (data_type: PgType) => {
    return data_type === "bool" || data_type === "boolean";
};

export const valueTypeIsDate = (data_type: PgType) => {
    return (
        data_type === "date" ||
        data_type === "time" ||
        data_type === "timetz" ||
        data_type === "timestamp" ||
        data_type === "timestamptz"
    );
};

export const valueToSql = (column: Pick<PgColumn, "data_type">, value: any): string => {
    // Handle NULL values
    if (value === null || value === undefined) {
        return "NULL";
    }

    const type = column.data_type;

    // 🧠 Vector type (pgvector) - MUST be checked before array types
    if (type === "vector") {
        if (Array.isArray(value)) {
            return `'[${value.join(",")}]'`;
        }
        return `'${value}'`;
    }

    // 📅 Interval (preserve ISO 8601 duration T separator)
    if (type === "interval") {
        const escaped = String(value).replace(/'/g, "''");
        return `'${escaped}'`;
    }

    // 📅 Date/Time types Convert ISO 8601 format to PostgreSQL format (replace T with space)
    if (valueTypeIsDate(type)) {
        const pgFormat = String(value).replace("T", " ");
        const escaped = pgFormat.replace(/'/g, "''");
        return `'${escaped}'`;
    }

    // 🔤 String types (need quoting and escaping)
    if (
        [
            "character",
            "character_varying",
            "text",
            "cidr",
            "inet",
            "macaddr",
            "macaddr8",
            "uuid",
            "xml",
            "bit",
            "varbit",
            "tsquery",
            "jsonpath",
            "regclass",
            "regtype",
            "regproc",
            "pg_lsn",
            "txid_snapshot",
        ].includes(type)
    ) {
        const escaped = String(value).replace(/'/g, "''");
        return `'${escaped}'`;
    }

    // 📜 tsvector - special case, already contains single quotes that shouldn't be escaped
    if (type === "tsvector") {
        return `'${value}'`;
    }

    // 🧬 JSON types
    if (type === "json" || type === "jsonb") {
        const escaped = JSON.stringify(value).replace(/'/g, "''");
        return `'${escaped}'`;
    }

    // 🧩 Geometric types (string representation)
    if (["line", "lseg", "box", "path", "polygon", "circle"].includes(type)) {
        return `'${value}'`;
    }

    // 🧩 Point type (special handling)
    if (type === "point") {
        if (typeof value === "object" && "x" in value && "y" in value) {
            return `'(${value.x},${value.y})'`;
        }
        return `'${value}'`;
    }

    // 💾 Binary data
    if (type === "bytea") {
        if (value instanceof Uint8Array) {
            const hex = Array.from(value)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
            return `'\\x${hex}'`;
        }
        return `'\\x${value}'`;
    }

    // 🧮 BigInt types
    if (type === "bigint" || type === "int8" || type === "bigserial") {
        return String(value).replace("n", "");
    }

    // 📚 Array types
    if (type.includes("_array") || Array.isArray(value)) {
        const arrayElements = value.map((item: any) => {
            if (item === null) return "NULL";
            if (type === "text_array" || type === "uuid_array") {
                return `"${String(item).replace(/"/g, '\\"')}"`;
            }
            return item;
        });
        return `'{${arrayElements.join(",")}}'`;
    }

    // 🗝️ Range types
    if (type.includes("range")) {
        return `'${value}'`;
    }

    // ✅ Boolean
    if (valueTypeIsBoolean(type)) {
        return value === true ? "true" : value === false ? "false" : value;
    }

    // 🧮 Numeric types (no quoting needed)
    if (valueTypeIsNumber(type)) {
        return String(value);
    }

    // 🧱 Composite types
    if (type === "composite") {
        const values = Object.values(value).map((v) => (v === null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`));
        return `ROW(${values.join(",")})`;
    }

    // enums
    // check if already shaped like an enum value
    if (value.includes(`::${type}`)) {
        return value;
    }
    return `'${value}'::${type}`;
};
