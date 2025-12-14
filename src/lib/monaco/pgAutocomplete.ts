import type {PgTable} from "$lib/table/pgContext.svelte";
import type monaco from "monaco-editor";

const keywords = [
    // DML - Data Manipulation Language
    "select",
    "distinct",
    "from",
    "where",
    "group by",
    "having",
    "order by",
    "limit",
    "offset",
    "fetch first",
    "insert into",
    "values",
    "on conflict",
    "do update",
    "do nothing",
    "returning",
    "update",
    "set",
    "delete from",
    "truncate table",
    // DDL - Data Definition Language
    "create table",
    "alter table",
    "drop table",
    "create index",
    "drop index",
    "create sequence",
    "drop sequence",
    "create view",
    "drop view",
    "create type",
    "drop type",
    "create domain",
    "drop domain",
    "create function",
    "drop function",
    "create trigger",
    "drop trigger",
    "create extension",
    "drop extension",
    // DCL - Data Control Language
    "grant",
    "revoke",
    // TCL - Transaction Control Language
    "begin",
    "commit",
    "rollback",
    "savepoint",
    "release savepoint",
    // Joins and Set Operations
    "join",
    "inner join",
    "left join",
    "right join",
    "full join",
    "cross join",
    "using",
    "on",
    "union",
    "union all",
    "intersect",
    "except",
    // Filtering and Comparison
    "and",
    "or",
    "not",
    "in",
    "like",
    "ilike",
    "is null",
    "is not null",
    "between",
    "any",
    "all",
    "exists",
    "similar to",
    "over", // For Window Functions
    // Data Types (Common)
    "text",
    "varchar",
    "char",
    "integer",
    "int",
    "bigint",
    "smallint",
    "serial",
    "bigserial",
    "numeric",
    "decimal",
    "real",
    "double precision",
    "boolean",
    "bool",
    "date",
    "time",
    "timestamp",
    "timestamptz",
    "interval",
    "uuid",
    "json",
    "jsonb",
    "bytea",
    // Constraints and Definitions
    "primary key",
    "foreign key",
    "references",
    "default",
    "unique",
    "check",
    "not null",
    "with", // CTEs
    "recursive",
    "as",
    "case when then else end",
    "asc",
    "desc",
    "only",
    "for update",
    "explain",
    "vacuum",
    "analyze",
    "current_timestamp",
    "current_date",
    "session_user",
    "current_user",
    "view",
    "materialized",
    "recursive",
    "cascade",
    "restrict",
];

