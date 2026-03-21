<script lang="ts">
    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";
    import Popover from "$lib/widgets/Popover.svelte";
    import {fuzzy_search_with_highlights, render_highlighted_match} from "$lib/helpers/fuzzy_search";

    type Props = {
        schemas: string[];
        current_schema: string;
        onselect: (schema: string) => void;
    };

    let {schemas, current_schema, onselect}: Props = $props();

    let is_open = $state(false);
    let search = $state("");
    let selected_index = $state(0);
    let input_ref = $state<HTMLInputElement>();
    let button_refs = $state<HTMLButtonElement[]>([]);

    const results = $derived(
        search === ""
            ? schemas.map((s) => ({schema: s, html: s}))
            : fuzzy_search_with_highlights(search, schemas).map(({item, ranges}) => ({
                  schema: item,
                  html: render_highlighted_match(item, ranges),
              })),
    );

    $effect(() => {
        search;
        selected_index = 0;
    });

    $effect(() => {
        if (is_open && input_ref) {
            input_ref.focus();
        }
    });

    $effect(() => {
        if (button_refs[selected_index]) {
            button_refs[selected_index].scrollIntoView({behavior: "instant", block: "nearest"});
        }
    });

    const handle_keys = (event: KeyboardEvent) => {
        const len = results.length;
        if (event.key === "ArrowDown" && selected_index < len - 1) {
            selected_index++;
            event.preventDefault();
        } else if (event.key === "ArrowUp" && selected_index > 0) {
            selected_index--;
            event.preventDefault();
        } else if (event.key === "Enter") {
            select(results[selected_index]?.schema);
        }
    };

    const select = (schema: string | undefined) => {
        if (schema) {
            onselect(schema);
            search = "";
            is_open = false;
        }
    };
</script>

<Popover bind:is_open offset_y={10}>
    {#snippet target()}
        <button class="btn ghost text-sm" onclick={() => (is_open = !is_open)}>
            {current_schema}
            <ChevronIcon --size="1rem" direction={is_open ? "top" : "bottom"} />
        </button>
    {/snippet}
    <div class="flex flex-col gap-2 min-w-60">
        <input
            bind:this={input_ref}
            type="text"
            bind:value={search}
            onkeydown={handle_keys}
            autocorrect="off"
            placeholder="Search schemas"
        />
        <div class="flex flex-col gap-1 overflow-auto max-h-60 py-1">
            {#each results as {schema, html}, i}
                <button
                    bind:this={button_refs[i]}
                    class="btn ghost justify-start!"
                    class:selected={i === selected_index}
                    onclick={() => select(schema)}
                >
                    <span class="search-result">{@html html}</span>
                </button>
            {:else}
                <p class="text-sm text-center text-fg-2 py-2">No schema found</p>
            {/each}
        </div>
    </div>
</Popover>

<style>
    input[type="text"] {
        background-color: transparent;
        &:focus-visible {
            border: 1px solid transparent;
        }
    }
    .search-result {
        color: var(--color-fg-2);
        :global(b) {
            color: var(--color-fg);
        }
    }
    .selected {
        background-color: var(--color-bg-1) !important;
    }
</style>
