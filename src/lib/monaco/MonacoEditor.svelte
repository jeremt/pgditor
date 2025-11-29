<!--
@component

MonacoEditor — a small, ergonomic wrapper around Monaco to provide a
VSCode-like editor instance inside your Svelte app.

Features
- Lazily loads `monaco-editor` and language workers.
- Integrates `shiki` -> Monaco themes for consistent syntax highlighting.
- Optional Emmet support via `emmet-monaco-es`.
- Reuses Monaco models across instances (doesn't dispose shared models).

Basic usage

```svelte
<script>
    import MonacoEditor from '$lib/monaco/MonacoEditor.svelte';

    const files = [{ path: 'index.js', value: 'console.log("hello")' }];
    let selected = 'index.js';
    function onChange(value, path) { console.log(path, value); }
    function onReady() { console.log('editor ready'); }
</script>

<MonacoEditor
    {files}
    selectedFile={selected}
    onready={onReady}
    onchange={onChange}
    theme="dark"
    fontSize={14}
/>
```

Props
- `files: {path: string, value: string}[]` — list of files to populate the editor. Each file creates or reuses a Monaco model at `inmemory://model/{path}`.
- `selectedFile: string` — the path of the file currently opened in the editor (required).
- `value?: string` — optional controlled value; when provided the component syncs the model content with this value.
- `fontFamily?: string` — optional CSS font-family for the editor.
- `fontSize?: number` — font size in pixels.
- `theme?: 'light' | 'dark'` — chooses between the bundled `light-plus` and `dark-plus` themes (default: `dark`).
- `showLineNumbers?: boolean` — show/hide line numbers (default: `true`).
- `debounce?: number` — debounce delay (ms) for `onchange` events (default: 0).
- `emmet?: boolean` — enable Emmet for HTML/CSS inside Monaco (loads `emmet-monaco-es`).

Events / Callbacks
- `onchange(value: string, filePath: string)` — called after edits (debounced by `debounce`).
- `onrun()` — called when the user hits the Run shortcut (Cmd/Ctrl+Enter).
- `onsave()` — called when the user triggers Save (Cmd/Ctrl+S). The editor will also attempt to format the document before saving.
- `onready()` — called once the editor instance is fully created and ready.

Advanced notes
- Models are stored at URIs like `inmemory://model/{path}` and are intentionally reused between instances — do not dispose shared models here.
- Monaco creates internal DOM layers that can obscure wrapper backgrounds. If you need to style the editor background, either:
    - define or override a Monaco theme via `Monaco.editor.defineTheme(...)` and apply it with `Monaco.editor.setTheme(...)`, or
    - use high-specificity/global CSS to target Monaco classes (this component already exposes a wrapper `.editor` for that purpose).
- To add custom themes, use the `loadMonacoOnce` hook (inside this file) and call `Monaco.editor.defineTheme('my-theme', {...})` before `Monaco.editor.setTheme(...)`.

Accessibility & resizing
- The component listens to the provided `resize` action to call `editor.layout(...)` when its container changes size — keep the wrapper visible and sized for correct layout.

Examples
- Multiple files / tabs

```svelte
<MonacoEditor files={[{path:'index.html', value:'<h1>Hello</h1>'},{path:'app.js', value:'console.log(1)'}]} selectedFile={'index.html'} />
```
-->
<script lang="ts" module>
    import type monaco from "monaco-editor";
    import {addSqliteAutocomplete} from "./sqlAutocomplete";

    // Module-level singletons so everything is initialized only once
    let _monacoPromise: Promise<typeof monaco> | undefined;
    let _shikiInitialized = false;
    let _emmetEnabled = false;

    async function loadMonacoOnce({emmet = false} = {}): Promise<typeof monaco> {
        if (!_monacoPromise) {
            _monacoPromise = (async () => {
                // set workers once (we'll override with real workers per-instance later)
                self.MonacoEnvironment = {
                    getWorker: function (_moduleId: any, label: string) {
                        // workers are imported lazily by the instance script when running
                        // but MonacoEnvironment must exist early
                        return null as any;
                    },
                } as any;

                const Monaco = await import("monaco-editor");

                // monaco-sql-languages
                // const {setupLanguageFeatures, LanguageIdEnum} = await import("monaco-sql-languages");
                // const {completionService} = await import("$lib/monaco/sqlAutocomplete");
                // setupLanguageFeatures(LanguageIdEnum.PG, {
                //     completionItems: {
                //         enable: true,
                //         completionService: completionService,
                //     },
                // });

                // shiki -> monaco conversion should be done once
                if (!_shikiInitialized) {
                    const {createHighlighter} = await import("shiki");
                    const highlighter = await createHighlighter({
                        themes: ["dark-plus", "light-plus"],
                        langs: ["sql", "javascript", "typescript", "markdown", "json", "css", "html"],
                    });
                    const {shikiToMonaco} = await import("@shikijs/monaco");
                    shikiToMonaco(highlighter, Monaco);
                    _shikiInitialized = true;
                }

                return Monaco;
            })();
        }

        const Monaco = await _monacoPromise;

        // enable emmet globally if requested and not yet enabled
        if (emmet && !_emmetEnabled) {
            const {emmetHTML, emmetCSS} = await import("emmet-monaco-es");
            emmetHTML(Monaco);
            emmetCSS(Monaco);
            _emmetEnabled = true;
        }

        return Monaco;
    }
</script>

<script lang="ts">
    import {resize} from "$lib/helpers/resize";
    import {onMount} from "svelte";
    import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
    import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
    import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
    import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
    import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
    import {getTableContext} from "$lib/table/tableContext.svelte";

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
        fontFamily?: string;

        /**
         * The code font size in pixels.
         */
        fontSize?: number;

        /**
         * The name of the color highlighting theme to use.
         */
        theme?: "light" | "dark";

        /**
         * Show line numbers in the editor. Set to `false` to hide them.
         */
        showLineNumbers?: boolean;

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

    const pgTable = getTableContext();

    let {
        files = [],
        selectedFile,
        value = $bindable(),
        fontSize,
        theme = "dark",
        showLineNumbers = true,
        /** Custom font family for the editor (CSS font-family string). */
        fontFamily = undefined,
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
        // load monaco (and shared shiki/emmet if requested) once
        Monaco = await loadMonacoOnce({emmet});

        // now set the MonacoEnvironment worker factory (must reference imported worker constructors)
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
        } as any;

        Monaco.editor.setTheme(`${theme}-plus`);

        // generate monaco model for each file and create editor from selectedFile
        for (const file of files) {
            const [_, ext] = file.path.split(".");
            const mapExtension: Record<string, string> = {
                js: "typescript",
                md: "markdown",
                sql: "pgsql",
            };
            const language = mapExtension[ext] ?? ext;

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
            console.log("mounting sql", model, text);
            if (!model) {
                console.log("Set language to ", language);
                model = Monaco.editor.createModel(text, language, uri);
            } else if (model.getValue() !== text) {
                model.setValue(text);
            }

            if (file.path === selectedFile && divEl !== undefined) {
                editor = Monaco.editor.create(divEl, {
                    model,
                    fontSize,
                    minimap: {enabled: false},
                    lineNumbers: showLineNumbers ? "on" : "off",
                    fontFamily: fontFamily,
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

    let sqlAutocomplete: ReturnType<typeof addSqliteAutocomplete> | undefined = undefined;
    $effect(() => {
        if (Monaco) {
            if (sqlAutocomplete) {
                sqlAutocomplete.dispose();
            }
            sqlAutocomplete = addSqliteAutocomplete(Monaco, pgTable.list);
        }
    });

    // Do not dispose shared models here — models are reused across editor instances.

    $effect(() => {
        Monaco?.editor.setTheme(`${theme}-plus`);
    });

    // reactively update line numbers visibility when prop changes
    $effect(() => {
        if (editor) {
            editor.updateOptions({lineNumbers: showLineNumbers ? "on" : "off"});
        }
    });

    // reactively update font family when prop changes
    $effect(() => {
        if (editor) {
            editor.updateOptions({fontFamily: fontFamily ?? undefined});
        }
    });

    // load model when selected file changes
    $effect(() => {
        if (editor) {
            const uri = Monaco?.Uri.parse(`inmemory://model/${selectedFile}`);
            const model = uri ? Monaco?.editor.getModel(uri) : undefined;
            if (model === undefined) {
                throw new Error(`file ${selectedFile} not found`);
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
                        () => []
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
