import {
    DOMWidget,
    LGraphNode,
    LiteGraph,
    SlotLayout,
} from "@litegraph-ts/core";

class TextareaWidget extends DOMWidget {
    constructor(name: string, node: LGraphNode, defaultValue?: string) {
        const element = document.createElement("textarea");
        element.style.resize = "none";
        element.value = node.properties[name] ?? defaultValue ?? "";
        super({
            element,
            name,
            node,
            options: {
                hideOnZoom: true,
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

        this.addCustomWidget(new TextareaWidget("text", this, ""));
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
