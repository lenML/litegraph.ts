import {
    BuiltInSlotType,
    DOMWidget,
    ISliderWidget,
    LActionOptions,
    LGraphCanvas,
    LGraphNode,
    LiteGraph,
    MouseEventExt,
    PropertyLayout,
    SlotLayout,
    Vector2,
    WidgetLayout,
} from "@litegraph-ts/core";

class TextareaWidget extends DOMWidget {
    constructor(
        name: string,
        node: LGraphNode,
        {
            defaultValue,
            placeholder,
        }: {
            defaultValue?: string;
            placeholder?: string;
        } = {},
    ) {
        const element = document.createElement("textarea");
        element.style.resize = "none";
        element.value = node.properties[name] ?? defaultValue ?? "";
        if (placeholder) {
            element.placeholder = placeholder;
        }

        super({
            element,
            name,
            node,
            options: {
                selectOn: ["click"],
                hideOnZoom: true,
                enableDomClipping: true,
                getValue: () => element.value,
                setValue: (x) => (element.value = x),
            },
        });

        element.addEventListener("input", () => {
            this.updateProperty();
        });
    }
}

class UploadWidget extends DOMWidget {
    _file = null as null | File;

    constructor(name: string, node: LGraphNode) {
        const element = document.createElement("input");
        element.type = "file";
        element.multiple = false;
        super({
            element,
            name,
            node,
            options: {
                hideOnZoom: true,
                enableDomClipping: true,
                selectOn: ["click"],
                getValue: () =>
                    this._file instanceof Blob ? this._file : null,
                setValue: (x) => (this._file = x),
            },
        });

        element.addEventListener("change", () => {
            const file0 = element.files[0];
            this._file = file0 || null;
            this.updateProperty();
        });
    }
}
export class DomDemoNode extends LGraphNode {
    override properties = {
        text: "",
        file: null,
    };

    static slotLayout: SlotLayout = {
        outputs: [
            { name: "text", type: "string" },
            { name: "file", type: "File" },
        ],
    };

    constructor(name?: string) {
        super(name);

        this.addCustomWidget(
            new TextareaWidget("text", this, {
                defaultValue: "Hello",
            }),
        );
        this.addCustomWidget(new UploadWidget("file", this));
    }

    onExecute(param: any, options: object): void {
        this.setOutputData(0, this.properties.text);
        this.setOutputData(1, this.properties.file);
    }
}

LiteGraph.registerNodeType({
    class: DomDemoNode,
    title: "Dom Widget Demo",
    desc: "Demo node",
    type: "demo/text_and_input",
});

class YoutubeEmbedWidget extends DOMWidget {
    videoId = "";

    constructor(name: string, node: LGraphNode) {
        const iframe = document.createElement("iframe");
        iframe.setAttribute("frameborder", "0");
        iframe.setAttribute("allowfullscreen", "true");
        iframe.style.width = "100%";
        iframe.style.height = "100%";

        super({
            element: iframe,
            name,
            node,
            options: {
                hideOnZoom: false,
                enableDomClipping: true,
            },
        });
    }

    setVideoId(videoId) {
        this.videoId = videoId;
        const iframe = this.$el as HTMLIFrameElement;
        if (videoId) {
            iframe.src = `https://www.youtube.com/embed/${videoId}`;
        } else {
            iframe.src = "";
        }
    }
}

export class YoutubeEmbedNode extends LGraphNode {
    override properties = {
        videoId: "",
    };

    static widgetLayout: WidgetLayout = [
        {
            type: "text",
            name: "videoId",
            value: "",
            options: {
                property: "videoId",
            },
        },
        {
            widget: (node) => new YoutubeEmbedWidget("video", node),
        },
    ];

    constructor(title?: string) {
        super(title ?? "Youtube Embed");
    }

    onPropertyChanged(
        property: string,
        value: any,
        prevValue?: any,
    ): boolean | void {
        if (property === "videoId") {
            const w1 = this.widgets?.[1] as YoutubeEmbedWidget;
            w1?.setVideoId(value ?? "");
        }
    }
}

LiteGraph.registerNodeType({
    class: YoutubeEmbedNode,
    title: "Youtube Embed",
    desc: "A node that embeds a YouTube video",
    type: "media/youtube_embed",
});
