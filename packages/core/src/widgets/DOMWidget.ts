import type { default as IWidget, WidgetCallback } from "../IWidget";
import LGraphNode, { SerializedLGraphNode } from "../LGraphNode";
import LiteGraph from "../LiteGraph";
import { NodeMode, Vector2 } from "../types";

type LDomRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

function intersect(a: LDomRect, b: LDomRect) {
    const x = Math.max(a.x, b.x);
    const num1 = Math.min(a.x + a.width, b.x + b.width);
    const y = Math.max(a.y, b.y);
    const num2 = Math.min(a.y + a.height, b.y + b.height);
    if (num1 >= x && num2 >= y) return [x, y, num1 - x, num2 - y];
    else return null;
}

function getClipPath(node: LGraphNode, element: HTMLElement, elRect: DOMRect) {
    // FIXME: maybe to multiple canvas?
    const canvas = node.graph.list_of_graphcanvas[0];
    const selectedNode = Object.values(canvas.selected_nodes)[0];
    if (selectedNode && selectedNode !== node) {
        const MARGIN = 7;
        const scale = canvas.ds.scale;

        const bounding = selectedNode.getBounding();
        const intersection = intersect(
            {
                x: elRect.x / scale,
                y: elRect.y / scale,
                width: elRect.width / scale,
                height: elRect.height / scale,
            },
            {
                x: selectedNode.pos[0] + canvas.ds.offset[0] - MARGIN,
                y:
                    selectedNode.pos[1] +
                    canvas.ds.offset[1] -
                    LiteGraph.NODE_TITLE_HEIGHT -
                    MARGIN,
                width: bounding[2] + MARGIN + MARGIN,
                height: bounding[3] + MARGIN + MARGIN,
            },
        );

        if (!intersection) {
            return "";
        }

        const widgetRect = element.getBoundingClientRect();
        const clipX = intersection[0] - widgetRect.x / scale + "px";
        const clipY = intersection[1] - widgetRect.y / scale + "px";
        const clipWidth = intersection[2] + "px";
        const clipHeight = intersection[3] + "px";
        const path = `polygon(0% 0%, 0% 100%, ${clipX} 100%, ${clipX} ${clipY}, calc(${clipX} + ${clipWidth}) ${clipY}, calc(${clipX} + ${clipWidth}) calc(${clipY} + ${clipHeight}), ${clipX} calc(${clipY} + ${clipHeight}), ${clipX} 100%, 100% 100%, 100% 0%)`;
        return path;
    }
    return "";
}

