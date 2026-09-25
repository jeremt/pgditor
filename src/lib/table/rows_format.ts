import {value_to_sql} from "./values";
import type {PgColumn, PgRow} from "./pg_context.svelte";

export const ROWS_FORMATS = ["json", "csv", "sql"] as const;
export type RowsFormat = (typeof ROWS_FORMATS)[number];

type FormatColumn = Pick<PgColumn, "column_name" | "data_type">;

export const escape_csv_value = (value: unknown) => {
    const str =
        value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
};

/**
 * Keep only the given columns, in order, so the output never leaks internal keys like `__index`.
 */
export const rows_to_json = (columns: FormatColumn[], rows: PgRow[]) =>
    JSON.stringify(rows.map((row) => Object.fromEntries(columns.map((col) => [col.column_name, row[col.column_name]]))));

export const rows_to_csv = (columns: FormatColumn[], rows: PgRow[]) =>
    columns.map((col) => escape_csv_value(col.column_name)).join(",") +
    "\n" +
    rows.map((row) => columns.map((col) => escape_csv_value(row[col.column_name])).join(",")).join("\n");

export const rows_to_sql = (table: string, columns: FormatColumn[], rows: PgRow[]) => `INSERT INTO ${table}
(${columns.map((col) => col.column_name).join(",")})
VALUES
${rows.map((row) => `(${columns.map((col) => value_to_sql(col, row[col.column_name])).join(",")})`).join(",\n")}
;`;

export const rows_to_format = (format: RowsFormat, table: string, columns: FormatColumn[], rows: PgRow[]) => {
    switch (format) {
        case "json":
            return rows_to_json(columns, rows);
        case "csv":
            return rows_to_csv(columns, rows);
        case "sql":
            return rows_to_sql(table, columns, rows);
    }
};
