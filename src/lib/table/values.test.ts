import {describe, expect, it} from "vitest";
import {
    default_value,
    parse_array_literal,
    primary_key_condition,
    quote_ident,
    sql_to_value,
    value_to_sql,
} from "./values";
import type {PgColumn} from "./pg_context.svelte";

describe("formatValue", () => {
    // Helper to create a column
    const makeColumn = (data_type: string): PgColumn => ({
        column_name: "test_column",
        data_type: data_type as any,
        data_type_params: null,
        is_nullable: "YES",
        is_primary_key: "NO",
        column_default: null,
        enum_values: null,
        foreign_column_name: null,
        foreign_table_name: null,
        foreign_table_schema: null,
    });

    describe("NULL handling", () => {
        it("should return NULL for null values", () => {
            expect(value_to_sql(makeColumn("text"), null)).toBe("NULL");
        });

        it("should return NULL for undefined values", () => {
            expect(value_to_sql(makeColumn("integer"), undefined)).toBe("NULL");
        });
    });

    describe("🧮 Numeric types", () => {
        it("should format smallint without quotes", () => {
            expect(value_to_sql(makeColumn("smallint"), 42)).toBe("42");
        });

        it("should format integer without quotes", () => {
            expect(value_to_sql(makeColumn("integer"), 12345)).toBe("12345");
        });

        it("should format bigint and remove n suffix", () => {
            expect(value_to_sql(makeColumn("bigint"), 9007199254740991n)).toBe("9007199254740991");
        });

        it("should format bigserial and remove n suffix", () => {
            expect(value_to_sql(makeColumn("bigserial"), 123n)).toBe("123");
        });

        it("should format numeric as string", () => {
            expect(value_to_sql(makeColumn("numeric"), "0.123456789")).toBe("0.123456789");
        });

        it("should format real", () => {
            expect(value_to_sql(makeColumn("real"), 3.14)).toBe("3.14");
        });

        it("should format double_precision", () => {
            expect(value_to_sql(makeColumn("double_precision"), 2.718281828)).toBe("2.718281828");
        });

        it("should format smallserial", () => {
            expect(value_to_sql(makeColumn("smallserial"), 1)).toBe("1");
        });

        it("should format serial", () => {
            expect(value_to_sql(makeColumn("serial"), 100)).toBe("100");
        });

        it("should format money with quotes", () => {
            expect(value_to_sql(makeColumn("money"), "123.45")).toBe("'123.45'");
        });

        it("should format oid", () => {
            expect(value_to_sql(makeColumn("oid"), 16384)).toBe("16384");
        });
    });

    describe("🔤 Character types", () => {
        it("should format character with quotes", () => {
            expect(value_to_sql(makeColumn("character"), "A")).toBe("'A'");
        });

        it("should format character_varying with quotes", () => {
            expect(value_to_sql(makeColumn("character_varying"), "Hello World")).toBe("'Hello World'");
        });

        it("should format text with quotes", () => {
            expect(value_to_sql(makeColumn("text"), "Sample text")).toBe("'Sample text'");
        });

        it("should escape single quotes in text", () => {
            expect(value_to_sql(makeColumn("text"), "It's a test")).toBe("'It''s a test'");
        });

        it("should escape multiple single quotes", () => {
            expect(value_to_sql(makeColumn("text"), "O'Brien's test")).toBe("'O''Brien''s test'");
        });
    });

    describe("📅 Date/Time types", () => {
        it("should format date with quotes", () => {
            expect(value_to_sql(makeColumn("date"), "2025-01-15")).toBe("'2025-01-15'");
        });

        it("should format time with quotes", () => {
            expect(value_to_sql(makeColumn("time"), "14:30:00")).toBe("'14:30:00'");
        });

        it("should format timetz with quotes", () => {
            expect(value_to_sql(makeColumn("timetz"), "14:30:00+02")).toBe("'14:30:00+02'");
        });

        it("should format timestamp with quotes", () => {
            expect(value_to_sql(makeColumn("timestamp"), "2025-01-15 14:30:00")).toBe("'2025-01-15 14:30:00'");
        });

        it("should format timestamptz with quotes", () => {
            expect(value_to_sql(makeColumn("timestamptz"), "2025-01-15 14:30:00+00")).toBe("'2025-01-15 14:30:00+00'");
        });

        it("should format interval with quotes", () => {
            expect(value_to_sql(makeColumn("interval"), "2 days 3 hours")).toBe("'2 days 3 hours'");
        });

        // NEW TESTS - ISO 8601 format conversion
        it("should convert ISO 8601 timestamp to PostgreSQL format", () => {
            expect(value_to_sql(makeColumn("timestamp"), "2025-11-13T19:36:55.266893")).toBe(
                "'2025-11-13 19:36:55.266893'",
            );
        });

        it("should convert ISO 8601 timestamptz to PostgreSQL format", () => {
            expect(value_to_sql(makeColumn("timestamptz"), "2025-11-13T19:36:55.266893+00:00")).toBe(
                "'2025-11-13 19:36:55.266893+00:00'",
            );
        });

        it("should convert ISO 8601 timestamptz with Z timezone", () => {
            expect(value_to_sql(makeColumn("timestamptz"), "2025-11-13T19:36:55.266893Z")).toBe(
                "'2025-11-13 19:36:55.266893Z'",
            );
        });

        it("should handle timestamp with microseconds", () => {
            expect(value_to_sql(makeColumn("timestamp"), "2025-01-15 14:30:00.123456")).toBe(
                "'2025-01-15 14:30:00.123456'",
            );
        });

        it("should handle ISO 8601 timestamp with microseconds", () => {
            expect(value_to_sql(makeColumn("timestamp"), "2025-01-15T14:30:00.123456")).toBe(
                "'2025-01-15 14:30:00.123456'",
            );
        });

        it("should handle timestamptz with different timezone offsets", () => {
            expect(value_to_sql(makeColumn("timestamptz"), "2025-11-13T19:36:55+01:00")).toBe(
                "'2025-11-13 19:36:55+01:00'",
            );
        });

        it("should handle timestamptz with negative timezone offset", () => {
            expect(value_to_sql(makeColumn("timestamptz"), "2025-11-13T19:36:55-05:00")).toBe(
                "'2025-11-13 19:36:55-05:00'",
            );
        });

        it("should handle date in ISO format (no conversion needed)", () => {
            expect(value_to_sql(makeColumn("date"), "2025-11-13")).toBe("'2025-11-13'");
        });

        it("should handle time in ISO format (no conversion needed)", () => {
            expect(value_to_sql(makeColumn("time"), "19:36:55")).toBe("'19:36:55'");
        });

        it("should handle time with microseconds", () => {
            expect(value_to_sql(makeColumn("time"), "19:36:55.123456")).toBe("'19:36:55.123456'");
        });

        it("should handle timetz with ISO format", () => {
            expect(value_to_sql(makeColumn("timetz"), "19:36:55+00:00")).toBe("'19:36:55+00:00'");
        });

        it("should handle interval with complex format", () => {
            expect(value_to_sql(makeColumn("interval"), "1 year 2 months 3 days 4 hours 5 minutes 6 seconds")).toBe(
                "'1 year 2 months 3 days 4 hours 5 minutes 6 seconds'",
            );
        });

        it("should handle interval in ISO 8601 duration format", () => {
            expect(value_to_sql(makeColumn("interval"), "P1Y2M3DT4H5M6S")).toBe("'P1Y2M3DT4H5M6S'");
        });

        it("should escape single quotes in date strings", () => {
            expect(value_to_sql(makeColumn("timestamp"), "2025-01-15T14:30:00 O'Clock")).toBe(
                "'2025-01-15 14:30:00 O''Clock'",
            );
        });

        it("should handle timestamp without timezone as-is", () => {
            expect(value_to_sql(makeColumn("timestamp"), "2025-11-13 19:36:55")).toBe("'2025-11-13 19:36:55'");
        });

        it("should handle empty interval", () => {
            expect(value_to_sql(makeColumn("interval"), "0")).toBe("'0'");
        });

        it("should handle BC dates", () => {
            expect(value_to_sql(makeColumn("date"), "0001-01-01 BC")).toBe("'0001-01-01 BC'");
        });

        it("should handle infinity timestamp", () => {
            expect(value_to_sql(makeColumn("timestamp"), "infinity")).toBe("'infinity'");
        });

        it("should handle negative infinity timestamp", () => {
            expect(value_to_sql(makeColumn("timestamp"), "-infinity")).toBe("'-infinity'");
        });
    });

    describe("✅ Boolean", () => {
        it("should format true as TRUE", () => {
            expect(value_to_sql(makeColumn("boolean"), true)).toBe("true");
        });

        it("should format false as FALSE", () => {
            expect(value_to_sql(makeColumn("boolean"), false)).toBe("false");
        });
    });

    describe("🧩 Geometric types", () => {
        it("should format point from object", () => {
            expect(value_to_sql(makeColumn("point"), {x: 10, y: 20})).toBe("'(10,20)'");
        });

        it("should format point from string", () => {
            expect(value_to_sql(makeColumn("point"), "(5,15)")).toBe("'(5,15)'");
        });

        it("should format line", () => {
            expect(value_to_sql(makeColumn("line"), "[1,2,3]")).toBe("'[1,2,3]'");
        });

        it("should format lseg", () => {
            expect(value_to_sql(makeColumn("lseg"), "[(0,0),(1,1)]")).toBe("'[(0,0),(1,1)]'");
        });

        it("should format box", () => {
            expect(value_to_sql(makeColumn("box"), "((0,0),(2,2))")).toBe("'((0,0),(2,2))'");
        });

        it("should format path", () => {
            expect(value_to_sql(makeColumn("path"), "((0,0),(1,1),(2,0))")).toBe("'((0,0),(1,1),(2,0))'");
        });

        it("should format polygon", () => {
            expect(value_to_sql(makeColumn("polygon"), "((0,0),(1,1),(1,0))")).toBe("'((0,0),(1,1),(1,0))'");
        });

        it("should format circle", () => {
            expect(value_to_sql(makeColumn("circle"), "<(0,0),5>")).toBe("'<(0,0),5>'");
        });
    });

    describe("🌐 Network types", () => {
        it("should format cidr", () => {
            expect(value_to_sql(makeColumn("cidr"), "192.168.0.0/24")).toBe("'192.168.0.0/24'");
        });

        it("should format inet", () => {
            expect(value_to_sql(makeColumn("inet"), "192.168.1.1")).toBe("'192.168.1.1'");
        });

        it("should format macaddr", () => {
            expect(value_to_sql(makeColumn("macaddr"), "08:00:2b:01:02:03")).toBe("'08:00:2b:01:02:03'");
        });

        it("should format macaddr8", () => {
            expect(value_to_sql(makeColumn("macaddr8"), "08:00:2b:01:02:03:04:05")).toBe("'08:00:2b:01:02:03:04:05'");
        });
    });

    describe("💾 Binary data", () => {
        it("should format bytea from Uint8Array", () => {
            const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
            expect(value_to_sql(makeColumn("bytea"), bytes)).toBe("'\\x48656c6c6f'");
        });

        it("should format empty bytea", () => {
            const bytes = new Uint8Array([]);
            expect(value_to_sql(makeColumn("bytea"), bytes)).toBe("'\\x'");
        });

        it("should format bytea from string", () => {
            expect(value_to_sql(makeColumn("bytea"), "DEADBEEF")).toBe("'\\xDEADBEEF'");
        });
    });

    describe("🧱 Bit strings", () => {
        it("should format bit", () => {
            expect(value_to_sql(makeColumn("bit"), "10101")).toBe("'10101'");
        });

        it("should format varbit", () => {
            expect(value_to_sql(makeColumn("varbit"), "110011")).toBe("'110011'");
        });
    });

    describe("📜 Text search", () => {
        it("should format tsvector", () => {
            expect(value_to_sql(makeColumn("tsvector"), "'fat':2 'cat':3")).toBe("'''fat'':2 ''cat'':3'");
        });

        it("should format tsquery", () => {
            expect(value_to_sql(makeColumn("tsquery"), "fat & cat")).toBe("'fat & cat'");
        });
    });

    describe("🧬 JSON/XML types", () => {
        it("should format json object", () => {
            expect(value_to_sql(makeColumn("json"), {name: "John", age: 30})).toBe('\'{"name":"John","age":30}\'');
        });

        it("should format jsonb object", () => {
            expect(value_to_sql(makeColumn("jsonb"), {active: true})).toBe("'{\"active\":true}'");
        });

        it("should format json array", () => {
            expect(value_to_sql(makeColumn("json"), [1, 2, 3])).toBe("'[1,2,3]'");
        });

        it("should escape quotes in JSON strings", () => {
            expect(value_to_sql(makeColumn("json"), {message: "It's great"})).toBe("'{\"message\":\"It''s great\"}'");
        });

        it("should format xml", () => {
            expect(value_to_sql(makeColumn("xml"), "<root><item>test</item></root>")).toBe(
                "'<root><item>test</item></root>'",
            );
        });
    });

    describe("🗂️ UUID", () => {
        it("should format uuid", () => {
            expect(value_to_sql(makeColumn("uuid"), "550e8400-e29b-41d4-a716-446655440000")).toBe(
                "'550e8400-e29b-41d4-a716-446655440000'",
            );
        });
    });

    describe("📚 Array types", () => {
        it("should format integer_array", () => {
            expect(value_to_sql(makeColumn("integer_array"), [1, 2, 3])).toBe("'{1,2,3}'");
        });

        it("should format text_array", () => {
            expect(value_to_sql(makeColumn("text_array"), ["hello", "world"])).toBe('\'{"hello","world"}\'');
        });

        it("should format uuid_array", () => {
            const uuids = ["550e8400-e29b-41d4-a716-446655440000", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"];
            expect(value_to_sql(makeColumn("uuid_array"), uuids)).toBe(
                '\'{"550e8400-e29b-41d4-a716-446655440000","6ba7b810-9dad-11d1-80b4-00c04fd430c8"}\'',
            );
        });

        it("should handle NULL in arrays", () => {
            expect(value_to_sql(makeColumn("integer_array"), [1, null, 3])).toBe("'{1,NULL,3}'");
        });

        it("should escape quotes in text_array", () => {
            expect(value_to_sql(makeColumn("text_array"), ['test"quote'])).toBe('\'{"test\\"quote"}\'');
        });

        it("should format empty array", () => {
            expect(value_to_sql(makeColumn("integer_array"), [])).toBe("'{}'");
        });
    });

    describe("🗝️ Range types", () => {
        it("should format int4range", () => {
            expect(value_to_sql(makeColumn("int4range"), "[1,10)")).toBe("'[1,10)'");
        });

        it("should format int8range", () => {
            expect(value_to_sql(makeColumn("int8range"), "[100,200]")).toBe("'[100,200]'");
        });

        it("should format numrange", () => {
            expect(value_to_sql(makeColumn("numrange"), "[0.5,2.5)")).toBe("'[0.5,2.5)'");
        });

        it("should format tsrange", () => {
            expect(value_to_sql(makeColumn("tsrange"), "['2025-01-01 00:00:00','2025-12-31 23:59:59')")).toBe(
                "'['2025-01-01 00:00:00','2025-12-31 23:59:59')'",
            );
        });

        it("should format tstzrange", () => {
            expect(value_to_sql(makeColumn("tstzrange"), "['2025-01-01 00:00:00+00','2025-12-31 23:59:59+00')")).toBe(
                "'['2025-01-01 00:00:00+00','2025-12-31 23:59:59+00')'",
            );
        });

        it("should format daterange", () => {
            expect(value_to_sql(makeColumn("daterange"), "['2025-01-01','2025-12-31')")).toBe(
                "'['2025-01-01','2025-12-31')'",
            );
        });
    });

    describe("🧱 Composite types", () => {
        it("should format composite type", () => {
            expect(value_to_sql(makeColumn("composite"), {field1: "value1", field2: "value2"})).toBe(
                "ROW('value1','value2')",
            );
        });

        it("should handle NULL in composite fields", () => {
            expect(value_to_sql(makeColumn("composite"), {field1: "value1", field2: null})).toBe("ROW('value1',NULL)");
        });

        it("should escape quotes in composite fields", () => {
            expect(value_to_sql(makeColumn("composite"), {name: "O'Brien"})).toBe("ROW('O''Brien')");
        });
    });

    describe("📦 System/Special types", () => {
        it("should format regclass", () => {
            expect(value_to_sql(makeColumn("regclass"), "pg_class")).toBe("'pg_class'");
        });

        it("should format regtype", () => {
            expect(value_to_sql(makeColumn("regtype"), "integer")).toBe("'integer'");
        });

        it("should format regproc", () => {
            expect(value_to_sql(makeColumn("regproc"), "now")).toBe("'now'");
        });

        it("should format pg_lsn", () => {
            expect(value_to_sql(makeColumn("pg_lsn"), "16/B374D848")).toBe("'16/B374D848'");
        });

        it("should format txid_snapshot", () => {
            expect(value_to_sql(makeColumn("txid_snapshot"), "10:20:")).toBe("'10:20:'");
        });

        it("should format jsonpath", () => {
            expect(value_to_sql(makeColumn("jsonpath"), "$.user.name")).toBe("'$.user.name'");
        });
    });

    describe("🧠 Vector (pgvector)", () => {
        it("should format vector from array", () => {
            expect(value_to_sql(makeColumn("vector"), [0.1, 0.2, 0.3])).toBe("'[0.1,0.2,0.3]'");
        });

        it("should format vector from string", () => {
            expect(value_to_sql(makeColumn("vector"), "[1.0,2.0,3.0]")).toBe("'[1.0,2.0,3.0]'");
        });

        it("should format empty vector", () => {
            expect(value_to_sql(makeColumn("vector"), [])).toBe("'[]'");
        });
    });

    describe("🔒 Escaping", () => {
        it("should escape single quotes in varchar and bpchar", () => {
            expect(value_to_sql(makeColumn("varchar"), "l'avion")).toBe("'l''avion'");
            expect(value_to_sql(makeColumn("bpchar"), "l'avion")).toBe("'l''avion'");
        });

        it("should escape single quotes in types cast by default", () => {
            expect(value_to_sql(makeColumn("citext"), "l'avion")).toBe("'l''avion'::citext");
            expect(value_to_sql(makeColumn("inet"), "1'1")).toBe("'1''1'::inet");
        });

        it("should format numbers of any type without crashing", () => {
            expect(value_to_sql(makeColumn("numeric"), 12.5)).toBe("12.5");
            expect(value_to_sql(makeColumn("oid"), 16384)).toBe("16384");
        });

        it("should keep values already cast to the column type", () => {
            expect(value_to_sql(makeColumn("point"), "'(5,15)'::point")).toBe("'(5,15)'::point");
        });

        it("should format arrays named after pg_type", () => {
            expect(value_to_sql(makeColumn("_text"), ["a,b", "l'avion", 'x"y', null])).toBe(
                `'{"a,b","l''avion","x\\"y",NULL}'`,
            );
            expect(value_to_sql(makeColumn("_int4"), [[1, 2], [3, 4]])).toBe("'{{1,2},{3,4}}'");
            expect(value_to_sql(makeColumn("_text"), "{a,b}")).toBe("'{a,b}'");
        });

        it("should not cast bit values, a cast to bit means bit(1)", () => {
            expect(value_to_sql(makeColumn("bit"), "101")).toBe("'101'");
            expect(value_to_sql(makeColumn("varbit"), "11001")).toBe("'11001'::varbit");
        });

        it("should not prefix bytea returned by postgres twice", () => {
            expect(value_to_sql(makeColumn("bytea"), "\\x48656c6c6f")).toBe("'\\x48656c6c6f'");
        });
    });

    describe("Edge cases", () => {
        it("should handle empty string", () => {
            expect(value_to_sql(makeColumn("text"), "")).toBe("''");
        });

        it("should handle zero", () => {
            expect(value_to_sql(makeColumn("integer"), 0)).toBe("0");
        });

        it("should handle negative numbers", () => {
            expect(value_to_sql(makeColumn("integer"), -42)).toBe("-42");
        });

        it("should handle very long strings", () => {
            const longString = "a".repeat(10000);
            expect(value_to_sql(makeColumn("text"), longString)).toBe(`'${longString}'`);
        });

        it("should handle strings with newlines", () => {
            expect(value_to_sql(makeColumn("text"), "line1\nline2")).toBe("'line1\nline2'");
        });

        it("should handle strings with tabs", () => {
            expect(value_to_sql(makeColumn("text"), "col1\tcol2")).toBe("'col1\tcol2'");
        });
    });
});

describe("quote_ident", () => {
    it("should quote camelCase and reserved names", () => {
        expect(quote_ident("userId")).toBe('"userId"');
        expect(quote_ident("order")).toBe('"order"');
    });

    it("should double the quotes inside the name", () => {
        expect(quote_ident('a"b')).toBe('"a""b"');
    });
});

describe("primary_key_condition", () => {
    const column = (column_name: string, data_type: string) => ({column_name, data_type}) as PgColumn;

    it("should match every column of a composite key", () => {
        const pks = [column("tenantId", "uuid"), column("id", "int4")];
        expect(
            primary_key_condition(pks, [
                {tenantId: "a", id: 1, name: "x"},
                {tenantId: "b", id: 2, name: "y"},
            ]),
        ).toBe(`("tenantId", "id") in (('a'::uuid, 1), ('b'::uuid, 2))`);
    });

    it("should work with a single column key", () => {
        expect(primary_key_condition([column("id", "int4")], [{id: 1}])).toBe(`("id") in ((1))`);
    });
});

describe("sql_to_value", () => {
    const column = (data_type: string) => ({data_type}) as PgColumn;

    it("should unwrap a literal whose cast isn't named like pg_type", () => {
        expect(sql_to_value(column("varchar"), "'draft'::character varying")).toBe("draft");
        expect(sql_to_value(column("_text"), "'{}'::text[]")).toEqual([]);
    });

    it("should unescape the quotes of the literal", () => {
        expect(sql_to_value(column("text"), "'it''s'::text")).toBe("it's");
        expect(sql_to_value(column("text"), "'a''::b'::text")).toBe("a'::b");
    });

    it("should unwrap enums and json", () => {
        expect(sql_to_value(column("mood"), "'happy'::mood")).toBe("happy");
        expect(sql_to_value(column("jsonb"), `'{"a": "it''s"}'::jsonb`)).toEqual({a: "it's"});
    });

    it("should keep expressions and numbers as they are", () => {
        expect(sql_to_value(column("timestamptz"), "now()")).toBe("now()");
        expect(sql_to_value(column("int4"), "nextval('seq'::regclass)")).toBe("nextval('seq'::regclass)");
        expect(sql_to_value(column("int4"), "42")).toBe("42");
    });
});

// values as row_to_json returns them, each output was checked to write the same value back in postgres 16
describe("value_to_sql with values read from postgres", () => {
    const sql = (data_type: string, value: unknown) => value_to_sql({data_type} as PgColumn, value);

    it("should keep backslashes, double quotes and newlines of text as is", () => {
        expect(sql("text", 'it\'s a "test", with \\ backslash\nand newline')).toBe(
            `'it''s a "test", with \\ backslash\nand newline'`,
        );
    });

    it("should keep the padding of bpchar", () => {
        expect(sql("bpchar", "ab'c ")).toBe("'ab''c '");
        expect(sql("bpchar", "     ")).toBe("'     '");
    });

    it("should format numbers at their limits", () => {
        expect(sql("int2", -32768)).toBe("-32768");
        expect(sql("int8", 9007199254740991)).toBe("9007199254740991");
        expect(sql("float8", -0.5)).toBe("-0.5");
        expect(sql("numeric", 123456.789)).toBe("123456.789");
        expect(sql("numeric", 0)).toBe("0");
    });

    it("should format special dates", () => {
        expect(sql("timestamp", "infinity")).toBe("'infinity'");
        expect(sql("timestamptz", "-infinity")).toBe("'-infinity'");
        expect(sql("date", "0001-01-01 BC")).toBe("'0001-01-01 BC'");
    });

    it("should format types without a dedicated case with a cast", () => {
        expect(sql("money", "$1,234.56")).toBe("'$1,234.56'::money");
        expect(sql("point", "(1.5,-2)")).toBe("'(1.5,-2)'::point");
        expect(sql("inet", "::1")).toBe("'::1'::inet");
        expect(sql("int4range", "empty")).toBe("'empty'::int4range");
        expect(sql("tsrange", "(,)")).toBe("'(,)'::tsrange");
        expect(sql("mood", "it's ok")).toBe("'it''s ok'::mood");
    });

    it("should escape xml and tsvector", () => {
        expect(sql("xml", `<root a="1">it's</root>`)).toBe(`'<root a="1">it''s</root>'`);
        expect(sql("tsvector", "'cat':3 'fat':2")).toBe("'''cat'':3 ''fat'':2'");
    });

    it("should format an empty bytea", () => {
        expect(sql("bytea", "\\x")).toBe("'\\x'");
    });

    it("should tell NULL elements from 'NULL' strings in arrays", () => {
        expect(sql("_text", ["a,b", "l'x", 'q"q', "back\\slash", null, "", "NULL", " spaced "])).toBe(
            `'{"a,b","l''x","q\\"q","back\\\\slash",NULL,"","NULL"," spaced "}'`,
        );
    });

    it("should format empty, boolean, uuid and jsonb arrays", () => {
        expect(sql("_int4", [])).toBe("'{}'");
        expect(sql("_bool", [true, false, null])).toBe("'{true,false,NULL}'");
        expect(sql("_uuid", ["550e8400-e29b-41d4-a716-446655440000"])).toBe(
            `'{"550e8400-e29b-41d4-a716-446655440000"}'`,
        );
        expect(sql("_jsonb", [{k: "v's"}])).toBe(`'{"{\\"k\\":\\"v''s\\"}"}'`);
    });

    it("should keep json values as json", () => {
        expect(sql("json", [])).toBe("'[]'");
        expect(sql("jsonb", {nested: {q: `x'y"z`}, n: null})).toBe(`'{"nested":{"q":"x''y\\"z"},"n":null}'`);
    });
});

describe("quote_ident edge cases", () => {
    it("should keep spaces, unicode and case", () => {
        expect(quote_ident("Mixed Case")).toBe('"Mixed Case"');
        expect(quote_ident("prénom")).toBe('"prénom"');
    });
});

describe("primary_key_condition edge cases", () => {
    const column = (column_name: string, data_type: string) => ({column_name, data_type}) as PgColumn;

    it("should escape text keys and quote key names", () => {
        expect(primary_key_condition([column("Code", "text")], [{Code: "l'x"}])).toBe(`("Code") in (('l''x'))`);
    });

    it("should keep a key equal to 0", () => {
        expect(primary_key_condition([column("id", "int4")], [{id: 0}])).toBe(`("id") in ((0))`);
    });
});

describe("arrays typed in the editor", () => {
    const column = (data_type: string) => ({data_type}) as PgColumn;

    it("should quote the items", () => {
        expect(value_to_sql(column("_text"), ["hello world", 'a"b', "c\\d", null])).toBe(
            `'{"hello world","a\\"b","c\\\\d",NULL}'`,
        );
        expect(value_to_sql(column("_int4"), ["1", "2"])).toBe(`'{"1","2"}'`);
    });

    it("should start from an empty array", () => {
        expect(default_value(column("_text"))).toEqual([]);
        expect(default_value(column("text"))).toBe("");
    });

    it("should parse array literals", () => {
        expect(parse_array_literal("{}")).toEqual([]);
        expect(parse_array_literal('{a,"b c",NULL,"NULL","x\\"y"}')).toEqual(["a", "b c", null, "NULL", 'x"y']);
        expect(parse_array_literal("{{1,2},{3,4}}")).toEqual([["1", "2"], ["3", "4"]]);
        expect(parse_array_literal("array['a']")).toBeUndefined();
        expect(sql_to_value(column("_text"), "'{a,\"b c\"}'::text[]")).toEqual(["a", "b c"]);
        expect(sql_to_value(column("_text"), "ARRAY['a'::text]")).toBe("ARRAY['a'::text]");
    });
});

