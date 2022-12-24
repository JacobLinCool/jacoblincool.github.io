import { Event } from "./event";
import { touchable } from "./misc";

export class Mouse extends Event {
	public element?: HTMLElement;
	private _x = 0;
	private _y = 0;
	private _down = false;

	private listener: Record<string, ((e: MouseEvent) => void) | ((e: TouchEvent) => void)> = {};

	constructor(element: HTMLElement | undefined = document.body) {
		super();

		this.element = element;

		if (this.element) {
			this.enable();
		}
	}

	public enable() {
		if (!this.element) {
			console.warn("Mouse: element is undefined");
			return;
		}

		if (touchable()) {
			this.listener["touchmove"] = (e: TouchEvent) => {
				this._x = e.touches[0].clientX;
				this._y = e.touches[0].clientY;
				this.emit("change", {
					x: [this._x, document.body.clientWidth - this._x],
					y: [this._y, document.body.clientHeight - this._y],
				});
			};
			this.element.addEventListener("touchmove", this.listener["touchmove"] as EventListener);

			this.listener["touchstart"] = (e: TouchEvent) => {
				this._x = e.touches[0].clientX;
				this._y = e.touches[0].clientY;
				this._down = true;
				this.emit("change", {
					x: [this._x, document.body.clientWidth - this._x],
					y: [this._y, document.body.clientHeight - this._y],
				});
			};
			this.element.addEventListener("touchstart", this.listener["touchstart"] as EventListener);

			this.listener["touchend"] = (e: TouchEvent) => {
				this._x = e.changedTouches[0].clientX;
				this._y = e.changedTouches[0].clientY;
				this._down = false;
				this.emit("change", {
					x: [this._x, document.body.clientWidth - this._x],
					y: [this._y, document.body.clientHeight - this._y],
				});
			};
			this.element.addEventListener("touchend", this.listener["touchend"] as EventListener);
		} else {
			this.listener["mousemove"] = (e: MouseEvent) => {
				this._x = e.clientX;
				this._y = e.clientY;
				this.emit("change", {
					x: [this._x, document.body.clientWidth - this._x],
					y: [this._y, document.body.clientHeight - this._y],
				});
			};
			this.element.addEventListener("mousemove", this.listener["mousemove"] as EventListener);

			this.listener["mousedown"] = () => {
				this._down = true;
				this.emit("change", {
					x: [this._x, document.body.clientWidth - this._x],
					y: [this._y, document.body.clientHeight - this._y],
				});
			};
			this.element.addEventListener("mousedown", this.listener["mousedown"] as EventListener);

			this.listener["mouseup"] = () => {
				this._down = false;
				this.emit("change", {
					x: [this._x, document.body.clientWidth - this._x],
					y: [this._y, document.body.clientHeight - this._y],
				});
			};
			this.element.addEventListener("mouseup", this.listener["mouseup"] as EventListener);

			this.listener["mouseleave"] = () => {
				this._down = false;
				this.emit("change", {
					x: [this._x, document.body.clientWidth - this._x],
					y: [this._y, document.body.clientHeight - this._y],
				});
			};
			this.element.addEventListener("mouseleave", this.listener["mouseleave"] as EventListener);
		}
	}

	public disable() {
		if (!this.element) {
			console.warn("Mouse: element is undefined");
			return;
		}

		for (const name in this.listener) {
			this.element.removeEventListener(
				name as keyof HTMLElementEventMap,
				this.listener[name] as EventListener,
			);
		}
		this.listener = {};
	}

	public get x() {
		return this._x;
	}

	public get y() {
		return this._y;
	}

	public get down() {
		return this._down;
	}

	public on(
		name: "change",
		listener: (pos: { x: [number, number]; y: [number, number] }) => void,
	): void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public on(name: string, listener: (data: any) => void): void {
		super.on(name, listener);
	}
}
