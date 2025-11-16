<script lang="ts">
    import type {HTMLButtonAttributes} from "svelte/elements";
    import Dialog from "./Dialog.svelte";

    type Props = {
        onaction: () => Promise<void>;
        confirm?: {
            title: string;
            description: string;
            confirmText?: string;
            confirmClass?: string;
        };
    } & Omit<HTMLButtonAttributes, "onclick">;

    let {confirm, onaction, children, class: btnClass, ...btnProps}: Props = $props();

    let isLoading = $state(false);
    let isConfirmOpen = $state(false);
</script>

<button
    {...btnProps}
    class={btnClass}
    disabled={isLoading}
    onclick={async () => {
        if (confirm) {
            isConfirmOpen = true;
        } else {
            isLoading = true;
            await onaction();
            isLoading = false;
        }
    }}>{@render children?.()}</button
>

{#if confirm}
    <Dialog isOpen={isConfirmOpen} onrequestclose={() => (isConfirmOpen = false)}>
        <h2 class="text-2xl pb-2">{confirm.title}</h2>
        <p>{confirm.description}</p>
        <footer class="flex justify-between pt-2">
            <button class="btn secondary" onclick={() => (isConfirmOpen = false)}>Cancel</button>
            <button
                class={confirm.confirmClass ?? btnClass}
                disabled={isLoading}
                onclick={async () => {
                    isLoading = true;
                    await onaction();
                    isLoading = false;
                }}>{confirm.confirmText ?? "Confirm"}</button
            >
        </footer>
    </Dialog>
{/if}
