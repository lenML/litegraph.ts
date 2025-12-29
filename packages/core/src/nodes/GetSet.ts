import { IComboWidget } from "../IWidget";
import LGraphNode, { SlotLayout } from "../LGraphNode";
import LiteGraph from "../LiteGraph";

export class SetNode extends LGraphNode {
    static slotLayout: SlotLayout = {
        inputs: [
            {
                type: "*",
                name: "*",
            },
        ],
        outputs: [
            {
                type: "*",
                name: "*",
            },
        ],
    };

    static type = "SetNode";

    properties: Record<string, any> = {
        previousName: "",
    };

    constructor() {
        super("Setter Node");

        this.addWidget(
            "text",
            "Constant",
            "",
            (e) => {
                this.validateName();
                if (this.varName !== "") {
                    this.title = "Set_" + this.varName;
                }
                this.update();
                this.properties.previousName = this.varName;
            },
            {
                multiline: false,
            },
        );
    }

    get varName() {
        return this.widgets[0].value;
    }

    get inputType() {
        return this.inputs[0].type;
    }

    private findGetters(checkForPreviousName = false) {
        const name = checkForPreviousName
            ? this.properties.previousName
            : this.varName;
        return this.graph._nodes.filter(
            (n) => n instanceof GetNode && n.varName === name && name !== "",
        ) as GetNode[];
    }

    private validateName() {
        let widgetValue = this.widgets[0].value;

        if (widgetValue === "") return;
        let tries = 0;
        const existingValues = new Set();

        this.graph._nodes.forEach((n) => {
            if (n == this) return;
            if (!(n instanceof SetNode)) return;
            existingValues.add(n.varName);
        });

        while (existingValues.has(widgetValue)) {
            widgetValue = this.varName + "_" + tries;
            tries++;
        }

        this.widgets[0].value = widgetValue;
        this.update();
    }

    private update() {
        if (!this.graph) {
            return;
        }

        const getters = this.findGetters();
        getters.forEach((getter) => {
            getter.setType(this.inputType);
        });

        if (this.varName) {
            const gettersWithPreviousName = this.findGetters(true);
            gettersWithPreviousName.forEach((getter) => {
                getter.setName(this.varName);
            });
        }

        // const allGetters = this.graph._nodes.filter(
        //     (otherNode) => otherNode.type === "GetNode",
        // );
        // allGetters.forEach((otherNode) => {
        //     if (otherNode.setComboValues) {
        //         otherNode.setComboValues();
        //     }
        // });
    }

    override onExecute(param: any, options: object): void {
        this.setOutputData(0, this.getInputData(0));
    }
}

export class GetNode extends LGraphNode {
    static slotLayout: SlotLayout = {
        inputs: [],
        outputs: [
            {
                type: "*",
                name: "*",
            },
        ],
    };

    static type = "GetNode";

    constructor() {
        super("Getter Node");

        this.addWidget(
            "combo",
            "Constant",
            "",
            (e) => {
                this.onRename();
            },
            {
                values: () => {
                    const nodes = this.graph._nodes.filter(
                        (n) => n instanceof SetNode,
                    ) as SetNode[];
                    return nodes.map((n) => n.varName).sort();
                },
            },
        );
    }

    get combo() {
        return this.widgets[0] as IComboWidget;
    }

    private validateLinks() {
        const out0 = this.outputs[0];
        const type0 = out0.type.toString();
        const links = out0.links || [];
        if (type0 === "*") return;
        if (links.length === 0) return;
        links
            .filter((linkId) => {
                const link = this.graph.links[linkId];
                return (
                    link &&
                    // FIXME: 其实我们不支持多类型
                    !link.type.toString().split(",").includes(type0) &&
                    link.type !== "*"
                );
            })
            .forEach((linkId) => {
                this.graph.removeLink(linkId);
            });
    }

    get varName() {
        return this.widgets[0].value;
    }

    public setType(type: any) {
        this.outputs[0].name = type;
        this.outputs[0].type = type;
        this.validateLinks();
    }

    public setName(name: string) {
        this.widgets[0].value = name;
        this.onRename();
        this.serialize();
    }

    public setComboValues() {
        // TODO 感觉不需要啊
    }

    private onRename() {
        const setter = this.findSetter();
        if (setter) {
            let linkType = setter.inputType;

            this.setType(linkType);
            this.title = "Get_" + setter.varName;
        } else {
            this.setType("*");
        }
    }

    private findSetter() {
        const name = this.varName;
        const foundNode = this.graph._nodes.find(
            (n) => n instanceof SetNode && n.varName === name && name !== "",
        );
        return foundNode as SetNode;
    }

    override onExecute(param: any, options: object): void {
        const upNode = this.findSetter();
        let data = null;
        if (upNode) {
            data = upNode.getInputData(0);
        }
        this.setOutputData(0, data);
    }
}

LiteGraph.registerNodeType({
    class: GetNode,
    title: "Output",
    desc: "Get var",
    type: "graph/vars/get",
});

LiteGraph.registerNodeType({
    class: SetNode,
    title: "Set Node",
    desc: "Set var",
    type: "graph/vars/set",
});
