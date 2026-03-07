import {getContext, setContext} from "svelte";
import {StoreContext} from "$lib/helpers/StoreContext";
import {listen, type UnlistenFn} from "@tauri-apps/api/event";
import {invoke} from "@tauri-apps/api/core";
import {catch_error} from "$lib/helpers/catch_error";
import {get_connections_context} from "$lib/connection/connections_context.svelte";

const store_path = "ai.json";

type GenerateQueryEvent =
    | {type: "tool_call"; name: string; args: Record<string, string>} // Might need to change non-string values at some point
    | {type: "tool_result"; name: string; result: string}
    | {type: "delta"; text: string}
    | {type: "done"}
    | {type: "error"; message: string};

type HistoryItem =
    | {type: "user"; text: string}
    | {type: "tool_call"; name: string; args: Record<string, string>; result?: string} // Might need to change non-string values at some point
    | {type: "message"; is_query: boolean; text: string};

const models = ["gpt-5", "gpt-5-mini"] as const;
type Model = (typeof models)[number];

class QueryGeneratorContext extends StoreContext {
    api_key = $state<string>();
    model = $state<Model>("gpt-5-mini");

    is_open = $state(false);

    query_prompt = $state("");
    is_generating = $state(false);

    history = $state<HistoryItem[]>([]);

    error = $state<string | null>(null);

    #connections = get_connections_context();

    #unlisten: UnlistenFn | null = null;

    constructor(store_path: string) {
        super(store_path);
        this.load_store();
    }

    load_store = async () => {
        this.model = (await this.get_from_store<Model>(`model`)) ?? "gpt-5-mini";
        this.api_key = await this.get_from_store<string>(`openai_api_key`);
    };

    save_model = async () => {
        await this.set_to_store(`model`, this.model);
        await this.save_store();
    };

    save_api_key = async () => {
        await this.set_to_store(`openai_api_key`, this.api_key);
        await this.save_store();
    };

    generate = async () => {
        // Reset state
        this.history = [];
        this.error = null;
        this.is_generating = true;
        this.history.push({type: "user", text: this.query_prompt});

        const connectionString = this.#connections.current?.connectionString;
        if (connectionString === undefined) {
            return;
        }

        this.#unlisten?.();
        this.#unlisten = await listen<GenerateQueryEvent>("generate-query", ({payload}) => {
            switch (payload.type) {
                case "tool_call":
                    this.history.push(payload);
                    // this.tool_log = [...this.tool_log, {kind: "call", name: payload.name}];
                    break;
                case "tool_result": {
                    const last_item = this.history[this.history.length - 1];
                    if (last_item?.type === "tool_call") {
                        last_item.result = payload.result;
                    }
                    break;
                }
                case "delta": {
                    const last_item = this.history[this.history.length - 1];
                    if (last_item?.type === "message") {
                        last_item.text += payload.text;
                        last_item.is_query = last_item.text.startsWith("SQL_QUERY");
                    } else {
                        this.history.push({
                            type: "message",
                            is_query: payload.text.startsWith("SQL_QUERY: "),
                            text: payload.text,
                        });
                    }
                    break;
                }
                case "done":
                    this.is_generating = false;
                    this.#unlisten?.();
                    break;
                case "error":
                    this.error = payload.message;
                    this.is_generating = false;
                    this.query_prompt = "";
                    this.#unlisten?.();
                    break;
            }
        });
        const error = await catch_error(() =>
            invoke("generate_query", {
                apiKey: this.api_key,
                connectionString,
                model: "gpt-5-mini",
                prompt: this.query_prompt,
            }),
        );
        if (error instanceof Error) {
            this.error = error.message;
            this.is_generating = false;
            this.#unlisten?.();
        }
    };
}

const key = Symbol("queryGeneratorContext");
export const get_query_generator_context = () => getContext<QueryGeneratorContext>(key);
export const set_query_generator_context = () => setContext(key, new QueryGeneratorContext(store_path));
