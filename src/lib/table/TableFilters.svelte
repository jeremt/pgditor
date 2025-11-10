<script lang="ts">
    import TrashIcon from "$lib/icons/TrashIcon.svelte";
    import Popover from "$lib/widgets/Popover.svelte";
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
        <button class="btn outline" onclick={() => (isPopoverOpen = !isPopoverOpen)}>Filters ({appliedRules})</button>
    {/snippet}
    <div class="flex flex-col gap-2 pb-4 w-lg">
        {#each filters as filter, i}
            <div class="flex gap-2">
                <input class="small w-80" type="text" bind:value={filters[i].column} placeholder="column name" />
                <select class="small" value={filter.operator}>
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
                </select>
                <input class="small w-80" type="text" bind:value={filters[i].value} placeholder="value" />
                <button
                    type="button"
                    aria-label="Trash"
                    class="btn icon"
                    onclick={(e) => {
                        e.preventDefault();
                        filters.splice(i, 1);
                    }}><TrashIcon --size="1.2rem" /></button
                >
            </div>
        {:else}
            <p>No filters applied, all rows will be listed.</p>
        {/each}
    </div>
    <div class="flex justify-between">
        <button
            class="btn outline small self-start"
            onclick={() => filters.push({column: "", operator: "=", value: ""})}>Ajouter un filtre</button
        >
        <button
            class="btn small"
            disabled={!filters.every((filter) => filter.column && filter.value)}
            onclick={applyFilters}>Apply filter</button
        >
    </div>
</Popover>
