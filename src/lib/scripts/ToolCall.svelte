<script lang="ts">
    import SparklesIcon from "$lib/icons/SparklesIcon.svelte";
    import ProgressCircle from "$lib/widgets/ProgressCircle.svelte";

    type Props = {
        name: string;
        args: Record<string, string>;
        result: string | undefined;
    };

    let {name, args, result}: Props = $props();

    let show_args = $state(false);
    let show_result = $state(false);
</script>

<div class="px-4">
    <div class="flex items-center text-sm text-fg-1">
        {#if result === undefined}
            <ProgressCircle --size="1rem" infinite={true} show_value={false} />
        {:else}
            <SparklesIcon --size="0.8rem" />
        {/if}
        <div class="ps-2">{name}</div>
        (
        <button class="btn ghost text-sm!" onclick={() => (show_args = !show_args)}>args</button>
        ) →
        {#if result !== undefined}
            <button class="btn ghost text-sm!" onclick={() => (show_result = !show_result)}>result</button>
        {/if}
    </div>
    {#if show_args}
        <div class="flex flex-col p-2 gap-1">
            {#each Object.entries(args) as [name, value] (name)}
                <div class="text-xs"><span class="text-fg-1">{name}:</span> {value}</div>
            {/each}
        </div>
    {/if}
    {#if result !== undefined && show_result}
        <div class="whitespace-pre-line font-mono text-xs border border-bg-1 rounded-lg overflow-auto p-2">
            {result}
        </div>
    {/if}
</div>
