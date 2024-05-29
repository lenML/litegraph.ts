import LGraphNode from "./LGraphNode";
import LiteGraph from "./LiteGraph";
import type { MouseEventExt, CustomEventExt, EventExt } from "./DragAndScale";
import INodeSlot, { SlotInPosition } from "./INodeSlot";
import LGraphCanvas from "./LGraphCanvas";
import { CssVars } from "./misc/CssVars";

export const contextmenu_vars = new CssVars({
    lg_combo_menu_selected_bg: "#ccc",
    lg_combo_menu_selected_fg: "#000",
    lg_menu_filter_bg: "transparent",
    lg_menu_filter_fg: "#fff",
});

export interface ContextMenuRoot extends HTMLDivElement {
    closing_timer?: number;
    close: () => void;
}

export interface IContextMenuItem {
    content: string;
    value?: any;
    callback?: ContextMenuEventListener;
    /** Used as innerHTML for extra child element */
    title?: string;
    disabled?: boolean;
    has_submenu?: boolean;
    slot?: SlotInPosition;
    submenu?: {
        options: ContextMenuItem[];
    } & IContextMenuOptions;
    className?: string;
}

export interface IContextMenuOptions {
    callback?: ContextMenuEventListener;
    ignore_item_callbacks?: Boolean;
    event?: MouseEventExt | CustomEventExt;
    parentMenu?: ContextMenu;
    autoopen?: boolean;
    title?: string;
    extra?: any;
    node?: LGraphNode;
    className?: string;
    scroll_speed?: number;
    left?: number;
    top?: number;
    scale?: number;
    allow_html?: boolean;
}

export enum ContextMenuSpecialItem {
    SEPARATOR,
}
export type ContextMenuExtraArg = LGraphNode | any;
export type ContextMenuItem =
    | IContextMenuItem
    | string
    | ContextMenuSpecialItem;
export type ContextMenuEventListener = (
    value: IContextMenuItem,
    options: IContextMenuOptions,
    event: MouseEventExt,
    parentMenu?: ContextMenu,
    extra?: ContextMenuExtraArg,
) => boolean | void;

export default class ContextMenu {
    root: ContextMenuRoot;
    values: ContextMenuItem[];

    static trigger(
        element: HTMLElement,
        event_name: string,
        params: any,
        origin?: any,
    ): Event {
        var evt = document.createEvent("CustomEvent");
        evt.initCustomEvent(event_name, true, true, params); //canBubble, cancelable, detail
        (evt as any).target = origin;
        if (element.dispatchEvent) {
            element.dispatchEvent(evt);
            // } else if (element.__events) {
            //     element.__events.dispatchEvent(evt);
        }
        //else nothing seems binded here so nothing to do
        return evt;
    }
    static isCursorOverElement(
        event: MouseEventExt,
        element: HTMLElement,
    ): boolean {
        var left = event.clientX;
        var top = event.clientY;
        var rect = element.getBoundingClientRect();
        if (!rect) {
            return false;
        }
        if (
            top > rect.top &&
            top < rect.top + rect.height &&
            left > rect.left &&
            left < rect.left + rect.width
        ) {
            return true;
        }
        return false;
    }

    static closeAllContextMenus(refWindow: Window): void {
        refWindow = refWindow || window;

        var elements =
            refWindow.document.querySelectorAll<ContextMenuRoot>(
                ".litecontextmenu",
            );
        if (!elements.length) {
            return;
        }

        var result = Array.from(elements);

        for (const ctxMenu of result) {
            ctxMenu.close();
        }
    }

