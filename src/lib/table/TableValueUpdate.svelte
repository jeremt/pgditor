<script lang="ts">
    import {catchError} from "$lib/helpers/catchError";
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import ActionButton from "$lib/widgets/ActionButton.svelte";
    import CheckboxInput from "$lib/widgets/CheckboxInput.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import {getPgContext, type PgColumn, type PgRow} from "./pgContext.svelte";
    import TableValueEditor from "./TableValueEditor.svelte";
    import {defaultValues} from "./values";

    type Props = {
        target: {element: HTMLElement; row: PgRow; column: PgColumn} | undefined;
    };
    let {target = $bindable()}: Props = $props();

    const pg = getPgContext();

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
        const [error] = await catchError(
            pg.updateRow({
                [pk.column_name]: target.row[pk.column_name],
                [target.column.column_name]: target.row[target.column.column_name],
            }),
        );
        if (error) {
            errorMessage = error.message;
        } else {
            target = undefined;
        }
    };
</script>

<Dialog
    --padding="0"
    isOpen={target !== undefined}
    onrequestclose={() => (target = undefined)}
    position="right"
    animation="right"
>
    {#if target}
        <div class="flex flex-col w-lg h-full">
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
                    <ActionButton class="btn " onaction={updateValue}><CheckIcon --size="1.2rem" />Update</ActionButton>
                </div>
            </header>
            {#if errorMessage}
                <div class="text-sm text-error p-2 mx-4 mb-4 border border-bg-2 rounded-xl">{errorMessage}</div>
            {/if}
            <div class="px-4 pb-4 w-full grow">
                <TableValueEditor column={target.column} bind:row={target.row} inlined={false} />
            </div>
        </div>
    {/if}
</Dialog>
