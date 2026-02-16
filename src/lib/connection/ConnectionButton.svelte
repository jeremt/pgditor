<script lang="ts">
    import {get_commands_context} from "$lib/commands/commandsContext.svelte";
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";
    import PenIcon from "$lib/icons/PenIcon.svelte";
    import PlugIcon from "$lib/icons/PlugIcon.svelte";
    import PlusIcon from "$lib/icons/PlusIcon.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import Popover from "$lib/widgets/Popover.svelte";

    import ConnectionDialog from "./ConnectionDialog.svelte";
    import {get_connections_context, type Connection} from "./connectionsContext.svelte";

    const connections = get_connections_context();
    const commands = get_commands_context();
    let connection_to_edit = $state<Connection>({id: "", name: "", connectionString: ""});
    let is_dialog_open = $state(false);
</script>

<Popover bind:isOpen={commands.is_connections_open} offsetY={10}>
    {#snippet target()}
        <button class="btn secondary" onclick={() => (commands.is_connections_open = !commands.is_connections_open)}>
            {connections.current ? connections.current.name : "Add connection"}
            <ChevronIcon --size="1rem" direction={commands.is_connections_open ? "top" : "bottom"} />
        </button>
    {/snippet}
    <div class="flex flex-col gap-2 w-sx">
        {#each connections.list as connection}
            <div class="flex gap-1">
                <button
                    class="btn ghost flex-1 justify-start!"
                    onclick={() => {
                        connections.connect(connection.id);
                        commands.is_connections_open = false;
                    }}
                >
                    {#if connection.id === connections.current_id}<CheckIcon --size="1rem" />{:else}<div
                            class="w-4"
                        ></div>{/if}
                    {connection.name}
                </button>
                <button
                    class="btn ghost icon"
                    aria-label="Edit"
                    onclick={() => {
                        connection_to_edit = {...connection};
                        is_dialog_open = true;
                        commands.is_connections_open = false;
                    }}><PenIcon --size="1rem" /></button
                >
            </div>
        {/each}
        <button
            class="btn"
            onclick={() => {
                connection_to_edit = {id: "", name: "", connectionString: ""};
                is_dialog_open = true;
                commands.is_connections_open = false;
            }}><PlusIcon /> Add connection</button
        >
    </div>
</Popover>

<Dialog isOpen={is_dialog_open} onrequestclose={() => (is_dialog_open = false)}>
    <ConnectionDialog bind:connection={connection_to_edit} onclose={() => (is_dialog_open = false)} />
</Dialog>
