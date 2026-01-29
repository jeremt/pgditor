import {getPgContext} from "$lib/table/pgContext.svelte";
import {globalShortcuts} from "$lib/tauri/globalShortcuts";
import type {ShortcutEvent} from "@tauri-apps/plugin-global-shortcut";
import {getContext, setContext} from "svelte";
import {platform} from "@tauri-apps/plugin-os";

export type Command = {
    keys: string;
    prettyKeys: string;
    title: string;
    description: string;
    action: (event: ShortcutEvent) => void;
};

class CommandsContext {
    #pg = getPgContext();

    #all = $state<Command[]>([]);
    get all() {
        return this.#all.slice(1);
    }

    #shortcuts: ReturnType<typeof globalShortcuts> | undefined = undefined;

    isCommandPaletteOpen = $state(false);

    mode = $state<"tables" | "script">("tables");
    isConnectionsOpen = $state(false);
    isTablesOpen = $state(false);

    get cmdOrCtrl() {
        return platform() === "macos" ? "⌘" : "Ctrl";
    }

    constructor() {
        this.#all = [
            {
                keys: "CommandOrControl+P",
                prettyKeys: `${this.cmdOrCtrl} P`,
                title: "Open command palette",
                description: "Allows you to search through all available commands and execute them",
                action: (event: ShortcutEvent) => {
                    if (event.state === "Pressed") {
                        this.isCommandPaletteOpen = true;
                    }
                },
            },
            {
                keys: "CommandOrControl+0",
                prettyKeys: `${this.cmdOrCtrl} 0`,
                title: "Switch database connection",
                description: "Open the popover to change the currently selected database connection",
                action: (event: ShortcutEvent) => {
                    if (event.state === "Pressed") {
                        this.isConnectionsOpen = true;
                    }
                },
            },
            {
                keys: "CommandOrControl+1",
                prettyKeys: `${this.cmdOrCtrl} 1`,
                title: "Open tables mode",
                description: "Visualize and edit tables of the currently selected database",
                action: (event: ShortcutEvent) => {
                    if (event.state === "Pressed") {
                        this.mode = "tables";
                    }
                },
            },
            {
                keys: "CommandOrControl+2",
                prettyKeys: `${this.cmdOrCtrl} 2`,
                title: "Open script mode",
                description: "Perform raw queries on the currently selected database connection",
                action: (event: ShortcutEvent) => {
                    if (event.state === "Pressed") {
                        this.mode = "script";
                    }
                },
            },
            {
                keys: "CommandOrControl+T",
                prettyKeys: `${this.cmdOrCtrl} T`,
                title: "Select tables and views",
                description: "Open the dialog to search a table or view within any schema",
                action: (event) => {
                    if (event.state === "Pressed") {
                        this.isTablesOpen = true;
                    }
                },
            },
            {
                keys: "CommandOrControl+F",
                prettyKeys: `${this.cmdOrCtrl} F`,
                title: "Apply filters",
                description: "Open the popover to apply some quick filter to the currently selected table",
                action: (event) => {
                    if (event.state === "Pressed") {
                        this.#pg.isFilterPopover = true;
                    }
                },
            },
            {
                keys: "CommandOrControl+R",
                prettyKeys: `${this.cmdOrCtrl} R`,
                title: "Refresh data",
                description: "Refresh the data of the currently selected table",

                action: (event) => {
                    if (event.state === "Pressed") {
                        this.#pg.loadTables();
                    }
                },
            },
            {
                keys: "CommandOrControl+ArrowLeft",
                prettyKeys: `${this.cmdOrCtrl} ←`,
                title: "Previous data page",
                description: "Load the previous page of data with the current LIMIT value with an OFFSET of LIMIT",

                action: (event) => {
                    if (event.state === "Pressed" && this.#pg.offset > 0) {
                        this.#pg.offset = Math.max(0, this.#pg.offset - this.#pg.limit);
                        this.#pg.refreshData();
                    }
                },
            },
            {
                keys: "CommandOrControl+ArrowRight",
                prettyKeys: `${this.cmdOrCtrl} →`,
                title: "Next data page",
                description: "Load the next page of data with the current LIMIT value with an OFFSET of LIMIT",

                action: (event) => {
                    if (
                        event.state === "Pressed" &&
                        this.#pg.currentTable &&
                        this.#pg.offset + this.#pg.limit < this.#pg.currentTable.count
                    ) {
                        this.#pg.offset = Math.min(this.#pg.currentTable.count, this.#pg.offset + this.#pg.limit);
                        this.#pg.refreshData();
                    }
                },
            },
        ];
        this.#shortcuts = globalShortcuts(this.#all);
    }

    execute = (title: string) => {
        const command = this.#all.find((cmd) => cmd.title === title);
        if (!command) {
            console.warn(`Command ${title} not found`);
            return;
        }
        command.action({state: "Pressed"} as ShortcutEvent);
    };

    mountShortcuts = async () => {
        await this.#shortcuts?.mount();
    };

    unmountShortcuts = () => {
        this.#shortcuts?.unmount();
    };
}

const key = Symbol("commandsContext");

/**
 * Manage all commands.
 *
 * You must call `setConnectionsContext()` in a parent component to use it.
 * @returns the context
 */
export const getCommandsContext = () => getContext<CommandsContext>(key);

/**
 * Manage all commands.
 *
 * This must be called in order to use `getCommandsContext()`.
 * @returns the context
 */
export const setCommandsContext = () => setContext(key, new CommandsContext());
