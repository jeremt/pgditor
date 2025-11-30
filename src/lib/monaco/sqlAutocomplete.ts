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

export const addSqliteAutocomplete = (Monaco: typeof monaco, tables: PgTable[]) => {
    return Monaco.languages.registerCompletionItemProvider("pgsql", {
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

            for (const keyword of keywords) {
                suggestions.push({
                    kind: Monaco.languages.CompletionItemKind.Keyword,
                    insertText: keyword,
                    label: keyword,
                    detail: "Keyword",
                    range: wordRange,
                });
            }
            for (const {category, functions} of pgFunctions) {
                for (const func of functions) {
                    suggestions.push({
                        label: func,
                        kind: Monaco.languages.CompletionItemKind.Function,
                        insertText: func,
                        detail: category,
                        insertTextRules: Monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        range: wordRange,
                    });
                }
            }

            for (const table of tables) {
                suggestions.push({
                    label: `${table.schema}.${table.name}`,
                    kind: Monaco.languages.CompletionItemKind.Class,
                    insertText: `${table.schema}.${table.name}`,
                    detail: table.type === "BASE TABLE" ? "🗃️ table" : "👁️ view",
                    range: wordRange,
                });
                for (const column of table.column_names) {
                    suggestions.push({
                        label: column,
                        kind: Monaco.languages.CompletionItemKind.Field,
                        insertText: column,
                        detail: `${table.type === "BASE TABLE" ? "🗃️" : "👁️"} ${table.schema}.${table.name}`,
                        range: wordRange,
                    });
                }
            }
            return {suggestions};
        },
    });
};
