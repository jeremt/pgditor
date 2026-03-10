<script lang="ts">
    import {get_settings_context} from "$lib/settings/settings_context.svelte";
    import {highlight} from "./highlight";

    let {code, lang, class: className}: {code: string; lang: "sql" | "json"; class?: string} = $props();

    const settings = get_settings_context();

    let html = $state("");

    $effect(() => {
        highlight(code, lang, settings.color_scheme).then((result) => {
            // Extract just the inner content from the <pre><code>...</code></pre> shiki wraps it in
            const match = result.match(/<code[^>]*>([\s\S]*?)<\/code>/);
            html = match ? match[1] : code;
        });
    });
</script>

<code class="inline-code {className}">
    {#if html}
        {@html html}
    {:else}
        {code}
    {/if}
</code>
