import dagre from "@dagrejs/dagre";
import type {PgTableForGraph} from "$lib/table/pgContext.svelte";
import {MarkerType, Position, type Edge, type Node} from "@xyflow/svelte";

export const build_nodes = (tables: PgTableForGraph[]) =>
    tables.map((table, index) => {
        return {
            id: `${table.schema}.${table.name}`,
            position: {x: index * 300, y: 100},
            data: {
                label: table.name,
                schema: table.schema,
                type: table.type,
                columns: table.columns,
            },
            type: "table",
        };
    });

export const build_edges = (tables: PgTableForGraph[]) =>
    tables.flatMap((table) =>
        table.columns
            .filter((col) => col.foreign_table_name !== null)
            .map(
                (col) =>
                    ({
                        id: `${table.schema}.${table.name}.${col.column_name}-${col.foreign_table_schema}.${col.foreign_table_name}.${col.foreign_column_name}`,
                        source: `${col.foreign_table_schema}.${col.foreign_table_name}`,
                        sourceHandle: `${col.foreign_table_schema}.${col.foreign_table_name}.${col.foreign_column_name}-source`,
                        target: `${table.schema}.${table.name}`,
                        targetHandle: `${table.schema}.${table.name}.${col.column_name}-target`,
                        style: "stroke: var(--color-fg); stroke-width: 1px;",
                        type: "smoothstep",
                        markerEnd: {
                            type: MarkerType.Arrow,
                            width: 30,
                            height: 30,
                            strokeWidth: 1,
                            color: "var(--color-fg)",
                        },
                        markerStart: {
                            type: MarkerType.Arrow,
                            width: 30,
                            height: 30,
                            strokeWidth: 1,
                            color: "var(--color-fg)",
                        },
                    }) satisfies Edge,
            ),
    );

export const build_layout = (nodes: Node[], edges: Edge[], direction = "LR") => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const isHorizontal = direction === "LR";
    dagreGraph.setGraph({rankdir: direction});

    for (const node of nodes) {
        const nodeSize = node.measured;
        if (nodeSize === undefined || nodeSize.width === undefined || nodeSize.height === undefined) {
            return new Error(`Cannot layout if the node isn't rendered yet.`);
        }
        dagreGraph.setNode(node.id, {
            width: nodeSize.width,
            height: nodeSize.height,
        });
    }
    for (const edge of edges) {
        dagreGraph.setEdge(edge.source, edge.target);
    }

    dagre.layout(dagreGraph);

    const layoutedNodes: Node[] = [];
    for (const node of nodes) {
        const nodeSize = node.measured;
        if (nodeSize === undefined || nodeSize.width === undefined || nodeSize.height === undefined) {
            return new Error(`Cannot layout if the node isn't rendered yet.`);
        }
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = isHorizontal ? Position.Left : Position.Top;
        node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
        layoutedNodes.push({
            ...node,
            position: {
                x: nodeWithPosition.x - nodeSize.width / 2, // Use actual width
                y: nodeWithPosition.y - nodeSize.height / 2, // Use actual height
            },
        });
    }
    return layoutedNodes;
};
