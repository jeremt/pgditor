<script lang="ts">
    import {get_commands_context} from "$lib/commands/commands_context.svelte";
    import CleanBrushIcon from "$lib/icons/CleanBrushIcon.svelte";
    import FitViewIcon from "$lib/icons/FitViewIcon.svelte";
    import RefreshIcon from "$lib/icons/RefreshIcon.svelte";
    import {get_graph_context} from "./graph_context.svelte";

    const commands = get_commands_context();
    const graph = get_graph_context();

    let refreshing = $state(false);
    const refresh = async () => {
        refreshing = true;
        setTimeout(() => {
            refreshing = false;
        }, 500);
        await graph.load_db();
    };
</script>

<select
    class="select text-sm"
    bind:value={graph.current_schema}
    onchange={() => graph.filter_by_schema()}
>
    {#each graph.schemas as schema}
        <option value={schema}>{schema}</option>
    {/each}
</select>

<button class="btn icon ghost" onclick={graph.apply_layout} title="Re-layout {commands.shortcut('Re-layout')}">
    <CleanBrushIcon --size="1.2rem" />
</button>

<button class="btn icon ghost" onclick={graph.fit_view} title="Fit View">
    <FitViewIcon --size="1.2rem" />
</button>

<button class="btn icon ghost" onclick={refresh} title="Refresh">
    <RefreshIcon --size="1.2rem" spinning={refreshing} />
</button>