function computeSize(this: LGraphNode, size: Vector2) {
    if (this.widgets?.[0]?.last_y == null) return;

    let y = this.widgets[0].last_y;
    let freeSpace = size[1] - y;

    let widgetHeight = 0;
    let dom = [];
    for (const w of this.widgets) {
        if (w.computeSize) {
            widgetHeight += w.computeSize(size[0])[1] + 4;
        } else if (w instanceof DOMWidget) {
            let minHeight = w.options.getMinHeight?.();
            let maxHeight = w.options.getMaxHeight?.();
            let prefHeight = w.options.getHeight?.();
            if (typeof prefHeight === "string" && prefHeight.endsWith?.("%")) {
                prefHeight =
                    size[1] *
                    (parseFloat(
                        prefHeight.substring(0, prefHeight.length - 1),
                    ) /
                        100);
            } else {
                prefHeight = parseInt(prefHeight as any);
                if (isNaN(minHeight)) {
                    minHeight = prefHeight;
                }
            }
            if (isNaN(minHeight)) {
                minHeight = 50;
            }
            if (!isNaN(maxHeight)) {
                if (!isNaN(prefHeight)) {
                    prefHeight = Math.min(prefHeight, maxHeight);
                } else {
                    prefHeight = maxHeight;
                }
            }
            dom.push({
                minHeight,
                prefHeight,
                w,
            });
        } else {
            widgetHeight += LiteGraph.NODE_WIDGET_HEIGHT + 4;
        }
    }

    freeSpace -= widgetHeight;

    // Calculate sizes with all widgets at their min height
    const prefGrow = []; // Nodes that want to grow to their prefd size
    const canGrow = []; // Nodes that can grow to auto size
    let growBy = 0;
    for (const d of dom) {
        freeSpace -= d.minHeight;
        if (isNaN(d.prefHeight)) {
            canGrow.push(d);
            d.w.computedHeight = d.minHeight;
        } else {
            const diff = d.prefHeight - d.minHeight;
            if (diff > 0) {
                prefGrow.push(d);
                growBy += diff;
                d.diff = diff;
            } else {
                d.w.computedHeight = d.minHeight;
            }
        }
    }

    if (freeSpace < 0) {
        // Not enough space for all widgets so we need to grow
        size[1] -= freeSpace;
        this.graph.setDirtyCanvas(true);
    } else {
        // Share the space between each
        const growDiff = freeSpace - growBy;
        if (growDiff > 0) {
            // All pref sizes can be fulfilled
            freeSpace = growDiff;
            for (const d of prefGrow) {
                d.w.computedHeight = d.prefHeight;
            }
        } else {
            // We need to grow evenly
            const shared = -growDiff / prefGrow.length;
            for (const d of prefGrow) {
                d.w.computedHeight = d.prefHeight - shared;
            }
            freeSpace = 0;
        }

        if (freeSpace > 0 && canGrow.length) {
            // Grow any that are auto height
            const shared = freeSpace / canGrow.length;
            for (const d of canGrow) {
                d.w.computedHeight += shared;
            }
        }
    }

    // Position each of the widgets
    for (const w of this.widgets) {
        w.y = y;
        if (w instanceof DOMWidget && w.computedHeight) {
            y += w.computedHeight;
        } else if (w.computeSize) {
            y += w.computeSize(size[0])[1] + 4;
        } else {
            y += LiteGraph.NODE_WIDGET_HEIGHT + 4;
        }
    }
}

interface DOMWidgetOptions {
    hideOnZoom?: boolean;
    selectOn?: ("focus" | "click")[];
    getValue?: () => any;
    setValue?: (value: any) => void;
    beforeResize?: (node: LGraphNode) => void;
    afterResize?: (node: LGraphNode) => void;
    getMinHeight?: () => number;
    getMaxHeight?: () => number;
    getHeight?: () => number | string;
    onHide?: (widget: DOMWidget) => void;
    onDraw?: (widget: DOMWidget) => void;

    onBlur?: (event: MouseEvent) => any;

    enableDomClipping?: boolean;

    parentElement?: HTMLElement;
    property?: string;
}

/**
 * Constructs a DOMWidget instance.
 *
 * @param {string} [options.name] - The name of the widget.
 * @param {HTMLElement} [options.element] - The HTML element for the widget.
 * @param {any} [options.value] - The value of the widget.
 * @param {DOMWidgetOptions} [options.options] - The options for the widget.
 * @param {LGraphNode} [options.node] - The LGraphNode associated with the widget.
 */
export class DOMWidget implements IWidget {
    name: string;
    options: DOMWidgetOptions;
    type = "dom";
    y?: number;
    property?: string;
    last_y?: number;
    width?: number;
    clicked?: boolean;
    marker?: boolean;
    disabled?: boolean;
    hidden?: boolean;
    callback?: WidgetCallback<this>;

    $el: HTMLElement;

    computedHeight = null as null | number;
    private mouseDownHandler?: (...args: any) => any;

    node: LGraphNode;

