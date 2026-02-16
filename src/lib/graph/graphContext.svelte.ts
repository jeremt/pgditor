import {get_pg_context, type PgTableForGraph} from "$lib/table/pgContext.svelte";
import {type Node, type Edge, useNodesInitialized} from "@xyflow/svelte";
import {getContext, setContext} from "svelte";
import {build_edges, build_layout, build_nodes} from "./graph";

class GraphContext {
    nodes = $state.raw<Node[]>([]);
    edges = $state.raw<Edge[]>([]);
    error_message = $state("");

    fit_view = () => {};

    #pg = get_pg_context();
    #tables = $state<PgTableForGraph[]>([]);

    #initialized = false;
    constructor() {
        $effect(() => {
            // initialized check MUST BE after because its not reactive
            if (this.nodes.every((node) => node.measured) && !this.#initialized) {
                this.apply_layout();
                this.#initialized = true;
            }
        });
    }

    load_db = async () => {
        const res = await this.#pg.list_tables_for_graph();
        if (res instanceof Error) {
            this.error_message = res.message;
        } else {
            this.#tables = res;
            this.#initialized = false;
            this.nodes = build_nodes(this.#tables);
            this.edges = build_edges(this.#tables);
        }
    };

    apply_layout = () => {
        const new_nodes = build_layout(this.nodes, this.edges);
        if (new_nodes instanceof Error) {
            return;
        }
        this.nodes = new_nodes;
        this.fit_view();
    };
}

const key = Symbol("graphContext");
export const get_graph_context = () => getContext<GraphContext>(key);
export const set_graph_context = () => setContext(key, new GraphContext());
