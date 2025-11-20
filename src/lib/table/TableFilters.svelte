<script lang="ts">
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import FunnelIcon from "$lib/icons/FunnelIcon.svelte";
    import PlusIcon from "$lib/icons/PlusIcon.svelte";
    import Popover from "$lib/widgets/Popover.svelte";
    import Select from "$lib/widgets/Select.svelte";

    import {getTableContext} from "./tableContext.svelte";

    const pgTable = getTableContext();

    const applyFilters = () => {
        pgTable.applyWhere();
        pgTable.isFilterPopover = false;
    };
</script>

<Popover bind:isOpen={pgTable.isFilterPopover} offsetY={10}>
    {#snippet target()}
        <button class="btn ghost" onclick={() => (pgTable.isFilterPopover = !pgTable.isFilterPopover)}
            ><FunnelIcon --size="1.2rem" /> <span>Filters</span>
            {#if pgTable.appliedFilters > 0}<span class="badge">{pgTable.appliedFilters}</span>{/if}
            <ChevronIcon --size="1rem" direction={pgTable.isFilterPopover ? "top" : "bottom"} />
        </button>
    {/snippet}
    <div class="flex flex-col gap-2 pb-4 w-lg">
        {#each pgTable.whereFilters as filter, i}
            <div class="flex gap-2">
                <Select class="w-40" bind:value={pgTable.whereFilters[i].column} placeholder="column name">
                    {#each pgTable.current?.columns ?? [] as column}
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
                    class="small w-60"
                    type="text"
                    autocorrect="off"
                    bind:value={pgTable.whereFilters[i].value}
                    placeholder="value"
                />
                <button
                    type="button"
                    aria-label="Trash"
                    class="btn icon ghost"
                    onclick={(e) => {
                        e.preventDefault();
                        pgTable.whereFilters.splice(i, 1);
                    }}><CrossIcon --size="1.2rem" /></button
                >
            </div>
        {:else}
            <p class="text-sx text-fg-1 text-center py-2">No filters applied, all rows will be listed.</p>
        {/each}
    </div>
    <div class="flex justify-between">
        <button
            class="btn ghost self-start"
            onclick={() =>
                pgTable.whereFilters.push({
                    column: pgTable.current?.columns[0].column_name ?? "",
                    operator: "=",
                    value: "",
                })}><PlusIcon /> Ajouter un filtre</button
        >
        <button
            class="btn small"
            disabled={!pgTable.whereFilters.every((filter) => filter.column && filter.value)}
            onclick={applyFilters}><CheckIcon /> Apply filter</button
        >
    </div>
</Popover>
