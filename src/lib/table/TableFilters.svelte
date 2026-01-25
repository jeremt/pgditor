<script lang="ts">
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import FunnelIcon from "$lib/icons/FunnelIcon.svelte";
    import PlusIcon from "$lib/icons/PlusIcon.svelte";
    import MultilinesInput from "$lib/widgets/MultilinesInput.svelte";
    import Popover from "$lib/widgets/Popover.svelte";
    import Select from "$lib/widgets/Select.svelte";

    import {getPgContext} from "./pgContext.svelte";

    const pg = getPgContext();

    let mode = $state<"visual" | "sql">("visual");

    const applyFilters = () => {
        if (mode === "sql") {
            pg.applyWhere(sql);
        } else {
            pg.applyWhere(pg.whereFromFilters());
        }
        pg.isFilterPopover = false;
    };

    const getPlaceholderByOperator = (operator: string) => {
        if (["like", "ilike"].includes(operator)) {
            return "'%value%'";
        }
        if (operator === "between") {
            return "value1 and value2";
        }
        if (operator === "in") {
            return `(value1, value2, value3)`;
        }
        return "value";
    };

    let sql = $state("");
    $effect(() => {
        sql = pg.whereFromFilters().trim();
    });
</script>

<Popover bind:isOpen={pg.isFilterPopover} offsetY={10}>
    {#snippet target()}
        <button class="btn ghost" onclick={() => (pg.isFilterPopover = !pg.isFilterPopover)}
            ><FunnelIcon --size="1.2rem" /> <span>Filters</span>
            {#if pg.appliedFilters > 0}<span class="badge">{pg.appliedFilters}</span>{/if}
            <ChevronIcon --size="1rem" direction={pg.isFilterPopover ? "top" : "bottom"} />
        </button>
    {/snippet}
    <div class="flex flex-col gap-2 pb-4 w-lg">
        <div class="flex gap-2">
            <button type="button" class="btn ghost" disabled={mode === "visual"} onclick={() => (mode = "visual")}
                >Visual</button
            >
            <button type="button" class="btn ghost" disabled={mode === "sql"} onclick={() => (mode = "sql")}>SQL</button
            >
        </div>
        {#if mode === "visual"}
            {#each pg.whereFilters as filter, i}
                <div class="flex gap-2">
                    <Select class="w-40" bind:value={pg.whereFilters[i].column} placeholder="column name">
                        {#each pg.currentTable?.columns ?? [] as column}
                            <option>{column.column_name}</option>
                        {/each}
                    </Select>
                    <Select class="small" bind:value={filter.operator}>
                        <optgroup label="basic">
                            <option>=</option>
                            <option>&lt;</option>
                            <option>&gt;</option>
                            <option>&lt;=</option>
                            <option>&gt;=</option>
                            <option>&lt;&gt;</option>
                            <option>!=</option>
                            <option>like</option>
                            <option>ilike</option>
                            <option>in</option>
                            <option>between</option>
                            <option>is</option>
                        </optgroup>
                        <optgroup label="vector">
                            <option>&lt;-&gt;</option>
                            <!-- euclidean-->
                            <option>&lt;#&gt;</option>
                            <!-- !inner dot -->
                            <option>&lt=&gt;</option>
                            <!-- cosine -->
                        </optgroup>
                    </Select>
                    <input
                        class="small grow"
                        type="text"
                        autocorrect="off"
                        autocapitalize="off"
                        autocomplete="off"
                        bind:value={
                            () => pg.whereFilters[i].value,
                            (newValue) => (pg.whereFilters[i].value = newValue.replace(/[‘’]/g, "'"))
                        }
                        placeholder={getPlaceholderByOperator(filter.operator)}
                    />
                    <button
                        type="button"
                        aria-label="Trash"
                        class="btn icon ghost"
                        onclick={(e) => {
                            e.preventDefault();
                            pg.whereFilters.splice(i, 1);
                        }}><CrossIcon --size="1.2rem" /></button
                    >
                </div>
            {:else}
                <p class="text-sx text-fg-1 text-center py-2">No filters applied, all rows will be listed.</p>
            {/each}
        {:else}
            <MultilinesInput class="font-mono!" bind:value={sql} placeholder="WHERE id = ..." />
        {/if}
    </div>
    <div class="flex">
        {#if mode === "visual"}
            <button
                class="btn ghost self-start"
                onclick={() =>
                    pg.whereFilters.push({
                        column: pg.currentTable?.columns[0].column_name ?? "",
                        operator: "=",
                        value: "",
                    })}><PlusIcon /> Ajouter un filtre</button
            >
        {/if}
        <button
            class="btn small ms-auto"
            disabled={!pg.whereFilters.every((filter) => filter.column && filter.value)}
            onclick={applyFilters}><CheckIcon /> Apply filter</button
        >
    </div>
</Popover>
