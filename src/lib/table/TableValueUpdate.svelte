<script lang="ts">
    import {get_commands_context} from "$lib/commands/commands_context.svelte";
    import {catch_error} from "@les3dev/catch_error";
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import CopyIcon from "$lib/icons/CopyIcon.svelte";
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import KeyIcon from "$lib/icons/KeyIcon.svelte";
    import LinkIcon from "$lib/icons/LinkIcon.svelte";
    import TerminalIcon from "$lib/icons/TerminalIcon.svelte";
    import {get_scripts_context} from "$lib/scripts/scripts_context.svelte";
    import ActionButton from "$lib/widgets/ActionButton.svelte";
    import CheckboxInput from "$lib/widgets/CheckboxInput.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import {get_toast_context} from "$lib/widgets/Toaster.svelte";
    import {get_pg_context, type PgColumn, type PgRow} from "./pg_context.svelte";
    import TableValueEditor from "./TableValueEditor.svelte";
    import {default_values, value_type_is_boolean, value_type_is_number, value_to_sql} from "./values";
    import {writeText} from "@tauri-apps/plugin-clipboard-manager";
    import {anchor_to_target} from "$lib/helpers/anchor_to_target.svelte";

    type Props = {
        target: {element: HTMLElement; row: PgRow; column: PgColumn} | undefined;
    };
    let {target = $bindable()}: Props = $props();

    const pg = get_pg_context();
    const commands = get_commands_context();
    const scripts = get_scripts_context();
    const {toast} = get_toast_context();

    let errorMessage = $state("");
    $effect(() => {
        if (target) {
            errorMessage = ""; // reset error message whenever target changes
        }
    });

    const update_value = async () => {
        const pk = pg.get_primary_key();
        if (target === undefined || pk === undefined) {
            return;
        }
        const row = target.row;
        const column = target.column;
        const error = await catch_error(() =>
            pg.update_row({
                [pk.column_name]: row[pk.column_name],
                [column.column_name]: row[column.column_name],
            }),
        );
        if (error instanceof Error) {
            errorMessage = error.message;
        } else {
            target = undefined;
        }
    };

    const copy_value = async () => {
        if (!target) {
            return;
        }
        await writeText(value_to_sql(target.column, target.row[target.column.column_name]));
        toast(`Copied value to clipboard`);
    };

    const copy_sql = async () => {
        const pk = pg.get_primary_key();
        if (target === undefined || pk === undefined) {
            return;
        }
        const sql = await pg.generate_update_row({
            [pk.column_name]: target.row[pk.column_name],
            [target.column.column_name]: target.row[target.column.column_name],
        });
        if (sql !== undefined) {
            await writeText(sql.trim());
            toast(`Copied sql to clipboard`);
        }
    };

    const edit_sql = async () => {
        const pk = pg.get_primary_key();
        if (target === undefined || pk === undefined) {
            return;
        }
        const sql = await pg.generate_update_row({
            [pk.column_name]: target.row[pk.column_name],
            [target.column.column_name]: target.row[target.column.column_name],
        });
        if (sql) {
            target = undefined;
            scripts.empty_file();
            scripts.current_value = sql.trim();
            commands.mode = "script";
        }
    };

    const no_pk = $derived(pg.current_table && !pg.current_table.columns.some((col) => col.is_primary_key === "YES"));

    const use_small_dialog = $derived.by(() => {
        if (!target || target.column.foreign_table_name !== null) {
            return false;
        }
        return (
            target.column.is_primary_key === "YES" ||
            target.column.data_type === "uuid" ||
            value_type_is_number(target.column.data_type) ||
            value_type_is_boolean(target.column.data_type) ||
            target.column.enum_values !== null
        );
    });

    const anchor = anchor_to_target(() => target?.element);
</script>

