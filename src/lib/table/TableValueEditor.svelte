<script lang="ts">
    import type {PgColumn, PgRow} from "./tableContext.svelte";

    type Props = {
        column: PgColumn;
        row: PgRow;
    };
    let {column, row = $bindable()}: Props = $props();

    let rowValue = {
        get value() {
            if (typeof row[column.column_name] === "object") {
                return JSON.stringify(row[column.column_name]);
            }
            return row[column.column_name] as string;
        },
        set value(newValue) {
            if (typeof newValue === "object" && newValue !== null) {
                row[column.column_name] = JSON.parse(newValue);
            } else {
                row[column.column_name] = newValue;
            }
        },
    };
</script>

<input
    id={column.column_name}
    type="text"
    class="font-mono!"
    autocorrect="off"
    disabled={row[column.column_name] === null && column.is_nullable === "YES"}
    bind:value={rowValue.value}
    placeholder={row[column.column_name] === null && column.is_nullable === "YES" ? "NULL" : "Enter a value"}
/>
