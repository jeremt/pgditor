<script lang="ts">
    import {SvelteDate} from "svelte/reactivity";

    import {getDaysInMonth} from "$lib/helpers/date";

    type Props = {
        selectMode?: "date" | "range";
        startDate?: SvelteDate;
        endDate?: SvelteDate;
        locale?: Intl.LocalesArgument;
        minDate?: Date;
        maxDate?: Date;
        weekStart?: number;
    };
    let {
        selectMode = "date",
        startDate = $bindable(),
        endDate = $bindable(),
        locale = "en",
        minDate,
        maxDate,
        weekStart = 1,
    }: Props = $props();

    const monthFormatter = new Intl.DateTimeFormat(locale, {month: "short"});
    const weekdayFormatter = new Intl.DateTimeFormat(locale, {weekday: "narrow"});

    let currentMonth = $state(new SvelteDate());
    $effect(() => {
        currentMonth.setTime((startDate ?? new Date()).getTime());
    });

    let firstDay = $derived(
        (new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() - weekStart + 7) % 7,
    );
    let weekdays = Array(7)
        .fill("")
        .map((_, i) => weekdayFormatter.format(new Date(0, 0, i + weekStart)));
    let daysInMonth = $derived(getDaysInMonth(currentMonth));
    let canGoToNextMonth = $derived(
        maxDate === undefined || new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1) <= maxDate,
    );
    let canGoToPreviousMonth = $derived(
        minDate === undefined || new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1) >= minDate,
    );

    const isDayBetween = (index: number) => {
        if (startDate === undefined || endDate === undefined) {
            return false;
        }
        const currentDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), index + 1);
        return currentDate > startDate && currentDate < endDate;
    };
    const isDaySelected = (index: number) => {
        return (
            (startDate?.getDate() === index + 1 &&
                startDate.getMonth() === currentMonth.getMonth() &&
                startDate.getFullYear() === currentMonth.getFullYear()) ||
            (endDate?.getDate() === index + 1 &&
                endDate.getMonth() === currentMonth.getMonth() &&
                endDate.getFullYear() === currentMonth.getFullYear())
        );
    };
    const isDayOutOfRange = (index: number) => {
        const currentDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), index + 1);
        return (minDate !== undefined && currentDate < minDate) || (maxDate !== undefined && currentDate > maxDate);
    };

    const selectDay = (index: number) => {
        const newDate = new SvelteDate(currentMonth.getFullYear(), currentMonth.getMonth(), index + 1);
        if (selectMode === "date") {
            if (startDate !== undefined && startDate.toDateString() === newDate.toDateString()) {
                startDate = undefined;
            } else {
                startDate = newDate;
            }
        } else if (startDate === undefined) {
            startDate = newDate;
        } else if (endDate === undefined) {
            if (newDate < startDate) {
                const tmp = startDate;
                startDate = newDate;
                endDate = tmp;
            } else {
                endDate = newDate;
            }
        } else if (newDate < startDate) {
            startDate = newDate;
        } else if (newDate > endDate) {
            endDate = newDate;
        } else {
            endDate = undefined;
            startDate = newDate;
        }
    };
    const gotoNextMonth = () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
    };
    const gotoPreviousMonth = () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
    };
</script>

<div class="header">
    <button aria-label="Mois précédent" onclick={gotoPreviousMonth} disabled={!canGoToPreviousMonth}>
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
        {monthFormatter.format(currentMonth)}
        {currentMonth.getFullYear()}
    </span>
    <button aria-label="Mois suivant" onclick={gotoNextMonth} disabled={!canGoToNextMonth}>
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

    {#each Array(firstDay)}
        <div class="empty cell"></div>
    {/each}

    {#each Array(daysInMonth) as _, i}
        <button
            class="day cell"
            class:between={isDayBetween(i)}
            class:selected={isDaySelected(i)}
            disabled={isDayOutOfRange(i)}
            onclick={() => {
                selectDay(i);
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
