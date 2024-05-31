import { contextmenu_vars } from "./ContextMenu";
import LGraph from "./LGraph";
import LGraphCanvas from "./LGraphCanvas";
import type { NodeColor } from "./LGraphCanvas";
import LiteGraph from "./LiteGraph";
import { cloneDeep } from "./utils";

type ContextMenuVars = Record<
    keyof (typeof contextmenu_vars)["config"],
    string | number
>;
type UIVars<T extends string> = Record<T, string | number>;

const default_style_vars = {
    lg_menu_fg: "#aaf",
    lg_menu_bg: "#2e2e2e",
    lg_menu_bg_dark: "#000",
    lg_menu_bar_fg: "#999",
    lg_menu_bar_hover_bg: "#777",
    lg_menu_bar_hover_fg: "#eee",
    lg_menu_panel_bg: "#444",
    lg_menu_panel_shadow: "black",
    lg_menu_panel_border: "#aaf",
    lg_menu_entry_fg: "#aaa",
    lg_menu_entry_checked_bg: "#aaf",
    lg_menu_entry_separator_top: "#333",
    lg_menu_entry_separator_bottom: "#666",
    lg_menu_entry_submenu_border: "cyan",
    lg_menu_title_fg: "#dde",
    lg_menu_title_bg: "#111",
    lg_menu_entry_hover_bg: "#444",
    lg_menu_entry_hover_fg: "#eee",
    lg_menu_entry_property_value_bg: "rgba(0, 0, 0, 0.5",
    lg_searchbox_bg: "rgba(0, 0, 0, 0.5",
    lg_searchbox_input_bg: "black",
    lg_searchbox_fg: "white",
    lg_searchitem_bg: "rgba(0, 0, 0, 0.5",
    lg_searchitem_fg: "white",
    lg_searchitem_not_in_filter_fg: "#b99",
    lg_searchitem_generic_type_fg: "#999",
    lg_searchitem_hover_bg: "white",
    lg_searchitem_hover_fg: "black",
    lg_dialog_bg: "#2a2a2a",
    lg_dialog_shadow: "#111",
    lg_dialog_close_hover: "white",
    lg_dialog_header_fg: "#aaa",
    lg_dialog_header_border: "#161616",
    lg_dialog_footer_border: "#1a1a1a",
    lg_dialog_fg: "#aaa",
    lg_dialog_side_bg: "black",
    lg_separator_top: "#000",
    lg_separator_bottom: "#333",
    lg_property_hover: "#545454",
    lg_property_name_fg: "#737373",
    lg_dialog_hover_fg: "white",
    lg_dialog_value_fg: "#aaa",
    lg_dialog_value_bg: "#1a1a1a",
    lg_dialog_value_hover_fg: "white",
    lg_dialog_bool_fg: "#a88",
    lg_dialog_bool_on_fg: "#8a8",
    lg_dialog_btn_bg: "#060606",
    lg_dialog_btn_fg: "#8e8e8e",
    lg_dialog_btn_hover_bg: "#111",
    lg_dialog_btn_hover_fg: "#fff",
    lg_dialog_btn_delete_hover_bg: "#f33",
    lg_dialog_btn_delete_hover_fg: "black",
    lg_subgraph_hover_bg: "#333",
    lg_subgraph_type_bg: "black",
    lg_subgraph_input_fg: "#ccc",
    lg_subgraph_input_bg: "#1a1a1a",
    lg_subgraph_property_bg: "#1c1c1c",
    lg_subgraph_property_fg: "#aaa",
    lg_subgraph_property_extra_fg: "#ccc",
    lg_subgraph_property_extra_bg: "#111",
    lg_bullet_icon_bg: "#666",
    lg_bullet_icon_hover_bg: "#698",
    lg_menu_old_title_fg: "#dde",
    lg_menu_old_title_bg: "#222",
    lg_menu_event_border: "orange",
    lg_menu_submenu_border: "#eee",
    lg_menu_hover_bg: "#555",
    lg_menu_separator_bg: "#111",
    lg_menu_separator_border: "#666",
    lg_menu_property_value_bg: "rgba(0, 0, 0, 0.5",
    lg_dialog_old_bg: "#333",
    lg_dialog_old_shadow: "black",
    lg_dialog_name_fg: "#888",
    lg_dialog_input_bg: "black",
    lg_dialog_input_fg: "white",
    gd_button_bg: "#999",
    gd_help_item_bg: "white",
    gd_help_item_fg: "black",
} as const;