    constructor(
        values: ContextMenuItem[],
        options: IContextMenuOptions = {},
        window?: Window,
    ) {
        this.options = options;
        var that = this;

        //to link a menu with its parent
        if (options.parentMenu) {
            if (options.parentMenu.constructor !== this.constructor) {
                console.error(
                    "parentMenu must be of class ContextMenu, ignoring it",
                );
                options.parentMenu = null;
            } else {
                this.parentMenu = options.parentMenu;
                this.parentMenu.lock = true;
                this.parentMenu.current_submenu = this;
            }
        }

        var eventClass = null;
        if (options.event)
            //use strings because comparing classes between windows doesnt work
            eventClass = options.event.constructor.name;
        if (
            eventClass !== "MouseEvent" &&
            eventClass !== "CustomEvent" &&
            eventClass !== "PointerEvent"
        ) {
            console.error(
                "Event passed to ContextMenu is not of type MouseEvent or CustomEvent. Ignoring it. (" +
                    eventClass +
                    ")",
            );
            options.event = null;
        }

        var root = document.createElement("div") as ContextMenuRoot;
        root.className = "litegraph litecontextmenu litemenubar-panel";
        if (options.className) {
            root.className += " " + options.className;
        }
        // root.style.minWidth = "100px";
        // root.style.minHeight = "100px";
        root.style.pointerEvents = "none";
        setTimeout(function () {
            root.style.pointerEvents = "auto";
        }, 100); //delay so the mouse up event is not caught by this element

        //this prevents the default context browser menu to open in case this menu was created when pressing right button
        LiteGraph.pointerListenerAdd(
            root,
            "up",
            function (e) {
                //console.log("pointerevents: ContextMenu up root prevent");
                e.preventDefault();
                return true;
            },
            true,
        );
        root.addEventListener(
            "contextmenu",
            function (e) {
                if (e.button != 2) {
                    //right button
                    return false;
                }
                e.preventDefault();
                return false;
            },
            true,
        );

        root.close = () => {
            root.parentNode.removeChild(root);
        };

        LiteGraph.pointerListenerAdd(
            root,
            "down",
            function (e: MouseEvent) {
                //console.log("pointerevents: ContextMenu down");
                if (e.button == 2) {
                    that.close();
                    e.preventDefault();
                    return true;
                }
            },
            true,
        );

        function on_mouse_wheel(e) {
            var pos = parseInt(root.style.top);
            root.style.top =
                (pos + e.deltaY * options.scroll_speed).toFixed() + "px";
            e.preventDefault();
            return true;
        }

        if (!options.scroll_speed) {
            options.scroll_speed = 0.1;
        }

        root.addEventListener("wheel", on_mouse_wheel, true);
        root.addEventListener("mousewheel", on_mouse_wheel, {
            capture: true,
            passive: true,
        });

        this.root = root;

        //title
        if (options.title) {
            var element = document.createElement("div");
            element.className = "litemenu-title";
            element.innerHTML = options.title;
            root.appendChild(element);
        }

        this.values = [];

        //entries
        for (let i = 0; i < values.length; i++) {
            let value = values[i];
            let name: string = "";
            if (value === ContextMenuSpecialItem.SEPARATOR) name = "";
            else if (typeof value === "string") name = value;
            else name = value.content;
            this.addItem(name, value, options);
        }

        //close on leave? touch enabled devices won't work TODO use a global device detector and condition on that
        /*LiteGraph.pointerListenerAdd(root,"leave", function(e) {
          console.log("pointerevents: ContextMenu leave");
          if (that.lock) {
          return;
          }
          if (root.closing_timer) {
          clearTimeout(root.closing_timer);
          }
          root.closing_timer = setTimeout(that.close.bind(that, e), 500);
          //that.close(e);
          });*/

        LiteGraph.pointerListenerAdd(root, "enter", function (e) {
            //console.log("pointerevents: ContextMenu enter");
            if (root.closing_timer) {
                clearTimeout(root.closing_timer);
            }
        });

        //insert before checking position
        var root_document = document;
        if (options.event && options.event.target instanceof Node) {
            root_document = options.event.target.ownerDocument;
        }

        if (!root_document) {
            root_document = document;
        }

        if (root_document.fullscreenElement)
            root_document.fullscreenElement.appendChild(root);
        else root_document.body.appendChild(root);

        //compute best position
        var left = options.left || 0;
        var top = options.top || 0;
        if (options.event) {
            left = (options.event as any).clientX - 10;
            top = (options.event as any).clientY - 10;
            if (options.title) {
                top -= 20;
            }

            if (options.parentMenu) {
                var rect = options.parentMenu.root.getBoundingClientRect();
                left = rect.left + rect.width;
            }

            var body_rect = document.body.getBoundingClientRect();
            var root_rect = root.getBoundingClientRect();
            if (body_rect.height == 0)
                console.error(
                    "document.body height is 0. That is dangerous, set html,body { height: 100%; }",
                );

            if (
                body_rect.width &&
                left > body_rect.width - root_rect.width - 10
            ) {
                left = body_rect.width - root_rect.width - 10;
            }
            if (
                body_rect.height &&
                top > body_rect.height - root_rect.height - 10
            ) {
                top = body_rect.height - root_rect.height - 10;
            }
        }

        root.style.left = left + "px";
        root.style.top = top + "px";

        if (options.scale) {
            root.style.transform = "scale(" + options.scale + ")";
        }

        this.setupComboFilter();
    }

