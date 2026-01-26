<script lang="ts">
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import ColumnsIcon from "$lib/icons/ColumnsIcon.svelte";
    import CheckboxInput from "$lib/widgets/CheckboxInput.svelte";
    import Popover from "$lib/widgets/Popover.svelte";
    import {getPgContext} from "./pgContext.svelte";

    const pg = getPgContext();
    let isColumnsOpen = $state(false);
    const applyColumns = () => {
        pg.refreshData();
        isColumnsOpen = false;
    };
</script>

<Popover bind:isOpen={isColumnsOpen} offsetY={10}>
    {#snippet target()}
        <button class="btn ghost icon relative" title="Select columns" onclick={() => (isColumnsOpen = !isColumnsOpen)}
            ><ColumnsIcon --size="1.2rem" />
        </button>
    {/snippet}
    <div class="flex flex-col gap-4 max-h-96">
        <div class="flex flex-col gap-2 overflow-auto grow">
            {#each pg.currentTable?.columns ?? [] as column}
                <label class="flex gap-2 font-bold text-sm items-center">
                    <CheckboxInput
                        bind:checked={
                            () => pg.selectedColumns.has(column.column_name),
                            (isChecked) => {
                                if (isChecked) {
                                    pg.selectedColumns.add(column.column_name);
                                } else {
                                    pg.selectedColumns.delete(column.column_name);
                                }
                            }
                        }
                    /> <span>{column.column_name}</span><span class="font-normal text-xs">{column.data_type}</span>
                </label>
            {/each}
        </div>
        <button class="btn" onclick={applyColumns}><CheckIcon --size="1rem" /> Apply</button>
    </div>
</Popover>
