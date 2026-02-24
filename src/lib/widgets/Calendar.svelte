<script lang="ts">
    import {SvelteDate} from "svelte/reactivity";

    import {get_days_in_month} from "$lib/helpers/date";

    type Props = {
        select_mode?: "date" | "range";
        start_date?: SvelteDate;
        end_date?: SvelteDate;
        locale?: Intl.LocalesArgument;
        min_date?: Date;
        max_date?: Date;
        week_start?: number;
    };
    let {
        select_mode = "date",
        start_date = $bindable(),
        end_date = $bindable(),
        locale = "en",
        min_date,
        max_date,
        week_start = 1,
    }: Props = $props();

    const month_formatter = new Intl.DateTimeFormat(locale, {month: "short"});
    const weekday_formatter = new Intl.DateTimeFormat(locale, {weekday: "narrow"});

    let current_month = $state(new SvelteDate());
    $effect(() => {
        current_month.setTime((start_date ?? new Date()).getTime());
    });

    let first_day = $derived(
        (new Date(current_month.getFullYear(), current_month.getMonth(), 1).getDay() - week_start + 7) % 7,
    );
    let weekdays = Array(7)
        .fill("")
        .map((_, i) => weekday_formatter.format(new Date(0, 0, i + week_start)));
    let days_in_month = $derived(get_days_in_month(current_month));
    let can_go_to_next_month = $derived(
        max_date === undefined || new Date(current_month.getFullYear(), current_month.getMonth() + 1) <= max_date,
    );
    let can_go_to_previous_month = $derived(
        min_date === undefined || new Date(current_month.getFullYear(), current_month.getMonth() - 1) >= min_date,
    );

    const is_day_between = (index: number) => {
        if (start_date === undefined || end_date === undefined) {
            return false;
        }
        const currentDate = new Date(current_month.getFullYear(), current_month.getMonth(), index + 1);
        return currentDate > start_date && currentDate < end_date;
    };
    const is_day_selected = (index: number) => {
        return (
            (start_date?.getDate() === index + 1 &&
                start_date.getMonth() === current_month.getMonth() &&
                start_date.getFullYear() === current_month.getFullYear()) ||
            (end_date?.getDate() === index + 1 &&
                end_date.getMonth() === current_month.getMonth() &&
                end_date.getFullYear() === current_month.getFullYear())
        );
    };
    const is_day_out_of_range = (index: number) => {
        const current_date = new Date(current_month.getFullYear(), current_month.getMonth(), index + 1);
        return (
            (min_date !== undefined && current_date < min_date) || (max_date !== undefined && current_date > max_date)
        );
    };

    const select_day = (index: number) => {
        const newDate = new SvelteDate(current_month.getFullYear(), current_month.getMonth(), index + 1);
        if (select_mode === "date") {
            if (start_date !== undefined && start_date.toDateString() === newDate.toDateString()) {
                start_date = undefined;
            } else {
                start_date = newDate;
            }
        } else if (start_date === undefined) {
            start_date = newDate;
        } else if (end_date === undefined) {
            if (newDate < start_date) {
                const tmp = start_date;
                start_date = newDate;
                end_date = tmp;
            } else {
                end_date = newDate;
            }
        } else if (newDate < start_date) {
            start_date = newDate;
        } else if (newDate > end_date) {
            end_date = newDate;
        } else {
            end_date = undefined;
            start_date = newDate;
        }
    };
    const go_to_next_month = () => {
        current_month.setMonth(current_month.getMonth() + 1);
    };
    const go_to_previous_month = () => {
        current_month.setMonth(current_month.getMonth() - 1);
    };
</script>

<div class="header">
    <button aria-label="Mois précédent" onclick={go_to_previous_month} disabled={!can_go_to_previous_month}>
        <svg
            stroke="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            role="presentation"
            focusable="false"
        >
            <path fill="none" d="M20 28 8.7 16.7a1 1 0 0 1 0-1.4L20 4"></path>
        </svg>
    </button>
    <span>
        {month_formatter.format(current_month)}
        {current_month.getFullYear()}
    </span>
    <button aria-label="Mois suivant" onclick={go_to_next_month} disabled={!can_go_to_next_month}>
        <svg
            stroke="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            role="presentation"
            focusable="false"
        >
            <path fill="none" d="m12 4 11.3 11.3a1 1 0 0 1 0 1.4L12 28"></path>
        </svg>
    </button>
</div>
<div class="calendar">
    {#each weekdays as day}
        <div class="weekday cell">{day}</div>
    {/each}

    {#each Array(first_day)}
        <div class="empty cell"></div>
    {/each}

    {#each Array(days_in_month) as _, i}
        <button
            class="day cell"
            class:between={is_day_between(i)}
            class:selected={is_day_selected(i)}
            disabled={is_day_out_of_range(i)}
            onclick={() => {
                select_day(i);
            }}
        >
            {i + 1}
        </button>
    {/each}
</div>

<style>
    .calendar {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.3rem;
    }
    .cell {
        user-select: none;
        all: unset;
        cursor: pointer;
        padding: 0.3rem 0.4rem;
        text-align: center;
        transition: all 0.3s;
        border-radius: 9999px;
        font-size: 0.9rem;
        &.weekday {
            user-select: none;
            font-weight: bold;
            font-size: 0.8rem;
            pointer-events: none;
        }
        &.empty {
            pointer-events: none;
        }
        &:not(.weekday):hover,
        &.between {
            background-color: var(--color-bg-1);
        }
        &:not(.weekday).selected {
            color: var(--color-bg);
            background-color: var(--color-fg);
        }
        &:focus-visible {
            outline: 2px solid var(--color-fg);
        }
        &:disabled {
            opacity: 50%;
            pointer-events: none;
        }
    }
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.8rem;
        & > span {
            user-select: none;
        }
        & button {
            all: unset;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 1rem;
            padding: 0.3rem;
            transition: all 0.3s;
            &:hover {
                background-color: var(--color-bg-1);
            }
            &:disabled {
                opacity: 50%;
                pointer-events: none;

                svg {
                    fill-opacity: 50%;
                    stroke-opacity: 50%;
                }
            }
            &:focus-visible {
                outline: 2px solid var(--color-fg);
            }
            svg {
                fill: var(--color-fg);
                width: 1rem;
                height: 1rem;
                stroke-width: 4px;
            }
        }
    }
</style>
