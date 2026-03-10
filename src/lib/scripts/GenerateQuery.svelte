<script lang="ts">
    import CogIcon from "$lib/icons/CogIcon.svelte";
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import SparklesIcon from "$lib/icons/SparklesIcon.svelte";
    import TerminalIcon from "$lib/icons/TerminalIcon.svelte";
    import TrashIcon from "$lib/icons/TrashIcon.svelte";
    import MultilinesInput from "$lib/widgets/MultilinesInput.svelte";
    import PasswordInput from "$lib/widgets/PasswordInput.svelte";
    import ProgressCircle from "$lib/widgets/ProgressCircle.svelte";
    import Select from "$lib/widgets/Select.svelte";
    import {get_query_generator_context} from "./query_generator_context.svelte";
    import {get_scripts_context} from "./scripts_context.svelte";
    import ToolCall from "./ToolCall.svelte";

    const MODELS = ["gpt-5 ", "gpt-5-mini", "gpt-5-nano", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"];
    const query_generator = get_query_generator_context();
    const scripts = get_scripts_context();

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
                    query_generator.save_api_key(api_key);
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
                        query_generator.save_api_key(api_key);
                        mode = "chat";
                    }}>Save api key</button
                >
                <button
                    class="btn error"
                    onclick={(e) => {
                        e.preventDefault();
                        query_generator.reset_api_key();
                    }}><TrashIcon --size="1rem" /> Clear api key</button
                >
            </div>
        </div>
    {:else if mode === "chat"}
        <div class="flex flex-col w-full overflow-auto grow">
            {#each query_generator.history as item, i (i)}
                {#if item.type === "user"}
                    <div class="text-sm p-4 self-end rounded-lg bg-bg-1 mt-4 mx-4">{item.text}</div>
                {:else if item.type === "tool_call"}
                    <ToolCall name={item.name} args={item.args} result={item.result} />
                {:else if item.type === "message"}
                    {#if item.is_query}
                        {@const sql_query = item.text.slice("SQL_QUERY: ".length).trim()}
                        <div class="p-2 border border-bg-1 rounded-2xl m-4">
                            <div class="text-xs whitespace-pre-wrap p-2 font-mono text-fg-1">
                                {sql_query}
                            </div>
                            <button
                                class="btn ghost text-sm! self-start"
                                onclick={() => (scripts.current_value += sql_query)}
                                ><TerminalIcon --size="0.8rem" /> Use query</button
                            >
                        </div>
                    {:else}
                        <div class="text-sm whitespace-pre-wrap p-4">{item.text}</div>
                    {/if}
                {/if}
            {/each}
            {#if query_generator.is_generating}
                <div class="flex items-center gap-2 text-sm p-4">
                    <ProgressCircle --size="1rem" infinite={true} show_value={false} />
                    Thinking…
                </div>
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
                onkeydown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        query_generator.generate();
                    }
                }}
            />
            <div class="flex gap-2 w-full">
                <button class="btn ghost icon" aria-label="Settings" onclick={() => (mode = "settings")}
                    ><CogIcon --size="1rem" /></button
                >
                <Select bind:value={query_generator.model} onchange={() => query_generator.save_model()}>
                    {#each MODELS as model}
                        <option>{model}</option>
                    {/each}
                </Select>
                <button
                    class="btn ms-auto"
                    title="Trigger with ⌘ ⏎"
                    onclick={query_generator.generate}
                    disabled={query_generator.is_generating}
                >
                    <SparklesIcon --size="1rem" />
                    {query_generator.is_generating ? "Generating..." : "Generate"}
                </button>
            </div>
        </div>
    {/if}
</div>
