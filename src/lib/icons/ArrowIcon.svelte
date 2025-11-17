<script lang="ts">
    export let direction: "top" | "right" | "bottom" | "left" = "bottom";
    const directionToTransform = {top: "", right: "rotate(90deg)", bottom: "rotate(180deg)", left: "rotate(-90deg)"};
</script>

<svg
    width="22"
    height="25"
    viewBox="0 0 22 25"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style="--transform: {directionToTransform[direction]}"
    aria-hidden="true"
>
    <path d="M11 23L11 3M11 3L2 11.8M11 3L20 11.8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
</svg>

<style>
    svg {
        transform: var(--transform);
        width: var(--size, 1rem);
        transition: transform 0.3s;
    }
</style>
