import { fileURLToPath } from 'node:url';
import { runCli } from './cli/run.js';

const isDirectExecution = () => {
    const entryPath = process.argv[1];
    if (!entryPath) {
        return false;
    }

    return fileURLToPath(import.meta.url) === entryPath;
};

if (isDirectExecution()) {
    const exitCode = await runCli(process.argv.slice(2));
    process.exitCode = exitCode;
}
