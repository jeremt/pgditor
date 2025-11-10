<script lang="ts">
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import {onMount} from "svelte";
    import {getConnectionsContext, type Connection} from "./connectionsContext.svelte";

    type Props = {
        connection: Connection;
        onclose: () => void;
    };

    let {connection = $bindable(), onclose}: Props = $props();

    const connections = getConnectionsContext();
    let errorMessage = $state<string>();

    const save = async () => {
        if (connection.id) {
            errorMessage = await connections.edit(connection.id, connection.name, connection.connectionString);
        } else {
            errorMessage = await connections.create(connection.name, connection.connectionString);
        }
        if (!errorMessage) {
            onclose();
        }
    };
</script>

<header class="flex gap-4 items-center w-md">
    <button class="btn outline icon" aria-label="Close" onclick={onclose}><CrossIcon /></button>
    <h2>{connection.id ? "Edit" : "Create"} connection string</h2>
    <button class="btn ml-auto" onclick={save}>Test & save</button>
</header>
<div class="flex flex-col gap-2 py-4">
    <label class="text-sm" for="{connection.name}-name">Name</label>
    <input id="{connection.name}-name" type="text" bind:value={connection.name} placeholder="My connection" />
    <label class="text-sm" for="{connection.name}-connectionString">Connection string</label>
    <input
        id="{connection.name}-connectionString"
        type="text"
        bind:value={connection.connectionString}
        placeholder="postgresql://[user]:[password]@[host]:[port]/[dbname]"
    />
    {#if connection.id}
        <button
            class="btn outline error self-start"
            onclick={() => {
                onclose();
                connections.remove(connection.id);
            }}>Remove</button
        >
    {/if}
    {#if errorMessage}
        <div class="text-sm text-error">{errorMessage}</div>
    {/if}
</div>
