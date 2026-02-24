<script lang="ts">
    import type {HTMLButtonAttributes} from "svelte/elements";
    import Dialog from "./Dialog.svelte";
    import ProgressCircle from "./ProgressCircle.svelte";

    type Props = {
        onaction: () => Promise<void>;
        confirm?: {
            title: string;
            description: string;
            buttonText?: string;
            buttonClass?: string;
        };
        loading_text?: string;
        loading_delay?: number;
    } & Omit<HTMLButtonAttributes, "onclick">;

    let {
        confirm,
        loading_text = "Loading…",
        loading_delay = 100,
        onaction,
        children,
        class: btnClass,
        ...btnProps
    }: Props = $props();

    let isLoading = $state(false);
    let isConfirmOpen = $state(false);

    const run_action = async () => {
        const t = setTimeout(() => {
            isLoading = true;
        }, loading_delay);
        await onaction();
        clearTimeout(t);
        isLoading = false;
    };
</script>

<button
    {...btnProps}
    class={btnClass}
    disabled={btnProps.disabled || (isLoading && isConfirmOpen === false)}
    onclick={() => {
        if (confirm) {
            isConfirmOpen = true;
        } else {
            run_action();
        }
    }}
    >{#if isLoading && isConfirmOpen === false}<ProgressCircle
            --size="1.2rem"
            thickness={0.07}
            infinite={true}
            show_value={false}
        />{loading_text}
    {:else}{@render children?.()}{/if}</button
>

{#if confirm}
    <Dialog is_open={isConfirmOpen} onrequestclose={() => (isConfirmOpen = false)}>
        <h2 class="text-2xl pb-2">{confirm.title}</h2>
        <p class="whitespace-pre-line max-w-md">{confirm.description}</p>
        <footer class="flex justify-between pt-2">
            <button class="btn secondary" disabled={isLoading} onclick={() => (isConfirmOpen = false)}>Annuler</button>

            <button
                class={confirm.buttonClass ?? btnClass}
                disabled={isLoading}
                onclick={async () => {
                    await run_action();
                    isConfirmOpen = false;
                }}
                >{#if isLoading}<ProgressCircle --size="1.5rem" thickness={0.05} infinite={true} show_value={false} />
                    {loading_text}{:else}{confirm.buttonText ?? "Confirmer"}{/if}</button
            >
        </footer>
    </Dialog>
{/if}
