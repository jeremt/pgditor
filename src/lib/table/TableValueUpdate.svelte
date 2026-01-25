<script lang="ts">
    import {getCommandsContext} from "$lib/commands/commandsContext.svelte";
    import {catchError} from "$lib/helpers/catchError";
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import CopyIcon from "$lib/icons/CopyIcon.svelte";
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import ErrorIcon from "$lib/icons/ErrorIcon.svelte";
    import TerminalIcon from "$lib/icons/TerminalIcon.svelte";
    import {getScriptsContext} from "$lib/scripts/scriptsContext.svelte";
    import ActionButton from "$lib/widgets/ActionButton.svelte";
    import CheckboxInput from "$lib/widgets/CheckboxInput.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import {getToastContext} from "$lib/widgets/Toaster.svelte";
    import {getPgContext, type PgColumn, type PgRow} from "./pgContext.svelte";
    import TableValueEditor from "./TableValueEditor.svelte";
    import {defaultValues, valueToSql} from "./values";
    import {writeText} from "@tauri-apps/plugin-clipboard-manager";

    type Props = {
        target: {element: HTMLElement; row: PgRow; column: PgColumn} | undefined;
    };
    let {target = $bindable()}: Props = $props();

    const pg = getPgContext();
    const commands = getCommandsContext();
    const scripts = getScriptsContext();
    const {toast} = getToastContext();

    let errorMessage = $state("");
    $effect(() => {
        if (target) {
            errorMessage = ""; // reset error message whenever target changes
        }
    });

    const updateValue = async () => {
        const pk = pg.getPrimaryKey();
        if (target === undefined || pk === undefined) {
            return;
        }
        const error = await catchError(
            pg.updateRow({
                [pk.column_name]: target.row[pk.column_name],
                [target.column.column_name]: target.row[target.column.column_name],
            }),
        );
        if (error instanceof ErrorIcon) {
            errorMessage = error.message;
        } else {
            target = undefined;
        }
    };

    const copyValue = async () => {
        if (!target) {
            return;
        }
        await writeText(valueToSql(target.column, target.row[target.column.column_name]));
        toast(`Copied value to clipboard`);
    };

    const copySql = async () => {
        const pk = pg.getPrimaryKey();
        if (target === undefined || pk === undefined) {
            return;
        }
        const sql = await pg.generateUpdateRow({
            [pk.column_name]: target.row[pk.column_name],
            [target.column.column_name]: target.row[target.column.column_name],
        });
        if (sql !== undefined) {
            await writeText(sql.trim());
            toast(`Copied sql to clipboard`);
        }
    };

    const editSql = async () => {
        const pk = pg.getPrimaryKey();
        if (target === undefined || pk === undefined) {
            return;
        }
        const sql = await pg.generateUpdateRow({
            [pk.column_name]: target.row[pk.column_name],
            [target.column.column_name]: target.row[target.column.column_name],
        });
        if (sql) {
            target = undefined;
            scripts.emptyFile();
            scripts.currentValue = sql.trim();
            commands.mode = "script";
        }
    };

    const smallDialog = $derived.by(() => {
        if (!target) {
            return false;
        }
        if (target.column.is_primary_key === "YES") {
            return true;
        }
        switch (target.column.data_type) {
            case "bool":
            case "boolean":
                return true;
        }
        if (target.column.enum_values !== null) {
            return true;
        }
        return false;
    });
</script>

<Dialog
    --padding="0"
    isOpen={target !== undefined}
    onrequestclose={() => (target = undefined)}
    position={smallDialog ? "center" : "right"}
    animation={smallDialog ? "bottom" : "right"}
>
    {#if target}
        <div class="flex flex-col {smallDialog ? 'w-sm' : 'w-xl h-full'}">
            <header class="flex flex-col pt-4 px-4">
                <div class="flex gap-2 items-center pb-4">
                    <button
                        class="btn icon ghost"
                        type="button"
                        aria-label="Cancel"
                        onclick={() => (target = undefined)}><CrossIcon /></button
                    >
                    <h2 class="mr-auto">
                        {target.column.column_name}
                        <span class="font-normal">{target.column.data_type}</span>
                    </h2>
                    {#if pg.currentTable?.type === "BASE TABLE"}
                        {#if target.column.is_nullable === "YES"}
                            <label class="text-xs ml-auto flex gap-2 items-center"
                                >NULL
                                <CheckboxInput
                                    checked={target.row[target.column.column_name] === null}
                                    onchange={() => {
                                        if (target!.row[target!.column.column_name] !== null) {
                                            target!.row[target!.column.column_name] = null;
                                        } else {
                                            target!.row[target!.column.column_name] =
                                                defaultValues[target!.column.data_type];
                                        }
                                    }}
                                />
                            </label>
                        {/if}
                        <ActionButton
                            class="btn "
                            disabled={target.column.is_primary_key === "YES"}
                            onaction={updateValue}><CheckIcon --size="1.2rem" />Update</ActionButton
                        >
                    {/if}
                </div>
            </header>
            {#if errorMessage}
                <div class="text-sm text-error p-2 mx-4 mb-4 border border-bg-2 rounded-xl">{errorMessage}</div>
            {/if}
            <div class="px-4 pb-4 w-full grow">
                <TableValueEditor column={target.column} bind:row={target.row} inlined={false} />
            </div>
            <div class="flex px-4 pb-4 gap-2">
                <button class="btn ghost" onclick={copyValue}><CopyIcon --size="1rem" /> Copy value</button>
                <button class="btn ghost" onclick={copySql}><CopyIcon --size="1rem" /> Copy sql</button>
                <button class="btn ghost" onclick={editSql}><TerminalIcon --size="1rem" /> Edit sql</button>
            </div>
        </div>
    {/if}
</Dialog>
