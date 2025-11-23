<script lang="ts">
    import type monaco from "monaco-editor";
    import {resize} from "$lib/helpers/resize";
    import {shikiToMonaco} from "@shikijs/monaco";
    import {onMount, onDestroy} from "svelte";
    import {createHighlighter} from "shiki";
    import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
    import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
    import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
    import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
    import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

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
        selectedFile: string;

        /**
         * The current code value. You can specify it if you want to editor to be controlled from outsite.
         * Let it be undefined otherwise.
         */
        value?: string | undefined;

        /**
         * The code font size in pixels.
         */
        fontSize?: number;

        /**
         * The name of the color highlighting theme to use.
         */
        theme?: "light" | "dark";

        /**
         * The debounce delay for each change (in ms).
         */
        debounce?: number;

        /**
         * Whether emmet should be enabled.
         */
        emmet?: boolean;

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

    let {
        files = [],
        selectedFile,
        value = $bindable(),
        fontSize,
        theme = "dark",
        debounce = 0,
        emmet = false,
        onchange,
        onrun,
        onsave,
        onready,
    }: Props = $props();

    let divEl = $state<HTMLElement>();
    let editor = $state<monaco.editor.IStandaloneCodeEditor>();
    let Monaco = $state<typeof monaco>();

    let debounceTimer: number;

    // @ts-ignore async works but not in typescript 🤔
    onMount(async () => {
        self.MonacoEnvironment = {
            getWorker: function (_moduleId: any, label: string) {
                if (label === "json") {
                    return new jsonWorker();
                }
                if (label === "css" || label === "scss" || label === "less") {
                    return new cssWorker();
                }
                if (label === "html" || label === "handlebars" || label === "razor") {
                    return new htmlWorker();
                }
                if (label === "typescript" || label === "javascript") {
                    return new tsWorker();
                }
                return new editorWorker();
            },
        };

        Monaco = await import("monaco-editor");

        if (emmet) {
            const {emmetHTML, emmetCSS} = await import("emmet-monaco-es");
            emmetHTML(Monaco);
            emmetCSS(Monaco);
        }

        const highlighter = await createHighlighter({
            themes: ["dark-plus", "light-plus"],
            langs: ["sql", "javascript", "typescript", "markdown", "json", "css", "html"],
        });

        shikiToMonaco(highlighter, Monaco);

        Monaco.editor.setTheme(`${theme}-plus`);

        // generate mocano model for each file and create editor from selectedFile
        for (const file of files) {
            const [_, ext] = file.path.split(".");
            const mapExtension: Record<string, string> = {
                js: "typescript",
                md: "markdown",
            };
            const language = mapExtension[ext] ?? ext;
            const model = Monaco.editor.createModel(file.value, language, new Monaco.Uri().with({path: file.path}));
            if (file.path === selectedFile && divEl !== undefined) {
                editor = Monaco.editor.create(divEl, {
                    model,
                    language,
                    fontSize,
                    minimap: {enabled: false},
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
                editor?.getAction("editor.action.formatDocument")?.run();
                onsave?.();
            }
        });

        // call on:change and apply debounce if specified
        editor.onDidChangeModelContent(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (editor) {
                    onchange?.(editor.getValue(), selectedFile);
                }
            }, debounce);
        });

        if (editor) {
            onready?.();
        }
        return () => {
            editor?.dispose();
        };
    });

    onDestroy(() => {
        Monaco?.editor.getModels().forEach((model) => {
            model.dispose();
        });
    });

    $effect(() => {
        Monaco?.editor.setTheme(`${theme}-plus`);
    });

    // load model when selected file changes
    $effect(() => {
        if (editor) {
            const model = Monaco?.editor.getModels().find((m) => m.uri.path === `/${selectedFile}`);
            if (model === undefined) {
                throw new Error(`file ${selectedFile} not found`);
            }
            editor.setModel(model);

            // update editor if value is changed from outside
            if (model !== undefined && value !== undefined && value !== model.getValue()) {
                model.pushEditOperations(
                    [],
                    [
                        {
                            range: model.getFullModelRange(),
                            text: value,
                        },
                    ],
                    () => []
                );
            }
        }
    });
</script>

<div bind:this={divEl} class="editor" {@attach resize((width, height) => editor?.layout({width, height}))}></div>

<style>
    .editor {
        height: 100%;
        background-color: var(--color-bg-1); /* FIXME: not generic, should be a prop */
    }
</style>
