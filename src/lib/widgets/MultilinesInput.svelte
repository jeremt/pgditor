<script lang="ts">
    import type {HTMLTextareaAttributes} from "svelte/elements";

    interface Props extends HTMLTextareaAttributes {
        min_rows?: number;
    }

    let {value = $bindable(), min_rows, rows, ...props}: Props = $props();

    let element: HTMLTextAreaElement;
    let shadowElement: HTMLTextAreaElement;

    let rowHeight = $state(0);

    const calculateRowHeight = () => {
        if (!shadowElement) return;
        const rect = shadowElement.getBoundingClientRect();
        if (rect.height > 0) {
            rowHeight = rect.height;
        }
    };

    const resize = () => {
        if (!element) return;

        element.style.height = "auto";
        const style = window.getComputedStyle(element);
        const paddingBlock = 0;
        const borderBlock = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);

        const height = Math.max(
            rowHeight * (min_rows ?? 0) + paddingBlock + borderBlock,
            element.scrollHeight + borderBlock + paddingBlock,
        );
        element.style.height = `${height}px`;
    };

    const handleInput = (event: Event & {currentTarget: HTMLTextAreaElement}) => {
        resize();
        props.oninput?.(event);
    };

    $effect(() => {
        if (!element || !shadowElement) return;

        // Calculate row height from shadow element
        calculateRowHeight();

        // Set up IntersectionObserver to detect when textarea becomes visible
        const intersectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        // Element is visible, recalculate everything
                        calculateRowHeight();
                        requestAnimationFrame(() => {
                            resize();
                        });
                    }
                });
            },
            {
                threshold: 0.01, // Trigger when at least 1% is visible
            },
        );

        // Set up ResizeObserver to handle size changes
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === shadowElement && entry.contentRect.height > 0) {
                    rowHeight = entry.contentRect.height;
                }
                if (entry.target === element && entry.contentRect.width > 0) {
                    requestAnimationFrame(resize);
                }
            }
        });

        // Observe both elements
        intersectionObserver.observe(element);
        resizeObserver.observe(shadowElement);
        resizeObserver.observe(element);

        // Initial resize attempt
        requestAnimationFrame(() => {
            if (rowHeight === 0) {
                calculateRowHeight();
            }
            resize();
        });

        // Cleanup
        return () => {
            intersectionObserver.disconnect();
            resizeObserver.disconnect();
        };
    });

    // Watch for value changes from outside (e.g., programmatic updates)
    $effect(() => {
        if (value !== undefined) {
            requestAnimationFrame(resize);
        }
    });
</script>

<svelte:window onresize={resize} />
<textarea bind:this={shadowElement} rows="1" aria-hidden="true" tabindex="-1"></textarea>
<textarea bind:this={element} bind:value oninput={handleInput} rows={min_rows ?? rows} {...props}></textarea>

<style>
    textarea {
        width: 100%;
        flex-shrink: 0;
        overflow: hidden;
        resize: none;
        padding-block: 0.5rem;
    }

    textarea[aria-hidden="true"] {
        opacity: 0;
        position: absolute;
        box-sizing: content-box;
        pointer-events: none;
        left: -9999px;
    }
</style>
