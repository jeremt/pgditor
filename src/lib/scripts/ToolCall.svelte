<script lang="ts">
    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";
    import CodeBlock from "$lib/monaco/CodeBlock.svelte";
    import CodeInline from "$lib/monaco/CodeInline.svelte";
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
        class="flex items-center text-sm text-fg-1 hover:text-fg transition-all cursor-pointer p-2 gap-2"
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
                    <CodeInline code={JSON.stringify(value).replaceAll(",", ", ")} lang="json" />
                </div>
            {/each}
        </div>
    {/if}
    {#if result !== undefined && show_details}
        <CodeBlock
            class="[&_pre]:m-2 [&_pre]:max-h-80 [&_pre]:p-2 [&_pre]:text-xs [&_pre]:font-mono [&_pre]:overflow-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-bg-1"
            code={JSON.stringify(JSON.parse(result), null, 2)}
            lang="json"
        />
    {/if}
</div>
