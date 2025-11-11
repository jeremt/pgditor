<script lang="ts">
    import type {HTMLInputAttributes} from "svelte/elements";

    interface Props extends HTMLInputAttributes {
        indeterminate?: boolean;
    }

    let {checked = $bindable(), indeterminate, children, ...props}: Props = $props();
</script>

<div class="box">
    {#if indeterminate}
        <svg viewBox="0 0 12 9" aria-hidden="true"><polyline points="2 5 10 5" /></svg>
    {:else}
        <svg viewBox="0 0 12 9" aria-hidden="true"><polyline points="1 5 4 8 11 1" /></svg>
    {/if}
    <input bind:checked type="checkbox" {indeterminate} {...props} />
</div>

<style>
    .box {
        display: grid;
        position: relative;
        place-content: center;
        width: var(--size, 1.25rem);
        height: var(--size, 1.25rem);
        transition: var(--transition, 0.3s) all;
        flex-shrink: 0;
        border-radius: var(--radius, 0.4rem);
        background-color: var(--bg, var(--color-bg-1));
        &:hover,
        &:focus-visible {
            background-color: var(--bg-hover, var(--color-bg-2));
        }
        svg {
            display: block;
            width: calc(var(--size, 1.5rem) / 2);
            fill: none;
            overflow: visible;
            stroke: var(--fg, var(--color-bg));
            stroke-width: 3;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 16px;
            stroke-dashoffset: 16px;
            transform: translate3d(0, 0, 0);
            transition: all 0.2s ease;
            transition-delay: 0.1s;
        }
        &:has(input:focus-visible) {
            filter: brightness(1.4);
        }
        input[type="checkbox"] {
            position: absolute;
            opacity: 0;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            margin: 0;
            cursor: pointer;
            &:disabled {
                cursor: default;
            }
        }
        &:has(input[type="checkbox"]:checked) {
            background-color: var(--color, var(--color-fg));
            svg {
                stroke-dashoffset: 0;
            }
        }

        &:has(input[type="checkbox"]:indeterminate) {
            background-color: var(--color, var(--color-fg));
            svg {
                stroke-dashoffset: 0;
            }
        }
    }
</style>
