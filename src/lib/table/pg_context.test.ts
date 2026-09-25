import {beforeEach, describe, expect, it, vi} from "vitest";
import type {PgColumn, PgRow} from "./pg_context.svelte";

const queries: string[] = [];
const calls: {command: string; args: Record<string, unknown>}[] = [];

// PgContext reads its dependencies from svelte contexts and runs its queries through tauri
vi.mock("svelte", async (original) => ({
    ...(await original<typeof import("svelte")>()),
    setContext: (_key: unknown, value: unknown) => value,
    getContext: () => ({
        toast: () => {},
        current: {name: "test", connectionString: "postgres://test"},
        hide_system_tables: true,
        hide_views: true,
        save_selected_table: () => {},
    }),
}));
vi.mock("@tauri-apps/api/core", () => ({
    invoke: async (command: string, args: Record<string, unknown>) => {
        calls.push({command, args});
        if (command === "raw_query") {
            queries.push(args.sql as string);
        }
        if (command === "list_table_columns") {
            return [];
        }
        return {rows: [], count: 0, duration_ms: 0};
    },
}));
vi.mock("@tauri-apps/api/window", () => ({getCurrentWindow: () => ({setTitle: async () => {}})}));
vi.mock("$lib/widgets/Toaster.svelte", () => ({get_toast_context: () => ({toast: () => {}})}));

const {filters_to_where, set_pg_context} = await import("./pg_context.svelte");

const column = (column_name: string, data_type: string, options: Partial<PgColumn> = {}) =>
    ({
        column_name,
        data_type,
        data_type_params: null,
        is_nullable: "NO",
        is_primary_key: "NO",
        column_default: null,
        foreign_table_schema: null,
        foreign_table_name: null,
        foreign_column_name: null,
        enum_values: null,
        ...options,
    }) as PgColumn;

const user_fk = {foreign_table_schema: "public", foreign_table_name: "users", foreign_column_name: "id"};

const create_pg = (columns: PgColumn[]) => {
    const pg = set_pg_context();
    pg.current_table = {
        schema: "public",
        name: "projects",
        type: "BASE TABLE",
        column_names: columns.map((col) => col.column_name),
        size_mb: 0,
        columns,
        rows: [],
        count: 0,
    };
    return pg;
};

beforeEach(() => {
    queries.length = 0;
    calls.length = 0;
});

describe("insert_row", () => {
    it("should leave an empty primary key to its default", async () => {
        const pg = create_pg([
            column("id", "uuid", {is_primary_key: "YES", column_default: "gen_random_uuid()"}),
            column("user_id", "uuid", user_fk),
            column("name", "text"),
        ]);
        await pg.insert_row({id: null, user_id: "00000000-0000-0000-0000-00000000000a", name: "p"});
        expect(queries).toEqual([
            `insert into "public"."projects"
("user_id", "name")
values
('00000000-0000-0000-0000-00000000000a'::uuid, 'p');`,
        ]);
    });

    it("should insert the primary key columns that have a value", async () => {
        const pg = create_pg([
            column("user_id", "uuid", {...user_fk, is_primary_key: "YES"}),
            column("id", "int4", {is_primary_key: "YES", column_default: "nextval('projects_id_seq'::regclass)"}),
            column("name", "text"),
        ]);
        await pg.insert_row({user_id: "00000000-0000-0000-0000-00000000000a", id: null, name: "p"});
        expect(queries).toEqual([
            `insert into "public"."projects"
("user_id", "name")
values
('00000000-0000-0000-0000-00000000000a'::uuid, 'p');`,
        ]);
    });
});

describe("upsert_row", () => {
    const columns = [
        column("user_id", "uuid", {...user_fk, is_primary_key: "YES"}),
        column("id", "int4", {is_primary_key: "YES", column_default: "nextval('projects_id_seq'::regclass)"}),
        column("name", "text"),
    ];

    it("should insert when a column of a composite primary key is empty", async () => {
        const pg = create_pg(columns);
        await pg.upsert_row({user_id: "00000000-0000-0000-0000-00000000000a", id: null, name: "p"});
        expect(queries[0]).toMatch(/^insert into/);
    });

    it("should update the row matching every column of the primary key", async () => {
        const pg = create_pg(columns);
        await pg.upsert_row({user_id: "00000000-0000-0000-0000-00000000000a", id: 0, name: "p"});
        expect(queries[0].trim()).toBe(`UPDATE "public"."projects" SET
"name" = 'p'
WHERE ("user_id", "id") in (('00000000-0000-0000-0000-00000000000a'::uuid, 0));`);
    });
});

