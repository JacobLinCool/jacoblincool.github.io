import { classifyJevQuestions, JevError, type JevQuestion } from '$lib/server/llm/jev';
import { afterEach, describe, expect, it, vi } from 'vitest';

const questions: JevQuestion[] = [
    {
        id: 'tone',
        question: 'Which tone would best suit the latest request?',
        options: [
            { id: 'professional', description: 'Precise and professional.' },
            { id: 'casual', description: 'Conversational and relaxed.' }
        ]
    },
    {
        id: 'paper-details',
        question: 'Does the latest request need the paper details?',
        options: [
            { id: 'include', description: 'The paper is relevant to the request.' },
            { id: 'skip', description: 'The paper is unrelated to the request.' }
        ]
    }
];

const responsePayload = () => ({
    model: 'jev-1.13.0',
    answers: {
        tone: {
            type: 'choice',
            choice: 'professional',
            probabilities: { professional: 0.9, casual: 0.1 },
            confidence: 0.8
        },
        'paper-details': {
            type: 'choice',
            choice: 'include',
            probabilities: { include: 0.75, skip: 0.25 },
            confidence: 0.6
        }
    },
    usage: { input_tokens: 320, output_tokens: 40 }
});

const call = (fetchFn: typeof fetch, extra = {}) =>
    classifyJevQuestions({
        fetchFn,
        apiKey: 'test-secret',
        context: 'Conversation: What does this paper contribute?',
        questions,
        ...extra
    });

afterEach(() => vi.useRealTimers());

