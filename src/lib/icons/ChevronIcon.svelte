<script lang="ts">
    type Props = {
        direction?: "top" | "right" | "bottom" | "left";
    };
    let {direction = "bottom"}: Props = $props();
    const directionToTransform = {top: "rotate(-90deg)", right: "", bottom: "rotate(90deg)", left: "rotate(180deg)"};
</script>

<svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    style:--transform={directionToTransform[direction]}
    aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg
>

<style>
    svg {
        transform: var(--transform);
        width: var(--size);
        height: var(--size);
        transition: transform 0.3s;
    }
</style>
