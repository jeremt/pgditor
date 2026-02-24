<script lang="ts">
    import Calendar from "$lib/widgets/Calendar.svelte";
    import {SvelteDate} from "svelte/reactivity";
    import {type PgColumn} from "../pg_context.svelte";
    import Select from "$lib/widgets/Select.svelte";
    import NumberInput from "$lib/widgets/NumberInput.svelte";
    import CalendarIcon from "$lib/icons/CalendarIcon.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import CheckIcon from "$lib/icons/CheckIcon.svelte";

    type Props = {
        value: string;
        column: PgColumn;
        inlined: boolean;
    };
    let {value = $bindable(), column, inlined}: Props = $props();

    // ISO 8601 Regex: Matches YYYY-MM-DDTHH:mm:ss.sssZ or +/-HH:mm
    const iso_regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}(:\d{2})?)$/;

    // Reactive derived state for the error message
    let is_valid = $derived(value === "now()" || iso_regex.test(value));

    // --- Logic Helpers ---
    const get_effective_value = () => (value === "now()" ? new Date().toISOString() : value);

    const ensure_concrete_value = () => {
        if (value === "now()") {
            // toISOString() returns "2024...T12:00:00.000Z"
            // We swap 'Z' for '+00:00' so the timezone selector recognizes it
            value = new Date().toISOString().replace("Z", "+00:00");
        }
    };

    const get_parts = (str: string) => {
        // Normalize string: if it ends in Z, treat it as +00:00
        const normalized = str.endsWith("Z") ? str.replace("Z", "+00:00") : str;

        const tzIdx = timezone_index(normalized);
        const dotIdx = normalized.indexOf(".");
        const [datePart, timePartFull] = normalized.split("T");

        const timeEnd = dotIdx !== -1 ? dotIdx : tzIdx;
        const timePart = timePartFull.slice(0, timeEnd - datePart.length - 1);
        const [y, m, d] = datePart.split("-").map(Number);

        return {
            date: datePart,
            dateArray: {y, m, d},
            time: timePart.split(":"),
            ms: dotIdx !== -1 ? normalized.slice(dotIdx + 1, tzIdx) : "000000",
            tz: normalized.slice(tzIdx),
        };
    };

    // Unified function to put the string back together
    const update_value = (changes: Partial<{date: string; time: string[]; ms: string; tz: string}>) => {
        ensure_concrete_value();
        const p = {...get_parts(value), ...changes};
        // Force 6-digit microsecond padding for Postgres compatibility
        const ms = p.ms.padEnd(6, "0").slice(0, 6);
        value = `${p.date}T${p.time.join(":")}.${ms}${p.tz}`;
    };

    const parse_ios = (str: string) => {
        // Basic ISO format: YYYY-MM-DDTHH:mm:ss.sssZ or +/-HH:mm
        const [datePart, timeWithZone] = str.split("T");
        const [y, m, d] = datePart.split("-").map(Number);

        // Handle Time and Microseconds
        const dotIndex = timeWithZone.indexOf(".");
        const tzStart = timezone_index(timeWithZone);
        const timePart = timeWithZone.slice(0, dotIndex !== -1 ? dotIndex : tzStart);
        const [hh, mm, ss] = timePart.split(":");

        return {y, m, d, hh, mm, ss, datePart, timeWithZone};
    };

    const add_zero = (i: number) => `${i < 10 ? "0" : ""}${i}`;
    const options = (n: number) => {
        let result: string[] = [];
        for (let i = 0; i <= n; i++) {
            result.push(add_zero(i));
        }
        return result;
    };
    const timezone_index = (str: string) => {
        const i = str.indexOf("+");
        return i === -1 ? str.lastIndexOf("-") : i;
    };
    const timezones = (() => {
        const now = new Date();
        const groups = new Map();

        // 1. Get all supported zones
        Intl.supportedValuesOf("timeZone").forEach((tz) => {
            const parts = new Intl.DateTimeFormat("en-GB", {
                timeZone: tz,
                timeZoneName: "longOffset",
            }).formatToParts(now);

            let offset = parts.find((p) => p.type === "timeZoneName")!.value.replace("GMT", "");
            if (offset === "Z" || !offset) offset = "+00:00";

            // 2. Scoring logic: Prioritize "Mainstream" continents for better UX
            const score = (name: string) => {
                if (name.startsWith("Europe/")) return 4;
                if (name.startsWith("America/")) return 3;
                if (name.startsWith("Asia/")) return 3;
                if (name.startsWith("Australia/")) return 3;
                if (name.includes("/")) return 2; // Other regions (Africa, Pacific)
                return 1; // Generic or Etc/ zones
            };

            const currentBest = groups.get(offset);

            // 3. Keep the one with the higher score; if tied, keep the shorter name
            if (!currentBest || score(tz) > score(currentBest)) {
                groups.set(offset, tz);
            } else if (score(tz) === score(currentBest) && tz.length < currentBest.length) {
                groups.set(offset, tz);
            }
        });

        // 4. Convert Map back to sorted array
        return Array.from(groups.entries())
            .map(([offset, name]) => ({offset, name}))
            .sort((a, b) => {
                // Sort numerically by offset value
                const toMinutes = (o: string) => {
                    const [h, m] = o.split(":").map(Number);
                    return h * 60 + (h < 0 ? -m : m);
                };
                return toMinutes(a.offset) - toMinutes(b.offset);
            });
    })();

    let is_dialog_open = $state(false);
