import {catch_error} from "@les3dev/catch_error";
import {get_pg_context, type PgTableForGraph} from "$lib/table/pg_context.svelte";
import {type Node, type Edge, useNodesInitialized} from "@xyflow/svelte";
import {getContext, setContext} from "svelte";
import {build_edges, build_layout, build_nodes} from "./graph";
import {build_d2} from "./d2";
import {render_graph_png} from "./export_image";
import {get_toast_context} from "$lib/widgets/Toaster.svelte";
import {save_to_file} from "$lib/helpers/save_to_file";

class GraphContext {
    nodes = $state.raw<Node[]>([]);
    edges = $state.raw<Edge[]>([]);
    error_message = $state("");
    current_schema = $state("");
    container = $state.raw<HTMLElement>();
    exporting = $state(false);

    fit_view = () => {};

    #pg = get_pg_context();
    #toast = get_toast_context();
    #tables = $state<PgTableForGraph[]>([]);
    #schemas = $state<string[]>([]);

    get schemas() {
        return this.#schemas;
    }

    #initialized = false;
    constructor() {
        $effect(() => {
            if (this.nodes.every((node) => node.measured) && !this.#initialized) {
                this.apply_layout();
                this.#initialized = true;
            }
        });
    }

    load_db = async () => {
        const schemas_res = await this.#pg.list_schemas();
        if (schemas_res instanceof Error) {
            this.error_message = schemas_res.message;
            return;
        }

        this.#schemas = schemas_res;
        this.current_schema = this.#schemas.includes("public") ? "public" : this.#schemas[0] ?? "";

        await this.filter_by_schema();
        this.#toast.toast(`Tables loaded successfully`, {kind: "success"});
    };

    filter_by_schema = async () => {
        const res = await this.#pg.list_tables_for_graph(this.current_schema);
        if (res instanceof Error) {
            this.error_message = res.message;
            return;
        }

        this.#tables = res;
        this.#initialized = false;
        this.nodes = build_nodes(this.#tables);
        this.edges = build_edges(this.#tables);
    };

    navigate_to_schema = async (schema: string) => {
        if (!this.#schemas.includes(schema)) {
            this.#toast.toast(`Schema "${schema}" not found`, {kind: "error"});
            return;
        }
        this.current_schema = schema;
        await this.filter_by_schema();
    };

    apply_layout = () => {
        const new_nodes = build_layout(this.nodes, this.edges);
        if (new_nodes instanceof Error) {
            return;
        }
        this.nodes = new_nodes;
        this.fit_view();
    };

    export_png = async () => {
        const viewport = this.container?.querySelector<HTMLElement>(".svelte-flow__viewport");
        if (!viewport || this.nodes.length === 0 || this.exporting) {
            return;
        }
        this.exporting = true;
        const background_color = getComputedStyle(document.body).backgroundColor;
        const png = await catch_error(() => render_graph_png(viewport, this.nodes, background_color));
        this.exporting = false;
        if (png instanceof Error) {
            this.#toast.toast(`Failed to render the graph: ${png.message}`, {kind: "error"});
            return;
        }
        const saved = await catch_error(() => save_to_file(png, ["png"], `${this.current_schema}.png`));
        if (saved instanceof Error) {
            this.#toast.toast(`Failed to save the image: ${saved.message}`, {kind: "error"});
        } else if (saved) {
            this.#toast.toast(`Graph exported to PNG`, {kind: "success"});
        }
    };

    export_d2 = async () => {
        if (this.#tables.length === 0) {
            return;
        }
        const d2 = build_d2(this.#tables, this.current_schema);
        const saved = await catch_error(() => save_to_file(d2, ["d2"], `${this.current_schema}.d2`));
        if (saved instanceof Error) {
            this.#toast.toast(`Failed to save the diagram: ${saved.message}`, {kind: "error"});
        } else if (saved) {
            this.#toast.toast(`Graph exported to D2`, {kind: "success"});
        }
    };
}

const key = Symbol();
export const get_graph_context = () => getContext<GraphContext>(key);
export const set_graph_context = () => setContext(key, new GraphContext());
