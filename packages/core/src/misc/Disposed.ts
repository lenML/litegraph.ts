interface IDisposable {
    dispose(): void;
}

export class Disposed {
    protected _disposed = new AbortController();

    get signal() {
        return this._disposed.signal;
    }

    get is() {
        return this._disposed.signal.aborted;
    }

    dispose() {
        this._disposed.abort();
    }

    connect(disposable: IDisposable | (() => void)) {
        const dispose = () => {
            if (typeof disposable === "function") {
                disposable();
            } else {
                disposable.dispose();
            }
        };
        if (this.is) {
            dispose();
        } else {
            this._disposed.signal.addEventListener("abort", dispose);
        }
    }
}
