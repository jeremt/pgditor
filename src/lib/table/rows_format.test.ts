import {describe, expect, it} from "vitest";
import {rows_to_csv, rows_to_json, rows_to_sql} from "./rows_format";

const columns = [
    {column_name: "id", data_type: "integer" as const},
    {column_name: "name", data_type: "text" as const},
];
const rows = [
    {id: 1, name: "a,b", __index: "0"},
    {id: 2, name: null, __index: "1"},
];

describe("rows_format", () => {
    it("keeps only the given columns in JSON", () => {
        expect(rows_to_json(columns, rows)).toBe('[{"id":1,"name":"a,b"},{"id":2,"name":null}]');
    });

    it("escapes CSV values", () => {
        expect(rows_to_csv(columns, rows)).toBe('id,name\n1,"a,b"\n2,');
    });

    it("generates an insert statement", () => {
        expect(rows_to_sql("t", columns, rows)).toBe("INSERT INTO t\n(id,name)\nVALUES\n(1,'a,b'),\n(2,null)\n;");
    });
});
