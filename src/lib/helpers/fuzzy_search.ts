const fuzzy_match_with_highlights = (pattern: string, str: string) => {
    const lower_pattern = pattern.toLowerCase();
    const lower_str = str.toLowerCase();

    let pattern_idx = 0;
    let str_idx = 0;
    let score = 0;
    let consecutive = 0;
    let first_match = -1;
    const indexes: number[] = [];

    while (str_idx < lower_str.length) {
        if (pattern_idx < lower_pattern.length && lower_str[str_idx] === lower_pattern[pattern_idx]) {
            if (first_match === -1) first_match = str_idx;

            score += 10 + consecutive * 5;
            consecutive++;
            indexes.push(str_idx);
            pattern_idx++;
        } else {
            consecutive = 0;
        }
        str_idx++;
    }

    if (pattern_idx !== lower_pattern.length) {
        return {matched: false, score: 0, indexes: []};
    }

    score -= first_match;

    const length_penalty = (lower_str.length - lower_pattern.length) * 2;
    score -= length_penalty;

    return {matched: true, score, indexes};
};

const merge_highlight_indexes = (indexes: number[]) => {
    if (indexes.length === 0) return [];

    indexes.sort((a, b) => a - b);
    const ranges = [];
    let start = indexes[0];
    let end = start + 1;

    for (let i = 1; i < indexes.length; i++) {
        if (indexes[i] === end) {
            end++;
        } else {
            ranges.push([start, end] as const);
            start = indexes[i];
            end = start + 1;
        }
    }

    ranges.push([start, end] as const);
    return ranges;
};

/**
 * Performs a fuzzy search on an array of strings, returning matches where the
 * characters in the search pattern appear in order (not necessarily contiguous).
 * Matches are scored based on closeness and position, and include merged highlight ranges.
 *
 * @param needle - The search string (pattern) to match against the haystack.
 * @param haystack - The array of strings to search through.
 * @returns An array of match results, each containing:
 *   - `item`: the matched string from the haystack,
 *   - `score`: the relevance score (higher is better),
 *   - `ranges`: an array of [start, end) pairs indicating matched character ranges.
 *
 * @example
 * fuzzySearchWithHighlights("apc", ["AppController"]);
 * // => [
 * //   {
 * //     item: "AppController",
 * //     score: 38,
 * //     ranges: [[0, 2], [4, 5]]
 * //   }
 * // ]
 *
 * @remarks
 * The function ignores case and returns results sorted by descending score.
 * An empty search string returns an empty array.
 */
export const fuzzy_search_with_highlights = (needle: string, haystack: string[]) => {
    if (!needle) return [];

    const results = [];

    for (const item of haystack) {
        const match = fuzzy_match_with_highlights(needle, item);
        if (match.matched) {
            const ranges = merge_highlight_indexes(match.indexes);
            results.push({
                item,
                score: match.score,
                ranges, // merged highlight ranges
            });
        }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
};

/**
 * Renders a fuzzy search result with matched ranges wrapped in custom tags.
 *
 * @param str - The original string (e.g., result.item).
 * @param ranges - The matched character ranges from the result.
 * @param wrapper - The tags to wrap matched text with.
 * @returns The string with matched parts wrapped.
 *
 * @example
 * render_highlighted_match("AppController", [[0, 2], [4, 5]], { start: "<b>", end: "</b>" });
 * // => "<b>Ap</b>p<b>C</b>ontroller"
 */
export const render_highlighted_match = (
    str: string,
    ranges: readonly (readonly [number, number])[],
    wrapper = {start: "<b>", end: "</b>"},
) => {
    let result = "";
    let last_index = 0;

    for (const [start, end] of ranges) {
        if (start > last_index) {
            result += str.slice(last_index, start);
        }
        result += wrapper.start + str.slice(start, end) + wrapper.end;
        last_index = end;
    }
    if (last_index < str.length) {
        result += str.slice(last_index);
    }
    return result;
};