    options: IContextMenuOptions;
    parentMenu?: ContextMenu;
    lock: boolean;
    current_submenu?: ContextMenu;
    addItem(
        name: string,
        value: ContextMenuItem,
        options: IContextMenuOptions = {},
    ): HTMLDivElement {
        var that = this;

        var element = document.createElement("div") as HTMLDivElement;
        element.className = "litemenu-entry submenu";

        var disabled = false;

        if (typeof value === "string") value = { content: value };

        if (value === ContextMenuSpecialItem.SEPARATOR) {
            element.classList.add("separator");
            //element.innerHTML = "<hr/>"
            //continue;
        } else {
            element.innerHTML = value.title ? value.title : name;
            // element.value = value;

            if (value.disabled) {
                disabled = true;
                element.classList.add("disabled");
            }
            if (value.submenu || value.has_submenu) {
                element.classList.add("has_submenu");
            }

            if (typeof value == "function") {
                element.dataset["value"] = name;
                // element.onclick_callback = value;
            } else {
                element.dataset["value"] = "" + this.values.length;
            }

            if (value.className) {
                element.className += " " + value.className;
            }
        }

        this.values.push(value);

        this.root.appendChild(element);
        if (!disabled) {
            element.addEventListener("click", inner_onclick);
        }
        if (options.autoopen) {
            LiteGraph.pointerListenerAdd(element, "enter", inner_over);
        }

        let ctxMenu = this;

        function inner_over(e: MouseEvent) {
            var value = this.value;
            if (!value || !value.has_submenu) {
                return;
            }
            //if it is a submenu, autoopen like the item was clicked
            inner_onclick.call(this, e);
        }

        //menu option clicked
        function inner_onclick(_e: MouseEvent) {
            let index = parseInt(this.dataset["value"]);
            var value = ctxMenu.values[index];
            if (LiteGraph.debug)
                console.debug("ContextMenu inner_onclick", index, value);

            const graphCanvas = LGraphCanvas.active_canvas;
            if (!graphCanvas) return;
            const e = graphCanvas.adjustMouseEvent(_e);

            var close_parent = true;

            if (that.current_submenu) {
                that.current_submenu.close(e);
            }

            //global callback
            if (options.callback) {
                var r = options.callback.call(
                    this,
                    value,
                    options,
                    e,
                    that,
                    options.node,
                );
                if (r === true) {
                    close_parent = false;
                }
            }

            //special cases
            if (value && typeof value === "object") {
                if (
                    value.callback &&
                    !options.ignore_item_callbacks &&
                    value.disabled !== true
                ) {
                    //item callback
                    var r = value.callback.call(
                        this,
                        value,
                        options,
                        e,
                        that,
                        options.extra,
                    );
                    if (r === true) {
                        close_parent = false;
                    }
                }
                if (value.submenu) {
                    if (!value.submenu.options) {
                        throw "ContextMenu submenu needs options";
                    }
                    var submenu = new ContextMenu(value.submenu.options, {
                        callback: value.submenu.callback,
                        event: e,
                        parentMenu: that,
                        ignore_item_callbacks:
                            value.submenu.ignore_item_callbacks,
                        title: value.submenu.title,
                        extra: value.submenu.extra,
                        autoopen: options.autoopen,
                    });
                    close_parent = false;
                }
            }

            if (close_parent && !that.lock) {
                that.close();
            }
        }

        return element;
    }

    close(e?: MouseEventExt, ignore_parent_menu?: boolean): void {
        if (this.root.parentNode) {
            this.root.parentNode.removeChild(this.root);
        }
        if (this.parentMenu && !ignore_parent_menu) {
            this.parentMenu.lock = false;
            this.parentMenu.current_submenu = null;
            if (e === undefined) {
                this.parentMenu.close();
            } else if (
                e &&
                !ContextMenu.isCursorOverElement(e, this.parentMenu.root)
            ) {
                ContextMenu.trigger(
                    this.parentMenu.root,
                    LiteGraph.pointerevents_method + "leave",
                    e,
                );
            }
        }
        if (this.current_submenu) {
            this.current_submenu.close(e, true);
        }

        if (this.root.closing_timer) {
            clearTimeout(this.root.closing_timer);
        }

        // TODO implement : LiteGraph.contextMenuClosed(); :: keep track of opened / closed / current ContextMenu
        // on key press, allow filtering/selecting the context menu elements
    }

    getTopMenu(): ContextMenu {
        if (this.options.parentMenu) {
            return this.options.parentMenu.getTopMenu();
        }
        return this;
    }

    getFirstEvent(): EventExt {
        if (this.options.parentMenu) {
            return this.options.parentMenu.getFirstEvent();
        }
        return this.options.event;
    }