</script>

{#snippet editor()}
    <div class="flex flex-col">
        <input
            type="text"
            id={column.column_name}
            class="font-mono! w-full py-2"
            autocomplete="off"
            autocapitalize="off"
            bind:value
        />
        {#if !is_valid}
            <div class="text-error border border-bg-1 p-4 rounded-2xl text-sm mt-4">
                Invalid ISO 8601 format (e.g., 2024-01-01T12:00:00.000Z)
            </div>
        {:else}
            <div class="flex gap-4 pt-4">
                <div class="p-4 border border-bg-1 rounded-2xl">
                    <Calendar
                        bind:start_date={
                            () => {
                                const {y, m, d} = parse_ios(get_effective_value());
                                return new SvelteDate(y, m - 1, d);
                            },
                            (v) => {
                                ensure_concrete_value();
                                const y = v.getFullYear();
                                const m = add_zero(v.getMonth() + 1);
                                const d = add_zero(v.getDate());
                                value = `${y}-${m}-${d}T${value.split("T")[1]}`;
                            }
                        }
                    />
                </div>

                <div class="flex flex-col gap-4">
                    <div class="flex gap-2 items-center">
                        {#each [0, 1, 2] as i}
                            <Select
                                title={["hours", "minutes", "seconds"][i]}
                                bind:value={
                                    () => get_parts(get_effective_value()).time[i],
                                    (v) => {
                                        const time = get_parts(get_effective_value()).time;
                                        time[i] = v;
                                        update_value({time});
                                    }
                                }
                            >
                                {#each options(i === 0 ? 23 : 59) as opt}
                                    <option>{opt}</option>
                                {/each}
                            </Select>
                            {i < 2 ? ":" : ""}
                        {/each}
                    </div>

                    <NumberInput
                        title="microseconds"
                        min={0}
                        max={999999}
                        bind:value={
                            () => {
                                const ms = get_parts(get_effective_value()).ms;
                                return parseInt(ms, 10) || 0;
                            },
                            (v) => update_value({ms: v.toString().padStart(3, "0")})
                        }
                    />

                    <Select
                        title="timezone"
                        bind:value={() => get_parts(get_effective_value()).tz, (v) => update_value({tz: v})}
                    >
                        {#each timezones as timezone}
                            <option value={timezone.offset}>{timezone.offset} {timezone.name}</option>
                        {/each}
                    </Select>

                    <button class="btn secondary" onclick={() => (value = "now()")}> Set to now() </button>
                </div>
            </div>
        {/if}
    </div>
{/snippet}

{#if inlined}
    <div class="flex gap-2">
        <input
            type="text"
            id={column.column_name}
            class="font-mono! grow py-2"
            autocomplete="off"
            autocapitalize="off"
            bind:value
        />
        <button class="btn secondary" onclick={() => (is_dialog_open = true)}><CalendarIcon --size="1rem" /></button>
    </div>
    <Dialog is_open={is_dialog_open} position="right" animation="right">
        <div class="flex flex-col w-xl h-full">
            <header class="flex flex-col pt-4 px-4">
                <div class="flex gap-2 items-center pb-4">
                    <h2 class="flex gap-2 ms-2 me-auto items-center">
                        {column.column_name}
                        <span class="font-normal">{column.data_type}</span>
                    </h2>
                    <button class="btn" onclick={() => (is_dialog_open = false)}
                        ><CheckIcon --size="1.2rem" /> Apply</button
                    >
                </div>
            </header>
            <div class="grow px-4 w-full overflow-auto">
                {#if is_dialog_open}
                    {@render editor()}
                {/if}
            </div>
        </div>
    </Dialog>
{:else}{@render editor()}{/if}
