<script lang="ts">
    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";
    import ProgressCircle from "$lib/widgets/ProgressCircle.svelte";

    type Props = {
        name: string;
        args: Record<string, string>;
        result: string | undefined;
    };

    let {name, args, result}: Props = $props();

    let show_details = $state(false);
</script>

<div class="px-2">
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
        <div class="flex flex-col gap-1 mx-2">
            {#each Object.entries(args) as [name, value] (name)}
                <div class="text-xs w-full mx-2">
                    <span class="text-fg-1 font-bold">{name}:</span>
                    <span>{JSON.stringify(value).replaceAll(",", ", ")}</span>
                </div>
            {/each}
        </div>
    {/if}
    {#if result !== undefined && show_details}
        <div class="text-fg-1 font-bold text-xs mt-2 mx-4">result</div>
        <div
            class="whitespace-pre-line font-mono text-xs border border-bg-1 rounded-lg overflow-auto p-4 m-2 text-fg-1"
        >
            {result}
        </div>
    {/if}
</div>
