import type {Attachment} from "svelte/attachments";

/**
 * Create a resize attachment for observing element size changes
 * @param onResize Called when the element resizes
 * @returns Attachment function
 */
export const resize = (
    onResize: (width: number, height: number, element: HTMLElement) => void
): Attachment<HTMLElement> => {
    return (element: HTMLElement) => {
        if (!ResizeObserver) return () => {};

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                onResize(entry.contentRect.width, entry.contentRect.height, element);
            }
        });

        resizeObserver.observe(element);

        // Return cleanup function
        return () => {
            resizeObserver.unobserve(element);
            resizeObserver.disconnect();
        };
    };
};
