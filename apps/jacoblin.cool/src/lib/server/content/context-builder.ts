import type { GeminiFunctionDeclaration } from '$lib/server/llm/gemini';
import {
    createSiteToolRegistry as createAgentSiteToolRegistry,
    createSiteToolRegistryFromRegistry as createAgentSiteToolRegistryFromRegistry,
    type KnowledgeRegistry,
    type SiteToolExecutionResult,
    type SiteToolName
} from '@jacoblincool/agent';

export type { SiteToolExecutionResult, SiteToolName };

export type SiteToolRegistry = {
    contentVersion: string;
    refs: string[];
    siteIndexText: string;
    toolDeclarations: GeminiFunctionDeclaration[];
    executeTool: (name: string, args: Record<string, unknown>) => SiteToolExecutionResult | null;
};

const toGeminiFunctionDeclaration = (tool: {
    name: string;
    description: string;
    inputJsonSchema: Record<string, unknown>;
}): GeminiFunctionDeclaration => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputJsonSchema
});

const adaptRegistry = (
    registry: ReturnType<typeof createAgentSiteToolRegistry>
): SiteToolRegistry => ({
    contentVersion: registry.contentVersion,
    refs: registry.refs,
    siteIndexText: registry.siteIndexText,
    toolDeclarations: registry.toolDefinitions.map(toGeminiFunctionDeclaration),
    executeTool: registry.executeTool
});

export const createSiteToolRegistryFromRegistry = (registry: KnowledgeRegistry): SiteToolRegistry =>
    adaptRegistry(createAgentSiteToolRegistryFromRegistry(registry));

export const createSiteToolRegistry = (): SiteToolRegistry =>
    adaptRegistry(createAgentSiteToolRegistry());
