<script lang="ts">
    import {get_pg_context, type PgTableForGraph} from "$lib/table/pgContext.svelte";
    import {
        SvelteFlow,
        Background,
        BackgroundVariant,
        MiniMap,
        type Node,
        type Edge,
        useNodesInitialized,
    } from "@xyflow/svelte";
    import {build_edges, build_nodes} from "./graph";
    import TableNode from "./TableNode.svelte";

    import "@xyflow/svelte/dist/style.css";
    import {get_graph_context} from "./graphContext.svelte";

    const graph = get_graph_context();
    const nodesInitialized = useNodesInitialized();
    let initialized = false; // breaks the infinite effect loop

    $effect(() => {
        graph.load_db();
        initialized = false;
        console.log("load db");
    });

    $effect(() => {
        if (!initialized && nodesInitialized.current) {
            console.log("apply layout");
            graph.apply_layout();
            initialized = true;
        }
    });

    const nodeTypes = {
        table: TableNode,
    };
</script>

<div class="grow border-t border-t-bg-1">
    <SvelteFlow
        bind:nodes={graph.nodes}
        bind:edges={graph.edges}
        {nodeTypes}
        fitView
        nodesConnectable={false}
        minZoom={0.1}
    >
        <MiniMap
            width={160}
            height={90}
            nodeColor="var(--color-fg-1)"
            maskColor="var(--color-backdrop)"
            bgColor="var(--color-bg)"
        />
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
