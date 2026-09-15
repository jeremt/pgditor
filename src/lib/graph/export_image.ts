import {getNodesBounds, type Node} from "@xyflow/svelte";
import {domToBlob} from "modern-screenshot";

const PADDING = 64;
const MAX_SCALE = 2;
// Keep the canvas within what every webview can allocate (WebKit is the strictest).
const MAX_CANVAS_AREA = 2 ** 25;
const MAX_CANVAS_SIDE = 16384;

/**
 * Render every node of the graph (not only the visible part) into a PNG.
 *
 * Elements marked with `data-export-hidden` are removed from the image, and elements marked with
 * `data-export-push-end` are pushed back to the end of their flex row to fill the freed space.
 */
export const render_graph_png = async (viewport: HTMLElement, nodes: Node[], background_color: string) => {
    const bounds = getNodesBounds(nodes.filter((node) => !node.hidden));
    const width = Math.ceil(bounds.width + PADDING * 2);
    const height = Math.ceil(bounds.height + PADDING * 2);
    const scale = Math.min(MAX_SCALE, Math.sqrt(MAX_CANVAS_AREA / (width * height)));

    const blob = await domToBlob(viewport, {
        width,
        height,
        scale,
        backgroundColor: background_color,
        maximumCanvasSize: MAX_CANVAS_SIDE,
        style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: `translate(${PADDING - bounds.x}px, ${PADDING - bounds.y}px) scale(1)`,
        },
        filter: (el) => !(el instanceof Element && el.hasAttribute("data-export-hidden")),
        onCloneNode: (clone) => {
            if (!(clone instanceof Element)) {
                return;
            }
            for (const el of clone.querySelectorAll<HTMLElement>("[data-export-push-end]")) {
                el.style.marginLeft = "auto";
            }
            // Each edge lives in its own default-sized svg and relies on overflow to be drawn
            // entirely, which is lost when cloning.
            for (const el of clone.querySelectorAll<SVGElement>(".svelte-flow__edge-wrapper")) {
                el.style.overflow = "visible";
            }
        },
    });

    return new Uint8Array(await blob.arrayBuffer());
};
