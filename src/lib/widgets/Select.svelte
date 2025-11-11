<script lang="ts">
    import {type Snippet} from "svelte";
    import type {HTMLSelectAttributes} from "svelte/elements";

    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";

    interface Props extends HTMLSelectAttributes {
        children?: Snippet;
    }

    let {value = $bindable(), children, ...props}: Props = $props();

    let selectElement: HTMLSelectElement;
    let hasFocus = $state(false);

    const findFirstOptionText = () => {
        return selectElement?.options[0]?.text;
    };

    const findOptionText = () => {
        return selectElement?.options[selectElement.selectedIndex]?.text;
    };

    let text = $derived.by(() => {
        if (!value && props.placeholder) {
            return props.placeholder;
        }
        return (value ? findOptionText() : findFirstOptionText()) || value;
    });

    $effect(() => {
        // Tricks to trigger this $effect when value changes
        value;
        text = findOptionText() || findFirstOptionText() || value;

        const observer = new MutationObserver(() => {
            text = findOptionText() || findFirstOptionText() || value;
        });
        observer.observe(selectElement, {childList: true, subtree: true});

        return () => {
            observer.disconnect();
        };
    });
</script>

<button
    onclick={() => selectElement.click()}
    tabindex="-1"
    class="btn secondary"
    class:focus={hasFocus}
    disabled={props.disabled}
>
    <div aria-hidden="true" class="content">{text}</div>
    <ChevronIcon />
    <select
        bind:this={selectElement}
        bind:value
        {...props}
        onfocus={() => (hasFocus = true)}
        onblur={() => (hasFocus = false)}
    >
        {@render children?.()}
    </select>
</button>

<style>
    button {
        position: relative;
    }
    select {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        opacity: 0;
        margin: 0;
    }
</style>
