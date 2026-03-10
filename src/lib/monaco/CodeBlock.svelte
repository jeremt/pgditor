<script lang="ts">
    import {get_settings_context} from "$lib/settings/settings_context.svelte";
    import {highlight} from "./highlight";

    let {code, lang, class: className}: {code: string; lang: "sql" | "json"; class?: string} = $props();

    const settings = get_settings_context();

    let html = $state("");

    $effect(() => {
        highlight(code, lang, settings.color_scheme).then((result) => {
            html = result;
        });
    });
</script>

<div class="contents {className}">
    {#if html}
        {@html html}
    {:else}
        <pre>{code}</pre>
    {/if}
</div>
