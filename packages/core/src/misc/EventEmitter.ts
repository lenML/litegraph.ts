type EventMap = Record<string | symbol, (...args: any[]) => any>;
type EventOff = () => void;
type ListenerOptions = { signal?: AbortSignal };

export class EventEmitter<Events extends EventMap> {
    static iterator<Events extends EventMap, EventName extends keyof Events>(
        eventEmitter: EventEmitter<Events>,
        eventName: EventName,
        options?: ListenerOptions,
    ) {
        const queue: Parameters<Events[EventName]>[] = [];
        const val_ee = new EventEmitter<{
            value: () => void;
        }>();
        let done = false;

        const iterator = {
            async next(): Promise<
                IteratorResult<Parameters<Events[EventName]>, any>
            > {
                if (queue.length > 0) {
                    return {
                        value: queue.shift() as Parameters<Events[EventName]>,
                        done,
                    };
                }

                return new Promise<
                    IteratorResult<Parameters<Events[EventName]>, any>
                >((resolve) => {
                    val_ee.once("value", () => {
                        resolve({
                            value: queue.shift() as Parameters<
                                Events[EventName]
                            >,
                            done,
                        });
                    });
                });
            },
            [Symbol.asyncIterator]() {
                return this;
            },
        };

        eventEmitter.on(eventName, ((...args) => {
            queue.push(args as any);
            val_ee.emit("value");
        }) as any);

        if (options?.signal) {
            options?.signal.addEventListener("abort", () => {
                done = true;
                val_ee.emit("value");
                val_ee.removeAllListeners();
            });
        }

        return iterator;
    }

    private events: Map<keyof Events, Function[]> = new Map();
    private maxListeners: number = Infinity;
    private signal?: AbortSignal;

    constructor(options?: { maxListeners?: number; signal?: AbortSignal }) {
        this.maxListeners = options?.maxListeners ?? Infinity;
        this.signal = options?.signal;
    }

    private emitNewListener<EventName extends keyof Events>(
        eventName: EventName,
        listener: Events[EventName],
    ) {
        // @ts-ignore
        this.emit("__new_listener__", eventName, listener);
    }

    private emitRemoveListener<EventName extends keyof Events>(
        eventName: EventName,
        listener: Events[EventName],
    ) {
        // @ts-ignore
        this.emit("__remove_listener__", eventName, listener);
    }

    addListener<EventName extends keyof Events>(
        eventName: EventName,
        listener: Events[EventName],
        options?: ListenerOptions,
    ): EventOff {
        return this.on(eventName, listener, options);
    }

    emit<EventName extends keyof Events>(
        eventName: EventName,
        ...args: Parameters<Events[EventName]>
    ): boolean {
        const listeners = this.events.get(eventName);
        if (!listeners) return false;
        listeners.forEach((listener) => listener(...args));
        return true;
    }

    eventNames(): (keyof Events)[] {
        return Array.from(this.events.keys());
    }

    getMaxListeners(): number {
        return this.maxListeners;
    }

    listenerCount<EventName extends keyof Events>(
        eventName: EventName,
    ): number {
        const listeners = this.events.get(eventName);
        return listeners ? listeners.length : 0;
    }

    listeners<EventName extends keyof Events>(
        eventName: EventName,
    ): Events[EventName][] {
        return (this.events.get(eventName) as any) || [];
    }

    off<EventName extends keyof Events>(
        eventName: EventName,
        listener: Events[EventName],
    ): this {
        return this.removeListener(eventName, listener);
    }

    on<EventName extends keyof Events>(
        eventName: EventName,
        listener: Events[EventName],
        options?: ListenerOptions,
    ): EventOff {
        if (this.listenerCount(eventName) >= this.maxListeners) {
            console.warn(
                `Max listeners (${this.maxListeners}) for event '${String(
                    eventName,
                )}' exceeded!`,
            );
        }
        this.emitNewListener(eventName, listener);
        let listeners = this.events.get(eventName);
        if (!listeners) {
            listeners = [];
            this.events.set(eventName, listeners);
        }
        listeners.push(listener);

        const signals = [options?.signal, this.signal].filter(
            Boolean,
        ) as AbortSignal[];

        if (signals.length !== 0) {
            const mergedSignal = new AbortController();
            signals.forEach((signal) =>
                signal.addEventListener("abort", () => mergedSignal.abort()),
            );

            mergedSignal.signal.addEventListener("abort", () => {
                this.removeListener(eventName, listener);
            });
        }

        return () => this.removeListener(eventName, listener);
    }

    once<EventName extends keyof Events>(
        eventName: EventName,
        listener: Events[EventName],
    ): EventOff {
        const onceWrapper = (...args: Parameters<Events[EventName]>) => {
            listener(...args);
            this.removeListener(eventName, onceWrapper as any);
        };
        return this.on(eventName, onceWrapper as any);
    }

    prependListener<EventName extends keyof Events>(
        eventName: EventName,
        listener: Events[EventName],
    ): EventOff {
        let listeners = this.events.get(eventName);
        if (!listeners) {
            listeners = [];
            this.events.set(eventName, listeners);
        }
        listeners.unshift(listener);
        this.emitNewListener(eventName, listener);
        return () => this.removeListener(eventName, listener);
    }

    prependOnceListener<EventName extends keyof Events>(
        eventName: EventName,
        listener: Events[EventName],
    ): EventOff {
        const onceWrapper = (...args: Parameters<Events[EventName]>) => {
            listener(...args);
            this.removeListener(eventName, onceWrapper as any);
        };
        return this.prependListener(eventName, onceWrapper as any);
    }

    removeAllListeners<EventName extends keyof Events>(
        eventName?: EventName,
    ): this {
        if (eventName) {
            const listeners = this.events.get(eventName);
            if (listeners) {
                listeners.forEach((listener) =>
                    this.emitRemoveListener(
                        eventName,
                        listener as Events[EventName],
                    ),
                );
                this.events.delete(eventName);
            }
        } else {
            this.events.forEach((listeners, event) => {
                listeners.forEach((listener) =>
                    this.emitRemoveListener(
                        event,
                        listener as Events[typeof event],
                    ),
                );
            });
            this.events.clear();
        }
        return this;
    }

    removeListener<EventName extends keyof Events>(
        eventName: EventName,
        listener: Events[EventName],
    ): this {
        const listeners = this.events.get(eventName);
        if (listeners) {
            this.events.set(
                eventName,
                listeners.filter((l) => l !== listener),
            );
            this.emitRemoveListener(eventName, listener);
        }
        return this;
    }

    setMaxListeners(n: number): this {
        this.maxListeners = n;
        return this;
    }
}

// (async () => {
//   const ee1 = new EventEmitter<{ foo: (a: any) => void }>();

//   setTimeout(() => {
//     ee1.emit("foo", "bar");
//     ee1.emit("foo", 42);
//   });

//   ee1.on("foo", (a) => {
//     console.log("foo", a);
//   });

//   for await (const args of EventEmitter.iterator(ee1, "foo")) {
//     console.log(args);
//   }
// })();
