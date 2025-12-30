import ContextMenu from "./ContextMenu";
import type { MouseEventExt } from "./DragAndScale";
import { INodeInputSlot, INodeOutputSlot } from "./INodeSlot";
import LGraphCanvas, { IContextMenuTarget } from "./LGraphCanvas";
import LGraphNode from "./LGraphNode";
import LLink from "./LLink";
import LiteGraph from "./LiteGraph";
import { NodeMode, type Vector2 } from "./types";

export default class LGraphCanvas_Events {
    processMouseDown(this: LGraphCanvas, _e: MouseEvent): boolean | undefined {
        if (this.set_canvas_dirty_on_mouse_event) this.dirty_canvas = true;

        if (!this.graph) {
            return;
        }

        let e = _e as MouseEventExt;

        this.adjustMouseEvent(e);

        let ref_window = this.getCanvasWindow();
        let document = ref_window.document;
        LGraphCanvas.active_canvas = this;

        let x = e.clientX;
        let y = e.clientY;
        //console.log(y,this.viewport);
        //console.log("pointerevents: processMouseDown pointerId:"+e.pointerId+" which:"+e.which+" isPrimary:"+e.isPrimary+" :: x y "+x+" "+y);

        this.ds.viewport = this.viewport;
        let is_inside =
            !this.viewport ||
            (this.viewport &&
                x >= this.viewport[0] &&
                x < this.viewport[0] + this.viewport[2] &&
                y >= this.viewport[1] &&
                y < this.viewport[1] + this.viewport[3]);

        //move mouse move event to the window in case it drags outside of the canvas
        if (!this.skip_events) {
            LiteGraph.pointerListenerRemove(
                this.canvas,
                "move",
                this._mousemove_callback,
            );
            if (this._mousemove_callback)
                LiteGraph.pointerListenerAdd(
                    ref_window.document,
                    "move",
                    this._mousemove_callback,
                    true,
                ); //catch for the entire window
            if (this._mouseup_callback)
                LiteGraph.pointerListenerAdd(
                    ref_window.document,
                    "up",
                    this._mouseup_callback,
                    true,
                );
        }

        if (!is_inside) {
            return;
        }

        let node = this.graph.getNodeOnPos(
            e.canvasX,
            e.canvasY,
            this.visible_nodes,
            5,
        );
        let skip_dragging = false;
        let skip_action = false;
        let now = LiteGraph.getTime();
        let is_primary = !(e instanceof PointerEvent) || !e.isPrimary;
        let is_double_click = now - this.last_mouseclick < 300 && is_primary;
        this.mouse[0] = e.clientX;
        this.mouse[1] = e.clientY;
        this.offset_mouse[0] = e.offsetX;
        this.offset_mouse[1] = e.offsetY;
        this.graph_mouse[0] = e.canvasX;
        this.graph_mouse[1] = e.canvasY;
        this.last_click_position = [this.mouse[0], this.mouse[1]];
        this.last_click_position_offset = [
            this.offset_mouse[0],
            this.offset_mouse[1],
        ];

        if (this.pointer_is_down && is_primary) {
            this.pointer_is_double = true;
            //console.log("pointerevents: pointer_is_double start");
        } else {
            this.pointer_is_double = false;
        }
        this.pointer_is_down = true;

        this.canvas.focus();

        ContextMenu.closeAllContextMenus(ref_window);

        if (this.search_box) {
            this.search_box.close();
        }

        if (this.onMouse) {
            if (this.onMouse(e) === true) return;
        }
        let block_drag_node = false;

        //left button mouse / single finger
        if (e.which == 1 && !this.pointer_is_double) {
            if (e.ctrlKey && this.allow_interaction && !this.read_only) {
                this.dragging_rectangle = new Float32Array(4);
                this.dragging_rectangle[0] = e.canvasX;
                this.dragging_rectangle[1] = e.canvasY;
                this.dragging_rectangle[2] = 1;
                this.dragging_rectangle[3] = 1;
                skip_action = true;
            }

            // clone node ALT dragging
            if (
                LiteGraph.alt_drag_do_clone_nodes &&
                e.altKey &&
                node &&
                this.allow_interaction &&
                !skip_action &&
                !this.read_only
            ) {
                let cloned = node.clone();
                if (cloned) {
                    cloned.pos[0] += 5;
                    cloned.pos[1] += 5;
                    this.graph.add(cloned, { doCalcSize: false });
                    node = cloned;
                    skip_action = true;
                    if (!block_drag_node) {
                        if (this.allow_dragnodes) {
                            this.graph.beforeChange();
                            this.node_dragged = node;
                        }
                        if (!this.selected_nodes[node.id]) {
                            this.processNodeSelected(node, e);
                        }
                    }
                }
            }

            let clicking_canvas_bg = false;

            //when clicked on top of a node
            //and it is not interactive
            if (
                node &&
                this.allow_interaction &&
                !skip_action &&
                !this.read_only
            ) {
                if (!this.live_mode && !node.flags.pinned) {
                    this.bringToFront(node);
                } //if it wasn't selected?

                //not dragging mouse to connect two slots
                if (
                    !this.connecting_node &&
                    !node.flags.collapsed &&
                    !this.live_mode
                ) {
                    //Search for corner for resize
                    if (
                        !skip_action &&
                        node.resizable !== false &&
                        LiteGraph.isInsideRectangle(
                            e.canvasX,
                            e.canvasY,
                            node.pos[0] + node.size[0] - 15,
                            node.pos[1] + node.size[1] - 15,
                            20,
                            20,
                        )
                    ) {
                        this.graph.beforeChange();
                        this.resizing_node = node;
                        this.canvas.style.cursor = "se-resize";
                        skip_action = true;
                    } else {
                        //search for outputs
                        if (node.outputs) {
                            for (
                                let i = 0, l = node.outputs.length;
                                i < l;
                                ++i
                            ) {
                                let output = node.outputs[i];
                                let link_pos = node.getConnectionPos(false, i);
                                if (
                                    LiteGraph.isInsideRectangle(
                                        e.canvasX,
                                        e.canvasY,
                                        link_pos[0] - 15,
                                        link_pos[1] - 10,
                                        30,
                                        20,
                                    )
                                ) {
                                    this.connecting_node = node;
                                    this.connecting_output = output;
                                    this.connecting_output.slot_index = i;
                                    this.connecting_pos = node.getConnectionPos(
                                        false,
                                        i,
                                    );
                                    this.connecting_slot = i;

                                    if (
                                        LiteGraph.shift_click_do_break_link_from
                                    ) {
                                        if (e.shiftKey) {
                                            node.disconnectOutput(i);
                                        }
                                    }

                                    if (is_double_click) {
                                        if (node.onOutputDblClick) {
                                            node.onOutputDblClick(i, e);
                                        }
                                    } else {
                                        if (node.onOutputClick) {
                                            node.onOutputClick(i, e);
                                        }
                                    }

                                    skip_action = true;
                                    break;
                                }
                            }
                        }

                        //search for inputs
                        if (node.inputs) {
                            for (
                                let i = 0, l = node.inputs.length;
                                i < l;
                                ++i
                            ) {
                                let input = node.inputs[i];
                                let link_pos = node.getConnectionPos(true, i);
                                if (
                                    LiteGraph.isInsideRectangle(
                                        e.canvasX,
                                        e.canvasY,
                                        link_pos[0] - 15,
                                        link_pos[1] - 10,
                                        30,
                                        20,
                                    )
                                ) {
                                    if (is_double_click) {
                                        if (node.onInputDblClick) {
                                            node.onInputDblClick(i, e);
                                        }
                                    } else {
                                        if (node.onInputClick) {
                                            node.onInputClick(i, e);
                                        }
                                    }

                                    if (input.link !== null) {
                                        let link_info =
                                            this.graph.links[input.link]; //before disconnecting
                                        if (LiteGraph.click_do_break_link_to) {
                                            node.disconnectInput(i);
                                            this.dirty_bgcanvas = true;
                                            skip_action = true;
                                        } else {
                                            // do same action as has not node ?
                                        }

                                        if (
                                            this.allow_reconnect_links ||
                                            //this.move_destination_link_without_shift ||
                                            e.shiftKey
                                        ) {
                                            if (
                                                !LiteGraph.click_do_break_link_to
                                            ) {
                                                node.disconnectInput(i);
                                            }
                                            this.connecting_node = (
                                                this.graph as any
                                            )._nodes_by_id[link_info.origin_id];
                                            this.connecting_slot =
                                                link_info.origin_slot;
                                            if (this.connecting_node) {
                                                this.connecting_output =
                                                    this.connecting_node.outputs[
                                                        this.connecting_slot
                                                    ];
                                                this.connecting_pos =
                                                    this.connecting_node.getConnectionPos(
                                                        false,
                                                        this.connecting_slot,
                                                    );
                                            }

                                            this.dirty_bgcanvas = true;
                                            skip_action = true;
                                        }
                                    } else {
                                        // has not node
                                    }

                                    if (!skip_action) {
                                        // connect from in to out, from to to from
                                        this.connecting_node = node;
                                        this.connecting_input = input;
                                        this.connecting_input.slot_index = i;
                                        this.connecting_pos =
                                            node.getConnectionPos(true, i);
                                        this.connecting_slot = i;

                                        this.dirty_bgcanvas = true;
                                        skip_action = true;
                                    }
                                }
                            }
                        }
                    } //not resizing
                }

                //it wasn't clicked on the links boxes
                if (!skip_action) {
                    block_drag_node = false;
                    if (node?.flags?.pinned) {
                        block_drag_node = true;
                    }
                    let pos: Vector2 = [
                        e.canvasX - node.pos[0],
                        e.canvasY - node.pos[1],
                    ];

                    //widgets
                    const skip_widget_action =
                        node.mode === NodeMode.NEVER ||
                        node.mode === NodeMode.BY_PASS;
                    if (!skip_widget_action) {
                        let widget = this.processNodeWidgets(
                            node,
                            this.graph_mouse,
                            e,
                        );
                        if (widget) {
                            block_drag_node = true;
                            this.node_widget = [node, widget];
                        }
                    }

                    //double clicking
                    if (is_double_click && this.selected_nodes[node.id]) {
                        //double click node
                        if (node.onDblClick) {
                            node.onDblClick(e, pos, this);
                        }
                        this.processNodeDblClicked(node);
                        block_drag_node = true;
                    }

                    //if do not capture mouse
                    if (node.onMouseDown && node.onMouseDown(e, pos, this)) {
                        block_drag_node = true;
                    } else {
                        //open subgraph button
                        if (node.subgraph && !node.skip_subgraph_button) {
                            if (
                                !node.flags.collapsed &&
                                pos[0] >
                                    node.size[0] -
                                        LiteGraph.NODE_TITLE_HEIGHT &&
                                pos[1] < 0
                            ) {
                                setTimeout(() => {
                                    node?.subgraph &&
                                        this.openSubgraph(node.subgraph);
                                }, 10);
                            }
                        }

                        if (this.live_mode) {
                            clicking_canvas_bg = true;
                            block_drag_node = true;
                        }
                    }

                    if (!block_drag_node) {
                        if (this.allow_dragnodes) {
                            this.graph.beforeChange();
                            this.node_dragged = node;
                        }
                        if (!this.selected_nodes[node.id]) {
                            this.processNodeSelected(node, e);
                        }
                    }

                    this.dirty_canvas = true;
                }
            } //clicked outside of nodes
            else {
                if (!skip_action) {
                    // Allow traversing subgraphs even if locked
                    let clickedSubgraphButton = false;
                    if (node && node.subgraph && !node.skip_subgraph_button) {
                        let pos: Vector2 = [
                            e.canvasX - node.pos[0],
                            e.canvasY - node.pos[1],
                        ];
                        if (
                            !node.flags.collapsed &&
                            pos[0] >
                                node.size[0] - LiteGraph.NODE_TITLE_HEIGHT &&
                            pos[1] < 0
                        ) {
                            clickedSubgraphButton = true;
                            setTimeout(() => {
                                node?.subgraph &&
                                    this.openSubgraph(node.subgraph);
                            }, 10);
                        }
                    }
                    if (!clickedSubgraphButton) {
                        //search for link connector
                        if (this.allow_interaction && !this.read_only) {
                            const link = this.findLinkCenterAtPos(
                                e.canvasX,
                                e.canvasY,
                            );
                            if (link != null) {
                                this.showLinkMenu(link, e);
                                this.over_link_center = null; //clear tooltip
                            }
                        }

                        this.selected_group = this.graph.getGroupOnPos(
                            e.canvasX,
                            e.canvasY,
                        );
                        this.selected_group_resizing = false;
                        if (
                            this.selected_group &&
                            !this.read_only &&
                            this.allow_interaction
                        ) {
                            if (e.ctrlKey) {
                                this.dragging_rectangle = null;
                            }

                            let dist = LiteGraph.distance(
                                [e.canvasX, e.canvasY],
                                [
                                    this.selected_group.pos[0] +
                                        this.selected_group.size[0],
                                    this.selected_group.pos[1] +
                                        this.selected_group.size[1],
                                ],
                            );
                            if (dist * this.ds.scale < 10) {
                                this.selected_group_resizing = true;
                            } else {
                                this.selected_group.recomputeInsideNodes();
                            }
                        }

                        if (
                            is_double_click &&
                            !this.read_only &&
                            this.allow_searchbox &&
                            this.allow_interaction
                        ) {
                            this.showSearchBox(e);
                            e.preventDefault();
                            e.stopPropagation();
                        }

                        clicking_canvas_bg = true;
                    }
                }
            }

            if (!skip_action && clicking_canvas_bg && this.allow_dragcanvas) {
                //console.log("pointerevents: dragging_canvas start");
                this.dragging_canvas = true;
            }
        } else if (e.which == 2) {
            //middle button

            if (LiteGraph.middle_click_slot_add_default_node) {
                if (
                    node &&
                    this.allow_interaction &&
                    !skip_action &&
                    !this.read_only
                ) {
                    //not dragging mouse to connect two slots
                    if (
                        !this.connecting_node &&
                        !node.flags.collapsed &&
                        !this.live_mode
                    ) {
                        let mClikSlot: INodeOutputSlot | INodeInputSlot | null =
                            null;
                        let mClikSlot_index: number | null = null;
                        let mClikSlot_isOut: boolean | null = null;

                        //search for outputs
                        if (node.outputs) {
                            for (
                                let i = 0, l = node.outputs.length;
                                i < l;
                                ++i
                            ) {
                                let output = node.outputs[i];
                                let link_pos = node.getConnectionPos(false, i);
                                if (
                                    LiteGraph.isInsideRectangle(
                                        e.canvasX,
                                        e.canvasY,
                                        link_pos[0] - 15,
                                        link_pos[1] - 10,
                                        30,
                                        20,
                                    )
                                ) {
                                    mClikSlot = output;
                                    mClikSlot_index = i;
                                    mClikSlot_isOut = true;
                                    break;
                                }
                            }
                        }

                        //search for inputs
                        if (node.inputs) {
                            for (
                                let i = 0, l = node.inputs.length;
                                i < l;
                                ++i
                            ) {
                                let input = node.inputs[i];
                                let link_pos = node.getConnectionPos(true, i);
                                if (
                                    LiteGraph.isInsideRectangle(
                                        e.canvasX,
                                        e.canvasY,
                                        link_pos[0] - 15,
                                        link_pos[1] - 10,
                                        30,
                                        20,
                                    )
                                ) {
                                    mClikSlot = input;
                                    mClikSlot_index = i;
                                    mClikSlot_isOut = false;
                                    break;
                                }
                            }
                        }
                        //console.log("middleClickSlots? "+mClikSlot+" & "+(mClikSlot_index!==false));
                        if (mClikSlot && mClikSlot_index) {
                            let alphaPosY =
                                0.5 -
                                (mClikSlot_index + 1) /
                                    (mClikSlot_isOut
                                        ? node.outputs.length
                                        : node.inputs.length);
                            let node_bounding = node.getBounding();
                            // estimate a position: this is a bad semi-bad-working mess .. REFACTOR with a correct autoplacement that knows about the others slots and nodes
                            let posRef: Vector2 = [
                                !mClikSlot_isOut
                                    ? node_bounding[0]
                                    : node_bounding[0] + node_bounding[2], // + node_bounding[0]/this.canvas.width*150
                                e.canvasY - 80, // + node_bounding[0]/this.canvas.width*66 // vertical "derive"
                            ];
                            let nodeCreated = this.createDefaultNodeForSlot(
                                "AUTO",
                                {
                                    nodeFrom: !mClikSlot_isOut
                                        ? undefined
                                        : node,
                                    slotFrom: !mClikSlot_isOut
                                        ? undefined
                                        : mClikSlot_index,
                                    nodeTo: !mClikSlot_isOut ? node : undefined,
                                    slotTo: !mClikSlot_isOut
                                        ? mClikSlot_index
                                        : undefined,
                                    position: posRef, //,e: e
                                    posAdd: [
                                        !mClikSlot_isOut ? -30 : 30,
                                        -alphaPosY * 130,
                                    ], //-alphaPosY*30]
                                    posSizeFix: [!mClikSlot_isOut ? -1 : 0, 0], //-alphaPosY*2*/
                                },
                            );
                        }
                    }
                }
            }
            // } else if (e.which == 3 || this.pointer_is_double) {
        } else if (e.which == 3) {
            //right button
            if (this.allow_interaction && !skip_action && !this.read_only) {
                let target: IContextMenuTarget | null = null;

                // is it hover a node ?
                if (node) {
                    target = { type: "node", item: node };
                    if (
                        Object.keys(this.selected_nodes).length &&
                        (this.selected_nodes[node.id] ||
                            e.shiftKey ||
                            e.ctrlKey ||
                            e.metaKey)
                    ) {
                        // is multiselected or using shift to include the now node
                        if (!this.selected_nodes[node.id])
                            this.selectNodes([node], true); // add this if not present
                    } else {
                        // update selection
                        this.selectNodes([node]);
                    }
                } else {
                    const link = this.findLinkCenterAtPos(e.canvasX, e.canvasY);
                    if (link != null) {
                        this.over_link_center = null;
                        this.dirty_canvas = true;
                        target = { type: "link", item: link };
                    }
                }

                // show menu on this node
                this.processContextMenu(target, e);
            }
        }

        this.selected_group_moving = false;

        if (this.selected_group && !this.selected_group_resizing) {
            let font_size =
                this.selected_group.fontSize ||
                LiteGraph.DEFAULT_GROUP_FONT_SIZE;
            let height = font_size * 1.4;

            // Move group by header
            if (
                LiteGraph.isInsideRectangle(
                    e.canvasX,
                    e.canvasY,
                    this.selected_group.pos[0],
                    this.selected_group.pos[1],
                    this.selected_group.size[0],
                    height,
                )
            ) {
                this.selected_group_moving = true;
            }
        }

        //TODO
        //if(this.node_selected != prev_selected)
        //	this.onNodeSelectionChange(this.node_selected);

        this.last_mouse[0] = e.clientX;
        this.last_mouse[1] = e.clientY;
        this.last_mouseclick = LiteGraph.getTime();
        this.last_mouse_dragging = true;

        /*
          if( (this.dirty_canvas || this.dirty_bgcanvas) && this.rendering_timer_id == null)
          this.draw();
        */

        this.graph.change();

        //this is to ensure to defocus(blur) if a text input element is on focus
        if (
            !ref_window.document.activeElement ||
            (ref_window.document.activeElement.nodeName.toLowerCase() !=
                "input" &&
                ref_window.document.activeElement.nodeName.toLowerCase() !=
                    "textarea")
        ) {
            e.preventDefault();
        }
        e.stopPropagation();

        if (this.onMouseDown) {
            this.onMouseDown(e);
        }
        this.events.emit("mouseDown", e);

        return false;
    }