type DeepPartial<T> =
    T extends Record<keyof any, any>
        ? { [K in keyof T]?: DeepPartial<T[K]> }
        : T;

// prettier-ignore
export type ILGraphTheme = {
    graph: {
        CANVAS_GRID_SIZE:            number;
        NODE_TITLE_HEIGHT:           number;
        NODE_TITLE_TEXT_Y:           number;
        NODE_SLOT_HEIGHT:            number;
        NODE_WIDGET_HEIGHT:          number;
        NODE_WIDTH:                  number;
        NODE_MIN_WIDTH:              number;
        NODE_COLLAPSED_RADIUS:       number;
        NODE_COLLAPSED_WIDTH:        number;
        NODE_TITLE_COLOR:            string;
        NODE_SELECTED_TITLE_COLOR:   string;
        NODE_TEXT_SIZE:              number;
        NODE_TEXT_COLOR:             string;
        NODE_SUBTEXT_SIZE:           number;
        NODE_DEFAULT_COLOR:          string;
        NODE_DEFAULT_BGCOLOR:        string;
        NODE_DEFAULT_BOXCOLOR:       string;
        NODE_DEFAULT_SHAPE:          string;
        NODE_BOX_OUTLINE_COLOR:      string;
        DEFAULT_SHADOW_COLOR:        string;
        DEFAULT_GROUP_FONT_SIZE:     number;
        WIDGET_BGCOLOR:              string;
        WIDGET_OUTLINE_COLOR:        string;
        WIDGET_TEXT_COLOR:           string;
        WIDGET_SECONDARY_TEXT_COLOR: string;
        EVENT_LINK_COLOR:            string;
        CONNECTING_LINK_COLOR:       string;
        NODE_OUTLINE_WIDTH:          number;
        NODE_OUTLINE_COLOR:          string;
    };
    canvas: {
        node_colors:                 Record<string, NodeColor>;
        type_colors:                 Record<string, string>;

        node_title_color:            string;
        title_text_font:             string;
        inner_text_font:             string;
        default_link_color:          string;

        background_image:            string;
        clear_background_color:      string;
    };
    ui:                              UIVars<keyof typeof default_style_vars> &
                                     ContextMenuVars;
}

