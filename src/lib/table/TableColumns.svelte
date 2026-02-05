<script lang="ts">
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import ColumnsIcon from "$lib/icons/ColumnsIcon.svelte";
    import CheckboxInput from "$lib/widgets/CheckboxInput.svelte";
    import Popover from "$lib/widgets/Popover.svelte";
    import {SvelteSet} from "svelte/reactivity";
    import {getPgContext} from "./pgContext.svelte";

    const pg = getPgContext();
    let isColumnsOpen = $state(false);
    const applyColumns = () => {
        pg.selectedColumns = selectedColums;
        pg.refreshData();
        isColumnsOpen = false;
    };
    let selectedColums = $derived.by(() => {
        const copy = $state(new SvelteSet(pg.selectedColumns));
        return copy;
    });
</script>

<Popover bind:isOpen={isColumnsOpen} offsetY={10}>
    {#snippet target()}
        <button class="btn ghost icon relative" title="Select columns" onclick={() => (isColumnsOpen = !isColumnsOpen)}
            ><ColumnsIcon --size="1.2rem" />
        </button>
    {/snippet}
    <div class="flex flex-col gap-4 max-h-96">
        <div class="flex flex-col gap-2 overflow-auto grow">
            {#if pg.currentTable !== undefined}
                <label class="flex gap-2 font-bold text-sm items-center">
                    <CheckboxInput
                        checked={selectedColums.size === pg.currentTable.columns.length &&
                            pg.currentTable.columns.length > 0}
                        disabled={pg.currentTable.columns.length === 0}
                        indeterminate={selectedColums.size > 0 &&
                            selectedColums.size !== pg.currentTable.columns.length}
                        onchange={() => {
                            if (pg.currentTable === undefined) {
                                return;
                            }
                            if (selectedColums.size === pg.currentTable.columns.length) {
                                selectedColums.clear();
                            } else {
                                selectedColums = new SvelteSet(pg.currentTable.columns.map((col) => col.column_name));
                            }
                        }}
                    />
                    <span>all columns</span>
                </label>
                {#each pg.currentTable.columns as column}
                    <label class="flex gap-2 font-bold text-sm items-center">
                        <CheckboxInput
                            bind:checked={
                                () => selectedColums.has(column.column_name),
                                (isChecked) => {
                                    if (isChecked) {
                                        selectedColums.add(column.column_name);
                                    } else {
                                        selectedColums.delete(column.column_name);
                                    }
                                }
                            }
                        /> <span>{column.column_name}</span><span class="font-normal text-xs">{column.data_type}</span>
                    </label>
                {/each}
            {/if}
        </div>
        <button class="btn" onclick={applyColumns}><CheckIcon --size="1rem" /> Apply</button>
    </div>
</Popover>
