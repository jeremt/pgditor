<script lang="ts" module>
    import type monaco from "monaco-editor";
    import {add_pg_autocomplete} from "./pg_autocomplete";
    import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
    import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
    import SqlWorker from "monaco-sql-languages/esm/languages/pgsql/pgsql.worker?worker";

    let Monaco: typeof monaco;

    const loadMonaco = async () => {
        if (Monaco) {
            return Monaco;
        }
        // now set the MonacoEnvironment worker factory (must reference imported worker constructors)
        self.MonacoEnvironment = {
            getWorker: function (_moduleId: any, label: string) {
                if (label === "json") {
                    return new JsonWorker();
                }
                if (label === "pgsql") {
                    return new SqlWorker();
                }
                return new EditorWorker();
            },
        };

        Monaco = await import("monaco-editor");

        // monaco-sql-languages
        // const {setupLanguageFeatures, LanguageIdEnum} = await import("monaco-sql-languages");
        // const {completionService} = await import("$lib/monaco/sqlAutocomplete");
        // setupLanguageFeatures(LanguageIdEnum.PG, {
        //     completionItems: {
        //         enable: true,
        //         completionService: completionService,
        //     },
        // });

        const {createHighlighter} = await import("shiki");
        const highlighter = await createHighlighter({
            themes: ["dark-plus", "light-plus"],
            langs: ["sql", "javascript", "typescript", "markdown", "json", "css", "html"],
        });
        const {shikiToMonaco} = await import("@shikijs/monaco");
        shikiToMonaco(highlighter, Monaco);
        return Monaco;
    };
</script>

