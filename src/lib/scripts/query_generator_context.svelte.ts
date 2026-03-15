import {getContext, setContext} from "svelte";
import {StoreContext} from "$lib/helpers/StoreContext";
import {listen, type UnlistenFn} from "@tauri-apps/api/event";
import {invoke} from "@tauri-apps/api/core";
import {catch_error} from "$lib/helpers/catch_error";
import {get_connections_context} from "$lib/connection/connections_context.svelte";

const store_path = "ai.json";

type GenerateQueryEvent =
    | {type: "tool_call"; name: string; args: Record<string, string>}
    | {type: "tool_result"; name: string; result: string}
    | {type: "delta"; text: string}
    | {type: "done"}
    | {type: "error"; message: string};

type HistoryItem =
    | {type: "user"; text: string}
    | {type: "tool_call"; name: string; args: Record<string, string>; result?: string}
    | {type: "message"; is_query: boolean; text: string};

export const MODELS = ["gpt-5 ", "gpt-5-mini", "gpt-5-nano", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"] as const;
type Model = (typeof MODELS)[number];
type Reasoning = "low" | "medium" | "high";
class QueryGeneratorContext extends StoreContext {
    #api_key = $state<string>();
    get api_key() {
        return this.#api_key;
    }
    model = $state<Model>("gpt-5-mini");
    reasoning = $state<Reasoning>();

    is_open = $state(false);

    query_prompt = $state("");
    is_generating = $state(false);

    #last_response_id = $state<string | null>(null);
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
        this.reasoning = (await this.get_from_store<Reasoning>(`reasoning`)) ?? "low";
        this.#api_key = await this.get_from_store<string>(`openai_api_key`);
    };

    save_model = async () => {
        await this.set_to_store(`model`, this.model);
        await this.set_to_store(`reasoning`, this.reasoning);
        await this.save_store();
    };

    save_api_key = async (api_key: string) => {
        this.#api_key = api_key;
        await this.set_to_store(`openai_api_key`, this.#api_key);
        await this.save_store();
    };

    reset_api_key = async () => {
        this.#api_key = undefined;
        await this.set_to_store(`openai_api_key`, this.#api_key);
        await this.save_store();
    };

    clear_history = () => {
        this.history = [];
        this.error = null;
        this.#last_response_id = null;
    };

    generate = async () => {
        this.error = null;
        this.is_generating = true;

        const prompt = this.query_prompt;
        this.query_prompt = "";
        this.history.push({type: "user", text: prompt});

        const connectionString = this.#connections.current?.connectionString;
        if (connectionString === undefined) {
            this.is_generating = false;
            return;
        }

        this.#unlisten?.();
        this.#unlisten = await listen<GenerateQueryEvent>("generate-query", ({payload}) => {
            switch (payload.type) {
                case "tool_call":
                    this.history.push(payload);
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
                    this.#unlisten?.();
                    break;
            }
        });

        const result = await catch_error(() =>
            invoke<string | null>("generate_query", {
                apiKey: this.#api_key,
                connectionString,
                model: this.model,
                reasoning: this.reasoning,
                prompt,
                previousResponseId: this.#last_response_id,
            }),
        );
        if (result instanceof Error) {
            this.error = result.message;
            this.is_generating = false;
            this.#unlisten?.();
        } else {
            this.#last_response_id = result ?? null;
        }
    };
}

const key = Symbol("queryGeneratorContext");
export const get_query_generator_context = () => getContext<QueryGeneratorContext>(key);
export const set_query_generator_context = () => setContext(key, new QueryGeneratorContext(store_path));
