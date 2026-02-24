<script lang="ts">
    import type {Snippet} from "svelte";
    import type {HTMLDialogAttributes} from "svelte/elements";

    interface Props extends HTMLDialogAttributes {
        is_open: boolean;
        children?: Snippet;
        disableBodyScrolling?: boolean;
        /**
         * Disable click outside the modal or cancel to close.
         */
        disable_cancel?: boolean;
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
        is_open,
        animation = "bottom",
        type = "card",
        position = "center",
        onrequestclose,
        onclosed,
        children,
        disable_cancel: disableCancel = false,
        disableBodyScrolling = true,
        ...props
    }: Props = $props();
    let dialog: HTMLDialogElement;

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
        event.stopPropagation();
        onrequestclose?.(event);
    };

    const handleAnimationEnd = () => {
        if (!is_open) {
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

    const handleClick = (event: MouseEvent) => {
        // check if the click target is within a different dialog element
        const targetDialog = (event.target as HTMLElement)?.closest("dialog");
        if (targetDialog && targetDialog !== dialog) {
            // click is inside a nested dialog, ignore it
            return;
        }

        const rect = dialog.getBoundingClientRect();
        const isInDialog =
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom &&
            event.clientX >= rect.left &&
            event.clientX <= rect.right;
        const isTargetInsideDialog = event.target ? dialog.contains(event.target as HTMLElement) : true;

        // check clientY and clientX !== 0 for Firefox bug when clicking in an option inside a dialog
        if ((event.clientY !== 0 && event.clientX !== 0 && !isInDialog) || !isTargetInsideDialog) {
            onrequestclose?.(event);
            event.preventDefault();
            event.stopPropagation();
        }
    };

    $effect(() => {
        if (is_open) {
            dialog.showModal();
        }
    });

    $effect(() => {
        const currentValue = document.documentElement.getAttribute("data-scroll");
        const resetValue = () => {
            if (currentValue === null) {
                document.documentElement.removeAttribute("data-scroll");
            } else {
                document.documentElement.setAttribute("data-scroll", currentValue);
            }
        };
        if (is_open && disableBodyScrolling) {
            document.documentElement.setAttribute("data-scroll", "false");
        } else if (!is_open && disableBodyScrolling) {
            resetValue();
        }

        return resetValue;
    });
</script>

<dialog
    bind:this={dialog}
    class:closing={!is_open}
    class:fullscreen={type === "fullscreen"}
    onclose={handleClose}
    onclick={handleClick}
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
            animation: var(--animation-in) 0.2s cubic-bezier(0.25, 0, 0.3, 1) normal;
        }

        &[open].closing {
            animation: var(--animation-out) 0.2s cubic-bezier(0.25, 0, 0.3, 1) normal;
        }

        &::backdrop {
            background-color: var(--dialog-background-color, var(--color-backdrop));
            backdrop-filter: var(--dialog-backdrop-filter);
        }
        &[open]::backdrop {
            animation: dialog-fade-in 0.2s cubic-bezier(0.25, 0, 0.3, 1) normal;
        }

        &[open].closing::backdrop {
            animation: dialog-fade-out 0.2s cubic-bezier(0.25, 0, 0.3, 1) normal;
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