    processMouseMove(this: LGraphCanvas, _e: MouseEvent): boolean | undefined {
        let e = _e as MouseEventExt;

        if (this.autoresize) {
            this.resize();
        }

        if (this.set_canvas_dirty_on_mouse_event) this.dirty_canvas = true;

        if (!this.graph) {
            return;
        }

        LGraphCanvas.active_canvas = this;
        this.adjustMouseEvent(e);
        let mouse: Vector2 = [e.clientX, e.clientY];
        this.mouse[0] = mouse[0];
        this.mouse[1] = mouse[1];
        let delta = [
            mouse[0] - this.last_mouse[0],
            mouse[1] - this.last_mouse[1],
        ];
        this.last_mouse = mouse;
        this.offset_mouse[0] = e.offsetX;
        this.offset_mouse[1] = e.offsetY;
        this.graph_mouse[0] = e.canvasX;
        this.graph_mouse[1] = e.canvasY;

        //console.log("pointerevents: processMouseMove "+e.pointerId+" "+e.isPrimary);

        if (this.block_click) {
            //console.log("pointerevents: processMouseMove block_click");
            e.preventDefault();
            return false;
        }

        e.dragging = this.last_mouse_dragging;

        if (this.node_widget) {
            this.processNodeWidgets(
                this.node_widget[0],
                this.graph_mouse,
                e,
                this.node_widget[1],
            );
            this.dirty_canvas = true;
        }

        const orig_selected_group = this.selected_group;

        if (
            this.selected_group &&
            !this.selected_group_resizing &&
            !this.selected_group_moving
        ) {
            this.selected_group = null;
        }

        if (this.dragging_rectangle) {
            this.dragging_rectangle[2] = e.canvasX - this.dragging_rectangle[0];
            this.dragging_rectangle[3] = e.canvasY - this.dragging_rectangle[1];
            this.dirty_canvas = true;
        } else if (
            this.selected_group &&
            !this.read_only &&
            this.allow_interaction
        ) {
            //moving/resizing a group
            if (this.selected_group_resizing) {
                this.selected_group.size = [
                    e.canvasX - this.selected_group.pos[0],
                    e.canvasY - this.selected_group.pos[1],
                ];
            } else {
                let deltax = delta[0] / this.ds.scale;
                let deltay = delta[1] / this.ds.scale;
                this.selected_group.move(deltax, deltay, e.ctrlKey);
                if ((this.selected_group as any)._nodes.length) {
                    this.dirty_canvas = true;
                }
            }
            this.dirty_bgcanvas = true;
        } else if (this.dragging_canvas) {
            ////console.log("pointerevents: processMouseMove is dragging_canvas");
            this.ds.offset[0] += delta[0] / this.ds.scale;
            this.ds.offset[1] += delta[1] / this.ds.scale;
            this.dirty_canvas = true;
            this.dirty_bgcanvas = true;
        } else {
            const can_interact = this.allow_interaction && !this.read_only;
            if (this.connecting_node) {
                this.dirty_canvas = true;
            }

            //get node over
            let node = this.graph.getNodeOnPos(
                e.canvasX,
                e.canvasY,
                this.visible_nodes,
            );

            if (can_interact) {
                //remove mouseover flag
                for (let i = 0, l = this.graph._nodes.length; i < l; ++i) {
                    let otherNode: LGraphNode = this.graph._nodes[i];
                    if (otherNode.mouseOver && node != otherNode) {
                        //mouse leave
                        otherNode.mouseOver = false;
                        if (this.node_over && this.node_over.onMouseLeave) {
                            this.node_over.onMouseLeave(
                                e,
                                [
                                    e.canvasX - this.node_over.pos[0],
                                    e.canvasY - this.node_over.pos[1],
                                ],
                                this,
                            );
                        }
                        this.node_over?.events.emit("mouseLeave", e);
                        const prev_node_over = this.node_over;
                        this.node_over = null;
                        this.dirty_canvas = true;
                        if (prev_node_over != this.node_over) {
                            this.onHoverChange?.(
                                this.node_over,
                                prev_node_over,
                            );
                            this.events.emit(
                                "hoverChange",
                                this.node_over,
                                prev_node_over,
                            );
                        }
                    }
                }
            }

            //mouse over a node
            if (node) {
                if (node.redraw_on_mouse) this.dirty_canvas = true;

                if (can_interact) {
                    //this.canvas.style.cursor = "move";
                    if (!node.mouseOver) {
                        //mouse enter
                        node.mouseOver = true;
                        const prev_node_over = this.node_over;
                        this.node_over = node;
                        this.dirty_canvas = true;
                        if (prev_node_over != this.node_over) {
                            this.onHoverChange?.(
                                this.node_over,
                                prev_node_over,
                            );
                            this.events.emit(
                                "hoverChange",
                                this.node_over,
                                prev_node_over,
                            );
                        }

                        if (node.onMouseEnter) {
                            node.onMouseEnter(
                                e,
                                [
                                    e.canvasX - node.pos[0],
                                    e.canvasY - node.pos[1],
                                ],
                                this,
                            );
                        }
                        node.events.emit("mouseEnter", e);
                    }

                    //in case the node wants to do something
                    if (node.onMouseMove) {
                        node.onMouseMove(
                            e,
                            [e.canvasX - node.pos[0], e.canvasY - node.pos[1]],
                            this,
                        );
                    }
                    node.events.emit("mouseMove", e);

                    //if dragging a link
                    if (this.connecting_node) {
                        if (this.connecting_output) {
                            let pos = this._highlight_input || [0, 0]; //to store the output of isOverNodeInput

                            //on top of input
                            if (
                                this.isOverNodeBox(node, e.canvasX, e.canvasY)
                            ) {
                                //mouse on top of the corner box, don't know what to do
                            } else {
                                //check if I have a slot below de mouse
                                let slot = this.isOverNodeInput(
                                    node,
                                    e.canvasX,
                                    e.canvasY,
                                    pos,
                                );
                                if (slot != -1 && node.inputs[slot]) {
                                    let slot_type = node.inputs[slot].type;
                                    if (
                                        LiteGraph.isValidConnection(
                                            this.connecting_output.type,
                                            slot_type,
                                        )
                                    ) {
                                        this._highlight_input = pos;
                                        this._highlight_input_slot =
                                            node.inputs[slot]; // XXX CHECK THIS
                                    }
                                } else {
                                    this._highlight_input = null;
                                    this._highlight_input_slot = null; // XXX CHECK THIS
                                }
                            }
                        } else if (this.connecting_input) {
                            let pos = this._highlight_output || [0, 0]; //to store the output of isOverNodeOutput

                            //on top of output
                            if (
                                this.isOverNodeBox(node, e.canvasX, e.canvasY)
                            ) {
                                //mouse on top of the corner box, don't know what to do
                            } else {
                                //check if I have a slot below de mouse
                                let slot = this.isOverNodeOutput(
                                    node,
                                    e.canvasX,
                                    e.canvasY,
                                    pos,
                                );
                                if (slot != -1 && node.outputs[slot]) {
                                    let slot_type = node.outputs[slot].type;
                                    if (
                                        LiteGraph.isValidConnection(
                                            this.connecting_input.type,
                                            slot_type,
                                        )
                                    ) {
                                        this._highlight_output = pos;
                                    }
                                } else {
                                    this._highlight_output = null;
                                }
                            }
                        }
                    }

                    //Search for corner
                    if (this.canvas) {
                        if (
                            LiteGraph.isInsideRectangle(
                                e.canvasX,
                                e.canvasY,
                                node.pos[0] + node.size[0] - 15,
                                node.pos[1] + node.size[1] - 15,
                                15,
                                15,
                            )
                        ) {
                            this.canvas.style.cursor = "se-resize";
                        } else {
                            this.canvas.style.cursor = "crosshair";
                        }
                    }
                }
            } else {
                //not over a node

                //search for link connector
                let over_link = this.findLinkCenterAtPos(e.canvasX, e.canvasY);
                if (over_link != this.over_link_center) {
                    this.over_link_center = over_link;
                    this.dirty_canvas = true;
                }

                if (this.canvas) {
                    this.canvas.style.cursor = "";
                }
            } //end

            if (can_interact) {
                //send event to node if capturing input (used with widgets that allow drag outside of the area of the node)
                if (
                    this.node_capturing_input &&
                    this.node_capturing_input != node
                ) {
                    this.node_capturing_input.onMouseMove?.(
                        e,
                        [
                            e.canvasX - this.node_capturing_input.pos[0],
                            e.canvasY - this.node_capturing_input.pos[1],
                        ],
                        this,
                    );
                    this.node_capturing_input.events.emit("mouseMove", e);
                }

                //node being dragged
                if (this.node_dragged && !this.live_mode) {
                    //console.log("draggin!",this.selected_nodes);
                    for (const i in this.selected_nodes) {
                        let n = this.selected_nodes[i];
                        n.pos[0] += delta[0] / this.ds.scale;
                        n.pos[1] += delta[1] / this.ds.scale;
                    }

                    this.dirty_canvas = true;
                    this.dirty_bgcanvas = true;
                }

                if (this.resizing_node && !this.live_mode) {
                    //convert mouse to node space
                    let desired_size: Vector2 = [
                        e.canvasX - this.resizing_node.pos[0],
                        e.canvasY - this.resizing_node.pos[1],
                    ];
                    let min_size = this.resizing_node.computeSize();
                    desired_size[0] = Math.max(min_size[0], desired_size[0]);
                    desired_size[1] = Math.max(min_size[1], desired_size[1]);
                    this.resizing_node.setSize(desired_size);

                    this.canvas.style.cursor = "se-resize";
                    this.dirty_canvas = true;
                    this.dirty_bgcanvas = true;
                }
            }
        }

        if (
            orig_selected_group &&
            !this.selected_group_resizing &&
            !this.selected_group_moving
        ) {
            this.selected_group = orig_selected_group;
        }

        e.preventDefault();
        return false;
    }

