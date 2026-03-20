<script lang="ts">
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import CopyIcon from "$lib/icons/CopyIcon.svelte";
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import KeyIcon from "$lib/icons/KeyIcon.svelte";
    import LinkIcon from "$lib/icons/LinkIcon.svelte";
    import TerminalIcon from "$lib/icons/TerminalIcon.svelte";
    import ActionButton from "$lib/widgets/ActionButton.svelte";
    import CheckboxInput from "$lib/widgets/CheckboxInput.svelte";
    import {get_pg_context, type PgColumn, type PgRow} from "./pg_context.svelte";
    import TableValueEditor from "./TableValueEditor.svelte";
    import {default_values} from "./values";
    import {anchor_to_target} from "$lib/helpers/anchor_to_target.svelte";
    import {create_table_value_actions} from "./table_value_actions.svelte";

    type Props = {
        target: {element: HTMLElement; row: PgRow; column: PgColumn} | undefined;
    };
    let {target = $bindable()}: Props = $props();

    const pg = get_pg_context();

    const actions = create_table_value_actions(
        () => target,
        () => (target = undefined),
    );

    let anchor_element = $state<HTMLElement | undefined>();

    const anchor = anchor_to_target(
        () => target?.element,
        {get_anchor_element: () => anchor_element ?? null}
    );
</script>

{#if target}
    <div
        class="fixed inset-0 z-40"
        role="presentation"
        onclick={() => (target = undefined)}
        onkeydown={() => {}}
    >
        <div
            bind:this={anchor_element}
            class="fixed w-md border border-bg-2 rounded-xl shadow-lg bg-bg"
            style:left="{anchor.left}px"
            style:top="{anchor.top}px"
            role="dialog"
            aria-modal="true"
            tabindex="-1"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
        >
            <header class="flex flex-col pt-4 px-4">
                <div class="flex gap-2 items-center pb-4">
                    <button class="btn icon ghost" type="button" aria-label="Cancel" onclick={() => (target = undefined)}
                        ><CrossIcon /></button
                    >
                    <h2 class="flex gap-2 me-auto items-center">
                        {#if target.column.foreign_column_name !== null}
                            <LinkIcon --size="1.2rem" />
                        {:else if target.column.is_primary_key === "YES"}
                            <KeyIcon --size="1.2rem" />
                        {/if}
                        {target.column.column_name}
                        <span class="font-normal"
                            >{target.column.data_type}{#if target.column.data_type_params}{target.column.data_type_params}{/if}</span
                        >
                        {#if target.column.foreign_table_schema !== null && target.column.foreign_table_name !== null}
                            <span class="font-mono text-sm bg-bg-1 py-0.5 px-2 rounded-md ml-1">
                                {target.column.foreign_table_schema}.{target.column.foreign_table_name}
                            </span>
                        {/if}
                    </h2>
                    {#if pg.current_table?.type === "BASE TABLE"}
                        {#if target.column.is_nullable === "YES"}
                            <label class="text-xs ml-auto flex gap-2 items-center"
                                >NULL
                                <CheckboxInput
                                    checked={target.row[target.column.column_name] === null}
                                    onchange={() => {
                                        if (target!.row[target!.column.column_name] !== null) {
                                            target!.row[target!.column.column_name] = null;
                                        } else {
                                            target!.row[target!.column.column_name] = default_values[target!.column.data_type] ?? "";
                                        }
                                    }}
                                />
                            </label>
                        {/if}
                        <ActionButton class="btn " disabled={target.column.is_primary_key === "YES"} onaction={actions.update_value}
                            ><CheckIcon --size="1.2rem" />Update</ActionButton
                        >
                    {/if}
                </div>
            </header>
            {#if actions.error_message}
                <div class="text-sm text-error p-2 mx-4 mb-4 border border-bg-2 rounded-xl">{actions.error_message}</div>
            {/if}
            <div class="px-4 pb-4 w-full grow overflow-hidden">
                <TableValueEditor column={target.column} bind:row={target.row} inlined={false} />
            </div>
            <div class="flex px-4 pb-4 gap-2">
                <button class="btn ghost" onclick={actions.copy_value}><CopyIcon --size="1rem" /> Value</button>
                <button class="btn ghost" onclick={actions.copy_sql}><CopyIcon --size="1rem" /> SQL</button>
                <button class="btn ghost" onclick={actions.edit_sql}><TerminalIcon --size="1rem" /> Edit</button>
            </div>
        </div>
    </div>
{/if}
