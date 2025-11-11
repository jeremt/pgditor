const fuzzyMatchWithHighlights = (pattern: string, str: string) => {
    const lowerPattern = pattern.toLowerCase();
    const lowerStr = str.toLowerCase();

    let patternIdx = 0;
    let strIdx = 0;
    let score = 0;
    let consecutive = 0;
    let firstMatch = -1;
    const indexes = [];

    while (strIdx < lowerStr.length) {
        if (patternIdx < lowerPattern.length && lowerStr[strIdx] === lowerPattern[patternIdx]) {
            if (firstMatch === -1) firstMatch = strIdx;
            score += 10 + consecutive * 5;
            consecutive++;
            indexes.push(strIdx);
            patternIdx++;
        } else {
            consecutive = 0;
        }
        strIdx++;
    }

    if (patternIdx !== lowerPattern.length) {
        return {matched: false, score: 0, indexes: []};
    }

    score -= firstMatch;
    return {matched: true, score, indexes};
};

const mergeHighlightIndexes = (indexes: number[]) => {
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
export const fuzzySearchWithHighlights = (needle: string, haystack: string[]) => {
    if (!needle) return [];

    const results = [];

    for (const item of haystack) {
        const match = fuzzyMatchWithHighlights(needle, item);
        if (match.matched) {
            const ranges = mergeHighlightIndexes(match.indexes);
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
 * renderHighlightedMatch("AppController", [[0, 2], [4, 5]], { start: "<b>", end: "</b>" });
 * // => "<b>Ap</b>p<b>C</b>ontroller"
 */
export const renderHighlightedMatch = (
    str: string,
    ranges: readonly (readonly [number, number])[],
    wrapper = {start: "<b>", end: "</b>"}
) => {
    let result = "";
    let lastIndex = 0;

    for (const [start, end] of ranges) {
        if (start > lastIndex) {
            result += str.slice(lastIndex, start);
        }
        result += wrapper.start + str.slice(start, end) + wrapper.end;
        lastIndex = end;
    }
    if (lastIndex < str.length) {
        result += str.slice(lastIndex);
    }
    return result;
};