describe("update_row", () => {
    it("should only set the given columns", async () => {
        const pg = create_pg([
            column("id", "int4", {is_primary_key: "YES"}),
            column("userName", "varchar", {is_nullable: "YES"}),
            column("note", "text"),
        ]);
        const primary_key = pg.pick_primary_keys({id: 7, userName: "l'avion", note: "x"} as PgRow);
        await pg.update_row({...primary_key, userName: null});
        expect(queries[0].trim()).toBe(`UPDATE "public"."projects" SET
"userName" = null
WHERE ("id") in ((7));`);
    });
});

describe("int8 primary keys", () => {
    // get_table_data sends int8 as strings, since 1234567890123456789 isn't a safe JS integer
    const columns = [column("id", "int8", {is_primary_key: "YES"}), column("amount", "numeric")];

    it("should update the row matching the exact primary key", async () => {
        const pg = create_pg(columns);
        await pg.update_row({id: "1234567890123456789", amount: "12345678901234567.89"});
        expect(queries[0].trim()).toBe(`UPDATE "public"."projects" SET
"amount" = '12345678901234567.89'::numeric
WHERE ("id") in ((1234567890123456789));`);
    });

    it("should delete the rows matching the exact primary keys", async () => {
        const pg = create_pg(columns);
        pg.current_table!.rows = [{id: "9007199254740993"}, {id: "9007199254740992"}];
        pg.selected_rows = [0];
        await pg.delete_selection();
        expect(queries[0]).toBe(`delete from "public"."projects"
where ("id") in ((9007199254740993));`);
    });
});

describe("delete_selection", () => {
    it("should only delete the selected rows of a composite primary key", async () => {
        const pg = create_pg([
            column("tenant_id", "int4", {is_primary_key: "YES"}),
            column("id", "int4", {is_primary_key: "YES"}),
        ]);
        pg.current_table!.rows = [
            {tenant_id: 1, id: 1},
            {tenant_id: 1, id: 2},
            {tenant_id: 2, id: 1},
        ];
        pg.selected_rows = [0, 2];
        await pg.delete_selection();
        expect(queries[0]).toBe(`delete from "public"."projects"
where ("tenant_id", "id") in ((1, 1), (2, 1));`);
    });
});

describe("insert_row edge cases", () => {
    it("should insert a primary key typed by the user", async () => {
        const pg = create_pg([column("code", "text", {is_primary_key: "YES"}), column("label", "text")]);
        await pg.insert_row({code: "l'x", label: "a"});
        expect(queries[0]).toContain(`("code", "label")`);
        expect(queries[0]).toContain(`('l''x', 'a')`);
    });

    it("should insert null values of nullable columns and skip tsvector columns", async () => {
        const pg = create_pg([
            column("id", "int4", {is_primary_key: "YES", column_default: "nextval('s'::regclass)"}),
            column("note", "text", {is_nullable: "YES"}),
            column("search", "tsvector", {is_nullable: "YES"}),
        ]);
        await pg.insert_row({id: null, note: null, search: "'a':1"});
        expect(queries[0]).toBe(`insert into "public"."projects"
("note")
values
(null);`);
    });
});

describe("update_row edge cases", () => {
    const columns = [
        column("id", "int4", {is_primary_key: "YES"}),
        column("order", "text"),
        column("search", "tsvector", {is_nullable: "YES"}),
    ];

    it("should not set the primary key, tsvector columns or columns missing from the row", async () => {
        const pg = create_pg([...columns, column("note", "text")]);
        await pg.update_row({id: 1, order: "desc", search: "'a':1"});
        expect(queries[0].trim()).toBe(`UPDATE "public"."projects" SET
"order" = 'desc'
WHERE ("id") in ((1));`);
    });

    it("should not run anything on a table without primary key", async () => {
        const pg = create_pg([column("a", "text")]);
        await pg.update_row({a: "x"});
        expect(queries).toEqual([]);
    });
});

