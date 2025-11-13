<script lang="ts">
    import PenIcon from "$lib/icons/PenIcon.svelte";
    import PlugIcon from "$lib/icons/PlugIcon.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import Popover from "$lib/widgets/Popover.svelte";

    import ConnectionDialog from "./ConnectionDialog.svelte";
    import {getConnectionsContext, type Connection} from "./connectionsContext.svelte";

    let connections = getConnectionsContext();
    let connectionToEdit = $state<Connection>({id: "", name: "", connectionString: ""});
    let isDialogOpen = $state(false);
    let isPopoverOpen = $state(false);
</script>

<Popover bind:isOpen={isPopoverOpen} offsetY={10}>
    {#snippet target()}
        <button class="btn secondary" onclick={() => (isPopoverOpen = !isPopoverOpen)}
            ><PlugIcon --size="1.2rem" /> {connections.current ? connections.current.name : "Add connection"}</button
        >
    {/snippet}
    <div class="flex flex-col gap-2 w-sx">
        {#each connections.list as connection}
            <div class="flex gap-1">
                <button
                    class="btn ghost flex-1 justify-start!"
                    onclick={() => {
                        connections.use(connection.id);
                        isPopoverOpen = false;
                    }}
                    >{connection.name}
                </button>
                <button
                    class="btn ghost icon"
                    aria-label="Edit"
                    onclick={() => {
                        connectionToEdit = {...connection};
                        isDialogOpen = true;
                        isPopoverOpen = false;
                    }}><PenIcon --size="1rem" /></button
                >
            </div>
        {/each}
        <button
            class="btn"
            onclick={() => {
                connectionToEdit = {id: "", name: "", connectionString: ""};
                isDialogOpen = true;
                isPopoverOpen = false;
            }}>Add connection</button
        >
    </div>
</Popover>

<Dialog isOpen={isDialogOpen} onrequestclose={() => (isDialogOpen = false)}>
    <ConnectionDialog bind:connection={connectionToEdit} onclose={() => (isDialogOpen = false)} />
</Dialog>
