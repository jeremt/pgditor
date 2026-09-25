import {beforeEach, describe, expect, it, vi} from "vitest";
import type {PgColumn, PgRow} from "./pg_context.svelte";

const queries: string[] = [];

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
    invoke: async (command: string, args: {sql?: string}) => {
        if (command === "raw_query") {
            queries.push(args.sql!);
        }
        return {rows: [], count: 0, duration_ms: 0};
    },
}));
vi.mock("@tauri-apps/api/window", () => ({getCurrentWindow: () => ({setTitle: async () => {}})}));
vi.mock("$lib/widgets/Toaster.svelte", () => ({get_toast_context: () => ({toast: () => {}})}));

const {set_pg_context} = await import("./pg_context.svelte");

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