describe("upsert_row edge cases", () => {
    it("should update a row whose primary key is 0", async () => {
        const pg = create_pg([column("id", "int4", {is_primary_key: "YES"}), column("name", "text")]);
        await pg.upsert_row({id: 0, name: "p"});
        expect(queries[0]).toMatch(/^UPDATE/);
    });

    it("should insert a row without primary key value", async () => {
        const pg = create_pg([column("id", "int4", {is_primary_key: "YES"}), column("name", "text")]);
        await pg.upsert_row({id: null, name: "p"});
        expect(queries[0]).toMatch(/^insert into/);
    });
});

describe("delete_selection edge cases", () => {
    it("should delete the selected rows of a single primary key", async () => {
        const pg = create_pg([column("id", "uuid", {is_primary_key: "YES"})]);
        pg.current_table!.rows = [{id: "00000000-0000-0000-0000-000000000001"}, {id: "00000000-0000-0000-0000-000000000002"}];
        pg.selected_rows = [1];
        await pg.delete_selection();
        expect(queries[0]).toBe(`delete from "public"."projects"
where ("id") in (('00000000-0000-0000-0000-000000000002'::uuid));`);
    });

    it("should not delete anything on a table without primary key", async () => {
        const pg = create_pg([column("a", "text")]);
        pg.current_table!.rows = [{a: "x"}];
        pg.selected_rows = [0];
        await pg.delete_selection();
        expect(queries).toEqual([]);
    });
});

describe("get_row_value", () => {
    it("should select the row by its whole primary key", async () => {
        const pg = create_pg([
            column("tenant_id", "int4", {is_primary_key: "YES"}),
            column("id", "int4", {is_primary_key: "YES"}),
            column("name", "text"),
        ]);
        await pg.get_row_value({tenant_id: 1, id: 2, name: "x"}, pg.current_table!.columns[2]);
        const data_call = calls.find((call) => call.command === "get_table_data");
        expect(data_call?.args.whereClause).toBe(`where ("tenant_id", "id") in ((1, 2))`);
    });
});

describe("update_data", () => {
    const columns = [
        column("tenant_id", "int4", {is_primary_key: "YES"}),
        column("id", "int4", {is_primary_key: "YES"}),
        column("userId", "int4"),
        column("order", "text"),
    ];
    const get_table_data_args = () => calls.find((call) => call.command === "get_table_data")!.args;

    it("should order by every primary key column by default", async () => {
        const pg = create_pg(columns);
        pg.selected_columns = new Set(columns.map((col) => col.column_name));
        await pg.refresh_data();
        expect(get_table_data_args().orderBy).toBe(`order by "tenant_id" asc, "id" asc`);
        expect(get_table_data_args().columns).toBe("*");
    });

    it("should quote the sorted column and the selected columns", async () => {
        const pg = create_pg(columns);
        pg.selected_columns = new Set(["userId", "order"]);
        pg.order_by = {column: "userId", direction: "desc"};
        await pg.refresh_data();
        expect(get_table_data_args().orderBy).toBe(`order by "userId" desc`);
        expect(get_table_data_args().columns).toBe(`"userId", "order"`);
    });
});

describe("filters_to_where", () => {
    it("should quote column names and join filters with and", () => {
        expect(
            filters_to_where([
                {column: "userId", column_type: "int4", operator: "=", value: "5"},
                {column: 'quo"te', column_type: "text", operator: "!=", value: "a"},
            ]),
        ).toBe(`\nwhere "userId" = 5\nand "quo""te" != 'a'`);
    });

    it("should escape like and regex patterns", () => {
        expect(filters_to_where([{column: "name", column_type: "varchar", operator: "ilike", value: "l'a%"}])).toBe(
            `\nwhere "name" ilike 'l''a%'`,
        );
        expect(filters_to_where([{column: "name", column_type: "text", operator: "!~*", value: "^it's"}])).toBe(
            `\nwhere "name" !~* '^it''s'`,
        );
    });

    it("should not add a value to is null filters", () => {
        expect(filters_to_where([{column: "note", column_type: "text", operator: "is not null", value: "x"}])).toBe(
            `\nwhere "note" is not null `,
        );
    });

    it("should cast uuid values", () => {
        expect(
            filters_to_where([
                {column: "id", column_type: "uuid", operator: "=", value: "550e8400-e29b-41d4-a716-446655440000"},
            ]),
        ).toBe(`\nwhere "id" = '550e8400-e29b-41d4-a716-446655440000'::uuid`);
    });
});
