<script lang="ts">
    import Calendar from "$lib/widgets/Calendar.svelte";
    import {SvelteDate} from "svelte/reactivity";
    import {type PgColumn} from "../pgContext.svelte";
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

    const addZero = (i: number) => `${i < 10 ? "0" : ""}${i}`;
    const options = (n: number) => {
        let result: string[] = [];
        for (let i = 0; i <= n; i++) {
            result.push(addZero(i));
        }
        return result;
    };
    const parseTime = (datetime: string, i: number) => {
        const valueOrNow = datetime === "now()" ? new Date().toISOString() : datetime;
        return valueOrNow.slice(valueOrNow.indexOf("T") + 1, valueOrNow.indexOf(".")).split(":")[i];
    };
    const replaceTime = (datetime: string, digits: string, i: number) => {
        const start = datetime.indexOf("T");
        const end = datetime.indexOf(".");
        const time = datetime.slice(start + 1, end).split(":");
        console.log({time});
        time[i] = digits;
        return datetime.slice(0, start + 1) + time.join(":") + datetime.slice(end);
    };
    const timezoneIndex = (str: string) => {
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

    let isDialogOpen = $state(false);
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
        <div class="flex gap-4 pt-4">
            <div class="p-4 border border-bg-1 rounded-2xl">
                <Calendar
                    bind:startDate={
                        () => {
                            const valueOrNow = value === "now()" ? new Date().toISOString() : value;
                            // Split the string to get ONLY the date part "YYYY-MM-DD"
                            // This ignores the T, the time, and the timezone offset entirely.
                            const [datePart] = valueOrNow.split("T");
                            const [y, m, d] = datePart.split("-").map(Number);

                            // Months in JS Date are 0-indexed, so we subtract 1
                            return new SvelteDate(y, m - 1, d);
                        },
                        (newValue) => {
                            const y = newValue.getFullYear();
                            const m = addZero(newValue.getMonth() + 1);
                            const d = addZero(newValue.getDate());

                            const timePart = value.slice(value.indexOf("T"));
                            value = `${y}-${m}-${d}${timePart}`;
                        }
                    }
                />
            </div>
            <div class="flex flex-col gap-4">
                <div class="flex gap-2 items-center">
                    <Select
                        title="hours"
                        bind:value={() => parseTime(value, 0), (newValue) => (value = replaceTime(value, newValue, 0))}
                    >
                        {#each options(23) as opt}
                            <option>{opt}</option>
                        {/each}
                    </Select>:
                    <Select
                        title="minutes"
                        bind:value={() => parseTime(value, 1), (newValue) => (value = replaceTime(value, newValue, 1))}
                    >
                        {#each options(59) as opt}
                            <option>{opt}</option>
                        {/each}
                    </Select>:
                    <Select
                        title="seconds"
                        bind:value={() => parseTime(value, 2), (newValue) => (value = replaceTime(value, newValue, 2))}
                    >
                        {#each options(59) as opt}
                            <option>{opt}</option>
                        {/each}
                    </Select>
                </div>
                <NumberInput
                    title="microseconds"
                    min={0}
                    max={999999}
                    bind:value={
                        () => {
                            const valueOrNow = value === "now()" ? new Date().toISOString() : value;
                            return parseInt(
                                valueOrNow.slice(valueOrNow.indexOf(".") + 1, timezoneIndex(valueOrNow)),
                                10,
                            );
                        },
                        (newValue) => {
                            value = `${value.slice(0, value.indexOf(".") + 1)}${newValue}${value.slice(timezoneIndex(value))}`;
                        }
                    }
                />
                <Select
                    title="timezone"
                    bind:value={
                        () => {
                            const valueOrNow = value === "now()" ? new Date().toISOString() : value;
                            return valueOrNow.slice(timezoneIndex(valueOrNow));
                        },
                        (newValue) => {
                            value = value.slice(0, timezoneIndex(value)) + newValue;
                        }
                    }
                >
                    {#each timezones as timezone}
                        <option value={timezone.offset}>{timezone.offset} {timezone.name}</option>
                    {/each}
                </Select>
                <button class="btn secondary" onclick={() => (value = "now()")}>now()</button>
            </div>
        </div>
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
        <button class="btn secondary" onclick={() => (isDialogOpen = true)}><CalendarIcon --size="1rem" /></button>
    </div>
    <Dialog isOpen={isDialogOpen} position="right" animation="right">
        <div class="flex flex-col w-xl h-full">
            <header class="flex flex-col pt-4 px-4">
                <div class="flex gap-2 items-center pb-4">
                    <h2 class="flex gap-2 ms-2 me-auto items-center">
                        {column.column_name}
                        <span class="font-normal">{column.data_type}</span>
                    </h2>
                    <button class="btn" onclick={() => (isDialogOpen = false)}
                        ><CheckIcon --size="1.2rem" /> Apply</button
                    >
                </div>
            </header>
            <div class="grow px-4 w-full overflow-auto">
                {#if isDialogOpen}
                    {@render editor()}
                {/if}
            </div>
        </div>
    </Dialog>
{:else}{@render editor()}{/if}
