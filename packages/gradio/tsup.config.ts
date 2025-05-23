import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	dts: true,
	splitting: false,
	clean: true,
	treeshake: true,
	esbuildOptions: (options) => {
		options.conditions = ['gradio'];
		options.define = {
			'process.env.NODE_ENV': '"production"',
			'global.WebSocket': '"undefined"',
			global: 'globalThis'
		};
	}
});
