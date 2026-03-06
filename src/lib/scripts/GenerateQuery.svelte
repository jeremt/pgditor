<script lang="ts">
    import SparklesIcon from "$lib/icons/SparklesIcon.svelte";
    import MultilinesInput from "$lib/widgets/MultilinesInput.svelte";
    import PasswordInput from "$lib/widgets/PasswordInput.svelte";
    import Select from "$lib/widgets/Select.svelte";
    import {get_query_generator_context} from "./query_generator_context.svelte";

    const query_generator = get_query_generator_context();
    let api_key = $state("");
</script>

<div class="flex flex-col gap-4 items-start h-full">
    {#if query_generator.api_key === undefined}
        <label class="flex flex-col gap-4">
            <span class="text-xs text-fg-1">
                You must provide your OpenAI api key to generate queries (it only be saved locally on your computer and
                never shared)
            </span>
            <PasswordInput placeholder="sk-proj-***" bind:value={api_key} />
        </label>
        <button
            class="btn"
            type="button"
            onclick={(e) => ((e.preventDefault(), (query_generator.api_key = api_key)), query_generator.save_api_key())}
            >Save api key</button
        >
    {:else}
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
                <div class="text-error text-sm">Error: {query_generator.error}</div>
            {/if}
        </div>
        <div class="flex flex-col gap-4 px-4 pb-4 w-full">
            <MultilinesInput
                class="mt-auto"
                bind:value={query_generator.query_prompt}
                placeholder="Describe your SQL query…"
            />
            <div class="flex justify-between w-full">
                <Select bind:value={query_generator.model} onchange={() => query_generator.save_model()}>
                    <option value="gpt-5">gpt-5 </option>
                    <option value="gpt-5-mini">gpt-5-mini</option>
                </Select>
                <button class="btn" onclick={query_generator.generate} disabled={query_generator.is_generating}>
                    <SparklesIcon --size="1rem" />
                    {query_generator.is_generating ? "Generating..." : "Generate"}
                </button>
            </div>
        </div>
    {/if}
</div>
