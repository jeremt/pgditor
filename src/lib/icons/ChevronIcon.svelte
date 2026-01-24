<script lang="ts">
    type Props = {
        direction?: "top" | "right" | "bottom" | "left";
    };
    let {direction = "bottom"}: Props = $props();
    const directionToTransform = {top: "-90deg", right: "", bottom: "90deg", left: "180deg"};
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
    style:rotate={directionToTransform[direction]}
    aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg
>

<style>
    svg {
        width: var(--size);
        height: var(--size);
        transition: rotate 0.3s;
    }
</style>
