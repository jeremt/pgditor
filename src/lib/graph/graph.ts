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
    const sorted_nodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));

    // First, find all connected components
    const components = find_connected_components(sorted_nodes, edges);

    // Sort components deterministically (by first node ID, then by size)
    components.sort((a, b) => {
        const firstIdA = a[0].id;
        const firstIdB = b[0].id;
        return firstIdA.localeCompare(firstIdB);
    });

    const is_horizontal = direction === "LR";
    const all_layouted_nodes: Node[] = [];
    const component_bounds: {width: number; height: number; nodes: Node[]}[] = [];

    // Layout each component separately
    for (const component_nodes of components) {
        const dagre_graph = new dagre.graphlib.Graph();
        dagre_graph.setDefaultEdgeLabel(() => ({}));

        dagre_graph.setGraph({
            rankdir: direction,
            nodesep: 50,
            edgesep: 10,
            ranksep: 50,
            marginx: 20,
            marginy: 20,
            ranker: "tight-tree",
        });

        // Add nodes in sorted order
        for (const node of component_nodes) {
            const node_size = node.measured;
            if (node_size === undefined || node_size.width === undefined || node_size.height === undefined) {
                return new Error(`Cannot layout if the node isn't rendered yet.`);
            }
            dagre_graph.setNode(node.id, {
                width: node_size.width,
                height: node_size.height,
            });
        }

        // Add edges in sorted order
        const component_node_ids = new Set(component_nodes.map((n) => n.id));
        const relevant_edges = edges
            .filter((e) => component_node_ids.has(e.source) && component_node_ids.has(e.target))
            .sort((a, b) => {
                const cmp = a.source.localeCompare(b.source);
                return cmp !== 0 ? cmp : a.target.localeCompare(b.target);
            });

        for (const edge of relevant_edges) {
            dagre_graph.setEdge(edge.source, edge.target);
        }

        dagre.layout(dagre_graph);

        // Get the bounds of this component
        let min_x = Infinity,
            min_y = Infinity,
            max_x = -Infinity,
            max_y = -Infinity;
        const component_layouted: Node[] = [];

        for (const node of component_nodes) {
            const node_size = node.measured;
            if (node_size === undefined || node_size.width === undefined || node_size.height === undefined) {
                return new Error(`Cannot layout if the node isn't rendered yet.`);
            }
            const node_with_position = dagre_graph.node(node.id);
            const x = node_with_position.x - node_size.width / 2;
            const y = node_with_position.y - node_size.height / 2;

            min_x = Math.min(min_x, x);
            min_y = Math.min(min_y, y);
            max_x = Math.max(max_x, x + node_size.width);
            max_y = Math.max(max_y, y + node_size.height);

            component_layouted.push({
                ...node,
                targetPosition: is_horizontal ? Position.Left : Position.Top,
                sourcePosition: is_horizontal ? Position.Right : Position.Bottom,
                position: {x, y},
            });
        }

        component_bounds.push({
            width: max_x - min_x,
            height: max_y - min_y,
            nodes: component_layouted,
        });
    }

    // Arrange components in a grid
    const spacing = 100;
    const components_per_row = Math.ceil(Math.sqrt(components.length));

    let current_x = 0;
    let current_y = 0;
    let row_height = 0;
    let col_index = 0;

    for (const component of component_bounds) {
        // Normalize positions to start at (0, 0) for this component
        const min_x = Math.min(...component.nodes.map((n) => n.position.x));
        const min_y = Math.min(...component.nodes.map((n) => n.position.y));

        for (const node of component.nodes) {
            all_layouted_nodes.push({
                ...node,
                position: {
                    x: node.position.x - min_x + current_x,
                    y: node.position.y - min_y + current_y,
                },
            });
        }

        row_height = Math.max(row_height, component.height);
        col_index++;

        if (col_index >= components_per_row) {
            // Move to next row
            current_x = 0;
            current_y += row_height + spacing;
            row_height = 0;
            col_index = 0;
        } else {
            // Move to next column
            current_x += component.width + spacing;
        }
    }

    return all_layouted_nodes;
};

// Helper function to find connected components
function find_connected_components(nodes: Node[], edges: Edge[]): Node[][] {
    const node_map = new Map(nodes.map((n) => [n.id, n]));
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
                component.push(node_map.get(current)!);

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
