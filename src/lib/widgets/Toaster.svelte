<script lang="ts" module>
    import {getContext, setContext} from "svelte";

    type ToastOptions = {
        /**
         * Changes the color and add an icon for error and success.
         */
        kind?: "error" | "message" | "success";

        /**
         * A custom action button is added to the toast.
         */
        action?: {label: string; callback: () => void};

        /**
         * The duration before closing the toast, 0 if the toast never closes automatically.
         */
        timeout?: number;

        /**
         * Simple subtitle added to the toast.
         */
        details?: string;

        /**
         * Add an image to the toast.
         */
        thumbnail_src?: string;
    };
    type ToastMessage = {
        index: number;
        message: string;
        options: ToastOptions;
    };
    export const create_toast_context = () => {
        const messages = $state<ToastMessage[]>([]);

        const remove = (item: ToastMessage) => {
            const index = messages.findIndex((m) => m.index === item.index);
            if (index !== -1) {
                messages.splice(index, 1);
            }
        };
        const toast = (message: string, options: ToastOptions = {}) => {
            options.kind ??= "message";
            options.timeout ??= 5000;
            const item = {message, index: messages.length, options: {...options}};
            messages.push(item);
            if (options.timeout !== 0) {
                setTimeout(() => {
                    remove(item);
                }, options.timeout);
            }
        };

        return {
            get toast() {
                return toast;
            },
            get remove() {
                return remove;
            },
            get messages() {
                return messages;
            },
        };
    };

    const key = Symbol("toastContext");
    export const get_toast_context = () => getContext<ReturnType<typeof create_toast_context>>(key);
    export const set_toast_context = () => setContext(key, create_toast_context());
</script>

<script lang="ts">
    import Check from "$lib/icons/CheckIcon.svelte";
    import Cross from "$lib/icons/CrossIcon.svelte";
    import Error from "$lib/icons/ErrorIcon.svelte";

    const toast_context = get_toast_context();
    const kind_to_color = {
        error: "var(--color-error)",
        success: "var(--color-success)",
        message: "var(--color-fg)",
    };
</script>

<div class="toasts">
    {#each toast_context.messages as item}
        <div class="toast" style:color={kind_to_color[item.options.kind!]}>
            {#if item.options.kind === "error"}
                <div class="circle"><Error /></div>
            {:else if item.options.kind === "success"}
                <div class="circle"><Check --size="1.2rem" /></div>
            {/if}
            {#if item.options.thumbnail_src}
                <img src={item.options.thumbnail_src} alt="" role="presentation" />
            {/if}
            {#if item.options.details}
                <div>
                    <div class="message">{item.message}</div>
                    <small>{item.options.details}</small>
                </div>
            {:else}
                <div class="message">{item.message}</div>
            {/if}
            {#if item.options.action}
                <button
                    class="btn"
                    onclick={() => {
                        item.options.action?.callback();
                        toast_context.remove(item);
                    }}>{item.options.action.label}</button
                >
            {/if}
            <button class="btn ghost icon" onclick={() => toast_context.remove(item)}><Cross /></button>
        </div>
    {/each}
</div>

<style>
    @keyframes appear {
        from {
            opacity: 0;
            translate: 0 2rem;
        }
        to {
            opacity: 1;
            translate: 0;
        }
    }

    .toasts {
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: start;
        gap: 1rem;
        position: fixed;
        bottom: 1rem;
        left: 1rem;

        & > .toast {
            display: flex;
            gap: 0.5rem;
            align-items: center;
            border: 1px solid var(--color-bg-2);
            background-color: var(--color-bg);
            & > img {
                max-width: 6rem;
                border-radius: 0.5rem;
            }
            .message {
                font-weight: bold;
            }
            font-size: 0.9rem;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            opacity: 0;
            animation: appear 0.2s ease-out 0s forwards;
        }
    }
</style>
