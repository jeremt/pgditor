import type {PgColumn, PgValue} from "./pg_context.svelte";

export const default_values = {
    smallint: 0,
    integer: 0,
    bigint: "0", // string, like get_table_data sends 64-bit integers
    int2: 0,
    int4: 0,
    int8: "0",
    smallserial: 1,
    serial: 1,
    bigserial: "1",

    float4: 0.0, // float
    float8: 0.0, // double

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
    timestamp: "1970-01-01T00:00:00",
    timestamptz: "1970-01-01T00:00:00.0+00:00",
    interval: "0 days",

    // ✅ Boolean
    boolean: false,
    bool: false,

    geography: "",
    geometry: "",

    // 💾 Binary
    bytea: new Uint8Array([]), // or Uint8Array

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
    tsrange: '["1970-01-01 00:00:00","1970-01-02 00:00:00")',
    tstzrange: '["1970-01-01 00:00:00+00","1970-01-02 00:00:00+00")',
    daterange: "[1970-01-01,1970-01-02)",

    // 🧠 Vector (pgvector extension)
    vector: [0.0, 0.0, 0.0],
} as const;

export type PgType = keyof typeof default_values;

/**
 * Array columns are named `_<element type>` in pg_type (e.g. `_text` for `text[]`).
 */
export const value_type_is_array = (data_type: PgType) => data_type.startsWith("_");

/**
 * The value to start from when the user sets a column that has no value.
 */
export const default_value = (column: Pick<PgColumn, "data_type">): PgValue =>
    value_type_is_array(column.data_type) ? [] : ((default_values[column.data_type] as PgValue) ?? "");

/**
 * Parse a postgres array literal (e.g. `{a,"b c",NULL,{1,2}}`), or return undefined if it isn't one.
 */
export const parse_array_literal = (text: string): unknown[] | undefined => {
    if (!text.startsWith("{")) {
        return undefined;
    }
    let i = 0;
    const parse_array = (): unknown[] => {
        const items: unknown[] = [];
        i++; // opening brace
        while (i < text.length && text[i] !== "}") {
            if (text[i] === "{") {
                items.push(parse_array());
            } else if (text[i] === '"') {
                let item = "";
                for (i++; i < text.length && text[i] !== '"'; i++) {
                    if (text[i] === "\\") i++;
                    item += text[i];
                }
                i++; // closing quote
                items.push(item);
            } else {
                let item = "";
                for (; i < text.length && text[i] !== "," && text[i] !== "}"; i++) {
                    item += text[i];
                }
                items.push(item.trim().toUpperCase() === "NULL" ? null : item.trim());
            }
            if (text[i] === ",") i++;
        }
        i++; // closing brace
        return items;
    };
    return parse_array();
};

export const sql_to_value = (column: Pick<PgColumn, "data_type">, sql: string): unknown => {
    // unwrap quoted literals and their cast, which postgres doesn't always name like pg_type
    // (e.g. `'draft'::character varying` for a varchar or `'{}'::text[]` for a _text)
    const literal = sql.match(/^'((?:[^']|'')*)'(::.+)?$/);
    const value = literal ? literal[1].replace(/''/g, "'") : sql;
    if (column.data_type === "json" || column.data_type === "jsonb") {
        return JSON.parse(value);
    }
    if (literal && value_type_is_array(column.data_type)) {
        return parse_array_literal(value) ?? value;
    }
    return value;
};

