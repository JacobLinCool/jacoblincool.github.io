/** TypeSafe System One's Choice protocol: https://docs.typesafe.ai/api */
export type JevQuestion = {
    id: string;
    question: string;
    options: readonly { id: string; description: string }[];
};

export type JevChoiceAnswer = {
    type: 'choice';
    choice: string;
    probabilities: Record<string, number>;
    confidence: number;
};

export type JevClassificationResult = {
    model: string;
    answers: Record<string, JevChoiceAnswer>;
    usage: { inputTokens: number; outputTokens: number };
};

type JevErrorCode =
    | 'configuration'
    | 'invalid_request'
    | 'http'
    | 'network'
    | 'invalid_response'
    | 'timeout'
    | 'aborted';

/** Contains only local diagnostic text; never upstream bodies, queries, or credentials. */
export class JevError extends Error {
    constructor(
        readonly code: JevErrorCode,
        message: string,
        readonly status?: number
    ) {
        super(message);
        this.name = 'JevError';
    }
}

type ClassifyJevQuestionsArgs = {
    fetchFn: typeof fetch;
    apiKey: string;
    model?: string;
    context: string;
    questions: readonly JevQuestion[];
    signal?: AbortSignal;
    timeoutMs?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

const isProbability = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

const isTokenCount = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

const invalidResponse = (detail: string): never => {
    throw new JevError('invalid_response', `Invalid Jev response: ${detail}.`);
};

const parseResponse = (
    payload: unknown,
    questions: readonly JevQuestion[]
): JevClassificationResult => {
    if (!isRecord(payload) || typeof payload.model !== 'string' || !payload.model.trim()) {
        return invalidResponse('missing model');
    }
    const rawAnswers = payload.answers;
    if (
        !isRecord(rawAnswers) ||
        !hasExactKeys(
            rawAnswers,
            questions.map(({ id }) => id)
        )
    ) {
        return invalidResponse('question ids do not match the request');
    }
    const usage = payload.usage;
    if (
        !isRecord(usage) ||
        !isTokenCount(usage.input_tokens) ||
        !isTokenCount(usage.output_tokens)
    ) {
        return invalidResponse('invalid token usage');
    }

    const answers = questions.map(({ id, options }): [string, JevChoiceAnswer] => {
        const answer = rawAnswers[id];
        const optionIds = options.map((option) => option.id);
        if (
            !isRecord(answer) ||
            answer.type !== 'choice' ||
            typeof answer.choice !== 'string' ||
            !optionIds.includes(answer.choice) ||
            !isProbability(answer.confidence) ||
            !isRecord(answer.probabilities) ||
            !hasExactKeys(answer.probabilities, optionIds)
        ) {
            return invalidResponse('invalid choice answer');
        }

        const entries = Object.entries(answer.probabilities);
        if (!entries.every((entry): entry is [string, number] => isProbability(entry[1]))) {
            return invalidResponse('invalid choice probability');
        }
        const probabilities = Object.fromEntries(entries);
        const total = entries.reduce((sum, [, probability]) => sum + probability, 0);
        // Allow serialization rounding, while rejecting incomplete distributions.
        if (Math.abs(total - 1) > 0.001) {
            return invalidResponse('choice probabilities must sum to one');
        }
        const selectedProbability = probabilities[answer.choice];
        if (entries.some(([, probability]) => probability > selectedProbability + 1e-6)) {
            return invalidResponse('choice must have the highest probability');
        }
        return [
            id,
            {
                type: 'choice',
                choice: answer.choice,
                probabilities,
                confidence: answer.confidence
            }
        ];
    });

    return {
        model: payload.model,
        answers: Object.fromEntries(answers),
        usage: { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }
    };
};

const validateRequest = ({
    apiKey,
    context,
    questions,
    model,
    timeoutMs
}: {
    apiKey: string;
    context: string;
    questions: readonly JevQuestion[];
    model: string;
    timeoutMs: number;
}) => {
    if (!apiKey.trim()) {
        throw new JevError(
            'configuration',
            'TYPESAFE_API_KEY is required for chat classification.'
        );
    }
    if (
        !model.trim() ||
        !Number.isSafeInteger(timeoutMs) ||
        timeoutMs <= 0 ||
        timeoutMs > 2_147_483_647
    ) {
        throw new JevError('configuration', 'Jev requires a model and a positive timeout.');
    }
    if (!context.trim() || questions.length === 0) {
        throw new JevError('invalid_request', 'Jev requires context and at least one question.');
    }

    const questionIds = new Set<string>();
    for (const { id, question, options } of questions) {
        if (!id.trim() || questionIds.has(id) || !question.trim()) {
            throw new JevError('invalid_request', 'Jev question ids must be unique and nonempty.');
        }
        questionIds.add(id);
        const optionIds = new Set(options.map((option) => option.id));
        if (
            options.length === 0 ||
            options.length > 255 ||
            optionIds.size !== options.length ||
            options.some((option) => !option.id.trim() || !option.description.trim())
        ) {
            throw new JevError('invalid_request', 'Jev requires 1–255 unique, described options.');
        }
    }
};

/** Evaluate every independent prompt decision in one call against the same conversation. */
export const classifyJevQuestions = async ({
    fetchFn,
    apiKey,
    model = 'jev-latest',
    context,
    questions,
    signal,
    timeoutMs = 6_000
}: ClassifyJevQuestionsArgs): Promise<JevClassificationResult> => {
    validateRequest({ apiKey, context, questions, model, timeoutMs });
    if (signal?.aborted) {
        throw new JevError('aborted', 'Jev request was cancelled.');
    }

    const controller = new AbortController();
    const cancel = () => controller.abort(new JevError('aborted', 'Jev request was cancelled.'));
    signal?.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(
        () => controller.abort(new JevError('timeout', 'Jev request timed out.')),
        timeoutMs
    );

    const request = async () => {
        const response = await fetchFn('https://api.typesafe.ai/v1/systemone', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey.trim()}`,
                'Content-Type': 'application/json'
            },
            signal: controller.signal,
            body: JSON.stringify({
                state: context,
                model,
                questions: Object.fromEntries(
                    questions.map(({ id, question, options }) => [
                        id,
                        {
                            type: 'choice',
                            instructions: question,
                            criteria: Object.fromEntries(
                                options.map((option) => [option.id, option.description])
                            )
                        }
                    ])
                )
            })
        });
        if (!response.ok) {
            void response.body?.cancel().catch(() => {});
            throw new JevError(
                'http',
                `Jev request failed (HTTP ${response.status}).`,
                response.status
            );
        }

        let payload: unknown;
        try {
            payload = await response.json();
        } catch {
            return invalidResponse('expected JSON');
        }
        return parseResponse(payload, questions);
    };

    let stopWaiting: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
        stopWaiting = () => reject(controller.signal.reason);
        controller.signal.addEventListener('abort', stopWaiting, { once: true });
    });
    try {
        return await Promise.race([request(), aborted]);
    } catch (error) {
        if (controller.signal.aborted) {
            throw controller.signal.reason;
        }
        if (error instanceof JevError) {
            throw error;
        }
        throw new JevError('network', 'Jev could not be reached.');
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', cancel);
        if (stopWaiting) {
            controller.signal.removeEventListener('abort', stopWaiting);
        }
    }
};
