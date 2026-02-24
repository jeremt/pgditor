<script lang="ts">
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import ColumnsIcon from "$lib/icons/ColumnsIcon.svelte";
    import CheckboxInput from "$lib/widgets/CheckboxInput.svelte";
    import Popover from "$lib/widgets/Popover.svelte";
    import {SvelteSet} from "svelte/reactivity";
    import {get_pg_context} from "./pg_context.svelte";

    const pg = get_pg_context();
    let is_columns_open = $state(false);
    const apply_columns = () => {
        pg.selected_columns = selected_colums;
        pg.refresh_data();
        is_columns_open = false;
    };
    let selected_colums = $derived.by(() => {
        const copy = $state(new SvelteSet(pg.selected_columns));
        return copy;
    });
</script>

<Popover bind:is_open={is_columns_open} offset_y={10}>
    {#snippet target()}
        <button
            class="btn ghost icon relative"
            title="Select columns"
            onclick={() => (is_columns_open = !is_columns_open)}
            ><ColumnsIcon --size="1.2rem" />
        </button>
    {/snippet}
    <div class="flex flex-col gap-4 max-h-96">
        <div class="flex flex-col gap-2 overflow-auto grow">
            {#if pg.current_table !== undefined}
                <label class="flex gap-2 font-bold text-sm items-center">
                    <CheckboxInput
                        checked={selected_colums.size === pg.current_table.columns.length &&
                            pg.current_table.columns.length > 0}
                        disabled={pg.current_table.columns.length === 0}
                        indeterminate={selected_colums.size > 0 &&
                            selected_colums.size !== pg.current_table.columns.length}
                        onchange={() => {
                            if (pg.current_table === undefined) {
                                return;
                            }
                            if (selected_colums.size === pg.current_table.columns.length) {
                                selected_colums.clear();
                            } else {
                                selected_colums = new SvelteSet(pg.current_table.columns.map((col) => col.column_name));
                            }
                        }}
                    />
                    <span>all columns</span>
                </label>
                {#each pg.current_table.columns as column}
                    <label class="flex gap-2 font-bold text-sm items-center">
                        <CheckboxInput
                            bind:checked={
                                () => selected_colums.has(column.column_name),
                                (is_checked) => {
                                    if (is_checked) {
                                        selected_colums.add(column.column_name);
                                    } else {
                                        selected_colums.delete(column.column_name);
                                    }
                                }
                            }
                        /> <span>{column.column_name}</span><span class="font-normal text-xs">{column.data_type}</span>
                    </label>
                {/each}
            {/if}
        </div>
        <button class="btn" onclick={apply_columns}><CheckIcon --size="1rem" /> Apply</button>
    </div>
</Popover>
