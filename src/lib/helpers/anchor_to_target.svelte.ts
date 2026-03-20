import {tick} from "svelte";

/**
 * Creates a positioned anchor that follows a target element.
 * Computes position at the target's top-left corner and adjusts if it overflows the viewport.
 *
 * @param element - A getter function returning the target HTMLElement
 * @param options - Configuration options
 * @returns An object with reactive top and left properties
 */
export const anchor_to_target = (element: () => HTMLElement | undefined, {margin_overflow = 8} = {}) => {
    let top = $state(0);
    let left = $state(0);

    const compute_position = async () => {
        const el = element();
        if (!el) {
            top = 0;
            left = 0;
            return;
        }

        const rect = el.getBoundingClientRect();
        top = rect.top;
        left = rect.left;

        await tick();
        const dialog = document.querySelector(".small_dialog_anchor");
        if (dialog) {
            const dialog_rect = dialog.getBoundingClientRect();

            if (left + dialog_rect.width > window.innerWidth) {
                left = window.innerWidth - dialog_rect.width - margin_overflow;
            }
            if (top + dialog_rect.height > window.innerHeight) {
                top = window.innerHeight - dialog_rect.height - margin_overflow;
            }
            if (left < margin_overflow) left = margin_overflow;
            if (top < margin_overflow) top = margin_overflow;
        }
    };

    $effect(() => {
        compute_position();

        const on_resize = () => compute_position();
        window.addEventListener("resize", on_resize);
        return () => window.removeEventListener("resize", on_resize);
    });

    return {
        get top() {
            return top;
        },
        get left() {
            return left;
        },
    };
};
