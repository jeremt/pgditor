import {get_pg_context} from "$lib/table/pg_context.svelte";
import {getContext, setContext} from "svelte";
import {platform} from "@tauri-apps/plugin-os";
import {get_settings_context} from "$lib/settings/settings_context.svelte";
import {get_scripts_context} from "$lib/scripts/scripts_context.svelte";
import {get_graph_context} from "$lib/graph/graph_context.svelte";

type Mode = "tables" | "script" | "graph";

export type Command = {
    mode?: Mode; // if defined, the command will only be enabled in this mode
    title: string;
    shortcut?: string; // if undefined, there is no shortcut for this
    description: string;
    action: () => void;
};

const make_commands = (ctx: CommandsContext) =>
    [
        {
            mode: undefined,
            title: "Open command palette",
            shortcut: `${ctx.cmd_or_ctrl} P`,
            description: "Allows you to search through all available commands and execute them",
            action: () => {
                ctx.is_command_palette_open = true;
            },
        },
        {
            mode: undefined,
            title: "Switch database connection",
            shortcut: `${ctx.cmd_or_ctrl} 0`,
            description: "Open the popover to change the currently selected database connection",
            action: () => {
                ctx.is_connections_open = true;
            },
        },
        {
            mode: undefined,
            title: "Open tables mode",
            shortcut: `${ctx.cmd_or_ctrl} 1`,
            description: "Visualize and edit tables of the currently selected database",
            action: () => {
                ctx.mode = "tables";
            },
        },
        {
            mode: undefined,
            title: "Open script mode",
            shortcut: `${ctx.cmd_or_ctrl} 2`,
            description: "Perform raw queries on the currently selected database connection",
            action: () => {
                ctx.mode = "script";
            },
        },
        {
            mode: undefined,
            title: "Open graph mode",
            shortcut: `${ctx.cmd_or_ctrl} 3`,
            description: "Visualize tables as a graph",
            action: () => {
                ctx.mode = "graph";
            },
        },
        {
            mode: undefined,
            title: "Refresh data",
            shortcut: `${ctx.cmd_or_ctrl} R`,
            description: "Refresh the data of the currently selected table",
            action: () => {
                console.log("IN");
                if (ctx.mode === "graph") {
                    ctx.graph.load_db();
                } else {
                    ctx.pg.load_tables();
                }
            },
        },
        {
            mode: "tables",
            title: "Select tables and views",
            shortcut: `${ctx.cmd_or_ctrl} T`,
            description: "Open the dialog to search a table or view within any schema",
            action: () => {
                ctx.is_tables_open = true;
            },
        },
        {
            mode: "tables",
            title: "Show visual filters",
            shortcut: `${ctx.cmd_or_ctrl} F`,
            description: "Open the popover to apply visual filters to the currently selected table.",
            action: () => {
                ctx.pg.is_filters_open = true;
            },
        },
        {
            mode: "tables",
            title: "Previous data page",
            shortcut: `${ctx.cmd_or_ctrl} ←`,
            description: "Load the previous page of data with the current LIMIT value with an OFFSET of LIMIT",
            action: () => {
                if (ctx.pg.offset > 0) {
                    ctx.pg.offset = Math.max(0, ctx.pg.offset - ctx.pg.limit);
                    ctx.pg.refresh_data();
                }
            },
        },
        {
            mode: "tables",
            title: "Next data page",
            shortcut: `${ctx.cmd_or_ctrl} →`,
            description: "Load the next page of data with the current LIMIT value with an OFFSET of LIMIT",
            action: () => {
                if (ctx.pg.current_table && ctx.pg.offset + ctx.pg.limit < ctx.pg.current_table.count) {
                    ctx.pg.offset = Math.min(ctx.pg.current_table.count, ctx.pg.offset + ctx.pg.limit);
                    ctx.pg.refresh_data();
                }
            },
        },
        {
            mode: "tables",
            title: "Export data",
            shortcut: `${ctx.cmd_or_ctrl} E`,
            description: "Open the popover to export table data or selection.",
            action: () => {
                ctx.is_export_open = true;
            },
        },
        {
            mode: "tables",
            title: "Insert row",
            shortcut: `${ctx.cmd_or_ctrl} I`,
            description: "Insert a new row in the currently selected table",
            action: () => {
                ctx.is_insert_open = true;
            },
        },
        {
            mode: "script",
            title: "Select file",
            shortcut: `${ctx.cmd_or_ctrl}⇧ F`,
            description: "Filter and select sql files synced with the current database",
            action: () => {
                ctx.is_files_open = true;
            },
        },
        {
            mode: "script",
            title: "Save current script",
            shortcut: `${ctx.cmd_or_ctrl} S`,
            description: "Save the current script to the file system",
            action: () => {
                ctx.scripts.save_current_file();
            },
        },
        {
            mode: "graph",
            title: "Re-layout",
            shortcut: `${ctx.cmd_or_ctrl} K`,
            description: `Clean up the nodes layout.`,
            action: () => {
                ctx.graph.apply_layout();
            },
        },
        {
            mode: undefined,
            title: "Toggle between Light/Dark ColorScheme",
            shortcut: undefined,
            description: "Override the default system color scheme.",
            action: () => {
                ctx.settings.toggleColorScheme();
            },
        },
    ] as const satisfies Command[];

export type CommandTitle = ReturnType<typeof make_commands>[number]["title"];

class CommandsContext {
    is_command_palette_open = $state(false);

    mode = $state<Mode>("tables");
    is_connections_open = $state(false);

    // tables mode
    is_tables_open = $state(false);
    is_insert_open = $state(false);
    is_export_open = $state(false);

    // script mode
    is_files_open = $state(false);

    pg = get_pg_context();
    settings = get_settings_context();
    scripts = get_scripts_context();
    graph = get_graph_context();

    get #all() {
        return make_commands(this);
    }

    get list() {
        return this.#all.slice(1).filter((command) => command.mode === undefined || command.mode === this.mode);
    }

    get cmd_or_ctrl() {
        return platform() === "macos" ? "⌘" : "^";
    }

    shortcut = (title: CommandTitle) => {
        const command = this.#all.find((command) => command.title === title);
        return command?.shortcut ?? "";
    };

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
            .replace("↓", "ArrowDown")
            .replace("⌫", "Backspace");
        return key.toLowerCase() === event.key.toLowerCase();
    };

    constructor() {
        document.addEventListener("keydown", (event) => {
            for (const command of this.#all) {
                if (
                    command.shortcut !== undefined &&
                    (command.mode === this.mode || command.mode === undefined) &&
                    this.match_shortcut(command.shortcut, event)
                ) {
                    event.preventDefault();
                    command.action();
                }
            }
        });
    }

    execute = (title: CommandTitle) => {
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
