<script lang="ts">
    import MonacoEditor from "$lib/monaco/MonacoEditor.svelte";
    import {get_settings_context} from "$lib/settings/settings_context.svelte";
    import MultilinesInput from "$lib/widgets/MultilinesInput.svelte";
    import {get_pg_context, type PgColumn} from "../pg_context.svelte";

    type Props = {
        value: string;
        column: PgColumn;
        inlined: boolean;
    };
    let {value = $bindable(), column, inlined}: Props = $props();

    const pg = get_pg_context();
    const settings = get_settings_context();
</script>

{#if inlined}
    <MultilinesInput
        id={column.column_name}
        class="font-mono!"
        placeholder={"{}"}
        autocomplete="off"
        autocapitalize="off"
        min_rows={1}
        bind:value
    />
{:else}
    <MonacoEditor
        bind:value
        theme={settings.colorScheme}
        selected_file="{pg.current_table!.name}-{column}.json"
        files={[{path: `${pg.current_table!.name}-${column}.json`, value}]}
        font_family="Space Mono"
        font_size={12}
        show_line_numbers={true}
        onchange={(newValue, path) => {
            if (path === `${pg.current_table!.name}-${column}.json`) {
                value = newValue;
            } else {
                throw new Error(`File ${path} not found.`);
            }
        }}
    />
{/if}