export const value_type_is_integer = (data_type: PgType) => {
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

/**
 * Integers that JavaScript numbers can't hold exactly, so `get_table_data` sends them as strings.
 */
export const value_type_is_bigint = (data_type: PgType) => {
    return data_type === "bigint" || data_type === "int8" || data_type === "bigserial";
};

export const value_type_is_float = (data_type: PgType) => {
    return data_type === "float4" || data_type === "float8";
};

export const value_type_is_number = (data_type: PgType) => {
    return value_type_is_float(data_type) || value_type_is_integer(data_type);
};

export const value_type_is_boolean = (data_type: PgType) => {
    return data_type === "bool" || data_type === "boolean";
};

export const value_type_is_textish = (data_type: PgType) => {
    return (
        data_type === "varchar" ||
        data_type === "character" ||
        data_type === "character_varying" ||
        data_type === "text"
    );
};

export const value_type_is_date = (data_type: PgType) => {
    return (
        data_type === "date" ||
        data_type === "time" ||
        data_type === "timetz" ||
        data_type === "timestamp" ||
        data_type === "timestamptz"
    );
};

/**
 * Wrap the given identifier (column, table, schema...) in double quotes, doubling the quotes it contains.
 */
export const quote_ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * Wrap the given value in single quotes, doubling the quotes it contains.
 */
export const quote_literal = (value: unknown) => `'${String(value).replace(/'/g, "''")}'`;

/**
 * Format a JS array as a postgres array literal (e.g. `{1,"a b",NULL}`), without the outer quotes.
 */
const to_array_literal = (value: unknown[]): string =>
    `{${value
        .map((item) => {
            if (item === null || item === undefined) return "NULL";
            if (Array.isArray(item)) return to_array_literal(item);
            if (typeof item === "number" || typeof item === "bigint" || typeof item === "boolean") {
                return String(item);
            }
            const text = typeof item === "object" ? JSON.stringify(item) : String(item);
            return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
        })
        .join(",")}}`;

// `character` and `character varying` are named `bpchar` and `varchar` in pg_type
const TEXT_TYPES = ["character", "character_varying", "bpchar", "varchar", "text", "xml", "tsquery", "tsvector"];

export const value_to_sql = (column: Pick<PgColumn, "data_type">, value: any): string => {
    // Handle NULL values
    if (value === null || value === undefined) {
        return "null";
    }

    const type = column.data_type;

    // 🧠 Vector type (pgvector) - MUST be checked before array types
    if (type === "vector") {
        if (Array.isArray(value)) {
            return `'[${value.join(",")}]'`;
        }
        return `'${value}'`;
    }

    // Interval (preserve ISO 8601 duration T separator)
    if (type === "interval") {
        return quote_literal(value);
    }

    // Date/Time types Convert ISO 8601 format to PostgreSQL format (replace T with space)
    if (value_type_is_date(type)) {
        return quote_literal(String(value).replace("T", " "));
    }

    // String types (need quoting and escaping)
    if (type === "uuid") {
        return `${quote_literal(value)}::uuid`;
    }
    if (TEXT_TYPES.includes(type)) {
        return quote_literal(value);
    }

    // 🧬 JSON types
    if (type === "json" || type === "jsonb") {
        return quote_literal(JSON.stringify(value));
    }

    // 💾 Binary data
    if (type === "bytea") {
        if (value instanceof Uint8Array) {
            const hex = Array.from(value)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
            return `'\\x${hex}'`;
        }
        // postgres returns bytea already prefixed with \x
        return quote_literal(`\\x${String(value).replace(/^\\x/, "")}`);
    }

    // Remove JS n anotation to send numbers to PG
    if (type === "bigint" || type === "int8" || type === "bigserial") {
        return String(value).replace("n", "");
    }

    // 📚 Array types (named `_<element type>` in pg_type, e.g. `_int4`)
    if (Array.isArray(value)) {
        return quote_literal(to_array_literal(value));
    }
    if (type.startsWith("_")) {
        return quote_literal(value);
    }

    // ✅ Boolean
    if (value_type_is_boolean(type)) {
        return value === true ? "true" : value === false ? "false" : value;
    }

    // Numeric types (no quoting needed), `numeric` is also returned as a number by row_to_json
    if (value_type_is_number(type) || typeof value === "number" || typeof value === "bigint") {
        return String(value);
    }

    // a cast to `bit` means `bit(1)`, without cast the literal takes the length of the column
    if ((type as string) === "bit") {
        return quote_literal(value);
    }

    // check if already using explicit cast
    if (typeof value === "string" && value.endsWith(`::${type}`)) {
        return value;
    }
    // Handle objects (JSON stringify for any unknown object types)
    if (typeof value === "object") {
        return `${quote_literal(JSON.stringify(value))}::${type}`;
    }

    // otherwise, explicitly cast and wrap in quote special types
    return `${quote_literal(value)}::${type}`;
};

/**
 * Build the condition matching the given rows by their primary key, which can span several columns.
 *
 * e.g. `("a", "b") in ((1, 'x'), (2, 'y'))`
 */
export const primary_key_condition = (primary_keys: PgColumn[], rows: Record<string, unknown>[]) =>
    `(${primary_keys.map((pk) => quote_ident(pk.column_name)).join(", ")}) in (${rows
        .map((row) => `(${primary_keys.map((pk) => value_to_sql(pk, row[pk.column_name])).join(", ")})`)
        .join(", ")})`;
