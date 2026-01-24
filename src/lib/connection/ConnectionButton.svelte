<script lang="ts">
    import {getCommandsContext} from "$lib/commands/commandsContext.svelte";
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";
    import PenIcon from "$lib/icons/PenIcon.svelte";
    import PlugIcon from "$lib/icons/PlugIcon.svelte";
    import PlusIcon from "$lib/icons/PlusIcon.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import Popover from "$lib/widgets/Popover.svelte";

    import ConnectionDialog from "./ConnectionDialog.svelte";
    import {getConnectionsContext, type Connection} from "./connectionsContext.svelte";

    const connections = getConnectionsContext();
    const commands = getCommandsContext();
    let connectionToEdit = $state<Connection>({id: "", name: "", connectionString: ""});
    let isDialogOpen = $state(false);
</script>

<Popover bind:isOpen={commands.isConnectionsOpen} offsetY={10}>
    {#snippet target()}
        <button class="btn secondary" onclick={() => (commands.isConnectionsOpen = !commands.isConnectionsOpen)}>
            <PlugIcon --size="1.2rem" />
            {connections.current ? connections.current.name : "Add connection"}
            <ChevronIcon --size="1rem" direction={commands.isConnectionsOpen ? "top" : "bottom"} />
        </button>
    {/snippet}
    <div class="flex flex-col gap-2 w-sx">
        {#each connections.list as connection}
            <div class="flex gap-1">
                <button
                    class="btn ghost flex-1 justify-start!"
                    onclick={() => {
                        connections.use(connection.id);
                        commands.isConnectionsOpen = false;
                    }}
                >
                    {#if connection.id === connections.currentId}<CheckIcon --size="1rem" />{:else}<div
                            class="w-4"
                        ></div>{/if}
                    {connection.name}
                </button>
                <button
                    class="btn ghost icon"
                    aria-label="Edit"
                    onclick={() => {
                        connectionToEdit = {...connection};
                        isDialogOpen = true;
                        commands.isConnectionsOpen = false;
                    }}><PenIcon --size="1rem" /></button
                >
            </div>
        {/each}
        <button
            class="btn"
            onclick={() => {
                connectionToEdit = {id: "", name: "", connectionString: ""};
                isDialogOpen = true;
                commands.isConnectionsOpen = false;
            }}><PlusIcon /> Add connection</button
        >
    </div>
</Popover>

<Dialog isOpen={isDialogOpen} onrequestclose={() => (isDialogOpen = false)}>
    <ConnectionDialog bind:connection={connectionToEdit} onclose={() => (isDialogOpen = false)} />
</Dialog>
