<script lang="ts">
    import {get_pg_context, type PgTableForGraph} from "$lib/table/pgContext.svelte";
    import {SvelteFlow, Background, BackgroundVariant, MiniMap} from "@xyflow/svelte";
    import "@xyflow/svelte/dist/style.css";

    const pg = get_pg_context();

    let tables = $state<PgTableForGraph[]>([]);
    let nodes = $state.raw<any[]>([]);
    let edges = $state.raw<any[]>([]);
    let error_message = $state("");
    $effect(() => {
        (async () => {
            const t = await pg.list_tables_for_graph();
            if (t instanceof Error) {
                error_message = t.message;
            } else {
                tables = t;
                nodes = tables.map((table, index) => ({
                    id: `${table.schema}.${table.name}`,
                    position: {x: index * 300, y: 100},
                    data: {
                        label: table.name,
                        schema: table.schema,
                        columns: table.columns,
                    },
                    type: "table",
                }));
                edges = tables.flatMap((table) =>
                    table.columns
                        .filter((col) => col.foreign_table_name !== null)
                        .map((col) => ({
                            id: `${table.schema}.${table.name}.${col.column_name}-${col.foreign_table_schema}.${col.foreign_table_name}.${col.foreign_column_name}`,
                            source: `${col.foreign_table_schema}.${col.foreign_table_name}`,
                            sourceHandle: `${col.foreign_table_schema}.${col.foreign_table_name}.${col.foreign_column_name}-source`,
                            target: `${table.schema}.${table.name}`,
                            targetHandle: `${table.schema}.${table.name}.${col.column_name}-target`,
                            style: "stroke: var(--color-fg-1); stroke-width: 1px;",
                            type: "smoothstep",
                        })),
                );
            }
        })();
    });

    const default_tables = [
        {
            schema: "public",
            name: "users",
            columns: [
                {
                    column_name: "id",
                    data_type: "int4",
                    foreign_table_schema: null,
                    foreign_table_name: null,
                    foreign_column_name: null,
                },
                {
                    column_name: "name",
                    data_type: "text",
                    foreign_table_schema: null,
                    foreign_table_name: null,
                    foreign_column_name: null,
                },
                {
                    column_name: "email",
                    data_type: "varchar",
                    foreign_table_schema: null,
                    foreign_table_name: null,
                    foreign_column_name: null,
                },
            ],
        },
        {
            schema: "public",
            name: "posts",
            columns: [
                {
                    column_name: "id",
                    data_type: "int4",
                    foreign_table_schema: null,
                    foreign_table_name: null,
                    foreign_column_name: null,
                },
                {
                    column_name: "title",
                    data_type: "text",
                    foreign_table_schema: null,
                    foreign_table_name: null,
                    foreign_column_name: null,
                },
                {
                    column_name: "content",
                    data_type: "text",
                    foreign_table_schema: null,
                    foreign_table_name: null,
                    foreign_column_name: null,
                },
                {
                    column_name: "user_id",
                    data_type: "int4",
                    foreign_table_schema: "public",
                    foreign_table_name: "users",
                    foreign_column_name: "id",
                },
                {
                    column_name: "category_id",
                    data_type: "int4",
                    foreign_table_schema: "public",
                    foreign_table_name: "categories",
                    foreign_column_name: "id",
                },
            ],
        },
        {
            schema: "public",
            name: "comments",
            columns: [
                {
                    column_name: "id",
                    data_type: "int4",
                    foreign_table_schema: null,
                    foreign_table_name: null,
                    foreign_column_name: null,
                },
                {
                    column_name: "text",
                    data_type: "text",
                    foreign_table_schema: null,
                    foreign_table_name: null,
                    foreign_column_name: null,
                },
                {
                    column_name: "post_id",
                    data_type: "int4",
                    foreign_table_schema: "public",
                    foreign_table_name: "posts",
                    foreign_column_name: "id",
                },
                {
                    column_name: "user_id",
                    data_type: "int4",
                    foreign_table_schema: "public",
                    foreign_table_name: "users",
                    foreign_column_name: "id",
                },
            ],
        },
        {
            schema: "public",
            name: "categories",
            columns: [
                {
                    column_name: "id",
                    data_type: "int4",
                    foreign_table_schema: null,
                    foreign_table_name: null,
                    foreign_column_name: null,
                },
                {
                    column_name: "name",
                    data_type: "varchar",
                    foreign_table_schema: null,
                    foreign_table_name: null,
                    foreign_column_name: null,
                },
                {
                    column_name: "parent_id",
                    data_type: "int4",
                    foreign_table_schema: "public",
                    foreign_table_name: "categories",
                    foreign_column_name: "id",
                },
            ],
        },
        {
            schema: "public",
            name: "post_tags",
            columns: [
                {
                    column_name: "id",
                    data_type: "int4",
                    foreign_table_schema: null,
                    foreign_table_name: null,
                    foreign_column_name: null,
                },
                {
                    column_name: "post_id",
                    data_type: "int4",
                    foreign_table_schema: "public",
                    foreign_table_name: "posts",
                    foreign_column_name: "id",
                },
                {
                    column_name: "tag_id",
                    data_type: "int4",
                    foreign_table_schema: "public",
                    foreign_table_name: "tags",
                    foreign_column_name: "id",
                },
            ],
        },
    ];

    // Custom node component
    import TableNode from "./TableNode.svelte";

    const nodeTypes = {
        table: TableNode,
    };
</script>

<div class="grow border-t border-t-bg-1">
    <SvelteFlow bind:nodes bind:edges {nodeTypes} fitView nodesConnectable={false}>
        <MiniMap nodeColor="var(--color-bg)" maskColor="var(--color-bg-1)" bgColor="var(--color-bg-2)" />
        <Background
            bgColor="var(--color-bg)"
            patternColor="var(--color-bg-1)"
            size={3}
            variant={BackgroundVariant.Dots}
        />
    </SvelteFlow>
</div>

<style>
    :global(.graph-edge) {
        stroke: red;
        stroke-width: 3px;
    }
</style>