    protected setupComboFilter() {
        const menuThis = this;
        const { values, options, root: $root } = this;
        const is_long_combo =
            this.options.className?.includes("combo-menu") &&
            this.values.length > 10;

        if (!is_long_combo) return;

        const $filter = document.createElement("input");
        $filter.className = "litemenu-filter";
        $filter.type = "text";
        $filter.placeholder = "Filter... (↑↓ to navigate)";
        $filter.style.width = "calc(100% - 10px)";
        $filter.style.height = "20px";
        $filter.style.margin = "0 0 5px 5px";
        $filter.style.outline = "none";
        $filter.style.border = "none";
        $filter.style.boxSizing = "border-box";
        $filter.style.backgroundColor = contextmenu_vars.vars.lg_menu_filter_bg;
        $filter.style.color = contextmenu_vars.vars.lg_menu_filter_fg;

        $root.prepend($filter);
        $filter.focus();

        const $items = Array.from(
            $root.querySelectorAll(".litemenu-entry"),
        ) as HTMLDivElement[];
        let displayedItems = [...$items];

        // We must request an animation frame for the current node of the active canvas to update.
        requestAnimationFrame(filter_update);

        function filter_update() {
            const currentNode = LGraphCanvas.active_canvas.current_node;
            const clickedComboValue = currentNode.widgets
                ?.filter(
                    (w) =>
                        w.type === "combo" &&
                        w.options.values.length === values.length,
                )
                .find((w) =>
                    w.options.values.every((v, i) => v === values[i]),
                )?.value;

            let selectedIndex = clickedComboValue
                ? values.findIndex((v) => v === clickedComboValue)
                : 0;
            if (selectedIndex < 0) {
                selectedIndex = 0;
            }
            let selectedItem = displayedItems[selectedIndex];
            updateSelected();

            // Apply highlighting to the selected item
            function updateSelected() {
                selectedItem?.style.setProperty("background-color", "");
                selectedItem?.style.setProperty("color", "");

                selectedItem = displayedItems[selectedIndex];

                selectedItem?.style.setProperty(
                    "background-color",
                    contextmenu_vars.vars.lg_combo_menu_selected_bg,
                    "important",
                );
                selectedItem?.style.setProperty(
                    "color",
                    contextmenu_vars.vars.lg_combo_menu_selected_fg,
                    "important",
                );
            }

            const updateListPosition = () => {
                const rect = $root.getBoundingClientRect();

                // If the top is off-screen then shift the element with scaling applied
                if (rect.top < 0) {
                    const scale =
                        1 -
                        $root.getBoundingClientRect().height /
                            $root.clientHeight;
                    const shift = ($root.clientHeight * scale) / 2;
                    $root.style.top = -shift + "px";
                }
            };

            // Arrow up/down to select items
            $filter.addEventListener("keydown", (event) => {
                const itemCount = displayedItems.length;
                switch (event.key) {
                    case "ArrowUp":
                        event.preventDefault();
                        if (selectedIndex === 0) {
                            selectedIndex = itemCount - 1;
                        } else {
                            selectedIndex--;
                        }
                        updateSelected();
                        break;
                    case "ArrowRight":
                        event.preventDefault();
                        selectedIndex = itemCount - 1;
                        updateSelected();
                        break;
                    case "ArrowDown":
                        event.preventDefault();
                        if (selectedIndex === itemCount - 1) {
                            selectedIndex = 0;
                        } else {
                            selectedIndex++;
                        }
                        updateSelected();
                        break;
                    case "ArrowLeft":
                        event.preventDefault();
                        selectedIndex = 0;
                        updateSelected();
                        break;
                    case "Enter":
                        selectedItem?.click();
                        break;
                    case "Escape":
                        menuThis.close();
                        break;
                }
            });

            $filter.addEventListener("input", () => {
                // Hide all items that don't match our filter
                const term = $filter.value.toLocaleLowerCase();
                // When filtering, recompute which items are visible for arrow up/down and maintain selection.
                displayedItems = $items.filter((item) => {
                    const isVisible =
                        !term ||
                        item.textContent.toLocaleLowerCase().includes(term);
                    item.style.display = isVisible ? "block" : "none";
                    return isVisible;
                });

                selectedIndex = 0;
                if (displayedItems.includes(selectedItem)) {
                    selectedIndex = displayedItems.findIndex(
                        (d) => d === selectedItem,
                    );
                }

                updateSelected();

                // If we have an event then we can try and position the list under the source
                if (options.event && "clientY" in options.event) {
                    let top = options.event.clientY - 10;

                    const bodyRect = document.body.getBoundingClientRect();
                    const rootRect = $root.getBoundingClientRect();
                    if (
                        bodyRect.height &&
                        top > bodyRect.height - rootRect.height - 10
                    ) {
                        top = Math.max(
                            0,
                            bodyRect.height - rootRect.height - 10,
                        );
                    }

                    $root.style.top = top + "px";
                    updateListPosition();
                }
            });

            // next tick
            requestAnimationFrame(() => {
                $filter.focus();
                updateListPosition();
            });
        }
    }
}
