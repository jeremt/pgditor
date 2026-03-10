<script lang="ts">
    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";
    import SparklesIcon from "$lib/icons/SparklesIcon.svelte";
    import ProgressCircle from "$lib/widgets/ProgressCircle.svelte";

    type Props = {
        name: string;
        args: Record<string, string>;
        result: string | undefined;
    };

    let {name, args, result}: Props = $props();

    let show_details = $state(false);
</script>

<div class="px-4">
    <button
        class="flex items-center text-sm text-fg-1 cursor-pointer p-2 gap-2"
        onclick={() => (show_details = !show_details)}
    >
        {#if result === undefined}
            <ProgressCircle --size="1rem" infinite={true} show_value={false} />
        {/if}
        <ChevronIcon --size="1rem" direction={show_details ? "bottom" : "right"} />
        {name}
    </button>
    {#if show_details}
        <div class="flex flex-col p-2 gap-1">
            {#each Object.entries(args) as [name, value] (name)}
                <div class="text-xs"><span class="text-fg-1">{name}:</span> {value}</div>
            {/each}
        </div>
    {/if}
    {#if result !== undefined && show_details}
        <div class="whitespace-pre-line font-mono text-xs border border-bg-1 rounded-lg overflow-auto p-2">
            {result}
        </div>
    {/if}
</div>
