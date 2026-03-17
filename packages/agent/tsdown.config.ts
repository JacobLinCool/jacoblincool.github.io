import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/index.ts', 'src/cli.ts'],
    outDir: 'scripts',
    dts: {
        compilerOptions: {
            isolatedDeclarations: true
        }
    },
    exports: {}
});
