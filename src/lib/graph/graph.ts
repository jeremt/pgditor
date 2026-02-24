import dagre from "@dagrejs/dagre";
import type {PgTableForGraph} from "$lib/table/pg_context.svelte";
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
    // Sort nodes deterministically by ID to ensure consistent ordering
    const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));

    // First, find all connected components
    const components = find_connected_components(sortedNodes, edges);

    // Sort components deterministically (by first node ID, then by size)
    components.sort((a, b) => {
        const firstIdA = a[0].id;
        const firstIdB = b[0].id;
        return firstIdA.localeCompare(firstIdB);
    });

    const isHorizontal = direction === "LR";
    const allLayoutedNodes: Node[] = [];
    const componentBounds: {width: number; height: number; nodes: Node[]}[] = [];

    // Layout each component separately
    for (const componentNodes of components) {
        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));

        dagreGraph.setGraph({
            rankdir: direction,
            nodesep: 50,
            edgesep: 10,
            ranksep: 50,
            marginx: 20,
            marginy: 20,
            ranker: "tight-tree",
        });

        // Add nodes in sorted order
        for (const node of componentNodes) {
            const nodeSize = node.measured;
            if (nodeSize === undefined || nodeSize.width === undefined || nodeSize.height === undefined) {
                return new Error(`Cannot layout if the node isn't rendered yet.`);
            }
            dagreGraph.setNode(node.id, {
                width: nodeSize.width,
                height: nodeSize.height,
            });
        }

        // Add edges in sorted order
        const componentNodeIds = new Set(componentNodes.map((n) => n.id));
        const relevantEdges = edges
            .filter((e) => componentNodeIds.has(e.source) && componentNodeIds.has(e.target))
            .sort((a, b) => {
                const cmp = a.source.localeCompare(b.source);
                return cmp !== 0 ? cmp : a.target.localeCompare(b.target);
            });

        for (const edge of relevantEdges) {
            dagreGraph.setEdge(edge.source, edge.target);
        }

        dagre.layout(dagreGraph);

        // Get the bounds of this component
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        const componentLayouted: Node[] = [];

        for (const node of componentNodes) {
            const nodeSize = node.measured;
            if (nodeSize === undefined || nodeSize.width === undefined || nodeSize.height === undefined) {
                return new Error(`Cannot layout if the node isn't rendered yet.`);
            }
            const nodeWithPosition = dagreGraph.node(node.id);
            const x = nodeWithPosition.x - nodeSize.width / 2;
            const y = nodeWithPosition.y - nodeSize.height / 2;

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + nodeSize.width);
            maxY = Math.max(maxY, y + nodeSize.height);

            componentLayouted.push({
                ...node,
                targetPosition: isHorizontal ? Position.Left : Position.Top,
                sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
                position: {x, y},
            });
        }

        componentBounds.push({
            width: maxX - minX,
            height: maxY - minY,
            nodes: componentLayouted,
        });
    }

    // Arrange components in a grid
    const spacing = 100;
    const componentsPerRow = Math.ceil(Math.sqrt(components.length));

    let currentX = 0;
    let currentY = 0;
    let rowHeight = 0;
    let colIndex = 0;

    for (const component of componentBounds) {
        // Normalize positions to start at (0, 0) for this component
        const minX = Math.min(...component.nodes.map((n) => n.position.x));
        const minY = Math.min(...component.nodes.map((n) => n.position.y));

        for (const node of component.nodes) {
            allLayoutedNodes.push({
                ...node,
                position: {
                    x: node.position.x - minX + currentX,
                    y: node.position.y - minY + currentY,
                },
            });
        }

        rowHeight = Math.max(rowHeight, component.height);
        colIndex++;

        if (colIndex >= componentsPerRow) {
            // Move to next row
            currentX = 0;
            currentY += rowHeight + spacing;
            rowHeight = 0;
            colIndex = 0;
        } else {
            // Move to next column
            currentX += component.width + spacing;
        }
    }

    return allLayoutedNodes;
};

// Helper function to find connected components
function find_connected_components(nodes: Node[], edges: Edge[]): Node[][] {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const adjacency = new Map<string, Set<string>>();

    // Build adjacency list (undirected)
    for (const node of nodes) {
        adjacency.set(node.id, new Set());
    }
    for (const edge of edges) {
        adjacency.get(edge.source)?.add(edge.target);
        adjacency.get(edge.target)?.add(edge.source);
    }

    const visited = new Set<string>();
    const components: Node[][] = [];

    // Process nodes in their original sorted order
    for (const node of nodes) {
        if (!visited.has(node.id)) {
            const component: Node[] = [];
            const queue = [node.id];

            while (queue.length > 0) {
                const current = queue.shift()!;
                if (visited.has(current)) continue;

                visited.add(current);
                component.push(nodeMap.get(current)!);

                // Sort neighbors for consistency
                const neighbors = Array.from(adjacency.get(current) || []).sort();
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        queue.push(neighbor);
                    }
                }
            }

            // Sort component nodes by ID
            component.sort((a, b) => a.id.localeCompare(b.id));
            components.push(component);
        }
    }

    return components;
}
