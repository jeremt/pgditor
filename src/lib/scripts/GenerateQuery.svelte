<script lang="ts">
    import CogIcon from "$lib/icons/CogIcon.svelte";
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import SparklesIcon from "$lib/icons/SparklesIcon.svelte";
    import TrashIcon from "$lib/icons/TrashIcon.svelte";
    import MultilinesInput from "$lib/widgets/MultilinesInput.svelte";
    import PasswordInput from "$lib/widgets/PasswordInput.svelte";
    import Select from "$lib/widgets/Select.svelte";
    import {get_query_generator_context} from "./query_generator_context.svelte";

    const query_generator = get_query_generator_context();
    let api_key = $state("");
    let mode = $state<"chat" | "settings">("chat");
</script>

<div class="flex flex-col gap-4 items-start h-full">
    {#if query_generator.api_key === undefined}
        <div class="flex flex-col p-4 gap-4">
            <label class="flex flex-col gap-4">
                <span class="text-xs text-fg-1">
                    You must provide your OpenAI api key to generate queries (it only be saved locally on your computer
                    and never shared)
                </span>
                <PasswordInput placeholder="sk-proj-***" bind:value={api_key} />
            </label>
            <button
                class="btn self-start"
                type="button"
                onclick={(e) => {
                    e.preventDefault();
                    query_generator.api_key = api_key;
                    query_generator.save_api_key();
                    mode = "chat";
                }}>Save api key</button
            >
        </div>
    {:else if mode === "settings"}
        <div class="flex flex-col p-4 gap-4 w-full">
            <div class="flex w-full gap-2 items-center">
                <button class="btn ghost icon" onclick={() => (mode = "chat")}><CrossIcon --size="1.2rem" /></button>
                <div class="font-bold">AI Settings</div>
            </div>
            <label class="flex flex-col gap-4">
                <span class="text-xs text-fg-1">Update your api key </span>
                <PasswordInput placeholder="sk-proj-***" bind:value={api_key} />
            </label>
            <div class="flex justify-between w-full">
                <button
                    class="btn"
                    type="button"
                    onclick={(e) => {
                        e.preventDefault();
                        query_generator.api_key = api_key;
                        query_generator.save_api_key();
                        mode = "chat";
                    }}>Save api key</button
                >
                <button
                    class="btn error"
                    onclick={(e) => {
                        e.preventDefault();
                        query_generator.api_key = undefined;
                        query_generator.save_api_key();
                    }}><TrashIcon --size="1rem" /> Clear api key</button
                >
            </div>
        </div>
    {:else if mode === "chat"}
        <div class="w-full overflow-auto grow">
            <!-- Tool call log -->
            {#if query_generator.tool_log.length > 0}
                <div class="flex flex-col gap-1 text-sm">
                    {#each query_generator.tool_log as entry}
                        {#if entry.kind === "call"}
                            <div>⚙️ Calling <code>{entry.name}</code>...</div>
                        {:else}
                            <div class="text-success">✅ <code>{entry.name}</code>: {entry.result}</div>
                        {/if}
                    {/each}
                </div>
            {/if}

            <!-- Streaming response -->
            {#if query_generator.response}
                <div class="rounded border p-3 text-sm whitespace-pre-wrap">{query_generator.response}</div>
            {/if}

            <!-- Error -->
            {#if query_generator.error}
                <div class="text-error text-sm border border-error p-4 m-4 rounded-2xl">
                    Error: {query_generator.error}
                </div>
            {/if}
        </div>
        <div class="flex flex-col gap-4 px-4 pb-4 w-full">
            <MultilinesInput
                class="mt-auto"
                bind:value={query_generator.query_prompt}
                placeholder="Describe your SQL query…"
            />
            <div class="flex gap-2 w-full">
                <button class="btn ghost icon" aria-label="Settings" onclick={() => (mode = "settings")}
                    ><CogIcon --size="1rem" /></button
                >
                <Select bind:value={query_generator.model} onchange={() => query_generator.save_model()}>
                    <option value="gpt-5">gpt-5 </option>
                    <option value="gpt-5-mini">gpt-5-mini</option>
                </Select>
                <button class="btn ms-auto" onclick={query_generator.generate} disabled={query_generator.is_generating}>
                    <SparklesIcon --size="1rem" />
                    {query_generator.is_generating ? "Generating..." : "Generate"}
                </button>
            </div>
        </div>
    {/if}
</div>
