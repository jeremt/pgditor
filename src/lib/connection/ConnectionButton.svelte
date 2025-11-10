<script lang="ts">
    import Dialog from "$lib/widgets/Dialog.svelte";
    import {getConnectionsContext, type Connection} from "./connectionsContext.svelte";
    import Popover from "$lib/widgets/Popover.svelte";
    import ConnectionDialog from "./ConnectionDialog.svelte";

    let connections = getConnectionsContext();
    let connectionToEdit = $state<Connection>({id: "", name: "", connectionString: ""});
    let isDialogOpen = $state(false);
    let isPopoverOpen = $state(false);
</script>

<Popover isOpen={isPopoverOpen} offsetY={10}>
    {#snippet target()}
        <button class="btn" onclick={() => (isPopoverOpen = !isPopoverOpen)}
            >{connections.current ? connections.current.name : "Add connection"}</button
        >
    {/snippet}
    <div class="flex flex-col gap-4 w-sx">
        {#each connections.list as connection}
            <div class="flex gap-4">
                <button
                    onclick={() => {
                        connections.use(connection.id);
                        isPopoverOpen = false;
                    }}
                    >{connection.name}
                </button>
                <button
                    class="btn outline ml-auto"
                    onclick={() => {
                        connectionToEdit = {...connection};
                        isDialogOpen = true;
                        isPopoverOpen = false;
                    }}>edit</button
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
