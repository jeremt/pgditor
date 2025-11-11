<script lang="ts">
    import type {Snippet} from "svelte";

    type Props = {
        isOpen: boolean;
        target: Snippet;
        offsetY?: number;
        children: Snippet;
    };

    let {isOpen = $bindable(), target, children, offsetY = 0}: Props = $props();
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
        const spaceRight = window.innerWidth - targetBounds.right;
        const expectedX =
            spaceRight >= childrenBounds.width ? targetBounds.left : window.innerWidth - childrenBounds.width - 16;

        const spaceBelow = window.innerHeight - targetBounds.bottom;
        const expectedY =
            spaceBelow >= childrenBounds.height
                ? targetBounds.bottom + offsetY
                : targetBounds.top - childrenBounds.height - offsetY;

        position.x = Math.max(expectedX, 0);
        position.y = Math.max(expectedY, 0);
        if (expectedY < 0) {
            maxHeight = `${childrenBounds.height - Math.abs(expectedY)}px`;
        } else {
            maxHeight = undefined;
        }
        if (expectedX < 0) {
            maxWidth = `${childrenBounds.width - Math.abs(expectedX)}px`;
        } else {
            maxWidth = undefined;
        }
    };

    $effect(() => {
        if (isOpen) {
            restrictContainerPosition();
        }
    });
</script>

<svelte:document onclick={clickOut} onkeydown={closeOnEsc} />
<svelte:window onresize={restrictContainerPosition} />

<div bind:this={el} role="button" tabindex="-1">
    {@render target()}
    <div
        bind:this={cardElement}
        class="popoverCard"
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
    .popoverCard {
        position: fixed;
        left: 0;
        opacity: 0;
        padding: 1rem;
        border: 1px solid var(--color-bg-1);
        border-radius: var(--radius-card);
        display: flex;
        flex-direction: column;
        transition:
            0.3s all,
            top 0s,
            left 0s;
        translate: 0 -1rem;
        pointer-events: none;
        background-color: #181818aa;
        backdrop-filter: blur(1rem);
        z-index: 1;
    }
    .popoverCard.open {
        opacity: 1;
        translate: 0;
        pointer-events: all;
    }
</style>
