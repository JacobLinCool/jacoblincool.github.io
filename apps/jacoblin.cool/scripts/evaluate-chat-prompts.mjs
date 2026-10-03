import {
    createSiteToolRegistryFromRegistry,
    getStaticKnowledgeRegistry
} from '@jacoblincool/agent';
import { fileURLToPath } from 'node:url';
import { createServer, loadEnv } from 'vite';

const help = `Usage: node scripts/evaluate-chat-prompts.mjs [--case <id>] [--list]

Evaluates the real Jev classifier against the maintained conversation scenarios.
Each selected case makes one API request, sequentially, without retries.
Loads TYPESAFE_API_KEY and optional JEV_MODEL from the environment or app .env files.
--case <id>  Run one scenario; repeat to select several.
--list       List scenario IDs without making API requests.
--help       Show this help without making API requests.

Reports decisions, confidence, policy, and latency; exits nonzero on any failure.
This checks classification and routing, not generated answer wording.`;

const args = process.argv.slice(2);
const selectedIds = new Set();
let listOnly = false;
let helpOnly = false;
for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help') helpOnly = true;
    else if (arg === '--list') listOnly = true;
    else if (arg === '--case' && args[index + 1] && !args[index + 1].startsWith('--')) {
        selectedIds.add(args[++index]);
    } else {
        console.error('Invalid arguments. Use --help for usage.');
        process.exitCode = 1;
        break;
    }
}

const appRoot = fileURLToPath(new URL('../', import.meta.url));

const localErrorDiagnostic = (error) => {
    const kind =
        error instanceof TypeError
            ? 'TypeError'
            : error instanceof ReferenceError
              ? 'ReferenceError'
              : error instanceof SyntaxError
                ? 'SyntaxError'
                : 'Error';
    // Only retain a local source location, never the error message or arbitrary stack text.
    const match =
        error instanceof Error
            ? error.stack
                  ?.split('\n')
                  .slice(1)
                  .map((line) =>
                      line.match(
                          /\/(src\/lib\/server|scripts)\/([A-Za-z0-9_./-]+\.(?:ts|js|mjs)):(\d+):(\d+)/
                      )
                  )
                  .find(Boolean)
            : undefined;
    return {
        kind,
        ...(match ? { location: `${match[1]}/${match[2]}:${match[3]}:${match[4]}` } : {})
    };
};

const evaluate = (scenario, result) => {
    const failures = [];
    for (const [blockId, acceptable] of Object.entries(scenario.expected.choices)) {
        const decision = result.decisions.find((entry) => entry.blockId === blockId);
        if (!decision || !acceptable.includes(decision.appliedChoice)) {
            failures.push(
                `${blockId}: expected ${acceptable.map((choice) => choice ?? 'uncertain').join('|')}, received ${decision?.appliedChoice ?? 'uncertain'}`
            );
        }
    }
    for (const [field, expected] of Object.entries(scenario.expected.policy)) {
        const actual = result.responsePolicy[field];
        const matches = Array.isArray(expected) ? expected.includes(actual) : actual === expected;
        if (!matches) {
            failures.push(
                `policy.${field}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
            );
        }
    }
    if (!scenario.expected.policy.includeKnowledge && result.selectedItemIds.length > 0) {
        failures.push('Knowledge is disabled but details were preloaded.');
    }
    return failures;
};

const run = async () => {
    const server = await createServer({
        configFile: false,
        root: appRoot,
        appType: 'custom',
        logLevel: 'silent',
        resolve: { alias: { $lib: fileURLToPath(new URL('../src/lib', import.meta.url)) } },
        server: { middlewareMode: true, hmr: false, watch: null }
    });
    try {
        const { PROMPT_SCENARIOS } = await server.ssrLoadModule(
            '/src/lib/server/chat/prompt-scenarios.ts'
        );
        const unknownIds = [...selectedIds].filter(
            (id) => !PROMPT_SCENARIOS.some((scenario) => scenario.id === id)
        );
        if (unknownIds.length > 0) {
            console.error('Unknown scenario ID. Use --list to see the available cases.');
            process.exitCode = 1;
            return;
        }
        const scenarios = PROMPT_SCENARIOS.filter(
            (scenario) => selectedIds.size === 0 || selectedIds.has(scenario.id)
        );
        if (listOnly) {
            for (const scenario of scenarios)
                console.log(`${scenario.id}: ${scenario.description}`);
            return;
        }
        const env = loadEnv('development', appRoot, ['TYPESAFE_', 'JEV_']);
        const apiKey = env.TYPESAFE_API_KEY?.trim();
        if (!apiKey) {
            console.error(
                'TYPESAFE_API_KEY is required. Set it in the environment or an ignored app .env file.'
            );
            process.exitCode = 1;
            return;
        }
        const { buildDynamicPrompt } = await server.ssrLoadModule(
            '/src/lib/server/chat/prompt-engine.ts'
        );
        const { JevError } = await server.ssrLoadModule('/src/lib/server/llm/jev.ts');
        const registry = getStaticKnowledgeRegistry();
        const { siteIndexText } = createSiteToolRegistryFromRegistry(registry);
        let passed = 0;
        for (const scenario of scenarios) {
            const started = performance.now();
            let phase = 'prompt_build';
            try {
                const result = await buildDynamicPrompt({
                    fetchFn: fetch,
                    apiKey,
                    model: env.JEV_MODEL || 'jev-latest',
                    locale: scenario.locale,
                    message: scenario.message,
                    recentMessages: scenario.recentMessages,
                    carryoverSummary: null,
                    siteIndexText,
                    registry,
                    now: new Date('2026-10-04T00:00:00Z')
                });
                phase = 'expectations';
                const failures = evaluate(scenario, result);
                if (failures.length === 0) passed += 1;
                console.log(
                    JSON.stringify({
                        id: scenario.id,
                        pass: failures.length === 0,
                        mode: result.responsePolicy.mode,
                        policy: result.responsePolicy,
                        choices: Object.fromEntries(
                            result.decisions
                                .filter((decision) => !decision.itemId)
                                .map((decision) => [
                                    decision.blockId,
                                    {
                                        selected: decision.choice,
                                        applied: decision.appliedChoice,
                                        confidence: decision.confidence,
                                        ...(failures.length > 0
                                            ? { probabilities: decision.probabilities }
                                            : {})
                                    }
                                ])
                        ),
                        latencyMs: Math.round(performance.now() - started),
                        failures
                    })
                );
            } catch (error) {
                // Provider responses and arbitrary error messages may contain sensitive request data.
                console.log(
                    JSON.stringify({
                        id: scenario.id,
                        pass: false,
                        latencyMs: Math.round(performance.now() - started),
                        phase,
                        error: error instanceof JevError ? error.code : 'evaluation_error',
                        ...(error instanceof JevError ? {} : localErrorDiagnostic(error)),
                        ...(error instanceof JevError && error.status
                            ? { status: error.status }
                            : {})
                    })
                );
            }
        }
        console.log(`${passed}/${scenarios.length} scenarios passed.`);
        if (passed !== scenarios.length) process.exitCode = 1;
    } finally {
        await server.close();
    }
};

if (!process.exitCode) {
    if (helpOnly) console.log(help);
    else
        await run().catch(() => {
            console.error(
                'Could not initialize the prompt evaluation runner. Check the agent build and local module configuration.'
            );
            process.exitCode = 1;
        });
}
