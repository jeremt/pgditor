<script lang="ts">
    import {get_commands_context} from "$lib/commands/commands_context.svelte";
    import CleanBrushIcon from "$lib/icons/CleanBrushIcon.svelte";
    import DownloadIcon from "$lib/icons/DownloadIcon.svelte";
    import FitViewIcon from "$lib/icons/FitViewIcon.svelte";
    import RefreshIcon from "$lib/icons/RefreshIcon.svelte";
    import Popover from "$lib/widgets/Popover.svelte";
    import SchemaSelect from "./SchemaSelect.svelte";
    import {get_graph_context} from "./graph_context.svelte";

    const commands = get_commands_context();
    const graph = get_graph_context();

    let is_export_open = $state(false);

    const export_graph = async (export_fn: () => Promise<void>) => {
        is_export_open = false;
        await export_fn();
    };

    let refreshing = $state(false);

    const refresh = async () => {
        refreshing = true;
        setTimeout(() => {
            refreshing = false;
        }, 500);
        await graph.load_db();
    };
</script>

<SchemaSelect
    schemas={graph.schemas}
    current_schema={graph.current_schema}
    onselect={(schema) => graph.navigate_to_schema(schema)}
/>

<button class="btn icon ghost" onclick={graph.apply_layout} title="Re-layout {commands.shortcut('Re-layout')}">
    <CleanBrushIcon --size="1.2rem" />
</button>

<button class="btn icon ghost" onclick={graph.fit_view} title="Fit View">
    <FitViewIcon --size="1.2rem" />
</button>

<Popover bind:is_open={is_export_open} offset_y={10}>
    {#snippet target()}
        <button
            class="btn icon ghost"
            onclick={() => (is_export_open = !is_export_open)}
            title="Export"
            disabled={graph.exporting || graph.nodes.length === 0}
        >
            <DownloadIcon --size="1.2rem" />
        </button>
    {/snippet}
    <div class="flex flex-col gap-1">
        <span class="text-xs text-fg-2 px-2 py-1">Export graph</span>
        <div class="flex gap-1">
            <button class="btn secondary flex-1" title="Image of the graph" onclick={() => export_graph(graph.export_png)}
                >PNG</button
            >
            <button class="btn secondary flex-1" title="d2lang.com diagram" onclick={() => export_graph(graph.export_d2)}
                >D2</button
            >
        </div>
    </div>
</Popover>

<button class="btn icon ghost" onclick={refresh} title="Refresh">
    <RefreshIcon --size="1.2rem" spinning={refreshing} />
</button>
