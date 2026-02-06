<script lang="ts">
    import type {HTMLInputAttributes} from "svelte/elements";

    import {safeIncrement} from "$lib/helpers/safeIncrement";

    interface Props extends HTMLInputAttributes {
        value: number | null | undefined;
        step?: number;
        min?: number;
        max?: number;
        unit?: string;
        nullable?: boolean;
        onchange?: (event: Event) => void;
    }
    let {value = $bindable(), type, unit, nullable, onchange, ...props}: Props = $props();

    const step = $derived(props.step ?? 1);
    const clampValue = (inputValue: number) => {
        let outputValue = inputValue;
        if (props.max !== undefined) {
            outputValue = Math.min(inputValue, props.max);
        }
        if (props.min !== undefined) {
            outputValue = Math.max(outputValue, props.min);
        }
        return outputValue;
    };

    const plus = (event: MouseEvent) => {
        event.preventDefault();
        value = clampValue(safeIncrement(value ?? 0, step));
        onchange?.(event);
    };
    const minus = (event: MouseEvent) => {
        event.preventDefault();
        value = clampValue(safeIncrement(value ?? 0, -step));
        onchange?.(event);
    };

    const keys = (event: KeyboardEvent) => {
        switch (event.key) {
            case "ArrowUp": {
                value = clampValue(safeIncrement(value ?? 0, step));
                break;
            }
            case "ArrowDown": {
                value = clampValue(safeIncrement(value ?? 0, -step));
                break;
            }
        }
        onchange?.(event);
    };
</script>

{#snippet chevron(direction: "top" | "right" | "bottom" | "left" = "bottom")}
    {@const directionToTransform = {top: "rotate(-90deg)", right: "", bottom: "rotate(90deg)", left: "rotate(180deg)"}}
    <svg
        width="12"
        height="20"
        viewBox="0 0 12 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style:transform={directionToTransform[direction]}
        aria-hidden="true"
    >
        <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M10.8388 11.0607C11.4246 10.4749 11.4246 9.52512 10.8388 8.93933L3.06066 1.16116C2.47487 0.575374 1.52513 0.575375 0.939341 1.16116C0.353554 1.74695 0.353554 2.6967 0.939341 3.28248L7.65685 9.99999L0.939339 16.7175C0.353553 17.3033 0.353553 18.253 0.939339 18.8388C1.52513 19.4246 2.47487 19.4246 3.06066 18.8388L10.8388 11.0607Z"
            fill="currentColor"
        />
    </svg>
{/snippet}

<div class="inputWrapper">
    <input
        type="number"
        style:padding-right={unit ? "2.5rem" : "1.5rem"}
        {value}
        onkeydown={keys}
        onchange={(event) => {
            const valueString = event.currentTarget.value;
            if (valueString === "" && nullable) {
                value = null;
            } else {
                value = clampValue(isNaN(parseFloat(valueString) ?? 0) ? 0 : (parseFloat(valueString) ?? 0));
                event.currentTarget.value = value.toString();
            }
            onchange?.(event);
        }}
        {...props}
    />
    {#if unit}<small>{unit}</small>{/if}
    <button class="plus" aria-label="Plus" type="button" tabindex="-1" onclick={plus}>
        {@render chevron("top")}
    </button>
    <button class="minus" aria-label="Minus" type="button" tabindex="-1" onclick={minus}>
        {@render chevron("bottom")}
    </button>
</div>

<style>
    .inputWrapper {
        width: var(--width, initial);
        flex-shrink: 0;
        position: relative;
        font-size: var(--font-size, initial);

        & > input {
            width: 100%;
            appearance: textfield;

            &::-webkit-outer-spin-button,
            &::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
        }
        & > small {
            position: absolute;
            right: 2rem;
            top: 50%;
            translate: 0 -50%;
            font-size: 0.95em;
            color: var(--color-fg-1);
        }
        & > button {
            cursor: pointer;
            background-color: transparent;
            border: none;
            position: absolute;
            right: 0.6rem;
            display: flex;
            align-items: center;
            color: var(--color-fg);
            &.plus {
                top: 0.1em;
            }
            &.minus {
                bottom: 0.1em;
            }
        }
    }

    svg {
        width: 0.4rem;
    }
</style>
