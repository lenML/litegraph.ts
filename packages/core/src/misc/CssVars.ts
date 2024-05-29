export class CssVars<T extends Record<string, any>> {
    constructor(readonly config: T) {}

    var(key: keyof T, def: string | number = this.config[key]) {
        return `var(--${String(key)}, ${def})`;
    }

    get vars() {
        const root = {};
        return new Proxy(root, {
            get: (target, p, receiver) => {
                if (p in root) return Reflect.get(target, p, receiver);
                if (typeof p === "string") {
                    return this.var(p);
                }
                return Reflect.get(target, p, receiver);
            },
        }) as Record<keyof T, string>;
    }
}
