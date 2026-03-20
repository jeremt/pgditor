import {getContext, setContext} from "svelte";
import {StoreContext} from "$lib/helpers/StoreContext";
import {listen, type UnlistenFn} from "@tauri-apps/api/event";
import {invoke} from "@tauri-apps/api/core";
import {catch_error} from "@les3dev/catch_error";
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

export const MODELS = ["gpt-5.4", "gpt-5-mini", "gpt-5-nano"] as const;
type Model = (typeof MODELS)[number];
type Reasoning = "low" | "medium" | "high";

type Chat = {id: string; title: string; updated_at: string; history: HistoryItem[]};

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

    #chats = $state<Chat[]>([]);
    #current_chat_index = $state(0);
    chat_filter = $state("");

    get chats() {
        return this.#chats
            .filter(
                (chat) => this.chat_filter === "" || chat.title.toLowerCase().includes(this.chat_filter.toLowerCase()),
            )
            .toSorted((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
    get current_chat() {
        return this.#chats[this.#current_chat_index];
    }

    #last_response_id = $state<string | null>(null);

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
        this.#chats = (await this.get_from_store<Chat[]>(`chats`)) ?? [this.#create_chat()];
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

    #create_chat = () => ({
        id: crypto.randomUUID(),
        title: "New chat",
        updated_at: new Date().toISOString(),
        history: [],
    });

    add_chat = () => {
        const new_chat = this.#create_chat();
        this.#chats.unshift(new_chat);
        this.select_chat(new_chat.id);
    };

    select_chat = (id: string) => {
        const index = this.#chats.findIndex((chat) => chat.id === id);
        if (index !== -1) {
            this.#current_chat_index = index;
        }
        this.#last_response_id = null;
    };

    remove_current_chat = () => {
        this.#chats.splice(this.#current_chat_index, 1);
        if (this.#chats.length === 0) {
            this.#chats.unshift(this.#create_chat());
            this.error = null;
            this.#last_response_id = null;
            // TODO: save to store
        }
    };

    generate = async () => {
        this.error = null;
        this.is_generating = true;

        const prompt = this.query_prompt;
        this.query_prompt = "";
        this.current_chat.history.push({type: "user", text: prompt});

        const connectionString = this.#connections.current?.connectionString;
        if (connectionString === undefined) {
            this.is_generating = false;
            return;
        }

        this.#unlisten?.();
        this.#unlisten = await listen<GenerateQueryEvent>("generate-query", ({payload}) => {
            switch (payload.type) {
                case "tool_call":
                    this.current_chat.history.push(payload);
                    break;
                case "tool_result": {
                    const last_item = this.current_chat.history[this.current_chat.history.length - 1];
                    if (last_item?.type === "tool_call") {
                        last_item.result = payload.result;
                    }
                    break;
                }
                case "delta": {
                    const last_item = this.current_chat.history[this.current_chat.history.length - 1];
                    if (last_item?.type === "message") {
                        last_item.text += payload.text;
                        last_item.is_query = last_item.text.startsWith("SQL_QUERY");
                    } else {
                        this.current_chat.history.push({
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
        if (this.current_chat.title === "New chat") {
            const result = await catch_error(() =>
                invoke<string>("generate_chat_title", {
                    apiKey: this.#api_key,
                    history: this.current_chat.history.flatMap((item): {role: string; content: string}[] => {
                        if (item.type === "user") return [{role: "user", content: item.text}];
                        if (item.type === "message") return [{role: "assistant", content: item.text}];
                        return [];
                    }),
                }),
            );
            if (!(result instanceof Error)) this.current_chat.title = result;
        }
        await this.set_to_store(
            `chats`,
            this.#chats.filter((chat) => chat.history.length > 0),
        );
        await this.save_store();
    };
}

const key = Symbol();
export const get_query_generator_context = () => getContext<QueryGeneratorContext>(key);
export const set_query_generator_context = () => setContext(key, new QueryGeneratorContext(store_path));