const pgFunctions = [
    {
        category: "aggregate function",
        functions: [
            "avg(x)",
            "count(*)",
            "count(x)",
            "sum(x)",
            "max(x)",
            "min(x)",
            "string_agg(x, delimiter)",
            "array_agg(x)",
            "json_agg(x)",
            "jsonb_agg(x)",
            "stddev(x)",
            "variance(x)",
            "regr_intercept(x, y)",
            "percentile_cont(fraction) within group (order by x)",
        ],
    },
    {
        category: "mathematical function",
        functions: [
            "abs(x)",
            "round(x)",
            "round(x, s)",
            "ceil(x)",
            "floor(x)",
            "mod(x, y)",
            "power(x, y)",
            "sqrt(x)",
            "exp(x)",
            "ln(x)",
            "log(b, x)",
            "pi()",
            "degrees(r)",
            "radians(d)",
            "sin(x)",
            "cos(x)",
            "tan(x)",
            "random()",
            "setseed(d)",
            "width_bucket(x, min, max, count)",
        ],
    },
    {
        category: "string function",
        functions: [
            "length(s)",
            "char_length(s)",
            "octet_length(s)",
            "lower(s)",
            "upper(s)",
            "initcap(s)",
            "trim(s)",
            "ltrim(s)",
            "rtrim(s)",
            "substring(s from start for count)",
            "position(sub in s)",
            "strpos(s, sub)",
            "replace(s, from, to)",
            "translate(s, from_chars, to_chars)",
            "concat(a, b, ...)",
            "concat_ws(sep, a, b, ...)",
            "left(s, n)",
            "right(s, n)",
            "repeat(s, n)",
            "reverse(s)",
            "split_part(s, delimiter, n)",
            "format(format_string, args...)",
        ],
    },
    {
        category: "date and time function",
        functions: [
            "now()",
            "current_timestamp",
            "current_date",
            "current_time",
            "statement_timestamp()",
            "date_trunc(field, source)",
            "extract(field from source)",
            "make_date(year, month, day)",
            "make_time(hour, min, sec)",
            "make_timestamp(year, month, day, hour, min, sec)",
            "age(timestamp, timestamp)",
            "timezone(zone, timestamp)",
        ],
    },
    {
        category: "type conversion / formatting",
        functions: [
            "cast(x as type)",
            "x::type", // Shorthand for CAST
            "to_char(x, format)",
            "to_timestamp(double)",
            "to_date(text, format)",
            "to_number(text, format)",
            "to_json(x)",
            "to_jsonb(x)",
            "to_tsvector(text)",
            "to_tsquery(text)",
            "convert_from(data, src_encoding)",
            "convert_to(s, dest_encoding)",
        ],
    },
    {
        category: "null handling / conditional",
        functions: ["coalesce(a, b, ...)", "nullif(a, b)", "greatest(a, b, ...)", "least(a, b, ...)"],
    },
    {
        category: "json/jsonb function",
        functions: [
            "to_json(x)",
            "to_jsonb(x)",
            "json_build_object(key, value, ...)",
            "jsonb_build_object(key, value, ...)",
            "json_build_array(val, ...)",
            "jsonb_build_array(val, ...)",
            "jsonb_array_elements(x)",
            "jsonb_array_elements_text(x)",
            "jsonb_each(x)",
            "jsonb_each_text(x)",
            "jsonb_array_length(x)",
            "jsonb_extract_path_text(x, key, ...)",
            "jsonb_set(target, path, new_value, create_if_missing)",
            "jsonb_pretty(x)",
        ],
    },
    {
        category: "window function",
        functions: [
            "row_number()",
            "rank()",
            "dense_rank()",
            "percent_rank()",
            "cume_dist()",
            "ntile(n)",
            "lag(x, offset, default)",
            "lead(x, offset, default)",
            "first_value(x)",
            "last_value(x)",
            "nth_value(x, n)",
            "mode() within group (order by x)",
        ],
    },
    {
        category: "system information / utility function",
        functions: [
            "nextval('seq')",
            "currval('seq')",
            "lastval()",
            "pg_sleep(sec)",
            "version()",
            "current_database()",
            "pg_relation_size(relation)",
            "pg_total_relation_size(relation)",
            "txid_current()",
            "gen_random_uuid()", // Requires pgcrypto
        ],
    },
    {
        category: "pattern matching / regex function",
        functions: [
            "regexp_replace(s, pattern, replace, flags)",
            "regexp_matches(s, pattern, flags)",
            "regexp_split_to_array(s, pattern, flags)",
            "regexp_split_to_table(s, pattern, flags)",
        ],
    },
];

// Store the disposable so we can clean it up
let currentDisposable: monaco.IDisposable | null = null;

// Helper function to get context from the current line and previous text
function analyzeContext(model: monaco.editor.ITextModel, position: monaco.Position) {
    const lineContent = model
        .getLineContent(position.lineNumber)
        .slice(0, position.column - 1)
        .toLowerCase();
    const textBeforeCursor = model
        .getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
        })
        .toLowerCase();

    return {
        afterSelect: /\bselect\b/.test(textBeforeCursor) && !/\bfrom\b/.test(textBeforeCursor.split("select").pop()!),
        afterFrom: /\bfrom\b(?!.*\bwhere\b)/.test(textBeforeCursor),
        afterWhere: /\bwhere\b/.test(textBeforeCursor.split(/\b(from|join)\b/).pop()!),
        afterJoin: /\b(join|inner join|left join|right join|full join)\s+\S*$/.test(lineContent),
        afterOn: /\bon\s+\S*$/.test(lineContent),
        afterGroupBy:
            /\bgroup\s+by\b/.test(textBeforeCursor) && !/\bhaving\b/.test(textBeforeCursor.split("group by").pop()!),
        afterOrderBy: /\border\s+by\b/.test(textBeforeCursor.split(/\blimit\b/).shift()!),
        afterInsertInto: /\binsert\s+into\s+\S*$/.test(lineContent),
        afterUpdate: /\bupdate\s+\S*$/.test(lineContent),
        afterSet: /\bset\b/.test(textBeforeCursor.split(/\bwhere\b/).shift()!),
        inSelectClause:
            /\bselect\b/.test(textBeforeCursor) && !/\bfrom\b/.test(textBeforeCursor.split("select").pop()!),
    };
}

// Helper to extract table references from the query
function getReferencedTables(text: string, tables: PgTable[]): PgTable[] {
    const referencedTables: PgTable[] = [];
    const lowerText = text.toLowerCase();

    for (const table of tables) {
        const fullName = `${table.schema}.${table.name}`;
        const patterns = [
            new RegExp(`\\b${table.name}\\b`, "i"),
            new RegExp(`\\b${fullName.replace(".", "\\.")}\\b`, "i"),
        ];

        if (patterns.some((p) => p.test(lowerText))) {
            referencedTables.push(table);
        }
    }

    return referencedTables;
}

