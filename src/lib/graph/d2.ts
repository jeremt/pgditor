import type {PgColumn, PgTableForGraph} from "$lib/table/pg_context.svelte";

// Keys that d2 interprets itself: a column or table named like this must be quoted.
const D2_KEYWORDS = new Set([
    "_",
    "null",
    "label",
    "desc",
    "shape",
    "icon",
    "constraint",
    "tooltip",
    "link",
    "near",
    "width",
    "height",
    "direction",
    "top",
    "left",
    "grid-rows",
    "grid-columns",
    "grid-gap",
    "vertical-gap",
    "horizontal-gap",
    "class",
    "classes",
    "vars",
    "style",
    "source-arrowhead",
    "target-arrowhead",
]);

const d2_string = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const d2_key = (name: string) =>
    /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !D2_KEYWORDS.has(name.toLowerCase()) ? name : d2_string(name);

const column_type = (column: PgColumn) =>
    `${column.data_type}${column.data_type_params ?? ""}${column.is_nullable === "YES" ? "?" : ""}`;

const column_constraint = (column: PgColumn) => {
    const constraints = [];
    if (column.is_primary_key === "YES") {
        constraints.push("primary_key");
    }
    if (column.foreign_table_name !== null) {
        constraints.push("foreign_key");
    }
    if (constraints.length === 0) {
        return "";
    }
    return constraints.length === 1 ? ` {constraint: ${constraints[0]}}` : ` {constraint: [${constraints.join("; ")}]}`;
};

/**
 * Build a d2 diagram (https://d2lang.com) of the tables of `schema` and their foreign keys.
 *
 * Tables of other schemas referenced by a foreign key are included with only the referenced columns.
 */
export const build_d2 = (tables: PgTableForGraph[], schema: string) => {
    const table_key = (table_schema: string, name: string) =>
        d2_key(table_schema === schema ? name : `${table_schema}.${name}`);

    const lines = ["direction: right", ""];

    const push_table = (key: string, columns: string[]) => {
        lines.push(`${key}: {`, "  shape: sql_table", ...columns.map((column) => `  ${column}`), "}", "");
    };

    for (const table of tables) {
        push_table(
            table_key(table.schema, table.name),
            table.columns.map(
                (column) => `${d2_key(column.column_name)}: ${d2_string(column_type(column))}${column_constraint(column)}`,
            ),
        );
    }

    const existing_tables = new Set(tables.map((table) => `${table.schema}.${table.name}`));
    const external_tables = new Map<string, {schema: string; name: string; columns: Map<string, string>}>();
    const relations: string[] = [];
    for (const table of tables) {
        for (const column of table.columns) {
            if (
                column.foreign_table_schema === null ||
                column.foreign_table_name === null ||
                column.foreign_column_name === null
            ) {
                continue;
            }
            const foreign_id = `${column.foreign_table_schema}.${column.foreign_table_name}`;
            if (!existing_tables.has(foreign_id)) {
                const external = external_tables.get(foreign_id) ?? {
                    schema: column.foreign_table_schema,
                    name: column.foreign_table_name,
                    columns: new Map(),
                };
                // The referenced column type isn't known, but it matches the referencing one.
                external.columns.set(column.foreign_column_name, `${column.data_type}${column.data_type_params ?? ""}`);
                external_tables.set(foreign_id, external);
            }
            relations.push(
                `${table_key(table.schema, table.name)}.${d2_key(column.column_name)} -> ${table_key(column.foreign_table_schema, column.foreign_table_name)}.${d2_key(column.foreign_column_name)}`,
            );
        }
    }

    for (const external of external_tables.values()) {
        push_table(
            table_key(external.schema, external.name),
            Array.from(external.columns, ([name, type]) => `${d2_key(name)}: ${d2_string(type)}`),
        );
    }

    lines.push(...relations);

    return lines.join("\n").trimEnd() + "\n";
};
