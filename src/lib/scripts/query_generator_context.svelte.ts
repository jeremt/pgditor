import {getContext, setContext} from "svelte";
import {StoreContext} from "$lib/helpers/StoreContext";
import {listen, type UnlistenFn} from "@tauri-apps/api/event";
import {invoke} from "@tauri-apps/api/core";
import {catch_error} from "$lib/helpers/catch_error";

const store_path = "ai.json";

type AiEvent =
    | {type: "tool_call"; name: string}
    | {type: "tool_result"; name: string; result: string}
    | {type: "delta"; text: string}
    | {type: "done"}
    | {type: "error"; message: string};

type ToolEntry = {kind: "call"; name: string} | {kind: "result"; name: string; result: string};

const models = ["gpt-5", "gpt-5-mini"] as const;
type Model = (typeof models)[number];

class QueryGeneratorContext extends StoreContext {
    api_key = $state<string>();
    model = $state<Model>("gpt-5-mini");

    is_open = $state(false);

    query_prompt = $state("");
    is_generating = $state(false);
    tool_log = $state<ToolEntry[]>([]);
    response = $state("");
    error = $state<string | null>(null);

    unlisten: UnlistenFn | null = null;

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
        this.tool_log = [];
        this.response = "";
        this.error = null;
        this.is_generating = true;

        this.unlisten?.();
        this.unlisten = await listen<AiEvent>("ai-event", ({payload}) => {
            switch (payload.type) {
                case "tool_call":
                    this.tool_log = [...this.tool_log, {kind: "call", name: payload.name}];
                    break;
                case "tool_result":
                    this.tool_log = [...this.tool_log, {kind: "result", name: payload.name, result: payload.result}];
                    break;
                case "delta":
                    this.response += payload.text;
                    break;
                case "done":
                    this.is_generating = false;
                    this.unlisten?.();
                    break;
                case "error":
                    this.error = payload.message;
                    this.is_generating = false;
                    this.query_prompt = "";
                    this.unlisten?.();
                    break;
            }
        });
        const error = await catch_error(() =>
            invoke("generate_query", {apiKey: this.api_key, model: "gpt-5-mini", prompt: this.query_prompt}),
        );
        if (error instanceof Error) {
            this.error = error.message;
            this.is_generating = false;
            this.unlisten?.();
        }
    };
}

const key = Symbol("queryGeneratorContext");
export const get_query_generator_context = () => getContext<QueryGeneratorContext>(key);
export const set_query_generator_context = () => setContext(key, new QueryGeneratorContext(store_path));
