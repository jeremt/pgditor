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
        loadingText?: string;
        loadingDelay?: number;
    } & Omit<HTMLButtonAttributes, "onclick">;

    let {
        confirm,
        loadingText = "Loading…",
        loadingDelay = 100,
        onaction,
        children,
        class: btnClass,
        ...btnProps
    }: Props = $props();

    let isLoading = $state(false);
    let isConfirmOpen = $state(false);

    const runAction = async () => {
        const t = setTimeout(() => {
            isLoading = true;
        }, loadingDelay);
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
            runAction();
        }
    }}
    >{#if isLoading && isConfirmOpen === false}<ProgressCircle
            --size="1.2rem"
            thickness={0.07}
            infinite={true}
            showValue={false}
        />{loadingText}
    {:else}{@render children?.()}{/if}</button
>

{#if confirm}
    <Dialog isOpen={isConfirmOpen} onrequestclose={() => (isConfirmOpen = false)}>
        <h2 class="text-2xl pb-2">{confirm.title}</h2>
        <p class="whitespace-pre-line max-w-md">{confirm.description}</p>
        <footer class="flex justify-between pt-2">
            <button class="btn secondary" disabled={isLoading} onclick={() => (isConfirmOpen = false)}>Annuler</button>

            <button
                class={confirm.buttonClass ?? btnClass}
                disabled={isLoading}
                onclick={async () => {
                    await runAction();
                    isConfirmOpen = false;
                }}
                >{#if isLoading}<ProgressCircle --size="1.5rem" thickness={0.05} infinite={true} showValue={false} />
                    {loadingText}{:else}{confirm.buttonText ?? "Confirmer"}{/if}</button
            >
        </footer>
    </Dialog>
{/if}