    processMouseUp(this: LGraphCanvas, _e: MouseEvent): boolean | undefined {
        let e = _e as MouseEventExt;

        let is_primary = !(e instanceof PointerEvent) || !e.isPrimary;

        //early exit for extra pointer
        if (!is_primary) {
            /*e.stopPropagation();
              e.preventDefault();*/
            //console.log("pointerevents: processMouseUp pointerN_stop "+e.pointerId+" "+e.isPrimary);
            return false;
        }

        //console.log("pointerevents: processMouseUp "+e.pointerId+" "+e.isPrimary+" :: "+e.clientX+" "+e.clientY);

        if (this.set_canvas_dirty_on_mouse_event) this.dirty_canvas = true;

        if (!this.graph) return;

        let window = this.getCanvasWindow();
        let document = window.document;
        LGraphCanvas.active_canvas = this;

        //restore the mousemove event back to the canvas
        if (!this.skip_events) {
            //console.log("pointerevents: processMouseUp adjustEventListener");
            LiteGraph.pointerListenerRemove(
                document,
                "move",
                this._mousemove_callback,
                true,
            );
            if (this._mousemove_callback)
                LiteGraph.pointerListenerAdd(
                    this.canvas,
                    "move",
                    this._mousemove_callback,
                    true,
                );
            LiteGraph.pointerListenerRemove(
                document,
                "up",
                this._mouseup_callback,
                true,
            );
        }

        this.adjustMouseEvent(e);
        let now = LiteGraph.getTime();
        e.click_time = now - this.last_mouseclick;
        this.last_mouse_dragging = false;
        this.last_click_position = [0, 0];

        if (this.block_click) {
            //console.log("pointerevents: processMouseUp block_clicks");
            this.block_click = false; //used to avoid sending twice a click in a immediate button
        }

        //console.log("pointerevents: processMouseUp which: "+e.which);

        if (e.button == 0) {
            if (this.node_widget) {
                this.processNodeWidgets(
                    this.node_widget[0],
                    this.graph_mouse,
                    e,
                );
            }

            //left button
            this.node_widget = null;

            if (this.selected_group) {
                let diffx =
                    this.selected_group.pos[0] -
                    Math.round(this.selected_group.pos[0]);
                let diffy =
                    this.selected_group.pos[1] -
                    Math.round(this.selected_group.pos[1]);
                this.selected_group.move(diffx, diffy, e.ctrlKey);
                this.selected_group.pos[0] = Math.round(
                    this.selected_group.pos[0],
                );
                this.selected_group.pos[1] = Math.round(
                    this.selected_group.pos[1],
                );
                if ((this.selected_group as any)._nodes.length) {
                    this.dirty_canvas = true;
                }
                this.selected_group = null;
            }
            this.selected_group_resizing = false;

            let node = this.graph.getNodeOnPos(
                e.canvasX,
                e.canvasY,
                this.visible_nodes,
            );

            if (this.dragging_rectangle) {
                if (this.graph) {
                    let nodes = this.graph._nodes;
                    let node_bounding = new Float32Array(4);

                    //compute bounding and flip if left to right
                    let w = Math.abs(this.dragging_rectangle[2]);
                    let h = Math.abs(this.dragging_rectangle[3]);
                    let startx =
                        this.dragging_rectangle[2] < 0
                            ? this.dragging_rectangle[0] - w
                            : this.dragging_rectangle[0];
                    let starty =
                        this.dragging_rectangle[3] < 0
                            ? this.dragging_rectangle[1] - h
                            : this.dragging_rectangle[1];
                    this.dragging_rectangle[0] = startx;
                    this.dragging_rectangle[1] = starty;
                    this.dragging_rectangle[2] = w;
                    this.dragging_rectangle[3] = h;

                    // test dragging rect size, if minimun simulate a click
                    if (!node || (w > 10 && h > 10)) {
                        //test against all nodes (not visible because the rectangle maybe start outside
                        let to_select: LGraphNode[] = [];
                        for (let i = 0; i < nodes.length; ++i) {
                            let nodeX = nodes[i];
                            nodeX.getBounding(node_bounding);
                            if (
                                !LiteGraph.overlapBounding(
                                    this.dragging_rectangle,
                                    node_bounding,
                                )
                            ) {
                                continue;
                            } //out of the visible area
                            to_select.push(nodeX);
                        }
                        if (to_select.length) {
                            this.selectNodes(to_select, e.shiftKey); // add to selection with shift
                        }
                    } else {
                        // will select of update selection
                        this.selectNodes([node], e.shiftKey || e.ctrlKey); // add to selection add to selection with ctrlKey or shiftKey
                    }
                }
                this.dragging_rectangle = null;
            } else if (this.connecting_node) {
                //dragging a connection
                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;

                let connInOrOut =
                    this.connecting_output || this.connecting_input;
                let connType = connInOrOut?.type;

                //node below mouse
                if (node) {
                    /* no need to condition on event type.. just another type
                       if (
                       connType == LiteGraph.EVENT &&
                       this.isOverNodeBox(node, e.canvasX, e.canvasY)
                       ) {

                       this.connecting_node.connect(
                       this.connecting_slot,
                       node,
                       LiteGraph.EVENT
                       );

                       } else {*/

                    //slot below mouse? connect

                    if (this.connecting_output) {
                        let slot = this.isOverNodeInput(
                            node,
                            e.canvasX,
                            e.canvasY,
                        );
                        if (slot != -1) {
                            if (this.connecting_slot !== null)
                                this.connecting_node.connect(
                                    this.connecting_slot,
                                    node,
                                    slot,
                                );
                        } else {
                            //not on top of an input
                            // look for a good slot
                            if (this.connecting_slot !== null)
                                this.connecting_node.connectByTypeInput(
                                    this.connecting_slot,
                                    node,
                                    connType || "",
                                );
                        }
                    } else if (this.connecting_input) {
                        let slot = this.isOverNodeOutput(
                            node,
                            e.canvasX,
                            e.canvasY,
                        );

                        if (slot != -1) {
                            if (this.connecting_slot !== null)
                                node.connect(
                                    slot,
                                    this.connecting_node,
                                    this.connecting_slot,
                                ); // this is inverted has output-input nature like
                        } else {
                            //not on top of an input
                            // look for a good slot
                            if (this.connecting_slot !== null)
                                this.connecting_node.connectByTypeOutput(
                                    this.connecting_slot,
                                    node,
                                    connType || "",
                                );
                        }
                    }

                    //}
                } else {
                    // add menu when releasing link in empty space
                    if (LiteGraph.release_link_on_empty_shows_menu) {
                        if (e.shiftKey && this.allow_searchbox) {
                            if (this.connecting_output) {
                                this.showSearchBox(e, {
                                    node_from: this.connecting_node,
                                    slotFrom: this.connecting_output,
                                    type_filter_in: this.connecting_output.type,
                                });
                            } else if (this.connecting_input) {
                                this.showSearchBox(e, {
                                    node_to: this.connecting_node,
                                    slotFrom: this.connecting_input,
                                    type_filter_out: this.connecting_input.type,
                                });
                            }
                        } else {
                            if (this.connecting_output) {
                                this.showConnectionMenu({
                                    nodeFrom: this.connecting_node,
                                    slotFrom: this.connecting_output,
                                    e: e,
                                });
                            } else if (this.connecting_input) {
                                this.showConnectionMenu({
                                    nodeTo: this.connecting_node,
                                    slotTo: this.connecting_input,
                                    e: e,
                                });
                            }
                        }
                    }
                }

                this.connecting_output = null;
                this.connecting_input = null;
                this.connecting_pos = null;
                this.connecting_node = null;
                this.connecting_slot = -1;
            } //not dragging connection
            else if (this.resizing_node) {
                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;
                this.graph.afterChange(this.resizing_node);
                this.resizing_node = null;
            } else if (this.node_dragged) {
                //node being dragged?
                let node = this.node_dragged;
                if (
                    node &&
                    e.click_time < 300 &&
                    node.isShowingTitle(true) &&
                    LiteGraph.isInsideRectangle(
                        e.canvasX,
                        e.canvasY,
                        node.pos[0],
                        node.pos[1] - LiteGraph.NODE_TITLE_HEIGHT,
                        LiteGraph.NODE_TITLE_HEIGHT,
                        LiteGraph.NODE_TITLE_HEIGHT,
                    )
                ) {
                    node.collapse();
                }
                this.dirty_canvas = true;
                this.dirty_bgcanvas = true;
                this.node_dragged.pos[0] = Math.round(this.node_dragged.pos[0]);
                this.node_dragged.pos[1] = Math.round(this.node_dragged.pos[1]);
                if (this.graph.config.align_to_grid || this.align_to_grid) {
                    this.node_dragged.alignToGrid();
                }
                if (this.onNodeMoved) this.onNodeMoved(this.node_dragged);
                this.events.emit("nodeMoved", this.node_dragged);
                this.graph.afterChange(this.node_dragged);
                this.node_dragged = null;
            } //no node being dragged
            else {
                //get node over
                let node = this.graph.getNodeOnPos(
                    e.canvasX,
                    e.canvasY,
                    this.visible_nodes,
                );

                if (!node && e.click_time < 300) {
                    this.deselectAllNodes();
                }

                this.dirty_canvas = true;
                this.dragging_canvas = false;

                if (this.node_over) {
                    this.node_over.onMouseUp?.(
                        e,
                        [
                            e.canvasX - this.node_over.pos[0],
                            e.canvasY - this.node_over.pos[1],
                        ],
                        this,
                    );
                    this.node_over.events.emit("mouseUp", e);
                }
                if (this.node_capturing_input) {
                    this.node_capturing_input.onMouseUp?.(
                        e,
                        [
                            e.canvasX - this.node_capturing_input.pos[0],
                            e.canvasY - this.node_capturing_input.pos[1],
                        ],
                        this,
                    );
                    this.node_capturing_input.events.emit("mouseUp", e);
                }
            }
        } else if (e.button === 1) {
            //middle button
            //trace("middle");
            this.dirty_canvas = true;
            this.dragging_canvas = false;
        } else if (e.button === 2) {
            //right button
            //trace("right");
            this.dirty_canvas = true;
            this.dragging_canvas = false;
        }

        /*
          if((this.dirty_canvas || this.dirty_bgcanvas) && this.rendering_timer_id == null)
          this.draw();
        */

        if (is_primary) {
            this.pointer_is_down = false;
            this.pointer_is_double = false;
        }

        this.graph.change();

        //console.log("pointerevents: processMouseUp stopPropagation");
        e.stopPropagation();
        e.preventDefault();
        return false;
    }

    processMouseWheel(this: LGraphCanvas, _e: MouseEvent): boolean | undefined {
        let e = _e as MouseEventExt;

        if (!this.graph || !this.allow_dragcanvas) {
            return;
        }

        let delta = e.wheelDeltaY != null ? e.wheelDeltaY : e.detail * -60;

        this.adjustMouseEvent(e);

        let x = e.clientX;
        let y = e.clientY;
        let is_inside =
            !this.viewport ||
            (this.viewport &&
                x >= this.viewport[0] &&
                x < this.viewport[0] + this.viewport[2] &&
                y >= this.viewport[1] &&
                y < this.viewport[1] + this.viewport[3]);
        if (!is_inside) return;

        let scale = this.ds.scale;

        if (delta > 0) {
            scale *= 1.1;
        } else if (delta < 0) {
            scale *= 1 / 1.1;
        }

        //this.setZoom( scale, [ e.clientX, e.clientY ] );
        this.ds.changeScale(scale, [e.clientX, e.clientY]);

        this.graph.change();

        e.preventDefault();
        return false; // prevent default
    }
}
