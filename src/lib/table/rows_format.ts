import {quote_ident, value_to_sql} from "./values";
import type {PgColumn, PgRow} from "./pg_context.svelte";

export const ROWS_FORMATS = ["json", "csv", "sql"] as const;
export type RowsFormat = (typeof ROWS_FORMATS)[number];

type FormatColumn = Pick<PgColumn, "column_name" | "data_type">;

export const escape_csv_value = (value: unknown) => {
    const str =
        value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
};

// `get_table_data` sends these as strings to keep their precision
const NUMBER_AS_STRING_TYPES = ["int8", "bigint", "bigserial", "numeric", "_int8", "_numeric"];

/**
 * Write the value as JSON, with the numbers sent as strings written back as JSON numbers.
 */
const value_to_json = (column: FormatColumn, value: unknown) => {
    const json = JSON.stringify(value);
    return NUMBER_AS_STRING_TYPES.includes(column.data_type) ? json.replace(/"(-?\d+(?:\.\d+)?)"/g, "$1") : json;
};

/**
 * Keep only the given columns, in order, so the output never leaks internal keys like `__index`.
 */
export const rows_to_json = (columns: FormatColumn[], rows: PgRow[]) =>
    `[${rows
        .map(
            (row) =>
                `{${columns
                    .filter((col) => row[col.column_name] !== undefined)
                    .map((col) => `${JSON.stringify(col.column_name)}:${value_to_json(col, row[col.column_name])}`)
                    .join(",")}}`,
        )
        .join(",")}]`;

export const rows_to_csv = (columns: FormatColumn[], rows: PgRow[]) =>
    columns.map((col) => escape_csv_value(col.column_name)).join(",") +
    "\n" +
    rows.map((row) => columns.map((col) => escape_csv_value(row[col.column_name])).join(",")).join("\n");

export const rows_to_sql = (table: string, columns: FormatColumn[], rows: PgRow[]) => `INSERT INTO ${table}
(${columns.map((col) => quote_ident(col.column_name)).join(",")})
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
