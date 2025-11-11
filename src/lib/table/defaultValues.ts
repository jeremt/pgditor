export const pgDefaultValues = {
    // 🧮 Numeric
    smallint: 0,
    integer: 0,
    bigint: 0n, // BigInt for 64-bit integers
    decimal: "0.0",
    numeric: "0.0",
    real: 0.0,
    double_precision: 0.0,
    smallserial: 1,
    serial: 1,
    bigserial: 1n,
    money: "0.00",

    // 🔤 Character
    character: "",
    character_varying: "",
    text: "",

    // 📅 Date / Time
    date: "1970-01-01",
    time: "00:00:00",
    timetz: "00:00:00+00",
    timestamp: "1970-01-01 00:00:00",
    timestamptz: "1970-01-01 00:00:00+00",
    interval: "0 days",

    // ✅ Boolean
    boolean: false,

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
    uuid: "00000000-0000-0000-0000-000000000000",

    // 📚 Arrays
    integer_array: [0],
    text_array: [""],
    uuid_array: ["00000000-0000-0000-0000-000000000000"],

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

export type PgType = keyof typeof pgDefaultValues;
