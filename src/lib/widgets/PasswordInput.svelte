<script lang="ts">
    import type {HTMLInputAttributes} from "svelte/elements";

    interface Props extends HTMLInputAttributes {}
    let {value = $bindable(), type, ...props}: Props = $props();

    let show = $state(false);

    const toggleShow = (event: MouseEvent) => {
        event.preventDefault();
        show = !show;
    };
</script>

{#snippet eye()}
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
        ><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
        ></path><circle cx="12" cy="12" r="3"></circle></svg
    >
{/snippet}
{#snippet eyeOff()}
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
        ><path d="m15 18-.722-3.25"></path><path d="M2 8a10.645 10.645 0 0 0 20 0"></path><path d="m20 15-1.726-2.05"
        ></path><path d="m4 15 1.726-2.05"></path><path d="m9 18 .722-3.25"></path></svg
    >
{/snippet}

<div>
    <input type={show ? "text" : "password"} bind:value {...props} />
    <button aria-label="Afficher ou masquer mot de passe" type="button" onclick={toggleShow}>
        {#if show}
            {@render eye()}
        {:else}
            {@render eyeOff()}
        {/if}
    </button>
</div>

<style>
    div {
        position: relative;
        background-color: var(--color-bg-1);
        border-radius: var(--radius-input);
    }

    input {
        width: calc(100% - 2rem);
    }
    div button {
        cursor: pointer;
        background-color: transparent;
        border: none;
        position: absolute;
        right: 0.5rem;
        top: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        color: var(--color-fg);
        svg {
            width: 1.2rem;
            height: 1.2rem;
        }
    }
</style>
