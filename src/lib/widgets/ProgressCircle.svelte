<script lang="ts">
    import type {Snippet} from "svelte";

    interface Props {
        value?: number;
        thickness?: number;
        infinite?: boolean;
        show_value?: boolean;
        end?: Snippet;
    }
    let {value = 0.25, thickness = 0.1, infinite = false, show_value = true, end}: Props = $props();

    const baseSize = 512; // px
    const radius = baseSize / 2;
    const circumference = radius * 2 * Math.PI;
    let dashoffset = $derived(circumference - value * circumference);
</script>

{#if value >= 1 && end !== undefined}
    {@render end()}
{:else}
    <figure
        role="meter"
        aria-valuenow={value}
        aria-valuetext={infinite ? "Infinite Spinner" : `${value * 100}%`}
        aria-valuemin={0}
        aria-valuemax={100}
    >
        <svg class:infinite viewBox={`0 0 ${baseSize} ${baseSize}`}>
            <circle class="track" stroke-width={thickness * baseSize} r={baseSize / 2} cx="50%" cy="50%" />
            <circle
                class="meter"
                stroke-width={thickness * baseSize}
                r={baseSize / 2}
                cx="50%"
                cy="50%"
                stroke-dasharray="{circumference} {circumference}"
                stroke-dashoffset={dashoffset}
            />
        </svg>
        {#if show_value}
            <figcaption>{(Math.min(value, 1) * 100).toFixed(0)}%</figcaption>
        {/if}
    </figure>
{/if}

<style>
    @keyframes rotate {
        from {
            rotate: 0;
        }
        to {
            rotate: 360deg;
        }
    }
    figure {
        position: relative;
        width: var(--size, 3rem);
        height: var(--size, 3rem);
        margin: 0;
    }
    figcaption {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color, currentColor);
        font-size: calc(var(--font-size-factor, 1) * 0.85em);
    }
    svg {
        &.infinite {
            animation: rotate 2s infinite forwards linear;
        }
        &:not(.infinite) {
            rotate: -90deg;
        }
        overflow: visible;
    }
    circle {
        fill: none;
    }
    .track {
        stroke: var(--bg, var(--color-bg-2));
    }
    .meter {
        stroke: var(--color, currentColor);
    }
</style>
