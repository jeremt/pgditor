import {get_pg_context} from "$lib/table/pg_context.svelte";
import {getContext, setContext} from "svelte";
import {platform} from "@tauri-apps/plugin-os";
import {get_settings_context} from "$lib/settings/settings_context.svelte";

export type Command = {
    shortcut: string;
    title: string;
    description: string;
    action: () => void;
};

class CommandsContext {
    is_command_palette_open = $state(false);

    mode = $state<"tables" | "script" | "graph">("tables");
    is_connections_open = $state(false);
    is_tables_open = $state(false);
    is_files_open = $state(false);

    #pg = get_pg_context();
    #settings = get_settings_context();

    #all = $state<Command[]>([]);
    get all() {
        return this.#all.slice(1);
    }

    get cmd_or_ctrl() {
        return platform() === "macos" ? "⌘" : "^";
    }

    match_shortcut = (shortcut: string, event: KeyboardEvent) => {
        if (shortcut === "") {
            return false;
        }
        if (shortcut[0] === this.cmd_or_ctrl && !event.ctrlKey && !event.metaKey) {
            return false;
        }
        if (shortcut[1] === "⇧" && !event.shiftKey) {
            return false;
        }
        const key = shortcut
            .slice(shortcut.indexOf(" ") + 1)
            .replace("←", "ArrowLeft")
            .replace("→", "ArrowRight")
            .replace("↑", "ArrowUp")
            .replace("↓", "ArrowDown");
        return key.toLowerCase() === event.key.toLowerCase();
    };

    constructor() {
        this.#all = [
            {
                shortcut: `${this.cmd_or_ctrl} P`,
                title: "Open command palette",
                description: "Allows you to search through all available commands and execute them",
                action: () => {
                    this.is_command_palette_open = true;
                },
            },
            {
                shortcut: `${this.cmd_or_ctrl} 0`,
                title: "Switch database connection",
                description: "Open the popover to change the currently selected database connection",
                action: () => {
                    this.is_connections_open = true;
                },
            },
            {
                shortcut: `${this.cmd_or_ctrl} 1`,
                title: "Open tables mode",
                description: "Visualize and edit tables of the currently selected database",
                action: () => {
                    this.mode = "tables";
                },
            },
            {
                shortcut: `${this.cmd_or_ctrl} 2`,
                title: "Open script mode",
                description: "Perform raw queries on the currently selected database connection",
                action: () => {
                    this.mode = "script";
                },
            },
            {
                shortcut: `${this.cmd_or_ctrl} T`,
                title: "Select tables and views",
                description: "Open the dialog to search a table or view within any schema",
                action: () => {
                    this.is_tables_open = true;
                },
            },
            {
                shortcut: `${this.cmd_or_ctrl}⇧ F`,
                title: "Select file",
                description: "Filter and select sql files synced with the current database",
                action: () => {
                    this.is_files_open = true;
                },
            },
            {
                shortcut: `${this.cmd_or_ctrl} R`,
                title: "Refresh data",
                description: "Refresh the data of the currently selected table",

                action: () => {
                    this.#pg.load_tables();
                },
            },
            {
                shortcut: `${this.cmd_or_ctrl} ←`,
                title: "Previous data page",
                description: "Load the previous page of data with the current LIMIT value with an OFFSET of LIMIT",

                action: () => {
                    if (this.#pg.offset > 0) {
                        this.#pg.offset = Math.max(0, this.#pg.offset - this.#pg.limit);
                        this.#pg.refresh_data();
                    }
                },
            },
            {
                shortcut: `${this.cmd_or_ctrl} →`,
                title: "Next data page",
                description: "Load the next page of data with the current LIMIT value with an OFFSET of LIMIT",

                action: () => {
                    if (this.#pg.current_table && this.#pg.offset + this.#pg.limit < this.#pg.current_table.count) {
                        this.#pg.offset = Math.min(this.#pg.current_table.count, this.#pg.offset + this.#pg.limit);
                        this.#pg.refresh_data();
                    }
                },
            },
            {
                shortcut: ``,
                title: "Toggle between Light/Dark ColorScheme",
                description: "Override the default system color scheme.",

                action: () => {
                    this.#settings.toggleColorScheme();
                },
            },
        ];
        document.addEventListener("keydown", (event) => {
            for (const command of this.#all) {
                if (this.match_shortcut(command.shortcut, event)) {
                    event.preventDefault();
                    command.action();
                }
            }
        });
    }

    execute = (title: string) => {
        const command = this.#all.find((cmd) => cmd.title === title);
        if (!command) {
            console.warn(`Command ${title} not found`);
            return;
        }
        command.action();
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
