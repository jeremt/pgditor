<script lang="ts">
    import {get_pg_context, type PgTableForGraph} from "$lib/table/pgContext.svelte";
    import {SvelteFlow, Background, BackgroundVariant, MiniMap, type Node, type Edge} from "@xyflow/svelte";
    import {build_edges, build_nodes} from "./graph";
    import TableNode from "./TableNode.svelte";

    import "@xyflow/svelte/dist/style.css";

    const pg = get_pg_context();

    let tables = $state<PgTableForGraph[]>([]);
    let nodes = $state.raw<Node[]>([]);
    let edges = $state.raw<Edge[]>([]);
    let error_message = $state("");

    $effect(() => {
        (async () => {
            const t = await pg.list_tables_for_graph();
            if (t instanceof Error) {
                error_message = t.message;
            } else {
                tables = t;
                nodes = build_nodes(tables);
                edges = build_edges(tables);
            }
        })();
    });

    const nodeTypes = {
        table: TableNode,
    };
</script>

<div class="grow border-t border-t-bg-1">
    <SvelteFlow bind:nodes bind:edges {nodeTypes} fitView nodesConnectable={false} minZoom={0.1}>
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
    :global(.svelte-flow__attribution) {
        display: none;
    }
</style>