{#snippet no_pk_dialog()}
    <div class="flex flex-col gap-4 p-4 items-start w-sm">
        <p>This table doesn't have a primary key so it cannot be updated automatically.</p>
        <p>Use the script editor to update it instead.</p>
        <div class="flex justify-between w-full">
            <button class="btn secondary" onclick={() => (target = undefined)}>Cancel</button>
            <button
                class="btn"
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
                }}><TerminalIcon --size="1rem" /> Open editor</button
            >
        </div>
    </div>
{/snippet}

{#snippet main_dialog_content()}
    {@const t = target!}
    <header class="flex flex-col pt-4 px-4">
        <div class="flex gap-2 items-center pb-4">
            <button class="btn icon ghost" type="button" aria-label="Cancel" onclick={() => (target = undefined)}
                ><CrossIcon /></button
            >
            <h2 class="flex gap-2 me-auto items-center">
                {#if t.column.foreign_column_name !== null}
                    <LinkIcon --size="1.2rem" />
                {:else if t.column.is_primary_key === "YES"}
                    <KeyIcon --size="1.2rem" />
                {/if}
                {t.column.column_name}
                <span class="font-normal"
                    >{t.column.data_type}{#if t.column.data_type_params}{t.column.data_type_params}{/if}</span
                >
                {#if t.column.foreign_table_schema !== null && t.column.foreign_table_name !== null}
                    <span class="font-mono text-sm bg-bg-1 py-0.5 px-2 rounded-md ml-1">
                        {t.column.foreign_table_schema}.{t.column.foreign_table_name}
                    </span>
                {/if}
            </h2>
            {#if pg.current_table?.type === "BASE TABLE"}
                {#if t.column.is_nullable === "YES"}
                    <label class="text-xs ml-auto flex gap-2 items-center"
                        >NULL
                        <CheckboxInput
                            checked={t.row[t.column.column_name] === null}
                            onchange={() => {
                                if (t.row[t.column.column_name] !== null) {
                                    t.row[t.column.column_name] = null;
                                } else {
                                    t.row[t.column.column_name] = default_values[t.column.data_type] ?? "";
                                }
                            }}
                        />
                    </label>
                {/if}
                <ActionButton class="btn " disabled={t.column.is_primary_key === "YES"} onaction={update_value}
                    ><CheckIcon --size="1.2rem" />Update</ActionButton
                >
            {/if}
        </div>
    </header>
    {#if errorMessage}
        <div class="text-sm text-error p-2 mx-4 mb-4 border border-bg-2 rounded-xl">{errorMessage}</div>
    {/if}
    <div class="px-4 pb-4 w-full grow overflow-hidden">
        <TableValueEditor column={t.column} bind:row={t.row} inlined={false} />
    </div>
    <div class="flex px-4 pb-4 gap-2">
        <button class="btn ghost" onclick={copy_value}><CopyIcon --size="1rem" /> Value</button>
        <button class="btn ghost" onclick={copy_sql}><CopyIcon --size="1rem" /> SQL</button>
        <button class="btn ghost" onclick={edit_sql}><TerminalIcon --size="1rem" /> Edit</button>
    </div>
{/snippet}

{#if no_pk && target}
    <div
        class="fixed small_dialog_anchor w-sm border border-bg-2 rounded-xl shadow-lg bg-bg z-50"
        style:left="{anchor.left}px"
        style:top="{anchor.top}px"
    >
        {@render no_pk_dialog()}
    </div>
{:else if target}
    {#if use_small_dialog}
        <div
            class="fixed small_dialog_anchor w-md border border-bg-2 rounded-xl shadow-lg bg-bg z-50"
            style:left="{anchor.left}px"
            style:top="{anchor.top}px"
        >
            <div class="flex flex-col w-full h-full">
                {@render main_dialog_content()}
            </div>
        </div>
    {:else}
        <Dialog
            --padding="0"
            is_open={true}
            onrequestclose={() => (target = undefined)}
            position="right"
            animation="right"
        >
            <div class="flex flex-col w-xl h-full">
                {@render main_dialog_content()}
            </div>
        </Dialog>
    {/if}
{/if}
