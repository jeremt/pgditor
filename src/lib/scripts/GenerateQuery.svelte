<script lang="ts">
    import CogIcon from "$lib/icons/CogIcon.svelte";
    import CopyIcon from "$lib/icons/CopyIcon.svelte";
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import DownloadIcon from "$lib/icons/DownloadIcon.svelte";
    import SparklesIcon from "$lib/icons/SparklesIcon.svelte";
    import TerminalIcon from "$lib/icons/TerminalIcon.svelte";
    import TrashIcon from "$lib/icons/TrashIcon.svelte";
    import CodeBlock from "$lib/monaco/CodeBlock.svelte";
    import MultilinesInput from "$lib/widgets/MultilinesInput.svelte";
    import PasswordInput from "$lib/widgets/PasswordInput.svelte";
    import ProgressCircle from "$lib/widgets/ProgressCircle.svelte";
    import Select from "$lib/widgets/Select.svelte";
    import {writeText} from "@tauri-apps/plugin-clipboard-manager";
    import {get_query_generator_context, MODELS} from "./query_generator_context.svelte";
    import {get_scripts_context} from "./scripts_context.svelte";
    import ToolCall from "./ToolCall.svelte";
    import {get_toast_context} from "$lib/widgets/Toaster.svelte";
    import {save_to_file} from "$lib/helpers/save_to_file";

    const query_generator = get_query_generator_context();
    const scripts = get_scripts_context();
    const {toast} = get_toast_context();

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
            <label class="flex flex-col gap-4">
                <span class="text-xs text-fg-1">Model</span>
                <Select
                    bind:value={query_generator.model}
                    onchange={() => {
                        query_generator.reasoning = query_generator.model.startsWith("gpt-5") ? "low" : undefined;
                        query_generator.save_model();
                    }}
                >
                    {#each MODELS as model}
                        <option>{model}</option>
                    {/each}
                </Select>
            </label>

            {#if query_generator.model.startsWith("gpt-5")}
                <label class="flex flex-col gap-4">
                    <span class="text-xs text-fg-1">Reasoning</span>
                    <Select bind:value={query_generator.reasoning} onchange={() => query_generator.save_model()}>
                        {#each ["low", "medium", "high"] as reasoning}
                            <option>{reasoning}</option>
                        {/each}
                    </Select>
                </label>
            {/if}
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
                        <div class="flex flex-col gap-2 px-4">
                            <div class="flex items-center overflow-auto w-full">
                                <button
                                    class="btn ghost text-xs! self-start"
                                    onclick={() => (scripts.current_value += sql_query)}
                                    ><TerminalIcon --size="0.8rem" /> Use query</button
                                >
                                <button
                                    class="btn ghost text-xs! self-start"
                                    onclick={async () => {
                                        await writeText(sql_query);
                                        toast("Query copied to clipboard");
                                    }}><CopyIcon --size="0.8rem" /> Copy query</button
                                >
                                <button
                                    class="btn ghost text-xs! self-start"
                                    onclick={async () => {
                                        if (await save_to_file(sql_query, ["sql"])) {
                                            toast("Query exported to SQL", {kind: "success"});
                                        } else {
                                            toast("Failed to export query", {kind: "error"});
                                        }
                                    }}><DownloadIcon --size="0.8rem" /> Export query</button
                                >
                            </div>
                            <CodeBlock
                                class="[&_pre]:p-2 [&_pre]:text-xs [&_pre]:font-mono [&_pre]:overflow-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-bg-1"
                                code={sql_query}
                                lang="sql"
                            />
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
                <button class="btn ghost icon" title="Settings" onclick={() => (mode = "settings")}
                    ><CogIcon --size="1rem" /></button
                >
                <button class="btn ghost icon" title="Clear chat" onclick={() => query_generator.clear_history()}
                    ><TrashIcon --size="1rem" /></button
                >
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
