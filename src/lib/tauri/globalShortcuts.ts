import {isRegistered, register, unregister, type ShortcutHandler} from "@tauri-apps/plugin-global-shortcut";

/**
 * Register global shortcuts while gracefully handling svelte reactivity, clean-up and potential
 * conflicts with other apps shortcuts.
 *
 * @param shortcuts the list of shortcuts to register with their associated action to trigger.
 */
export const globalShortcuts = (shortcuts: {keys: string; action: ShortcutHandler}[]) => {
    let shortcutsRegistered = false;
    let focusHandlerRef: EventListener | null = null;
    let blurHandlerRef: EventListener | null = null;

    const registerShortcuts = async () => {
        if (shortcutsRegistered) return;
        for (const {keys} of shortcuts) {
            try {
                const registered = await isRegistered(keys);
                if (registered) {
                    await unregister(keys);
                }
            } catch (err) {
                console.warn(`Failed to check/unregister ${keys}:`, err);
            }
        }

        shortcutsRegistered = true;
        for (const {keys, action} of shortcuts) {
            try {
                await register(keys, action);
            } catch (err) {
                shortcutsRegistered = false;
                console.error(`Failed to register ${keys}:`, err);
            }
        }
    };

    const unregisterShortcuts = async () => {
        for (const {keys} of shortcuts) {
            try {
                await unregister(keys);
            } catch (err) {
                console.warn(`Failed to unregister ${keys}:`, err);
            }
        }
        shortcutsRegistered = false;
    };

    return {
        mount: async () => {
            focusHandlerRef = async () => {
                if (!shortcutsRegistered) {
                    await registerShortcuts();
                }
            };

            blurHandlerRef = async () => {
                if (shortcutsRegistered) {
                    await unregisterShortcuts();
                }
            };

            window.addEventListener("focus", focusHandlerRef);
            window.addEventListener("blur", blurHandlerRef);

            if (document.hasFocus()) {
                await registerShortcuts();
            }
        },
        unmount: () => {
            try {
                if (focusHandlerRef) window.removeEventListener("focus", focusHandlerRef);
                if (blurHandlerRef) window.removeEventListener("blur", blurHandlerRef);
            } catch (err) {
                console.warn("Failed to remove focus/blur handlers:", err);
            }

            // best-effort unregister on destroy
            unregisterShortcuts();
        },
    };
};
