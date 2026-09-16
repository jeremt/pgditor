import {expect, suite, test} from "vitest";

import type {PgColumn, PgTableForGraph} from "$lib/table/pg_context.svelte";
import {build_d2} from "./d2";

const column = (column_name: string, data_type: string, overrides: Partial<PgColumn> = {}): PgColumn => ({
    column_name,
    data_type: data_type as PgColumn["data_type"],
    data_type_params: null,
    is_nullable: "NO",
    column_default: null,
    is_primary_key: "NO",
    foreign_table_schema: null,
    foreign_table_name: null,
    foreign_column_name: null,
    enum_values: null,
    ...overrides,
});

const table = (name: string, columns: PgColumn[], schema = "public"): PgTableForGraph =>
    ({schema, name, type: "BASE TABLE", columns}) as PgTableForGraph;

suite("build_d2", () => {
    test("tables, columns and foreign keys", () => {
        const d2 = build_d2(
            [
                table("organizations", [
                    column("id", "uuid", {is_primary_key: "YES"}),
                    column("plan", "varchar", {data_type_params: "(32)", is_nullable: "YES"}),
                ]),
                table("users", [
                    column("id", "uuid", {is_primary_key: "YES"}),
                    column("org_id", "uuid", {
                        foreign_table_schema: "public",
                        foreign_table_name: "organizations",
                        foreign_column_name: "id",
                    }),
                ]),
            ],
            "public",
        );
        expect(d2).toBe(`direction: right

organizations: {
  shape: sql_table
  id: "uuid" {constraint: primary_key}
  plan: "varchar(32)?"
}

users: {
  shape: sql_table
  id: "uuid" {constraint: primary_key}
  org_id: "uuid" {constraint: foreign_key}
}

users.org_id -> organizations.id
`);
    });

    test("tables referenced from other schemas are included", () => {
        const d2 = build_d2(
            [
                table("audit_log", [
                    column("actor_id", "uuid", {
                        is_primary_key: "YES",
                        foreign_table_schema: "auth",
                        foreign_table_name: "users",
                        foreign_column_name: "id",
                    }),
                ]),
            ],
            "public",
        );
        expect(d2).toContain(`actor_id: "uuid" {constraint: [primary_key; foreign_key]}`);
        expect(d2).toContain(`"auth.users": {\n  shape: sql_table\n  id: "uuid"\n}`);
        expect(d2).toContain(`audit_log.actor_id -> "auth.users".id`);
    });

    test("names that d2 would interpret are quoted", () => {
        const d2 = build_d2(
            [table("my table", [column("label", "text"), column("2fa", "bool"), column('say "hi"', "text")])],
            "public",
        );
        expect(d2).toContain(`"my table": {`);
        expect(d2).toContain(`  "label": "text"`);
        expect(d2).toContain(`  "2fa": "bool"`);
        expect(d2).toContain(`  "say \\"hi\\"": "text"`);
    });
});
