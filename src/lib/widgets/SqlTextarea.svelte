<script lang="ts">
    import {get_settings_context} from "$lib/settings/settings_context.svelte";
    import {highlight} from "$lib/monaco/highlight";

    let {
        value = $bindable(),
        placeholder,
        class: className,
    }: {
        value?: string;
        placeholder?: string;
        class?: string;
    } = $props();

    const settings = get_settings_context();

    let html = $state("");
    let textarea_element: HTMLTextAreaElement;

    const sync_scroll = () => {
        if (!textarea_element) return;
        const pre = textarea_element.previousElementSibling as HTMLElement;
        if (pre) {
            pre.scrollTop = textarea_element.scrollTop;
            pre.scrollLeft = textarea_element.scrollLeft;
        }
    };

    $effect(() => {
        highlight(value ?? "", "sql", settings.color_scheme).then((result) => {
            const match = result.match(/<code[^>]*>([\s\S]*?)<\/code>/);
            html = match ? match[1] : (value ?? "");
        });
    });
</script>

<div class="code-textarea-wrapper {className}">
    <pre class="code-textarea-highlight" aria-hidden="true"><code>{@html html}</code></pre>
    <textarea
        bind:this={textarea_element}
        bind:value
        {placeholder}
        class="code-textarea"
        spellcheck="false"
        onscroll={sync_scroll}
    ></textarea>
</div>

<style>
    .code-textarea-wrapper {
        position: relative;
        width: 100%;
        font-size: 0.9rem;
        background-color: var(--color-bg-1);
        border-radius: 1rem;
    }

    .code-textarea-highlight,
    .code-textarea {
        margin: 0;
        padding: 0.5rem;
        font-family: var(--font-mono, monospace);
        font-size: inherit;
        line-height: 1.5;
        white-space: pre;
        overflow-wrap: normal;
        overflow-x: auto;
        tab-size: 4;
    }

    .code-textarea-highlight {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-bg-0);
        color: var(--color-fg);
    }

    .code-textarea-highlight code {
        display: block;
        background: transparent;
    }

    .code-textarea {
        position: relative;
        display: block;
        width: 100%;
        height: 100%;
        min-height: 6rem;
        resize: vertical;
        border: 1px solid var(--color-border);
        border-radius: 1rem;
        background: transparent;
        color: transparent;
        caret-color: var(--color-fg);
        outline: none;
    }

    .code-textarea::placeholder {
        color: var(--color-fg-2);
    }

    .code-textarea-wrapper:has(.code-textarea:focus) {
        border: 1px solid var(--color-accent);
    }
</style>
