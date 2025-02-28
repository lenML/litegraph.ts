import {
    ITextWidget,
    LGraphNode,
    LiteGraph,
    OptionalSlots,
    PropertyLayout,
    SlotLayout,
    Vector2,
} from "@litegraph-ts/core";

export interface ConstantFileProperties extends Record<string, any> {
    url: string;
    type: "arraybuffer" | "text" | "json" | "blob";
}

export default class ConstantFile extends LGraphNode {
    override properties: ConstantFileProperties = {
        url: "",
        type: "text",
    };

    static slotLayout: SlotLayout = {
        inputs: [{ name: "url", type: "string" }],
        outputs: [{ name: "file", type: "string" }],
    };

    static propertyLayout: PropertyLayout = [
        { name: "url", defaultValue: "" },
        { name: "type", defaultValue: "text" },
    ];

    static optionalSlots: OptionalSlots = {};

    widget: ITextWidget;

    private _data: any = null;
    private _url: string | null = null;
    private _type: string | null = null;

    constructor(title?: string) {
        super(title);
        this.widget = this.addWidget("text", "url", "", "url");
        this._data = null;
        this.widgets_up = true;
    }

    override onPropertyChanged(name: string, value: any) {
        if (name == "url") {
            if (value == null || value == "") {
                this._data = null;
            } else {
                this.fetchFile(value);
            }
        }
    }

    override onExecute() {
        var url = this.getInputData(0) || this.properties.url;
        if (url && (url != this._url || this._type != this.properties.type))
            this.fetchFile(url);
        this.setOutputData(0, this._data);
    }

    setValue(v: any) {
        this.setProperty("value", v);
    }

    async fetchFile(url: string) {
        if (!url || url.constructor !== String) {
            this._data = null;
            this.boxcolor = null;
            return;
        }

        this._url = url;
        this._type = this.properties.type;
        if (url.substr(0, 4) == "http" && LiteGraph.proxy) {
            url = LiteGraph.proxy + url.substr(url.indexOf(":") + 3);
        }
        await fetch(url)
            .then((response) => {
                if (!response.ok) throw new Error("File not found");

                if (this.properties.type == "arraybuffer")
                    return response.arrayBuffer();
                else if (this.properties.type == "text") return response.text();
                else if (this.properties.type == "json") return response.json();
                else if (this.properties.type == "blob") return response.blob();
            })
            .then((data) => {
                this._data = data;
                this.boxcolor = "#AEA";
            })
            .catch((error) => {
                this._data = null;
                this.boxcolor = "red";
                console.error("error fetching file:", error, url);
            });
    }

    override onDropFile(file: File) {
        this._url = file.name;
        this._type = this.properties.type;
        this.properties.url = file.name;
        var reader = new FileReader();
        reader.onload = (_e: ProgressEvent) => {
            this.boxcolor = "#AEA";
            var v = reader.result;
            if (this.properties.type == "json") v = JSON.parse(v as string);
            this._data = v;
        };
        if (this.properties.type == "arraybuffer")
            reader.readAsArrayBuffer(file);
        else if (
            this.properties.type == "text" ||
            this.properties.type == "json"
        )
            reader.readAsText(file);
        else if (this.properties.type == "blob")
            return reader.readAsBinaryString(file);
    }
}

LiteGraph.registerNodeType({
    class: ConstantFile,
    title: "Const File",
    desc: "Fetches a file from an url",
    type: "basic/file",
});
