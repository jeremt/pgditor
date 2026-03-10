import {createHighlighter} from "shiki";

let highlighter: Awaited<ReturnType<typeof createHighlighter>> | null = null;

export async function getHighlighter() {
    if (!highlighter) {
        highlighter = await createHighlighter({
            themes: ["dark-plus", "light-plus"],
            langs: ["sql", "json"],
        });
    }
    return highlighter;
}

export async function highlight(code: string, lang: "sql" | "json", color_scheme: "light" | "dark"): Promise<string> {
    const hl = await getHighlighter();
    return hl.codeToHtml(code, {lang, theme: color_scheme === "dark" ? "dark-plus" : "light-plus"});
}
