<script lang="ts">
	import { onMount } from "svelte";

	export let id = `cursor-${Math.random().toString(36).substring(2)}`;

	const states: Record<string, { cursor?: string[]; inner?: string[]; outer?: string[] }> = {
		default: {
			inner: [
				"top-0",
				"left-0",
				"w-3",
				"h-3",
				"bg-slate-900",
				"ring-1",
				"ring-slate-100",
				"rounded-tr-full",
				"rounded-b-full",
			],
		},
		clickable: {
			inner: [
				"-top-4",
				"-left-4",
				"w-8",
				"h-8",
				"ring-2",
				"ring-slate-900",
				"border",
				"border-slate-100",
				"rounded-full",
				"opacity-80",
			],
			outer: [
				"-top-4",
				"-left-4",
				"w-8",
				"h-8",
				"ring-1",
				"ring-slate-900",
				"border",
				"border-slate-100",
				"rounded-full",
				"animate-ping",
			],
		},
		clicked: {
			inner: [
				"-top-3",
				"-left-3",
				"w-6",
				"h-6",
				"border-2",
				"border-slate-900",
				"rounded-full",
				"duration-75",
				"animate-[pulse_0.5s_ease-in-out_infinite]",
			],
			outer: [
				"-top-2",
				"-left-2",
				"w-4",
				"h-4",
				"border-2",
				"border-slate-900",
				"rounded-full",
				"duration-75",
				"animate-[pulse_0.5s_ease-in-out_infinite]",
			],
		},
	};
	let prev = "";
	let current = "";

	onMount(() => {
		console.log(`Cursor [${id}]: mounted`);
		const cursor = document.querySelector<HTMLDivElement>(`#${id}`);
		const inner = cursor?.querySelector<HTMLDivElement>(".inner-box");
		const outer = cursor?.querySelector<HTMLDivElement>(".outer-box");
		if (!cursor || !inner || !outer) {
			return;
		}

		let inactivate = 0;
		let pos = { x: 0, y: 0 };
		window.addEventListener("mousemove", (e) => {
			pos.x = e.clientX;
			pos.y = e.clientY;

			const state = clickable(e.target as Element) ? "clickable" : "default";
			activate();
			update(state);
		});
		window.addEventListener("mousedown", (e) => {
			if (clickable(e.target as Element)) {
				prev = current;
				update("clicked");

				(async () => {
					while (current === "clicked") {
						activate();
						await new Promise((r) => setTimeout(r, 500));
					}
				})();
			}
		});
		window.addEventListener("mouseup", () => {
			if (current === "clicked") {
				update(prev);
				prev = "";
			}
		});

		function update(...state: string[]) {
			for (const s of state) {
				if (!current || (s !== current && s in states && current in states)) {
					console.log(`Cursor [${id}]: state changed from ${current} to ${s}`);
					cursor?.classList.remove(...(states[current]?.cursor || []));
					inner?.classList.remove(...(states[current]?.inner || []));
					outer?.classList.remove(...(states[current]?.outer || []));
					cursor?.classList.add(...(states[s]?.cursor || []));
					inner?.classList.add(...(states[s]?.inner || []));
					outer?.classList.add(...(states[s]?.outer || []));
					current = s;
					break;
				}
			}
		}

		function activate() {
			if (inactivate) {
				clearTimeout(inactivate);
			}
			cursor?.classList.remove("opacity-30");
			inactivate = setTimeout(() => {
				cursor?.classList.add("opacity-30");
			}, 1000) as unknown as number;
		}

		function clickable(elm: Element): boolean {
			if (elm instanceof HTMLAnchorElement) {
				return true;
			}
			if (elm instanceof HTMLButtonElement) {
				return true;
			}
			if (elm instanceof HTMLInputElement) {
				return true;
			}
			if (elm instanceof HTMLSelectElement) {
				return true;
			}
			if (elm instanceof HTMLTextAreaElement) {
				return true;
			}
			if (elm instanceof HTMLLabelElement) {
				return true;
			}
			if ("onclick" in elm && elm.onclick) {
				return true;
			}
			if (elm.parentElement) {
				return clickable(elm.parentElement);
			}
			return false;
		}

		const fps = 30;
		let prev_t = 0;
		function loop() {
			requestAnimationFrame(loop);
			const t = Date.now();
			if (t - prev_t < 1000 / fps) {
				return;
			}
			prev_t = t;
			cursor!.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
		}
		loop();
	});
</script>

<div class="fixed top-0 left-0 w-[100dvw] h-[100dvh] pointer-events-none z-[9999]">
	<div
		{id}
		class="absolute transition-all duration-75 ease-out flex justify-center items-center z-[10000]"
	>
		<div class="outer-box absolute transition-all" />
		<div class="inner-box absolute transition-all" />
	</div>
</div>

<style>
	:global(*) {
		cursor: none;
	}
</style>
