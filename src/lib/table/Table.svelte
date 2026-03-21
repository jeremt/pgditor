<script lang="ts">
    import ArrowIcon from "$lib/icons/ArrowIcon.svelte";
    import KeyIcon from "$lib/icons/KeyIcon.svelte";
    import LinkIcon from "$lib/icons/LinkIcon.svelte";
    import UnpluggedIcon from "$lib/icons/UnpluggedIcon.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";

    import {get_pg_context, type PgColumn, type PgRow} from "./pg_context.svelte";
    import TableUpsert from "./TableUpsert.svelte";
    import {create_context_menu} from "./table_context_menu.svelte";
    import ProgressCircle from "$lib/widgets/ProgressCircle.svelte";
    import PopoverTableValueUpdate from "./PopoverTableValueUpdate.svelte";
    import DialogTableValueUpdate from "./DialogTableValueUpdate.svelte";
    import NoPkWarning from "./NoPkWarning.svelte";
    import TableRowCheckbox from "./TableRowCheckbox.svelte";
    import {value_type_is_boolean, value_type_is_number, value_type_is_textish} from "./values";
    import {writeText} from "@tauri-apps/plugin-clipboard-manager";
    import {get_toast_context} from "$lib/widgets/Toaster.svelte";
    import TableCell from "./TableCell.svelte";

    const pg = get_pg_context();

    const {toast} = get_toast_context();
    const {oncontextmenu} = create_context_menu();
    let cell = $state<{element: HTMLElement; row: PgRow; column: PgColumn}>();
    let force_mode = $state<"popover" | "dialog" | undefined>(undefined);

    const no_pk = $derived(pg.current_table && !pg.current_table.columns.some((col) => col.is_primary_key === "YES"));

    const TEXT_POPOVER_THRESHOLD = 200;

    const use_small_dialog = $derived.by(() => {
        if (force_mode !== undefined) {
            return force_mode === "popover";
        }
        return false;
    });
</script>

{#if pg.current_table === undefined}
    <div class="w-full h-full flex flex-col gap-4 items-center justify-center text-fg-1">
        <UnpluggedIcon --size="3rem" --thickness="1.2" />
        <div>The database is empty or not started.</div>
    </div>
{:else if pg.is_loading}
    <div class="w-full h-full flex flex-col gap-4 items-center justify-center text-fg-1">
        <ProgressCircle infinite={true} show_value={false} />
    </div>
{:else}
    <div class="flex flex-1 w-full h-full overflow-auto">
        <TableRowCheckbox />
        <table class="h-fit">
            <thead class="sticky top-0 bg-bg z-10">
                <tr>
                    {#each pg.get_selected_columns() as column (column.column_name)}
                        <th
                            class="cursor-pointer"
                            onclick={() => {
                                if (pg.order_by === undefined) {
                                    pg.order_by = {column: column.column_name, direction: "asc"};
                                } else if (pg.order_by.column !== column.column_name) {
                                    pg.order_by = {column: column.column_name, direction: "asc"};
                                } else if (pg.order_by.direction === "asc") {
                                    pg.order_by.direction = "desc";
                                } else {
                                    pg.order_by = undefined;
                                }
                                pg.refresh_data();
                            }}
                        >
                            <div class="flex gap-2 items-center px-1">
                                {#if column.is_primary_key === "YES"}<KeyIcon --size="1.1rem" />{/if}
                                {#if column.foreign_table_schema && column.foreign_table_name}
                                    <button
                                        onclick={() =>
                                            pg.select_table({
                                                schema: column.foreign_table_schema!,
                                                name: column.foreign_table_name!,
                                            })}
                                        title="{column.foreign_table_schema}.{column.foreign_table_name}.{column.foreign_column_name}"
                                        ><LinkIcon --size="1.2rem" /></button
                                    >
                                {/if}
                                <div>
                                    {column.column_name}
                                    <span class="font-normal text-xs! pl-2"
                                        >{column.data_type}{#if column.data_type_params}{column.data_type_params}{/if}</span
                                    >
                                </div>
                                {#if column.column_name === pg.order_by?.column}
                                    <ArrowIcon direction={pg.order_by.direction === "asc" ? "top" : "bottom"} />
                                {/if}
                            </div>
                        </th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#each pg.current_table.rows as row (row.__index)}
                    <tr>
                        {#each pg.get_selected_columns() as column (column.column_name)}
                            {@const value = row[column.column_name]}
                            <TableCell
                                {value}
                                {column}
                                {row}
                                {oncontextmenu}
                                onclick={async (event) => {
                                    if (pg.current_table?.type === "BASE TABLE") {
                                        if (event.currentTarget instanceof HTMLElement) {
                                            const value = row[column.column_name];
                                            const is_short_text =
                                                value_type_is_textish(column.data_type) &&
                                                typeof value === "string" &&
                                                value.length < TEXT_POPOVER_THRESHOLD;
                                            const use_popover =
                                                column.is_primary_key === "YES" ||
                                                column.data_type === "uuid" ||
                                                value_type_is_number(column.data_type) ||
                                                value_type_is_boolean(column.data_type) ||
                                                column.enum_values !== null ||
                                                is_short_text;
                                            force_mode = use_popover ? "popover" : "dialog";
                                            cell = {
                                                element: event.currentTarget,
                                                column,
                                                row: JSON.parse(JSON.stringify(row)),
                                            };
                                        }
                                    } else if (pg.current_table?.type === "VIEW") {
                                        await writeText(row[column.column_name]?.toString() ?? "null");
                                        toast("Value copied to clipboard");
                                    }
                                }}
                            />
                        {/each}
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
    {#if pg.current_table.rows.length === 0}
        <div class="fixed top-1/2 w-full flex justify-center pointer-events-none">
            <div class="border border-dashed border-bg-2 p-4 w-fit rounded-2xl">
                This table doesn't contain any rows, you can use <strong>Insert</strong> to add some!
            </div>
        </div>
    {/if}
{/if}

{#if pg.current_table && pg.row_to_update}
    <Dialog
        --padding="0"
        is_open={pg.is_update_open}
        onrequestclose={() => (pg.is_update_open = false)}
        position="right"
        animation="right"
    >
        <TableUpsert row={pg.row_to_update} onclose={() => (pg.is_update_open = false)} />
    </Dialog>
{/if}

{#if no_pk && cell}
    <NoPkWarning bind:target={cell} />
{:else if cell}
    {#if use_small_dialog}
        <PopoverTableValueUpdate bind:target={cell} onswitch_mode={() => (force_mode = "dialog")} />
    {:else}
        <DialogTableValueUpdate bind:target={cell} onswitch_mode={() => (force_mode = "popover")} />
    {/if}
{/if}
