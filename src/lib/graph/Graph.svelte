<script lang="ts">
    import {SvelteFlow, Background, BackgroundVariant, MiniMap, useNodes, useSvelteFlow} from "@xyflow/svelte";
    import TableNode from "./TableNode.svelte";

    import "@xyflow/svelte/dist/style.css";
    import {get_graph_context} from "./graphContext.svelte";

    const graph = get_graph_context();
    const {fitView} = useSvelteFlow();

    graph.fit_view = fitView;

    $effect(() => {
        graph.load_db();
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
            width={120}
            height={120}
            nodeColor="var(--color-bg)"
            nodeStrokeColor="var(--color-fg)"
            nodeStrokeWidth={6}
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
