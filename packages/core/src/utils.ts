interface CanvasRenderingContext2D {
    /** like rect but rounded corners */
    roundRect(
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number,
        radiusLow: number
    ): void;
}

export const clamp = function(v, a, b) {
    return a > v ? a : b < v ? b : v;
};

export function getStaticProperty<T>(type: new (...args: any[]) => any, name: string): T {
    if (name in type) {
        return type[name] as T;
    }
    return null;
}

export function getStaticPropertyOnInstance<T>(type: any, name: string): T {
    if (name in type.constructor) {
        return type.constructor[name] as T;
    }
    return null;
}

function onDrag(e: MouseEvent, el: HTMLElement) {
    if (e.target !== el)
        return

    let offsetX = e.clientX - parseInt(window.getComputedStyle(el).left);
    let offsetY = e.clientY - parseInt(window.getComputedStyle(el).top);

    const mouseMoveHandler = (e: MouseEvent) => {
        if (e.buttons === 0) {
            // In case pointer moved off the element when the mouse was
            // released, so mouseup on this elementnever triggers
            reset();
            return
        }

        el.style.top = (e.clientY - offsetY) + 'px';
        el.style.left = (e.clientX - offsetX) + 'px';
    }

    const reset = () => {
        window.removeEventListener('mousemove', mouseMoveHandler);
        window.removeEventListener('mouseup', reset);
    }

    window.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('mouseup', reset);
}

export function makeDraggable(el: HTMLElement): HTMLElement {
    el.addEventListener('mousedown', (e) => onDrag(e, el));
    el.classList.add("draggable")
    return el
}

export type UUID = string;
