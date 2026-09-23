import {getContext, setContext} from "svelte";
import {StoreContext} from "$lib/helpers/StoreContext";
import {listen, type UnlistenFn} from "@tauri-apps/api/event";
import {invoke} from "@tauri-apps/api/core";
import {catch_error} from "@les3dev/catch_error";
import {get_connections_context} from "$lib/connection/connections_context.svelte";

const store_path = "ai.json";

type GenerateQueryEvent =
    | {type: "tool_call"; call_id: string; name: string; args: Record<string, string>}
    | {type: "tool_result"; name: string; result: string}
    | {type: "delta"; text: string}
    | {type: "model"; model: string}
    | {type: "done"}
    | {type: "error"; message: string};

type HistoryItem =
    | {type: "user"; text: string}
    | {type: "tool_call"; call_id: string; name: string; args: Record<string, string>; result?: string}
    | {type: "message"; is_query: boolean; text: string; resolved_model?: string};

const DEFAULT_MODEL = "openrouter/free";

export type OpenRouterModel = {id: string; name: string; context_length: number | null};

/**
 * Converts pgditor's internal chat history into OpenAI Chat Completions
 * messages, so it can be resent to OpenRouter on every call — Chat
 * Completions has no server-side conversation state.
 */
const to_chat_messages = (history: HistoryItem[]): Record<string, unknown>[] =>
    history.flatMap((item): Record<string, unknown>[] => {
        if (item.type === "user") return [{role: "user", content: item.text}];
        if (item.type === "message") return [{role: "assistant", content: item.text}];
        return [
            {
                role: "assistant",
                content: null,
                tool_calls: [
                    {
                        id: item.call_id,
                        type: "function",
                        function: {name: item.name, arguments: JSON.stringify(item.args)},
                    },
                ],
            },
            {role: "tool", tool_call_id: item.call_id, content: item.result ?? ""},
        ];
    });

type Chat = {id: string; title: string; updated_at: string; history: HistoryItem[]};

class QueryGeneratorContext extends StoreContext {
    #api_key = $state<string>();
    get api_key() {
        return this.#api_key;
    }

    model = $state<string>(DEFAULT_MODEL);

    openrouter_models = $state<OpenRouterModel[]>([]);
    is_loading_openrouter_models = $state(false);

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

    error = $state<string | null>(null);

    #connections = get_connections_context();

    #unlisten: UnlistenFn | null = null;
    #pending_resolved_model: string | undefined;

    constructor(store_path: string) {
        super(store_path);
        this.load_store();
    }

    load_store = async () => {
        this.model = (await this.get_from_store<string>(`model`)) ?? DEFAULT_MODEL;
        this.#api_key = await this.get_from_store<string>(`openrouter_api_key`);
        this.#chats = (await this.get_from_store<Chat[]>(`chats`)) ?? [this.#create_chat()];
        this.fetch_openrouter_models();
    };

    fetch_openrouter_models = async () => {
        this.is_loading_openrouter_models = true;
        const result = await catch_error(() => invoke<OpenRouterModel[]>("list_openrouter_models"));
        if (!(result instanceof Error)) this.openrouter_models = result;
        this.is_loading_openrouter_models = false;
    };

    save_model = async () => {
        await this.set_to_store(`model`, this.model);
        await this.save_store();
    };

    save_api_key = async (api_key: string) => {
        this.#api_key = api_key;
        await this.set_to_store(`openrouter_api_key`, this.#api_key);
        await this.save_store();
    };

    reset_api_key = async () => {
        this.#api_key = undefined;
        await this.set_to_store(`openrouter_api_key`, this.#api_key);
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
    };

    remove_current_chat = () => {
        this.#chats.splice(this.#current_chat_index, 1);
        if (this.#chats.length === 0) {
            this.#chats.unshift(this.#create_chat());
            this.error = null;
            // TODO: save to store
        }
    };

    generate = async () => {
        this.error = null;
        this.is_generating = true;

        const prompt = this.query_prompt;
        this.query_prompt = "";
        // captured before pushing the new user turn — the backend appends `prompt` itself
        const history_for_request = to_chat_messages(this.current_chat.history);
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
                case "model":
                    this.#pending_resolved_model = payload.model;
                    break;
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
                            resolved_model: this.#pending_resolved_model,
                        });
                        this.#pending_resolved_model = undefined;
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
            invoke("generate_query", {
                apiKey: this.#api_key,
                connectionString,
                model: this.model,
                prompt,
                history: history_for_request,
            }),
        );
        if (result instanceof Error) {
            this.error = result.message;
            this.is_generating = false;
            this.#unlisten?.();
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
