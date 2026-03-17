import type { GeminiFunctionDeclaration, GeminiFunctionResponse } from '$lib/server/llm/gemini';
import { createFirestoreSnapshotStore } from '$lib/server/repos/dynamic-snapshot-repository';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import type { ExternalToolConfig } from '$lib/server/tools/external-tool-config';
import {
    createJacobAgentRuntime,
    type ToolDefinition,
    type ToolExecutionResult,
    type ToolSource
} from '@jacoblincool/agent';
import type { Firestore } from 'fires2rest';

export type ChatToolSource = ToolSource;
export type ChatToolExecutionResult = ToolExecutionResult;

type ToolRegistryInput = {
    db: Firestore;
    fetchFn: typeof fetch;
    config: RuntimeConfig;
    externalToolConfig: ExternalToolConfig;
};

export type ChatToolRegistry = {
    contentVersion: string;
    siteRefs: string[];
    siteIndexText: string;
    toolDeclarations: GeminiFunctionDeclaration[];
    executeTool: (
        name: string,
        args: Record<string, unknown>
    ) => Promise<ChatToolExecutionResult | null>;
};

const toGeminiSchema = (schema: unknown): Record<string, unknown> => {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
        return {
            type: 'OBJECT',
            properties: {}
        };
    }

    const record = schema as Record<string, unknown>;
    const type = typeof record.type === 'string' ? record.type.toUpperCase() : undefined;
    const properties =
        record.properties &&
        typeof record.properties === 'object' &&
        !Array.isArray(record.properties)
            ? Object.fromEntries(
                  Object.entries(record.properties as Record<string, unknown>).map(
                      ([key, value]) => [key, toGeminiSchema(value)]
                  )
              )
            : undefined;
    const items = record.items ? toGeminiSchema(record.items) : undefined;

    return {
        ...(type ? { type } : {}),
        ...(typeof record.description === 'string' ? { description: record.description } : {}),
        ...(Array.isArray(record.required) ? { required: record.required } : {}),
        ...(properties ? { properties } : {}),
        ...(items ? { items } : {}),
        ...(Array.isArray(record.enum) ? { enum: record.enum } : {})
    };
};

const toGeminiFunctionDeclaration = (tool: ToolDefinition): GeminiFunctionDeclaration => ({
    name: tool.name,
    description: tool.description,
    parameters: toGeminiSchema(tool.inputJsonSchema)
});

export const createChatToolRegistry = ({
    db,
    fetchFn,
    config,
    externalToolConfig
}: ToolRegistryInput): ChatToolRegistry => {
    const runtime = createJacobAgentRuntime({
        fetchFn,
        githubToken: config.githubToken,
        githubUser: config.githubUser,
        huggingfaceUser: config.huggingfaceUser,
        externalToolConfig,
        snapshotStore: createFirestoreSnapshotStore(db)
    });

    return {
        contentVersion: runtime.contentVersion,
        siteRefs: runtime.siteRefs,
        siteIndexText: runtime.siteIndexText,
        toolDeclarations: runtime.listTools().map(toGeminiFunctionDeclaration),
        executeTool: (name, args) => runtime.executeTool(name, args)
    };
};

export const toGeminiFunctionResponsePart = (
    name: string,
    payload: Record<string, unknown>
): GeminiFunctionResponse => ({
    name,
    response: payload
});
