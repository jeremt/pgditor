<script lang="ts">
    let {spinning = false} = $props();
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
    class:spinning
    ><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path
        d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
    ></path><path d="M8 16H3v5"></path></svg
>

<style>
    svg {
        width: var(--size);
        height: var(--size);
        &.spinning {
            animation: spin360 0.5s ease-out;
        }
    }

    @keyframes spin360 {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
</style>