export const addPgAutocomplete = (Monaco: typeof monaco, tables: PgTable[]) => {
    // Dispose of the previous provider if it exists
    if (currentDisposable) {
        currentDisposable.dispose();
    }

    // Register the new provider and store its disposable
    currentDisposable = Monaco.languages.registerCompletionItemProvider("pgsql", {
        provideCompletionItems: (
            model: monaco.editor.ITextModel,
            position: monaco.Position
        ): monaco.languages.ProviderResult<monaco.languages.CompletionList> => {
            const suggestions: monaco.languages.CompletionItem[] = [];
            const wordInfo = model.getWordUntilPosition(position);
            const wordRange = new Monaco.Range(
                position.lineNumber,
                wordInfo.startColumn,
                position.lineNumber,
                wordInfo.endColumn
            );

            const context = analyzeContext(model, position);
            const textBeforeCursor = model.getValueInRange({
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
            });
            const referencedTables = getReferencedTables(textBeforeCursor, tables);

            // Add keywords based on context
            for (const keyword of keywords) {
                let shouldInclude = true;
                let sortPriority = "5"; // Default priority

                // Context-specific filtering
                if (context.afterFrom && ["select", "from", "insert into", "update", "delete from"].includes(keyword)) {
                    shouldInclude = false;
                } else if (context.afterSelect && keyword === "from") {
                    sortPriority = "1"; // High priority
                } else if (
                    context.afterFrom &&
                    ["where", "join", "inner join", "left join", "group by", "order by"].includes(keyword)
                ) {
                    sortPriority = "2";
                } else if (context.afterWhere && ["and", "or", "group by", "order by", "limit"].includes(keyword)) {
                    sortPriority = "2";
                } else if (context.afterJoin && keyword === "on") {
                    sortPriority = "1";
                } else if (context.afterGroupBy && ["having", "order by"].includes(keyword)) {
                    sortPriority = "2";
                } else if (context.afterOrderBy && ["limit", "offset"].includes(keyword)) {
                    sortPriority = "2";
                }

                if (shouldInclude) {
                    suggestions.push({
                        kind: Monaco.languages.CompletionItemKind.Keyword,
                        insertText: keyword,
                        label: keyword,
                        detail: "Keyword",
                        range: wordRange,
                        sortText: sortPriority + keyword,
                    });
                }
            }

            // Add tables (especially after FROM, JOIN, INSERT INTO, UPDATE)
            if (
                context.afterFrom ||
                context.afterJoin ||
                context.afterInsertInto ||
                context.afterUpdate ||
                !context.inSelectClause
            ) {
                for (const table of tables) {
                    suggestions.push({
                        label: `${table.schema}.${table.name}`,
                        kind: Monaco.languages.CompletionItemKind.Class,
                        insertText: `${table.schema}.${table.name}`,
                        detail: table.type === "BASE TABLE" ? "table" : "view",
                        range: wordRange,
                        sortText: "1" + table.name,
                    });
                    if (table.schema === "public") {
                        suggestions.push({
                            label: `${table.name}`,
                            kind: Monaco.languages.CompletionItemKind.Class,
                            insertText: `${table.name}`,
                            detail: table.type === "BASE TABLE" ? "table" : "view",
                            range: wordRange,
                            sortText: "1" + table.name,
                        });
                    }
                }
            }

            // Add columns (prioritize from referenced tables)
            if (
                context.afterSelect ||
                context.afterWhere ||
                context.afterOn ||
                context.afterGroupBy ||
                context.afterOrderBy ||
                context.afterSet
            ) {
                const columnsToShow = referencedTables.length > 0 ? referencedTables : tables;

                for (const table of columnsToShow) {
                    const sortPrefix = referencedTables.includes(table) ? "1" : "3";

                    for (const column of table.column_names) {
                        suggestions.push({
                            label: column,
                            kind: Monaco.languages.CompletionItemKind.Field,
                            insertText: column,
                            detail: `${table.schema}.${table.name}`,
                            range: wordRange,
                            sortText: sortPrefix + column,
                        });
                    }
                }
            }

            // Add functions (prioritize aggregate functions in SELECT after GROUP BY)
            const showAggregateFunctions = context.inSelectClause;

            for (const {category, functions} of pgFunctions) {
                const sortPrefix = showAggregateFunctions && category === "aggregate function" ? "2" : "4";

                for (const func of functions) {
                    suggestions.push({
                        label: func,
                        kind: Monaco.languages.CompletionItemKind.Function,
                        insertText: func,
                        detail: category,
                        insertTextRules: Monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        range: wordRange,
                        sortText: sortPrefix + func,
                    });
                }
            }

            return {suggestions};
        },
    });

    return currentDisposable;
};
