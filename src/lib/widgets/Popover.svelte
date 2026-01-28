<script lang="ts">
    import type {Snippet} from "svelte";

    type Props = {
        isOpen: boolean;
        target: Snippet;
        offsetY?: number;
        anchor?: "start" | "center" | "end";
        children: Snippet;
    };

    let {isOpen = $bindable(), target, children, offsetY = 0, anchor = "center"}: Props = $props();
    let cardElement: HTMLDivElement;
    let el: HTMLDivElement;
    let position = $state({x: 0, y: 0});
    let maxHeight = $state<`${number}px`>();
    let maxWidth = $state<`${number}px`>();

    const clickOut = (event: MouseEvent) => {
        if (isOpen && !el.contains(event.target as Node) && !event.defaultPrevented) {
            isOpen = false;
        }
    };
    const closeOnEsc = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            if (isOpen) {
                event.preventDefault();
            }
            isOpen = false;
        }
    };

    const restrictContainerPosition = () => {
        const targetBounds = el.getBoundingClientRect();
        const childrenBounds = cardElement.getBoundingClientRect();
        const margin = 16;
        // horizontal anchor: 'start' | 'center' | 'end'
        let expectedX: number;
        if (anchor === "start") {
            expectedX = targetBounds.left;
        } else if (anchor === "end") {
            expectedX = targetBounds.right - childrenBounds.width;
        } else {
            expectedX = targetBounds.left + (targetBounds.width - childrenBounds.width) / 2;
        }
        // clamp to viewport with a safe margin
        expectedX = Math.max(margin, Math.min(expectedX, window.innerWidth - childrenBounds.width - margin));

        const spaceBelow = window.innerHeight - targetBounds.bottom;
        const expectedY =
            spaceBelow >= childrenBounds.height
                ? targetBounds.bottom + offsetY
                : targetBounds.top - childrenBounds.height - offsetY;

        // apply positions (never negative)
        position.x = Math.max(expectedX, 0);
        position.y = Math.max(expectedY, 0);
        if (expectedY < 0) {
            maxHeight = `${childrenBounds.height - Math.abs(expectedY)}px`;
        } else {
            maxHeight = undefined;
        }
        // adjust max width when horizontally constrained
        if (expectedX < margin) {
            maxWidth = `${childrenBounds.width - Math.abs(expectedX - margin)}px`;
        } else if (expectedX + childrenBounds.width + margin > window.innerWidth) {
            maxWidth = `${childrenBounds.width - (expectedX + childrenBounds.width + margin - window.innerWidth)}px`;
        } else {
            maxWidth = undefined;
        }
    };

    const handleFocusIn = (event: FocusEvent) => {
        if (!isOpen) {
            isOpen = true;
        }
    };

    const handleFocusOut = (event: FocusEvent) => {
        // FIXME: for now, we don't automatically close the popover on focus out because it compete with clickOut but we should find a better fix for that
    };

    $effect(() => {
        if (isOpen) {
            restrictContainerPosition();
        }
    });
</script>

<svelte:document onclick={clickOut} onkeydown={closeOnEsc} />
<svelte:window onresize={restrictContainerPosition} />

<div class="popover" onfocusin={handleFocusIn} onfocusout={handleFocusOut} bind:this={el}>
    {@render target()}
    <div
        bind:this={cardElement}
        class="popoverCard card"
        class:open={isOpen}
        style:top={`${position.y}px`}
        style:left={`${position.x}px`}
        style:max-height={maxHeight}
        style:max-width={maxWidth}
    >
        {@render children()}
    </div>
</div>

<style>
    .popover {
        display: inline-flex;
    }
    .popoverCard {
        position: fixed;
        background-color: var(--color-bg-card);
        backdrop-filter: blur(1rem);
        border-radius: var(--radius-card);
        border: 1px solid var(--color-bg-1);
        left: 0;
        opacity: 0;
        padding: var(--padding, 1rem);
        display: flex;
        flex-direction: column;
        transition:
            opacity 0.18s ease,
            transform 0.18s ease;
        transform: translateY(-0.75rem);
        will-change: transform, opacity;
        pointer-events: none;
        z-index: 50;
    }
    .popoverCard.open {
        opacity: 1;
        transform: translateY(0);
        pointer-events: all;
    }
</style>
