<script lang="ts">
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import FunnelIcon from "$lib/icons/FunnelIcon.svelte";
    import PlusIcon from "$lib/icons/PlusIcon.svelte";
    import MultilinesInput from "$lib/widgets/MultilinesInput.svelte";
    import Popover from "$lib/widgets/Popover.svelte";
    import Select from "$lib/widgets/Select.svelte";
    import {
        filtersToWhere,
        operatorsForColumn,
        type PgColumn,
        type WhereFilter,
        type WhereOperator,
    } from "./pgContext.svelte";

    type Props = {
        isOpen: boolean;
        filters: WhereFilter[];
        whereSql: string;
        appliedFilters: number;
        columns: PgColumn[];
        onapply: () => void;
    };
    let {
        isOpen = $bindable(),
        filters = $bindable(),
        whereSql = $bindable(),
        appliedFilters,
        columns,
        onapply,
    }: Props = $props();

    let mode = $state<"visual" | "sql">("visual");

    const getPlaceholderByOperator = (operator: WhereOperator) => {
        if (operator === "like" || operator === "ilike" || operator === "not like") {
            return "%value%";
        }
        if (operator === "~" || operator === "~*" || operator === "!~" || operator === "!~*") {
            return "^[a-zA-Z].*[0-9]{3}$";
        }
        return "value";
    };

    $effect(() => {
        whereSql = filtersToWhere(filters).trim();
    });
</script>

<Popover bind:isOpen offsetY={10} anchor="start" --padding="1rem">
    {#snippet target()}
        <button class="btn ghost" onclick={() => (isOpen = !isOpen)}
            ><FunnelIcon --size="1.2rem" />
            {#if appliedFilters > 0}<span class="badge">{appliedFilters}</span>{/if}
            <ChevronIcon --size="1rem" direction={isOpen ? "top" : "bottom"} />
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
            {#each filters as filter, i}
                {@const column = columns.find((col) => col.column_name === filter.column)}
                <div class="flex gap-2">
                    <Select
                        class="w-40"
                        bind:value={filters[i].column}
                        onchange={() => {
                            console.log("IN", column, filters[i].column);
                            if (column) {
                                filters[i].column_type = column.data_type;
                            }
                        }}
                    >
                        {#each columns ?? [] as column}
                            <option>{column.column_name}</option>
                        {/each}
                    </Select>
                    <Select class="small" bind:value={filter.operator}>
                        {#each operatorsForColumn(column) as operator}
                            <option>{operator}</option>
                        {/each}
                    </Select>
                    {#if column?.enum_values}
                        <Select
                            class="small grow"
                            bind:value={() => filters[i].value, (newValue) => (filters[i].value = newValue)}
                        >
                            {#each column.enum_values as enum_value}
                                <option>{enum_value}</option>
                            {/each}
                        </Select>
                    {:else if filter.operator !== "is null" && filter.operator !== "is not null"}
                        <input
                            class="small grow"
                            type="text"
                            autocorrect="off"
                            autocapitalize="off"
                            autocomplete="off"
                            bind:value={() => filters[i].value, (newValue) => (filters[i].value = newValue)}
                            placeholder={getPlaceholderByOperator(filter.operator)}
                        />
                    {/if}
                    <button
                        type="button"
                        aria-label="Trash"
                        class="btn icon ghost"
                        onclick={(e) => {
                            e.preventDefault();
                            filters.splice(i, 1);
                        }}><CrossIcon --size="1.2rem" /></button
                    >
                </div>
            {:else}
                <p class="text-sx text-fg-1 text-center py-2">No filters applied, all rows will be listed.</p>
            {/each}
        {:else}
            <MultilinesInput class="font-mono!" bind:value={whereSql} placeholder="WHERE id = ..." />
        {/if}
    </div>
    <div class="flex">
        {#if mode === "visual"}
            <button
                class="btn ghost self-start"
                onclick={() =>
                    filters.push({
                        column: columns[0].column_name ?? "",
                        column_type: columns[0].data_type,
                        operator: "=",
                        value: "",
                    })}><PlusIcon /> Ajouter un filtre</button
            >
        {/if}
        <button class="btn small ms-auto" disabled={!filters.every((filter) => filter.column)} onclick={onapply}
            ><CheckIcon --size="1.2rem" /> Apply filter</button
        >
    </div>
</Popover>
