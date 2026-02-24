<script lang="ts" generics="ItemType">
    import {fuzzy_search_with_highlights, render_highlighted_match} from "$lib/helpers/fuzzy_search";
    import type {Snippet} from "svelte";

    type Props = {
        items: ItemType[];
        item_to_string: (item: ItemType) => string;
        onselect: (item: ItemType) => void;
        render_item: Snippet<[item: ItemType, index: number, selectedIndex: number, highlights?: string]>;
        render_action?: Snippet;
        placeholder?: string;
        no_result?: string;
        no_items?: string;
    };

    let {
        items,
        item_to_string,
        onselect,
        render_item,
        render_action,
        placeholder = "Filter items",
        no_result = "No result found",
        no_items = "No items",
    }: Props = $props();

    let search_text = $state("");
    let search_result = $derived(
        fuzzy_search_with_highlights(search_text, items.map(item_to_string)).map(({item, ranges}) => ({
            text: item,
            html: render_highlighted_match(item, ranges),
        })),
    );

    let selected_index = $state(0);
    let button_refs = $state<HTMLButtonElement[]>([]);

    $effect(() => {
        if (button_refs[selected_index]) {
            button_refs[selected_index].scrollIntoView({
                behavior: "instant",
                block: "nearest",
            });
        }
    });

    const handle_keys = (event: KeyboardEvent) => {
        if (event.key === "Enter") {
            const selectedItem =
                search_text === ""
                    ? items[selected_index]
                    : items.find((item) => item_to_string(item) === search_result[selected_index].text);
            if (selectedItem) {
                onselect(selectedItem);
                search_text = "";
            }
        } else if (event.key === "ArrowUp") {
            selected_index =
                selected_index === 0
                    ? (search_text === "" ? items.length : search_result.length) - 1
                    : selected_index - 1;
            event.preventDefault();
        } else if (
            event.key === "ArrowDown" &&
            selected_index + 1 < (search_text === "" ? items.length : search_result.length)
        ) {
            selected_index += 1;
            event.preventDefault();
        } else {
            selected_index = 0;
        }
    };
</script>

<div class="flex flex-col gap-2 w-2xl overflow-hidden">
    <div class="flex gap-4">
        <input
            type="text"
            class="grow"
            bind:value={search_text}
            onkeydown={handle_keys}
            autocorrect="off"
            {placeholder}
        />
        {@render render_action?.()}
    </div>
    <div class="flex flex-col gap-2 overflow-auto h-80 py-2">
        {#if search_text === ""}
            {#each items as item, i}
                <button
                    bind:this={button_refs[i]}
                    class="item-btn"
                    class:selected-table={i === selected_index}
                    onclick={() => {
                        onselect(item);
                    }}
                >
                    {@render render_item(item, i, selected_index)}
                </button>
            {:else}
                <p class="text-sm text-center text-fg-2">{no_items}</p>
            {/each}
        {:else}
            {#each search_result as { text, html }, i}
                {@const item = items.find((item) => item_to_string(item) === text)}
                {#if item}
                    <button
                        bind:this={button_refs[i]}
                        class="item-btn"
                        class:selected-table={i === selected_index}
                        onclick={() => {
                            if (item) {
                                onselect(item);
                                search_text = "";
                            }
                        }}
                    >
                        {@render render_item(item, i, selected_index, html)}
                    </button>
                {/if}
            {:else}
                <p class="text-sm text-center text-fg-2">{no_result}</p>
            {/each}
        {/if}
    </div>
</div>

<style>
    input[type="text"] {
        background-color: transparent;
        &:focus-visible {
            border: 1px solid transparent;
        }
    }
    .selected-table {
        background-color: var(--color-bg-1) !important;
    }
    button.item-btn {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
        flex-shrink: 0;
        text-wrap: nowrap;
        align-items: center;
        font-weight: bold;
        color: var(--color-fg);
        background-color: transparent;
        border-radius: var(--radius-btn);
        cursor: pointer;
        outline: none;
        border: 1px solid transparent;
        font-size: var(--text-sm);
        padding-inline: 0.8em;
        transition: 0.1s all;
        &:disabled {
            opacity: 0.3;
            cursor: default;
            pointer-events: none;
        }
        &:hover,
        &:focus-visible {
            background-color: var(--color-bg-1);
        }
        &:active {
            translate: 0 0.15em;
        }
    }
</style>