<script lang="ts">
    import {resize} from "$lib/helpers/resize";
    import {onMount} from "svelte";
    import {get_pg_context} from "$lib/table/pg_context.svelte";

    type FileData = {path: string; value: string};

    type Props = {
        /**
         * List of files to load when the editor is mounted. Each file has 2 attributs :
         * - `path`: the name of the file
         * - `value`: the code
         * @example `[{path: 'index.html', code: '<h1>Hello</h1>'}, [{path: 'index.js', code: 'console.log("👋")'}]]`
         */
        files: FileData[];

        /**
         * The currently selected file.
         * @example 'index.html'
         */
        selected_file: string;

        /**
         * The current code value. You can specify it if you want to editor to be controlled from outsite.
         * Let it be undefined otherwise.
         */
        value?: string | undefined;

        /**
         * The currently selected text from the editor.
         */
        selection?: string | undefined;

        /**
         * The code font size in pixels.
         */
        font_family?: string;

        /**
         * The code font size in pixels.
         */
        font_size?: number;

        /**
         * The name of the color highlighting theme to use.
         */
        theme?: "light" | "dark";

        /**
         * Show line numbers in the editor. Set to `false` to hide them.
         */
        show_line_numbers?: boolean;

        word_wrap?: boolean;

        /**
         * Called whenever a change from within the editor is detected.
         * @param value the new value of the text.
         * @param filePath the path of the file that has been updated.
         */
        onchange?: (value: string, filePath: string) => void;

        /**
         * Called when the user used the run shortcut (Cmd+Enter).
         */
        onrun?: () => void;

        /**
         * Called when the user used the save shortcut (Cmd+S).
         */
        onsave?: () => void;

        /**
         * Called when the editor is fulled loaded.
         */
        onready?: () => void;
    };

    const pg = get_pg_context();

    let {
        files = [],
        selected_file,
        value = $bindable(),
        selection = $bindable(""),
        font_size,
        theme = "dark",
        show_line_numbers = true,
        word_wrap = false,
        /** Custom font family for the editor (CSS font-family string). */
        font_family = undefined,
        onchange,
        onrun,
        onsave,
        onready,
    }: Props = $props();

    let divEl = $state<HTMLElement>();
    let editor = $state<monaco.editor.IStandaloneCodeEditor>();
    let Monaco = $state<typeof monaco>();

    // @ts-ignore async works but not in typescript 🤔
    onMount(async () => {
        // load monaco (and shared shiki/emmet if requested) once
        Monaco = await loadMonaco();

        Monaco.editor.setTheme(`${theme}-plus`);

        // generate monaco model for each file and create editor from selectedFile
        for (const file of files) {
            const [_, ext] = file.path.split(".");
            const map_extension: Record<string, string> = {
                js: "typescript",
                md: "markdown",
                sql: "pgsql",
            };
            const language = map_extension[ext] ?? ext;

            const uri = Monaco.Uri.parse(`inmemory://model/${file.path}`);
            let model = Monaco.editor.getModel(uri);

            // Ensure the content we give to Monaco is a string. Monaco assumes
            // model values are strings and will call `split` internally.
            let text: string;
            if (file.value === undefined || file.value === null) {
                text = "";
            } else if (typeof file.value === "string") {
                text = file.value;
            } else if (typeof file.value === "object") {
                try {
                    text = JSON.stringify(file.value, null, 2);
                } catch {
                    text = String(file.value);
                }
            } else {
                text = String(file.value);
            }
            if (!model) {
                model = Monaco.editor.createModel(text, language, uri);
            } else if (model.getValue() !== text) {
                model.setValue(text);
            }

            if (file.path === selected_file && divEl !== undefined) {
                editor = Monaco.editor.create(divEl, {
                    model,
                    fontSize: font_size,
                    minimap: {enabled: false},
                    wordWrap: word_wrap ? "on" : undefined,
                    lineNumbers: show_line_numbers ? "on" : "off",
                    fontFamily: font_family,
                });
            }
        }

        if (editor === undefined) {
            throw new Error("selectedFile should be specify to properly create the editor");
        }

        editor.addAction({
            id: "run",
            keybindings: [Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.Enter],
            label: "Run",
            run: () => {
                onrun?.();
            },
        });

        editor.onKeyDown((event) => {
            if (event.keyCode === 49 /** KeyCode.KeyS */ && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                // editor?.getAction("editor.action.formatDocument")?.run();
                onsave?.();
            }
        });

        // call onchange and apply debounce if specified
        editor.onDidChangeModelContent(() => {
            onchange?.(editor?.getValue() ?? "", selected_file);
        });

        editor.onDidChangeCursorSelection((event) => {
            const model = editor?.getModel();
            if (!model) {
                return;
            }
            selection = model.getValueInRange(event.selection);
        });

        if (editor) {
            onready?.();
        }
        return () => {
            editor?.dispose();
        };
    });

    $effect(() => {
        if (Monaco) {
            add_pg_autocomplete(Monaco, pg.tables);
        }
    });

    // Do not dispose shared models here — models are reused across editor instances.

    $effect(() => {
        Monaco?.editor.setTheme(`${theme}-plus`);
    });

    // reactively update line numbers visibility when prop changes
    $effect(() => {
        if (editor) {
            editor.updateOptions({lineNumbers: show_line_numbers ? "on" : "off"});
        }
    });

    // reactively update font family when prop changes
    $effect(() => {
        if (editor) {
            editor.updateOptions({fontFamily: font_family ?? undefined});
        }
    });

    // load model when selected file changes
    $effect(() => {
        if (editor) {
            const uri = Monaco?.Uri.parse(`inmemory://model/${selected_file}`);
            const model = uri ? Monaco?.editor.getModel(uri) : undefined;
            if (model === undefined) {
                throw new Error(`file ${selected_file} not found`);
            }
            editor.setModel(model as any);

            // update editor if value is changed from outside
            if (model !== undefined && value !== undefined) {
                const newText = typeof value === "string" ? value : JSON.stringify(value, null, 2);
                if (newText !== model?.getValue()) {
                    model?.pushEditOperations(
                        [],
                        [
                            {
                                range: model.getFullModelRange(),
                                text: newText,
                            },
                        ],
                        () => [],
                    );
                }
            }
        }
    });
</script>

<div bind:this={divEl} class="editor" {@attach resize((width, height) => editor?.layout({width, height}))}></div>

<style>
    .editor {
        height: 100%;
    }
</style>
