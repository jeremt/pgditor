<script lang="ts">
    import {get_commands_context} from "$lib/commands/commands_context.svelte";
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import TerminalIcon from "$lib/icons/TerminalIcon.svelte";
    import {get_scripts_context} from "$lib/scripts/scripts_context.svelte";
    import {get_pg_context, type PgColumn, type PgRow} from "./pg_context.svelte";
    import {value_to_sql} from "./values";

    type Props = {
        target: {element: HTMLElement; row: PgRow; column: PgColumn} | undefined;
    };

    let {target = $bindable()}: Props = $props();

    const commands = get_commands_context();
    const scripts = get_scripts_context();
    const pg = get_pg_context();
</script>

<p class="text-sm text-fg-1">This table doesn't have a primary key so it cannot be updated automatically.</p>
<p class="text-sm text-fg-1">Use the script editor to update it instead.</p>
<div class="flex justify-between w-full pt-4">
    <button
        class="btn ghost"
        onclick={() => {
            commands.mode = "script";
            const row = Object.entries(target!.row).filter(([key]) => key !== "__index");
            if (row.length > 0 && pg.current_table) {
                scripts.current_value = `update ${pg.fullname} set
    ${row[0][0]} = ${value_to_sql(pg.current_table.columns.find((col) => col.column_name === row[0][0])!, row[0][1])}
where ${row.reduce((result, [name, value], index) => {
                    return (
                        result +
                        `${name} = ${value_to_sql(pg.current_table!.columns.find((col) => col.column_name === name)!, value)}` +
                        (index < row.length - 1 ? `\nor ` : "")
                    );
                }, "")};`;
            }
            target = undefined;
        }}
    >
        <TerminalIcon --size="1rem" /> Open editor
    </button>
    <button class="btn" onclick={() => (target = undefined)}><CheckIcon --size="1rem" /> Got it</button>
</div>
