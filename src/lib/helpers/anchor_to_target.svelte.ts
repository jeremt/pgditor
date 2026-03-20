import {tick} from "svelte";

interface AnchorToTargetOptions {
    /** Minimum margin from window edges when adjusting position. Default: 8 */
    margin_overflow?: number;
    /** Function that returns the element to measure for overflow adjustment */
    get_anchor_element?: () => HTMLElement | null;
}

interface AnchorToTargetReturn {
    /** The top position in pixels */
    top: number;
    /** The left position in pixels */
    left: number;
}

/**
 * Creates a positioned anchor that follows a target element.
 * Computes position at the target's top-left corner and adjusts if it overflows the viewport.
 *
 * @param element - A getter function returning the target HTMLElement
 * @param options - Configuration options
 * @returns An object with reactive top and left properties
 */
export const anchor_to_target = (
    element: () => HTMLElement | undefined,
    {margin_overflow = 8, get_anchor_element}: AnchorToTargetOptions = {},
): AnchorToTargetReturn => {
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

        const anchor = get_anchor_element?.();
        if (anchor) {
            const anchor_rect = anchor.getBoundingClientRect();

            if (left + anchor_rect.width > window.innerWidth) {
                left = window.innerWidth - anchor_rect.width - margin_overflow;
            }
            if (top + anchor_rect.height > window.innerHeight) {
                top = window.innerHeight - anchor_rect.height - margin_overflow;
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
