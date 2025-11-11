<script lang="ts">
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import FunnelIcon from "$lib/icons/FunnelIcon.svelte";
    import PlusIcon from "$lib/icons/PlusIcon.svelte";
    import TrashIcon from "$lib/icons/TrashIcon.svelte";
    import Popover from "$lib/widgets/Popover.svelte";
    import Select from "$lib/widgets/Select.svelte";

    import {getTableContext} from "./tableContext.svelte";

    let isPopoverOpen = $state(false);

    const pgTable = getTableContext();

    type Where = {column: string; operator: string; value: string}[];
    let filters = $state<Where>([]);
    let appliedRules = $state(0);
    const applyFilters = () => {
        pgTable.filters.where = filters.reduce((result, filter) => {
            return (
                result +
                "\n" +
                (result === "" ? "WHERE" : "AND") +
                ` ${filter.column} ${filter.operator} '${filter.value}'`
            );
        }, "");
        appliedRules = filters.length;
        isPopoverOpen = false;
    };
</script>

<Popover isOpen={isPopoverOpen} offsetY={10}>
    {#snippet target()}
        <button class="btn ghost" onclick={() => (isPopoverOpen = !isPopoverOpen)}
            ><FunnelIcon --size="1.2rem" /> <span>Filters</span>
            {#if appliedRules > 0}<span class="badge">{appliedRules}</span>{/if}
            <ChevronIcon --size="1rem" direction={isPopoverOpen ? "top" : "bottom"} />
        </button>
    {/snippet}
    <div class="flex flex-col gap-2 pb-4 w-lg">
        {#each filters as filter, i}
            <div class="flex gap-2">
                <input class="w-40" type="text" bind:value={filters[i].column} placeholder="column name" />
                <Select class="small" value={filter.operator}>
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
                <input class="small w-60" type="text" bind:value={filters[i].value} placeholder="value" />
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
    </div>
    <div class="flex justify-between">
        <button class="btn ghost self-start" onclick={() => filters.push({column: "", operator: "=", value: ""})}
            ><PlusIcon /> Ajouter un filtre</button
        >
        <button
            class="btn small"
            disabled={!filters.every((filter) => filter.column && filter.value)}
            onclick={applyFilters}><CheckIcon /> Apply filter</button
        >
    </div>
</Popover>
