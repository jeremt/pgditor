import {get_pg_context} from "$lib/table/pg_context.svelte";
import {globalShortcuts} from "$lib/tauri/global_shortcuts";
import type {ShortcutEvent} from "@tauri-apps/plugin-global-shortcut";
import {getContext, setContext} from "svelte";
import {platform} from "@tauri-apps/plugin-os";
import {get_settings_context} from "$lib/settings/settings_context.svelte";

export type Command = {
    keys: string;
    pretty_keys: string;
    title: string;
    description: string;
    action: (event: ShortcutEvent) => void;
};

class CommandsContext {
    is_command_palette_open = $state(false);

    mode = $state<"tables" | "script" | "graph">("tables");
    is_connections_open = $state(false);
    is_tables_open = $state(false);

    #pg = get_pg_context();
    #settings = get_settings_context();

    #all = $state<Command[]>([]);
    get all() {
        return this.#all.slice(1);
    }

    #shortcuts: ReturnType<typeof globalShortcuts> | undefined = undefined;

    get cmd_or_ctrl() {
        return platform() === "macos" ? "⌘" : "Ctrl";
    }

    constructor() {
        this.#all = [
            {
                keys: "CommandOrControl+P",
                pretty_keys: `${this.cmd_or_ctrl} P`,
                title: "Open command palette",
                description: "Allows you to search through all available commands and execute them",
                action: (event: ShortcutEvent) => {
                    if (event.state === "Pressed") {
                        this.is_command_palette_open = true;
                    }
                },
            },
            {
                keys: "CommandOrControl+0",
                pretty_keys: `${this.cmd_or_ctrl} 0`,
                title: "Switch database connection",
                description: "Open the popover to change the currently selected database connection",
                action: (event: ShortcutEvent) => {
                    if (event.state === "Pressed") {
                        this.is_connections_open = true;
                    }
                },
            },
            {
                keys: "CommandOrControl+1",
                pretty_keys: `${this.cmd_or_ctrl} 1`,
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
                pretty_keys: `${this.cmd_or_ctrl} 2`,
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
                pretty_keys: `${this.cmd_or_ctrl} T`,
                title: "Select tables and views",
                description: "Open the dialog to search a table or view within any schema",
                action: (event) => {
                    if (event.state === "Pressed") {
                        this.is_tables_open = true;
                    }
                },
            },
            // {
            //     keys: "CommandOrControl+F",
            //     prettyKeys: `${this.cmdOrCtrl} F`,
            //     title: "Apply filters",
            //     description: "Open the popover to apply some quick filter to the currently selected table",
            //     action: (event) => {
            //         if (event.state === "Pressed") {
            //             this.#pg.isFilterPopover = true;
            //         }
            //     },
            // },
            {
                keys: "CommandOrControl+R",
                pretty_keys: `${this.cmd_or_ctrl} R`,
                title: "Refresh data",
                description: "Refresh the data of the currently selected table",

                action: (event) => {
                    if (event.state === "Pressed") {
                        this.#pg.load_tables();
                    }
                },
            },
            {
                keys: "CommandOrControl+ArrowLeft",
                pretty_keys: `${this.cmd_or_ctrl} ←`,
                title: "Previous data page",
                description: "Load the previous page of data with the current LIMIT value with an OFFSET of LIMIT",

                action: (event) => {
                    if (event.state === "Pressed" && this.#pg.offset > 0) {
                        this.#pg.offset = Math.max(0, this.#pg.offset - this.#pg.limit);
                        this.#pg.refresh_data();
                    }
                },
            },
            {
                keys: "CommandOrControl+ArrowRight",
                pretty_keys: `${this.cmd_or_ctrl} →`,
                title: "Next data page",
                description: "Load the next page of data with the current LIMIT value with an OFFSET of LIMIT",

                action: (event) => {
                    if (
                        event.state === "Pressed" &&
                        this.#pg.current_table &&
                        this.#pg.offset + this.#pg.limit < this.#pg.current_table.count
                    ) {
                        this.#pg.offset = Math.min(this.#pg.current_table.count, this.#pg.offset + this.#pg.limit);
                        this.#pg.refresh_data();
                    }
                },
            },
            {
                keys: "",
                pretty_keys: ``,
                title: "Toggle between Light/Dark ColorScheme",
                description: "Override the default system color scheme.",

                action: (event) => {
                    if (event.state === "Pressed") {
                        this.#settings.toggleColorScheme();
                    }
                },
            },
        ];
        this.#shortcuts = globalShortcuts(this.#all.filter((cmd) => cmd.keys !== "" && cmd.pretty_keys !== ""));
    }

    execute = (title: string) => {
        const command = this.#all.find((cmd) => cmd.title === title);
        if (!command) {
            console.warn(`Command ${title} not found`);
            return;
        }
        command.action({state: "Pressed"} as ShortcutEvent);
    };

    mount_shortcuts = async () => {
        await this.#shortcuts?.mount();
    };

    unmount_shortcuts = () => {
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
export const get_commands_context = () => getContext<CommandsContext>(key);

/**
 * Manage all commands.
 *
 * This must be called in order to use `getCommandsContext()`.
 * @returns the context
 */
export const set_commands_context = () => setContext(key, new CommandsContext());
