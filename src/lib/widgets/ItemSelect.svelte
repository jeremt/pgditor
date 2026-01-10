<script lang="ts" generics="ItemType">
    import {fuzzySearchWithHighlights, renderHighlightedMatch} from "$lib/helpers/fuzzySearch";
    import type {Snippet} from "svelte";

    type Props = {
        items: ItemType[];
        itemToString: (item: ItemType) => string;
        onselect: (item: ItemType) => void;
        renderItem: Snippet<[item: ItemType, index: number, selectedIndex: number, highlights?: string]>;
        renderAction?: Snippet;
        placeholder?: string;
        noResult?: string;
        noItems?: string;
    };

    let {
        items,
        itemToString,
        onselect,
        renderItem,
        renderAction,
        placeholder = "Filter items",
        noResult = "No result found",
        noItems = "No items",
    }: Props = $props();

    let searchText = $state("");
    let searchResult = $derived(
        fuzzySearchWithHighlights(searchText, items.map(itemToString)).map(({item, ranges}) => ({
            text: item,
            html: renderHighlightedMatch(item, ranges),
        }))
    );

    let selectedIndex = $state(0);
    let buttonRefs = $state<HTMLButtonElement[]>([]);

    $effect(() => {
        if (buttonRefs[selectedIndex]) {
            buttonRefs[selectedIndex].scrollIntoView({
                behavior: "instant",
                block: "nearest",
            });
        }
    });

    const handleKeys = (event: KeyboardEvent) => {
        if (event.key === "Enter") {
            const selectedItem =
                searchText === ""
                    ? items[selectedIndex]
                    : items.find((item) => itemToString(item) === searchResult[selectedIndex].text);
            if (selectedItem) {
                onselect(selectedItem);
                searchText = "";
            }
        } else if (event.key === "ArrowUp") {
            selectedIndex =
                selectedIndex === 0 ? (searchText === "" ? items.length : searchResult.length) - 1 : selectedIndex - 1;
        } else if (
            event.key === "ArrowDown" &&
            selectedIndex + 1 < (searchText === "" ? items.length : searchResult.length)
        ) {
            selectedIndex += 1;
        } else {
            selectedIndex = 0;
        }
    };
</script>

<div class="flex flex-col gap-2 w-2xl overflow-hidden">
    <div class="flex gap-4">
        <input
            type="text"
            class="grow"
            bind:value={searchText}
            onkeydown={handleKeys}
            autocorrect="off"
            {placeholder}
        />
        {@render renderAction?.()}
    </div>
    <div class="flex flex-col gap-2 overflow-auto h-80 py-2">
        {#if searchText === ""}
            {#each items as item, i}
                <button
                    bind:this={buttonRefs[i]}
                    class="btn ghost justify-start!"
                    class:selected-table={i === selectedIndex}
                    onclick={() => {
                        onselect(item);
                    }}
                >
                    {@render renderItem(item, i, selectedIndex)}
                </button>
            {:else}
                <p class="text-sm text-center text-fg-2">{noItems}</p>
            {/each}
        {:else}
            {#each searchResult as { text, html }, i}
                {@const item = items.find((item) => itemToString(item) === text)}
                {#if item}
                    <button
                        bind:this={buttonRefs[i]}
                        class="btn ghost justify-start!"
                        class:selected-table={i === selectedIndex}
                        onclick={() => {
                            if (item) {
                                onselect(item);
                                searchText = "";
                            }
                        }}
                    >
                        {@render renderItem(item, i, selectedIndex, html)}
                    </button>
                {/if}
            {:else}
                <p class="text-sm text-center text-fg-2">{noResult}</p>
            {/each}
        {/if}
    </div>
</div>

<style>
    input[type="text"] {
        background-color: transparent;
    }
    .selected-table {
        background-color: var(--color-bg-1) !important;
    }
</style>
