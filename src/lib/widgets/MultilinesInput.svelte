<script lang="ts">
    import type {HTMLTextareaAttributes} from "svelte/elements";

    interface Props extends HTMLTextareaAttributes {
        minRows?: number;
    }

    let {value = $bindable(), minRows, rows, ...props}: Props = $props();

    let element: HTMLTextAreaElement;
    let shadowElement: HTMLTextAreaElement;

    let rowHeight = $state(0);

    const resize = () => {
        element.style.height = "auto";
        const style = window.getComputedStyle(element);
        const paddingBlock = 0; //parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        const borderBlock = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);

        const height = Math.max(
            rowHeight * (minRows ?? 0) + paddingBlock + borderBlock,
            element.scrollHeight + borderBlock + paddingBlock
        );
        element.style.height = `${height}px`;
    };

    const handleInput = (event: Event & {currentTarget: HTMLTextAreaElement}) => {
        resize();
        props.onchange?.(event);
    };

    $effect(() => {
        if (ResizeObserver) {
            const observer = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    if (entry.target.classList.contains("hidden") && entry.contentRect.height !== 0) {
                        rowHeight = entry.contentRect.height;
                        entry.target.parentElement?.removeChild(entry.target);
                    }
                    if (entry.contentRect.height) {
                        resize();
                        observer.disconnect();
                    }
                }
            });
            observer.observe(shadowElement);
            observer.observe(element);
        }
    });
</script>

<svelte:window onresize={resize} />
<textarea class="hidden" bind:this={shadowElement} rows="1"></textarea>
<textarea bind:this={element} bind:value oninput={handleInput} rows={minRows ?? rows} {...props}></textarea>

<style>
    textarea {
        width: 100%;
        flex-shrink: 0;
        overflow: hidden;
        resize: none;
        padding-block: 0.5rem;
    }

    textarea.hidden {
        opacity: 0;
        box-sizing: content-box;
        pointer-events: none;
    }
</style>
