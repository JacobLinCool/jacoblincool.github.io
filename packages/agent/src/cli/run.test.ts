import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCli } from './run.js';

describe('runCli', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    afterEach(() => {
        logSpy.mockClear();
        errorSpy.mockClear();
    });

    it('lists tools as JSON', async () => {
        const exitCode = await runCli(['list']);

        expect(exitCode).toBe(0);
        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(String(logSpy.mock.calls[0]?.[0])).toContain('get_knowledge_root');
    });

    it('executes a site tool without external fetches', async () => {
        const exitCode = await runCli(['exec', 'get_knowledge_root']);

        expect(exitCode).toBe(0);
        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(String(logSpy.mock.calls[0]?.[0])).toContain('"ok": true');
    });

    it('returns a non-zero exit code for unknown tools', async () => {
        const exitCode = await runCli(['exec', 'missing-tool']);

        expect(exitCode).toBe(1);
        expect(errorSpy).toHaveBeenCalledWith('Unknown tool: missing-tool');
    });
});