    constructor({
        name,
        element,
        options = {},
        node,
    }: {
        name: string;
        element: HTMLElement;
        value?: any;
        options?: DOMWidgetOptions;
        node: LGraphNode;
    }) {
        this.name = name;
        this.options = options || {};
        this.$el = element;
        this.node = node;

        this.property = name;
        this.options.property = name;

        this.options.onHide = () => {
            if (this.$el.hidden) return;
            this.$el.hidden = true;
        };
        this.options.onDraw = () => {
            if (!this.$el.hidden) return;
            this.$el.hidden = false;
        };

        if (options.onBlur) {
            this.mouseDownHandler = (event) => {
                if (!element.contains(event.target)) {
                    options.onBlur?.(event);
                }
            };
            document.addEventListener("mousedown", this.mouseDownHandler);
        }

        for (const evt of options.selectOn || []) {
            element.addEventListener(evt, () => {
                const canvas = this.node.graph.list_of_graphcanvas[0];
                if (!canvas) return;
                canvas.selectNode(this.node);
                canvas.bringToFront(this.node);
            });
        }

        if (!element.parentElement) {
            const onAdded = this.node.onAdded;
            this.node.onAdded = (graph) => {
                onAdded?.(graph);

                const parentElement =
                    this.options.parentElement ||
                    graph.list_of_graphcanvas[0].canvas.offsetParent ||
                    document.body;
                parentElement.appendChild(element);
            };
        }
    }

    get value() {
        return this.options?.getValue?.() ?? null;
    }

    set value(v: any) {
        this.options.setValue?.(v);
        // this.callback?.(this.value);
    }

    draw(
        ctx: CanvasRenderingContext2D,
        node: LGraphNode,
        widgetWidth: number,
        posY: number,
        height: number,
    ): void {
        if (this.computedHeight == null) {
            computeSize.call(node, node.size);
        }
        const graph = node.graph;
        // FIXME: maybe to multiple canvas?
        const canvas = node.graph.list_of_graphcanvas[0];
        const { $el: element } = this;

        const hidden =
            node.flags?.collapsed ||
            (!!this.options?.hideOnZoom && canvas.ds.scale < 0.5) ||
            this.computedHeight <= 0;
        element.hidden = hidden;
        element.style.display = hidden ? "none" : null;
        if (hidden) {
            this.options.onHide?.(this);
            return;
        }

        const margin = 10;
        const elRect = ctx.canvas.getBoundingClientRect();
        const transform = new DOMMatrix()
            .scaleSelf(
                elRect.width / ctx.canvas.width,
                elRect.height / ctx.canvas.height,
            )
            .multiplySelf(ctx.getTransform())
            .translateSelf(margin, margin + posY);

        const scale = new DOMMatrix().scaleSelf(transform.a, transform.d);

        Object.assign(element.style, {
            transformOrigin: "0 0",
            transform: scale,
            left: `${transform.a + transform.e}px`,
            top: `${transform.d + transform.f}px`,
            width: `${widgetWidth - margin * 2}px`,
            height: `${(this.computedHeight ?? 50) - margin * 2}px`,
            position: "absolute",
            zIndex: graph._nodes.indexOf(node),
        });

        if (this.options?.enableDomClipping) {
            element.style.clipPath = getClipPath(node, element, elRect);
            element.style.willChange = "clip-path";
        }

        this.options.onDraw?.(this);
    }

    drawInvisible() {
        this.hideElement();
    }

    hideElement() {
        if (this.$el.hidden) return;
        this.$el.hidden = true;
        this.options.onHide?.(this);
    }

    showElement() {
        if (!this.$el.hidden) return;
        this.$el.hidden = false;
        this.options.onDraw?.(this);
    }

    onNodeRemoved(node: LGraphNode) {
        if (this.mouseDownHandler) {
            document.removeEventListener("mousedown", this.mouseDownHandler);
        }
        this.$el.remove();
    }

    onNodeCollapse(node: LGraphNode, collapsed: boolean) {
        if (collapsed) {
            this.hideElement();
        } else {
            this.showElement();
        }
    }

    onNodeResize(node: LGraphNode, size: Vector2) {
        this.options?.beforeResize?.call(this, node);
        computeSize.call(node, size);
        this.options?.afterResize?.call(this, node);
    }

    onNodeModeChange(node: LGraphNode, mode: NodeMode): void {
        switch (mode) {
            case NodeMode.NEVER:
            case NodeMode.ON_REQUEST:
                this.$el.style.opacity = "0.5";
                this.$el.style.pointerEvents = "none";
                break;
            default: {
                this.$el.style.opacity = "1";
                this.$el.style.pointerEvents = undefined;
                break;
            }
        }
    }

    updateProperty() {
        const { name, value, node } = this;
        node.properties[name] = value;
    }
}
