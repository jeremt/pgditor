import {expect, suite, test} from "vitest";

import {fuzzySearchWithHighlights, renderHighlightedMatch} from "./fuzzySearch"; // adjust path as needed

suite("fuzzySearchWithHighlights", () => {
    test("basic match with ranges", () => {
        const results = fuzzySearchWithHighlights("ap", ["apple"]);
        expect(results.length).toBe(1);
        expect(results[0].item).toBe("apple");
        expect(results[0].ranges).toStrictEqual([[0, 2]]);
    });

    test("no match", () => {
        const results = fuzzySearchWithHighlights("zz", ["apple"]);
        expect(results.length).toBe(0);
    });

    test("case insensitive match", () => {
        const results = fuzzySearchWithHighlights("AP", ["Apple"]);
        expect(results[0].item).toBe("Apple");
        expect(results[0].ranges).toStrictEqual([[0, 2]]);
    });

    test("matches with gaps produce multiple ranges", () => {
        const results = fuzzySearchWithHighlights("ac", ["abc"]);
        expect(results.length).toBe(1);
        expect(results[0].ranges).toStrictEqual([
            [0, 1],
            [2, 3],
        ]);
    });

    test("score prioritizes tighter match", () => {
        const results = fuzzySearchWithHighlights("apc", ["AppController", "AppConfig"]);
        expect(results.length).toBe(2);
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    });

    test("multiple results sorted by score", () => {
        const results = fuzzySearchWithHighlights("rd", ["README.md", "roadmap.doc"]);
        expect(results.length).toBe(2);
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    });

    test("ranges match correct substrings", () => {
        const results = fuzzySearchWithHighlights("rg", ["reorganize"]);
        const [start1, end1] = results[0].ranges[0];
        const [start2, end2] = results[0].ranges[1];
        const str = results[0].item;
        expect(str.slice(start1, end1)).toBe("r");
        expect(str.slice(start2, end2)).toBe("g");
    });

    test("empty pattern returns no results", () => {
        const results = fuzzySearchWithHighlights("", ["something"]);
        expect(results.length).toBe(0);
    });

    test("empty haystack returns no results", () => {
        const results = fuzzySearchWithHighlights("a", []);
        expect(results).toStrictEqual([]);
    });

    test("full string match returns single full range", () => {
        const str = "test";
        const results = fuzzySearchWithHighlights("test", [str]);
        expect(results.length).toBe(1);
        expect(results[0].ranges).toStrictEqual([[0, 4]]);
    });
});

suite("renderHighlightedMatch", () => {
    test("wraps a single range in <b> tags", () => {
        const result = renderHighlightedMatch("apple", [[0, 3]], {start: "<b>", end: "</b>"});
        expect(result).toBe("<b>app</b>le");
    });

    test("wraps multiple non-contiguous ranges", () => {
        const result = renderHighlightedMatch(
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
        const result = renderHighlightedMatch("test", [[0, 4]], {start: "<b>", end: "</b>"});
        expect(result).toBe("<b>test</b>");
    });

    test("returns original string if no ranges", () => {
        const result = renderHighlightedMatch("hello", [], {start: "<b>", end: "</b>"});
        expect(result).toBe("hello");
    });

    test("handles empty string input", () => {
        const result = renderHighlightedMatch("", [], {start: "<b>", end: "</b>"});
        expect(result).toBe("");
    });

    test("custom wrapper works with <mark>", () => {
        const result = renderHighlightedMatch("highlight", [[0, 4]], {start: "<mark>", end: "</mark>"});
        expect(result).toBe("<mark>high</mark>light");
    });

    test("merges highlight and tail correctly", () => {
        const result = renderHighlightedMatch("world", [[1, 4]], {start: "<b>", end: "</b>"});
        expect(result).toBe("w<b>orl</b>d");
    });

    test("works with adjacent ranges", () => {
        const result = renderHighlightedMatch(
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
        const result = renderHighlightedMatch("abc", [[1, 2]]);
        expect(result).toBe("a<b>b</b>c");
    });
    test("shorter exact match is prioritized over longer partial match", () => {
        const results = fuzzySearchWithHighlights("tasks", ["tasks_triggers", "tasks"]);

        expect(results.length).toBe(2);

        // Exact shorter match should win
        expect(results[0].item).toBe("tasks");
        expect(results[1].item).toBe("tasks_triggers");

        expect(results[0].score).toBeGreaterThan(results[1].score);
    });
});