export class LGraphTheme {
    // prettier-ignore
    static defaultTheme = new LGraphTheme({
        graph: {
            CANVAS_GRID_SIZE:            LiteGraph.CANVAS_GRID_SIZE,
            NODE_TITLE_HEIGHT:           LiteGraph.NODE_TITLE_HEIGHT,
            NODE_TITLE_TEXT_Y:           LiteGraph.NODE_TITLE_TEXT_Y,
            NODE_SLOT_HEIGHT:            LiteGraph.NODE_SLOT_HEIGHT,
            NODE_WIDGET_HEIGHT:          LiteGraph.NODE_WIDGET_HEIGHT,
            NODE_WIDTH:                  LiteGraph.NODE_WIDTH,
            NODE_MIN_WIDTH:              LiteGraph.NODE_MIN_WIDTH,
            NODE_COLLAPSED_RADIUS:       LiteGraph.NODE_COLLAPSED_RADIUS,
            NODE_COLLAPSED_WIDTH:        LiteGraph.NODE_COLLAPSED_WIDTH,
            NODE_SELECTED_TITLE_COLOR:   LiteGraph.NODE_SELECTED_TITLE_COLOR,
            NODE_TEXT_COLOR:             LiteGraph.NODE_TEXT_COLOR,
            NODE_SUBTEXT_SIZE:           LiteGraph.NODE_SUBTEXT_SIZE,
            NODE_DEFAULT_COLOR:          LiteGraph.NODE_DEFAULT_COLOR,
            NODE_DEFAULT_BGCOLOR:        LiteGraph.NODE_DEFAULT_BGCOLOR,
            NODE_DEFAULT_BOXCOLOR:       LiteGraph.NODE_DEFAULT_BOXCOLOR,
            NODE_DEFAULT_SHAPE:          LiteGraph.NODE_DEFAULT_SHAPE,
            NODE_BOX_OUTLINE_COLOR:      LiteGraph.NODE_BOX_OUTLINE_COLOR,
            DEFAULT_SHADOW_COLOR:        LiteGraph.DEFAULT_SHADOW_COLOR,
            DEFAULT_GROUP_FONT_SIZE:     LiteGraph.DEFAULT_GROUP_FONT_SIZE,
            WIDGET_BGCOLOR:              LiteGraph.WIDGET_BGCOLOR,
            WIDGET_OUTLINE_COLOR:        LiteGraph.WIDGET_OUTLINE_COLOR,
            WIDGET_TEXT_COLOR:           LiteGraph.WIDGET_TEXT_COLOR,
            WIDGET_SECONDARY_TEXT_COLOR: LiteGraph.WIDGET_SECONDARY_TEXT_COLOR,
            EVENT_LINK_COLOR:            LiteGraph.EVENT_LINK_COLOR,
            CONNECTING_LINK_COLOR:       LiteGraph.CONNECTING_LINK_COLOR,
            NODE_OUTLINE_WIDTH:          LiteGraph.NODE_OUTLINE_WIDTH,
            NODE_OUTLINE_COLOR:          LiteGraph.NODE_OUTLINE_COLOR,
        },
        canvas: {
            node_colors:                 LGraphCanvas.node_colors,
            type_colors:                 LGraphCanvas.DEFAULT_LINK_TYPE_COLORS,
    
            node_title_color:            LiteGraph.NODE_TITLE_COLOR,
            title_text_font:             "" + LiteGraph.NODE_TEXT_SIZE + "px Arial",
            inner_text_font:             "normal " + LiteGraph.NODE_SUBTEXT_SIZE + "px Arial",
            default_link_color:          LiteGraph.LINK_COLOR,
    
            background_image:            LGraphCanvas.DEFAULT_BACKGROUND_IMAGE,
            clear_background_color:      null,
        },
        ui: {
            ...default_style_vars,
            ...contextmenu_vars.config
        }
    });

    readonly theme: DeepPartial<ILGraphTheme>;

    constructor(theme: DeepPartial<ILGraphTheme>) {
        this.theme = cloneDeep(theme);
    }

    apply(context: { graph: LGraph; canvas: LGraphCanvas }) {
        const { graph, canvas } = context;
        const { theme } = this;

        // apply graph theme colors
        Object.entries(theme.graph || {}).forEach(([k, v]) => {
            LiteGraph[k] = v;
        });

        // apply canvas theme colors
        const {
            node_colors,
            type_colors,
            node_title_color,
            title_text_font,
            inner_text_font,
            default_link_color,
            background_image,
            clear_background_color,
        } = this.theme.canvas || {};
        if (node_colors) {
            Object.assign(LGraphCanvas.node_colors, node_colors);
        }
        if (type_colors) {
            Object.assign(
                LGraphCanvas.DEFAULT_CONNECTION_COLORS_BY_TYPE,
                type_colors,
            );
            Object.assign(LGraphCanvas.DEFAULT_LINK_TYPE_COLORS, type_colors);
            Object.assign(canvas.link_type_colors, type_colors);
        }
        if (node_title_color) canvas.node_title_color = node_title_color;
        if (title_text_font) canvas.title_text_font = title_text_font;
        if (inner_text_font) canvas.inner_text_font = inner_text_font;
        if (default_link_color) canvas.default_link_color = default_link_color;
        if (background_image) {
            canvas.background_image = background_image;
            canvas._pattern = null;
            canvas._pattern_img = null;
        }
        if (clear_background_color)
            canvas.clear_background_color = clear_background_color;
        if (theme.canvas) canvas.draw(true, true);

        // apply ui css property
        const rootStyle = document.documentElement.style;
        Object.entries(theme.ui || {}).forEach(([k, v]) => {
            rootStyle.setProperty("--" + k, String(v));
        });
    }
}
