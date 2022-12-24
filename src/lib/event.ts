/* eslint-disable @typescript-eslint/ban-types */
// Event listener

export class Event {
	private listeners = new Map<string, Function[]>();

	public on(name: string, listener: Function) {
		if (!this.listeners.has(name)) {
			this.listeners.set(name, []);
		}
		this.listeners.get(name)?.push(listener);
	}

	public off(name: string, listener?: Function) {
		const listeners = this.listeners.get(name);
		if (!listeners) {
			return;
		}

		if (!listener) {
			this.listeners.delete(name);
			return;
		}

		const idx = listeners.indexOf(listener);
		if (idx > -1) {
			listeners.splice(idx, 1);
		}

		if (listeners.length === 0) {
			this.listeners.delete(name);
		}
	}

	public emit(name: string, data: unknown) {
		this.listeners.get(name)?.forEach((listener) => {
			try {
				listener(data);
			} catch (err) {
				console.error(`[EventError] ${name}`, err, { listener, data });
			}
		});
	}
}
