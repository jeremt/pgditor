import dagre from "@dagrejs/dagre";
import type {PgTableForGraph} from "$lib/table/pgContext.svelte";
import {Position, type Edge, type Node} from "@xyflow/svelte";

export const build_nodes = (tables: PgTableForGraph[]) =>
    tables.map((table, index) => ({
        id: `${table.schema}.${table.name}`,
        position: {x: index * 300, y: 100},
        data: {
            label: table.name,
            schema: table.schema,
            columns: table.columns,
        },
        type: "table",
    }));

export const build_edges = (tables: PgTableForGraph[]) =>
    tables.flatMap((table) =>
        table.columns
            .filter((col) => col.foreign_table_name !== null)
            .map((col) => ({
                id: `${table.schema}.${table.name}.${col.column_name}-${col.foreign_table_schema}.${col.foreign_table_name}.${col.foreign_column_name}`,
                source: `${col.foreign_table_schema}.${col.foreign_table_name}`,
                sourceHandle: `${col.foreign_table_schema}.${col.foreign_table_name}.${col.foreign_column_name}-source`,
                target: `${table.schema}.${table.name}`,
                targetHandle: `${table.schema}.${table.name}.${col.column_name}-target`,
                style: "stroke: var(--color-fg-1); stroke-width: 1px;",
                type: "smoothstep",
            })),
    );

const nodeWidth = 1;
const nodeHeight = 1;

export const build_layout = (nodes: Node[], edges: Edge[], direction = "LR") => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const isHorizontal = direction === "LR";
    dagreGraph.setGraph({rankdir: direction});

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, {
            width: node.measured?.width ?? nodeWidth,
            height: node.measured?.height ?? nodeHeight,
        });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = isHorizontal ? Position.Left : Position.Top;
        node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

        return {
            ...node,
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
        };
    });

    return {nodes: layoutedNodes, edges};
};
