<script lang="ts">
    import CheckboxInput from "$lib/widgets/CheckboxInput.svelte";
    import {get_pg_context} from "./pg_context.svelte";

    const pg = get_pg_context();

    let last_checked_index: number | null = $state(null);

    const handle_header_change = () => {
        if (!pg.current_table) return;
        if (pg.selected_rows.length === pg.current_table.rows.length) {
            pg.selected_rows = [];
        } else {
            pg.selected_rows = Array.from(new Array(pg.current_table.rows.length)).map((_, i) => i);
        }
    };

    const handle_row_click = (e: MouseEvent, index: number) => {
        const is_checked = (e.currentTarget as HTMLInputElement).checked;
        const is_shift_pressed = e.shiftKey;

        if (is_shift_pressed && last_checked_index !== null) {
            const start = Math.min(last_checked_index, index);
            const end = Math.max(last_checked_index, index);

            for (let j = start; j <= end; j++) {
                const alreadySelected = pg.selected_rows.indexOf(j) !== -1;

                if (is_checked && !alreadySelected) {
                    pg.selected_rows.push(j);
                } else if (!is_checked && alreadySelected) {
                    pg.selected_rows.splice(pg.selected_rows.indexOf(j), 1);
                }
            }
        } else {
            if (is_checked) {
                pg.selected_rows.push(index);
            } else {
                pg.selected_rows.splice(pg.selected_rows.indexOf(index), 1);
            }
        }

        last_checked_index = index;
    };
</script>

<div>
    {#if pg.current_table}
        <div class="grid items-center px-2 h-10">
            <CheckboxInput
                checked={pg.selected_rows.length === pg.current_table.rows.length &&
                    pg.current_table.rows.length > 0}
                disabled={pg.current_table.rows.length === 0}
                indeterminate={pg.selected_rows.length > 0 &&
                    pg.selected_rows.length !== pg.current_table.rows.length}
                onchange={handle_header_change}
            />
        </div>
        {#each pg.current_table.rows as row, i (row.__index)}
            <div class="grid items-center px-2 h-10">
                <CheckboxInput
                    checked={pg.selected_rows.indexOf(i) !== -1}
                    onclick={(e) => handle_row_click(e, i)}
                />
            </div>
        {/each}
    {/if}
</div>
