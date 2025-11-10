<script lang="ts">
    import type {Snippet} from "svelte";
    import type {HTMLDialogAttributes} from "svelte/elements";

    interface Props extends HTMLDialogAttributes {
        isOpen: boolean;
        children?: Snippet;
        /**
         * Disable click outside the modal or cancel to close.
         */
        disableCancel?: boolean;
        type?: "card" | "fullscreen";
        /**
         * The position of the dialog.
         */
        position?: "top" | "right" | "bottom" | "left" | "center";
        /**
         * The animation to use when opening the dialog.
         */
        animation?: "top" | "right" | "bottom" | "left" | "fade";
        /**
         * Called when the dialog should be closed (when clicking outside or pressing escape).
         */
        onrequestclose?: (event?: Event) => void;
        /**
         * Called once the closing animation actually finished.
         */
        onclosed?: () => void;
    }
    let {
        isOpen,
        animation = "bottom",
        type = "card",
        position = "center",
        onrequestclose,
        onclosed,
        children,
        disableCancel = false,
        ...props
    }: Props = $props();

    let dialog: HTMLDialogElement;
    let justOpened = $state(false);

    const animations = {
        top: {
            in: "dialog-top-in",
            out: "dialog-top-out",
        },
        right: {
            in: "dialog-right-in",
            out: "dialog-right-out",
        },
        bottom: {
            in: "dialog-bottom-in",
            out: "dialog-bottom-out",
        },
        left: {
            in: "dialog-left-in",
            out: "dialog-left-out",
        },
        fade: {
            in: "dialog-fade-in",
            out: "dialog-fade-out",
        },
    };

    const handleClose = (event: Event) => {
        event.preventDefault();
        onrequestclose?.(event);
    };
    const handleAnimationEnd = () => {
        if (!isOpen) {
            dialog.close();
            onclosed?.();
        }
    };
    const handleCancel = (event: Event) => {
        if (event.target !== dialog) {
            return;
        }
        event.preventDefault();
        if (!disableCancel) {
            onrequestclose?.(event);
        }
    };

    const handleWindowClick = (event: MouseEvent) => {
        if ((event as PointerEvent).pointerId === -1) {
            // prevent closing the dialog when selecting stuff with tab/enter.
            return;
        }
        if (!isOpen || justOpened || disableCancel) {
            justOpened = false;
            return;
        }
        // Sometimes, when clicking on a select inside a dialog, clientX and clientY = 0
        // So we just go up the tree to check if the element is contained in the dialog
        if (event.clientX === 0 && event.clientY === 0) {
            for (
                let el = event.target as HTMLElement | null;
                el !== null;
                el = el.parentElement as HTMLElement | null
            ) {
                if (el === dialog) {
                    return;
                }
            }
        }
        const rect = dialog.getBoundingClientRect();
        const clickedInDialog =
            rect.top <= event.clientY &&
            event.clientY <= rect.top + rect.height &&
            rect.left <= event.clientX &&
            event.clientX <= rect.left + rect.width;

        if (!clickedInDialog) {
            onrequestclose?.(event);
        }
    };

    $effect(() => {
        if (isOpen) {
            dialog.showModal();
            justOpened = true;
        }
    });
</script>

<svelte:window onclick={handleWindowClick} />
<dialog
    bind:this={dialog}
    class:closing={!isOpen}
    class:fullscreen={type === "fullscreen"}
    onclose={handleClose}
    onanimationend={handleAnimationEnd}
    oncancel={handleCancel}
    style:--animation-in={animations[animation].in}
    style:--animation-out={animations[animation].out}
    class={[position]}
    {...props}
>
    {@render children?.()}
</dialog>

<style>
    :global {
        @keyframes dialog-fade-in {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }
        @keyframes dialog-fade-out {
            from {
                opacity: 1;
            }
            to {
                opacity: 0;
            }
        }
        @keyframes dialog-top-in {
            from {
                translate: 0 -20%;
                opacity: 0;
            }
            to {
                translate: 0;
                opacity: 1;
            }
        }
        @keyframes dialog-top-out {
            from {
                translate: 0;
                opacity: 1;
            }
            to {
                translate: 0 -20%;
                opacity: 0;
            }
        }
        @keyframes dialog-bottom-in {
            from {
                translate: 0 20%;
                opacity: 0;
            }
            to {
                translate: 0;
                opacity: 1;
            }
        }
        @keyframes dialog-bottom-out {
            from {
                translate: 0;
                opacity: 1;
            }
            to {
                translate: 0 20%;
                opacity: 0;
            }
        }
        @keyframes dialog-left-in {
            from {
                translate: -20% 0;
                opacity: 0;
            }
            to {
                translate: 0;
                opacity: 1;
            }
        }
        @keyframes dialog-left-out {
            from {
                translate: 0;
                opacity: 1;
            }
            to {
                translate: -20% 0;
                opacity: 0;
            }
        }
        @keyframes dialog-right-in {
            from {
                translate: 20% 0;
                opacity: 0;
            }
            to {
                translate: 0;
                opacity: 1;
            }
        }
        @keyframes dialog-right-out {
            from {
                translate: 0;
                opacity: 1;
            }
            to {
                translate: 20% 0;
                opacity: 0;
            }
        }
    }

    dialog {
        --animation-in: "dialog-bottom-in";
        --animation-out: "dialog-bottom-out";
        color: var(--color-fg);
        border: none;
        overflow: auto;
        max-width: var(--max-width, fit-content);
        width: var(--width, fit-content);
        height: fit-content;
        max-height: 95%;
        padding: var(--padding, 1.5rem);
        border-radius: 1.25rem;
        backdrop-filter: var(--dialog-content-filter);
        background-color: var(--dialog-content-color, var(--color-bg));

        &.top {
            margin: 0 auto auto;
            width: 100%;
            max-width: 100%;
            align-items: center;
            border-top-left-radius: 0;
            border-top-right-radius: 0;
        }
        &.right {
            margin: auto 0 auto auto;
            height: 100%;
            max-height: 100%;
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
        }
        &.bottom {
            margin: auto auto 0 auto;
            width: 100%;
            max-width: 100%;
            align-items: center;
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
        }
        &.left {
            margin: auto auto auto 0;
            height: 100%;
            max-height: 100%;
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
        }
        &.center {
            margin: auto;
        }
        &[open] {
            display: flex;
            flex-direction: column;
            animation: var(--animation-in) 0.3s cubic-bezier(0.25, 0, 0.3, 1) normal;
        }

        &[open].closing {
            animation: var(--animation-out) 0.3s cubic-bezier(0.25, 0, 0.3, 1) normal;
        }

        &::backdrop {
            background-color: var(--dialog-background-color, var(--color-backdrop));
            backdrop-filter: var(--dialog-backdrop-filter);
        }
        &[open]::backdrop {
            animation: dialog-fade-in 0.3s cubic-bezier(0.25, 0, 0.3, 1) normal;
        }

        &[open].closing::backdrop {
            animation: dialog-fade-out 0.3s cubic-bezier(0.25, 0, 0.3, 1) normal;
        }
        &.fullscreen {
            max-width: 100%;
            width: 100%;
            height: 100%;
            max-height: 100%;
            margin: 0;
            padding: 0;
            border-radius: 0;
            background-color: transparent;
        }
    }
</style>
