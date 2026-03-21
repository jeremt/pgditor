<script lang="ts">
    import {Handle, Position, type Node, type NodeProps} from "@xyflow/svelte";

    type Props = NodeProps<Node<{schema: string; name: string; label: string; handles: string[]}, "foreign">>;

    let {data, id}: Props = $props();
</script>

<button
    class="bg-bg border border-bg-2 hover:border-fg-2 rounded-lg px-3 py-2 min-w-32 cursor-pointer"
>
    <div class="flex items-center gap-2">
        {#each data.handles as handle_id (handle_id)}
            <Handle type="target" position={Position.Left} id={`${handle_id}-target`} />
        {/each}
        <span>{data.label}</span>
        {#each data.handles as handle_id (handle_id)}
            <Handle type="source" position={Position.Right} id={`${handle_id}-source`} />
        {/each}
    </div>
</button>

<style>
    :global(.svelte-flow__handle) {
        opacity: 0;
    }
</style>