describe('classifyJevQuestions', () => {
    it('batches independent choices using the official protocol and retains calibrated results', async () => {
        const fetchFn = vi.fn<typeof fetch>(async () => Response.json(responsePayload()));
        const result = await call(fetchFn);

        expect(fetchFn).toHaveBeenCalledOnce();
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe('https://api.typesafe.ai/v1/systemone');
        expect(init).toMatchObject({
            method: 'POST',
            headers: {
                Authorization: 'Bearer test-secret',
                'Content-Type': 'application/json'
            },
            signal: expect.any(AbortSignal)
        });
        expect(JSON.parse(init!.body as string)).toEqual({
            state: 'Conversation: What does this paper contribute?',
            model: 'jev-latest',
            questions: {
                tone: {
                    type: 'choice',
                    instructions: questions[0].question,
                    criteria: {
                        professional: 'Precise and professional.',
                        casual: 'Conversational and relaxed.'
                    }
                },
                'paper-details': {
                    type: 'choice',
                    instructions: questions[1].question,
                    criteria: {
                        include: 'The paper is relevant to the request.',
                        skip: 'The paper is unrelated to the request.'
                    }
                }
            }
        });
        expect(result).toEqual({
            model: 'jev-1.13.0',
            answers: responsePayload().answers,
            usage: { inputTokens: 320, outputTokens: 40 }
        });
    });

    it('supports a pinned model and floating point serialization rounding', async () => {
        const payload = responsePayload();
        payload.answers.tone.probabilities = { professional: 0.6667, casual: 0.3334 };
        const fetchFn = vi.fn<typeof fetch>(async () => Response.json(payload));

        await expect(call(fetchFn, { model: 'jev-1.13.0' })).resolves.toMatchObject({
            answers: { tone: { probabilities: { professional: 0.6667, casual: 0.3334 } } }
        });
        expect(JSON.parse(fetchFn.mock.calls[0][1]!.body as string).model).toBe('jev-1.13.0');
    });

    it.each([
        [
            'missing question',
            (p: ReturnType<typeof responsePayload>) => ({ ...p, answers: { tone: p.answers.tone } })
        ],
        [
            'unexpected question',
            (p: ReturnType<typeof responsePayload>) => ({
                ...p,
                answers: { ...p.answers, extra: p.answers.tone }
            })
        ],
        [
            'wrong answer type',
            (p: ReturnType<typeof responsePayload>) => ({
                ...p,
                answers: { ...p.answers, tone: { ...p.answers.tone, type: 'score' } }
            })
        ],
        [
            'unknown choice',
            (p: ReturnType<typeof responsePayload>) => ({
                ...p,
                answers: { ...p.answers, tone: { ...p.answers.tone, choice: 'invented' } }
            })
        ],
        [
            'missing probability',
            (p: ReturnType<typeof responsePayload>) => ({
                ...p,
                answers: {
                    ...p.answers,
                    tone: { ...p.answers.tone, probabilities: { professional: 1 } }
                }
            })
        ],
        [
            'unexpected probability',
            (p: ReturnType<typeof responsePayload>) => ({
                ...p,
                answers: {
                    ...p.answers,
                    tone: {
                        ...p.answers.tone,
                        probabilities: { professional: 0.9, casual: 0.1, invented: 0 }
                    }
                }
            })
        ],
        [
            'invalid probability sum',
            (p: ReturnType<typeof responsePayload>) => ({
                ...p,
                answers: {
                    ...p.answers,
                    tone: { ...p.answers.tone, probabilities: { professional: 0.6, casual: 0.1 } }
                }
            })
        ],
        [
            'out-of-range probability',
            (p: ReturnType<typeof responsePayload>) => ({
                ...p,
                answers: {
                    ...p.answers,
                    tone: { ...p.answers.tone, probabilities: { professional: 1.1, casual: -0.1 } }
                }
            })
        ],
        [
            'non-numeric probability',
            (p: ReturnType<typeof responsePayload>) => ({
                ...p,
                answers: {
                    ...p.answers,
                    tone: { ...p.answers.tone, probabilities: { professional: '0.9', casual: 0.1 } }
                }
            })
        ],
        [
            'non-maximal choice',
            (p: ReturnType<typeof responsePayload>) => ({
                ...p,
                answers: { ...p.answers, tone: { ...p.answers.tone, choice: 'casual' } }
            })
        ],
        [
            'out-of-range confidence',
            (p: ReturnType<typeof responsePayload>) => ({
                ...p,
                answers: { ...p.answers, tone: { ...p.answers.tone, confidence: 2 } }
            })
        ],
        [
            'missing confidence',
            (p: ReturnType<typeof responsePayload>) => ({
                ...p,
                answers: { ...p.answers, tone: { ...p.answers.tone, confidence: undefined } }
            })
        ],
        [
            'invalid token usage',
            (p: ReturnType<typeof responsePayload>) => ({
                ...p,
                usage: { input_tokens: -1, output_tokens: 40 }
            })
        ],
        ['missing model', (p: ReturnType<typeof responsePayload>) => ({ ...p, model: undefined })]
    ])('rejects an upstream %s', async (_, change) => {
        const fetchFn = vi.fn<typeof fetch>(async () => Response.json(change(responsePayload())));
        await expect(call(fetchFn)).rejects.toMatchObject({ code: 'invalid_response' });
    });

    it('rejects invalid JSON without returning upstream text', async () => {
        const fetchFn = vi.fn<typeof fetch>(async () => new Response('private upstream detail'));
        await expect(call(fetchFn)).rejects.toEqual(
            new JevError('invalid_response', 'Invalid Jev response: expected JSON.')
        );
    });

    it.each([401, 422, 429, 529])(
        'returns sanitized HTTP %s errors without retrying',
        async (status) => {
            const fetchFn = vi.fn<typeof fetch>(
                async () => new Response('test-secret private query', { status })
            );
            await expect(call(fetchFn)).rejects.toMatchObject({
                code: 'http',
                status,
                message: `Jev request failed (HTTP ${status}).`
            });
            expect(fetchFn).toHaveBeenCalledOnce();
        }
    );

    it('does not expose transport errors that may contain credentials', async () => {
        const fetchFn = vi.fn<typeof fetch>(async () => {
            throw new Error('Header contained test-secret');
        });
        await expect(call(fetchFn)).rejects.toEqual(
            new JevError('network', 'Jev could not be reached.')
        );
    });

    it('rejects missing credentials and duplicate ids before sending a request', async () => {
        const fetchFn = vi.fn<typeof fetch>();
        await expect(call(fetchFn, { apiKey: '' })).rejects.toMatchObject({
            code: 'configuration'
        });
        await expect(
            call(fetchFn, { questions: [questions[0], questions[0]] })
        ).rejects.toMatchObject({ code: 'invalid_request' });
        await expect(
            call(fetchFn, {
                questions: [
                    { ...questions[0], options: [questions[0].options[0], questions[0].options[0]] }
                ]
            })
        ).rejects.toMatchObject({ code: 'invalid_request' });
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('rejects already-cancelled requests before sending', async () => {
        const fetchFn = vi.fn<typeof fetch>();
        await expect(
            call(fetchFn, { signal: AbortSignal.abort('private user reason') })
        ).rejects.toMatchObject({
            code: 'aborted',
            message: 'Jev request was cancelled.'
        });
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('forwards cancellation to the transport and cleans up the deadline', async () => {
        vi.useFakeTimers();
        const fetchFn = vi.fn<typeof fetch>(() => new Promise(() => {}));
        const controller = new AbortController();
        const pending = call(fetchFn, { signal: controller.signal });
        const rejected = expect(pending).rejects.toMatchObject({ code: 'aborted' });
        controller.abort('private cancellation reason');

        await rejected;
        expect(fetchFn.mock.calls[0][1]!.signal!.aborted).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });

    it.each(['headers', 'body'])('enforces the timeout while waiting for %s', async (stage) => {
        vi.useFakeTimers();
        const fetchFn = vi.fn<typeof fetch>(async () => {
            if (stage === 'headers') {
                return new Promise<Response>(() => {});
            }
            return new Response(new ReadableStream());
        });
        const pending = call(fetchFn, { timeoutMs: 50 });
        const rejected = expect(pending).rejects.toMatchObject({ code: 'timeout' });
        await vi.advanceTimersByTimeAsync(50);

        await rejected;
        expect(fetchFn.mock.calls[0][1]!.signal!.aborted).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });
});
