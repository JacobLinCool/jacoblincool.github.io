import { createJacobAgentRuntime } from '../runtime/agent-runtime.js';

const usage = `Usage:
  node scripts/index.mjs list
  node scripts/index.mjs exec <tool-name> --input '<json-object>'`;

const readRuntimeFromEnv = () =>
    createJacobAgentRuntime({
        githubToken: process.env.GITHUB_TOKEN ?? process.env.GITHUB_API_TOKEN ?? null,
        githubUser: process.env.GITHUB_USER ?? 'JacobLinCool',
        huggingfaceUser: process.env.HUGGINGFACE_USER ?? 'JacobLinCool'
    });

const parseJsonInput = (value: string | undefined) => {
    if (!value) {
        return {};
    }

    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('The --input payload must be a JSON object.');
    }

    return parsed as Record<string, unknown>;
};

export const runCli = async (args: string[]): Promise<number> => {
    const [command, maybeToolName, ...rest] = args;
    const runtime = readRuntimeFromEnv();

    if (!command || command === '--help' || command === '-h') {
        console.error(usage);
        return command ? 0 : 1;
    }

    if (command === 'list') {
        console.log(
            JSON.stringify(
                runtime.listTools().map((tool) => ({
                    source: tool.source,
                    name: tool.name,
                    description: tool.description,
                    inputJsonSchema: tool.inputJsonSchema
                })),
                null,
                2
            )
        );
        return 0;
    }

    if (command !== 'exec') {
        console.error(`Unknown command: ${command}`);
        console.error(usage);
        return 1;
    }

    const toolName = maybeToolName?.trim();
    if (!toolName) {
        console.error('Missing tool name.');
        console.error(usage);
        return 1;
    }

    let inputValue: string | undefined;
    for (let index = 0; index < rest.length; index += 1) {
        if (rest[index] === '--input') {
            inputValue = rest[index + 1];
            break;
        }
    }

    try {
        const input = parseJsonInput(inputValue);
        const result = await runtime.executeTool(toolName, input);
        if (!result) {
            console.error(`Unknown tool: ${toolName}`);
            return 1;
        }

        console.log(JSON.stringify(result, null, 2));
        return result.payload.ok === false ? 1 : 0;
    } catch (error) {
        console.error(error instanceof Error ? error.message : 'CLI execution failed.');
        return 1;
    }
};
