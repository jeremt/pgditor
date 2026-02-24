<script lang="ts">
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import TrashIcon from "$lib/icons/TrashIcon.svelte";
    import PasswordInput from "$lib/widgets/PasswordInput.svelte";

    import {get_connections_context, type Connection} from "./connections_context.svelte";

    type Props = {
        connection: Connection;
        onclose: () => void;
    };

    let {connection = $bindable(), onclose}: Props = $props();

    const connections = get_connections_context();
    let error_message = $state<string>();

    const save = async () => {
        if (connection.id) {
            error_message = await connections.edit(connection.id, connection.name, connection.connectionString);
        } else {
            error_message = await connections.create(connection.name, connection.connectionString);
        }
        if (!error_message) {
            onclose();
        }
    };
</script>

<header class="flex gap-4 items-center w-md">
    <button class="btn icon ghost" aria-label="Close" onclick={onclose}><CrossIcon /></button>
    <h2>{connection.id ? "Edit" : "Create"} connection string</h2>
    <button class="btn ml-auto" onclick={save}>Test & save</button>
</header>
<div class="flex flex-col gap-2 py-4">
    <label class="text-sm" for="{connection.name}-name">Name</label>
    <input
        id="{connection.name}-name"
        type="text"
        bind:value={connection.name}
        placeholder="My connection"
        autocorrect="off"
    />
    <label class="text-sm" for="{connection.name}-connectionString">Connection string</label>
    <PasswordInput
        id="{connection.name}-connectionString"
        type="text"
        bind:value={connection.connectionString}
        placeholder="postgresql://[user]:[password]@[host]:[port]/[dbname]"
        autocorrect="off"
    />
    {#if connection.id}
        <button
            class="btn error self-start"
            onclick={() => {
                onclose();
                connections.remove(connection.id);
            }}><TrashIcon --size="1.2rem" /> Remove</button
        >
    {/if}
    {#if error_message}
        <div class="text-sm text-error">{error_message}</div>
    {/if}
</div>
