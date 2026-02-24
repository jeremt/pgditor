import {expect, suite, test} from "vitest";

import {fuzzy_search_with_highlights, render_highlighted_match} from "./fuzzy_search"; // adjust path as needed

suite("fuzzySearchWithHighlights", () => {
    test("basic match with ranges", () => {
        const results = fuzzy_search_with_highlights("ap", ["apple"]);
        expect(results.length).toBe(1);
        expect(results[0].item).toBe("apple");
        expect(results[0].ranges).toStrictEqual([[0, 2]]);
    });

    test("no match", () => {
        const results = fuzzy_search_with_highlights("zz", ["apple"]);
        expect(results.length).toBe(0);
    });

    test("case insensitive match", () => {
        const results = fuzzy_search_with_highlights("AP", ["Apple"]);
        expect(results[0].item).toBe("Apple");
        expect(results[0].ranges).toStrictEqual([[0, 2]]);
    });

    test("matches with gaps produce multiple ranges", () => {
        const results = fuzzy_search_with_highlights("ac", ["abc"]);
        expect(results.length).toBe(1);
        expect(results[0].ranges).toStrictEqual([
            [0, 1],
            [2, 3],
        ]);
    });

    test("score prioritizes tighter match", () => {
        const results = fuzzy_search_with_highlights("apc", ["AppController", "AppConfig"]);
        expect(results.length).toBe(2);
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    });

    test("multiple results sorted by score", () => {
        const results = fuzzy_search_with_highlights("rd", ["README.md", "roadmap.doc"]);
        expect(results.length).toBe(2);
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    });

    test("ranges match correct substrings", () => {
        const results = fuzzy_search_with_highlights("rg", ["reorganize"]);
        const [start1, end1] = results[0].ranges[0];
        const [start2, end2] = results[0].ranges[1];
        const str = results[0].item;
        expect(str.slice(start1, end1)).toBe("r");
        expect(str.slice(start2, end2)).toBe("g");
    });

    test("empty pattern returns no results", () => {
        const results = fuzzy_search_with_highlights("", ["something"]);
        expect(results.length).toBe(0);
    });

    test("empty haystack returns no results", () => {
        const results = fuzzy_search_with_highlights("a", []);
        expect(results).toStrictEqual([]);
    });

    test("full string match returns single full range", () => {
        const str = "test";
        const results = fuzzy_search_with_highlights("test", [str]);
        expect(results.length).toBe(1);
        expect(results[0].ranges).toStrictEqual([[0, 4]]);
    });
});

suite("renderHighlightedMatch", () => {
    test("wraps a single range in <b> tags", () => {
        const result = render_highlighted_match("apple", [[0, 3]], {start: "<b>", end: "</b>"});
        expect(result).toBe("<b>app</b>le");
    });

    test("wraps multiple non-contiguous ranges", () => {
        const result = render_highlighted_match(
            "AppController",
            [
                [0, 2],
                [3, 4],
            ],
            {start: "<b>", end: "</b>"},
        );
        expect(result).toBe("<b>Ap</b>p<b>C</b>ontroller");
    });

    test("wraps full string if single full-range", () => {
        const result = render_highlighted_match("test", [[0, 4]], {start: "<b>", end: "</b>"});
        expect(result).toBe("<b>test</b>");
    });

    test("returns original string if no ranges", () => {
        const result = render_highlighted_match("hello", [], {start: "<b>", end: "</b>"});
        expect(result).toBe("hello");
    });

    test("handles empty string input", () => {
        const result = render_highlighted_match("", [], {start: "<b>", end: "</b>"});
        expect(result).toBe("");
    });

    test("custom wrapper works with <mark>", () => {
        const result = render_highlighted_match("highlight", [[0, 4]], {start: "<mark>", end: "</mark>"});
        expect(result).toBe("<mark>high</mark>light");
    });

    test("merges highlight and tail correctly", () => {
        const result = render_highlighted_match("world", [[1, 4]], {start: "<b>", end: "</b>"});
        expect(result).toBe("w<b>orl</b>d");
    });

    test("works with adjacent ranges", () => {
        const result = render_highlighted_match(
            "abcdef",
            [
                [0, 2],
                [2, 4],
            ],
            {start: "<i>", end: "</i>"},
        );
        expect(result).toBe("<i>ab</i><i>cd</i>ef");
    });

    test("defaults to <b> wrapper if none given", () => {
        const result = render_highlighted_match("abc", [[1, 2]]);
        expect(result).toBe("a<b>b</b>c");
    });
    test("shorter exact match is prioritized over longer partial match", () => {
        const results = fuzzy_search_with_highlights("tasks", ["tasks_triggers", "tasks"]);

        expect(results.length).toBe(2);

        // Exact shorter match should win
        expect(results[0].item).toBe("tasks");
        expect(results[1].item).toBe("tasks_triggers");

        expect(results[0].score).toBeGreaterThan(results[1].score);
    });
});
