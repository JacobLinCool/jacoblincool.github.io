import { getStaticPublishedContent } from '$lib/server/content/static-content';
import type { GeminiFunctionDeclaration } from '$lib/server/llm/gemini';
import type {
    FeaturedProject,
    HomeCurationPayload,
    ProfileMetricsSnapshot,
    PublicationHighlight,
    ResearchQuestionCard
} from '$lib/types/home';

export type SiteToolName =
    | 'get_site_overview'
    | 'get_scholar_profile'
    | 'get_research_interests'
    | 'get_previous_publications'
    | 'get_publication_detail'
    | 'get_side_projects'
    | 'get_project_detail';

export type SiteToolExecutionResult = {
    label: string;
    target: string;
    refs: string[];
    payload: Record<string, unknown>;
};

type SiteToolDefinition = {
    name: SiteToolName;
    declaration: GeminiFunctionDeclaration;
    execute: (args: Record<string, unknown>) => SiteToolExecutionResult;
};

export type SiteToolRegistry = {
    locale: string;
    contentVersion: string;
    refs: string[];
    siteIndexText: string;
    toolDeclarations: GeminiFunctionDeclaration[];
    executeTool: (name: string, args: Record<string, unknown>) => SiteToolExecutionResult | null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const researchRef = (id: string) => `research:${id}`;
const publicationRef = (id: string) => `publication:${id}`;
const projectRef = (id: string) => `project:${id}`;

const buildSiteRefs = (home: HomeCurationPayload) => [
    'site:overview',
    'scholar:profile',
    ...home.researchQuestions.map((item) => researchRef(item.id)),
    ...home.publications.map((item) => publicationRef(item.id)),
    ...home.projects.map((item) => projectRef(item.id))
];

const toResearchListItem = (item: ResearchQuestionCard) => ({
    id: item.id,
    title: item.title,
    question: item.question
});

const toPublicationListItem = (item: PublicationHighlight) => ({
    id: item.id,
    title: item.title,
    year: item.year,
    venue: item.venue,
    citations: item.citations,
    tags: item.tags
});

const toProjectListItem = (item: FeaturedProject) => ({
    id: item.id,
    name: item.name,
    language: item.language,
    stars: item.stars,
    updatedAt: item.updatedAt
});

const buildSiteOverview = (home: HomeCurationPayload, locale: string, contentVersion: string) => ({
    locale,
    contentVersion,
    sections: {
        scholarProfile: {
            topics: home.scholar.topics,
            citations: home.scholar.citations,
            hIndex: home.scholar.hIndex,
            i10Index: home.scholar.i10Index
        },
        researchInterests: home.researchQuestions.map(toResearchListItem),
        previousPublications: home.publications.map(toPublicationListItem),
        sideProjects: home.projects.map(toProjectListItem)
    },
    counts: {
        researchInterests: home.researchQuestions.length,
        previousPublications: home.publications.length,
        sideProjects: home.projects.length
    }
});

const buildSiteIndexText = (home: HomeCurationPayload, locale: string, contentVersion: string) => {
    const research = home.researchQuestions
        .map((item) => `  - [${item.id}] ${item.title}`)
        .join('\n');
    const publications = home.publications
        .map((item) => `  - [${item.id}] ${item.year} ${item.title} (${item.tags.join(', ')})`)
        .join('\n');
    const projects = home.projects
        .map((item) => `  - [${item.id}] ${item.name} (${item.language}, ${item.stars} stars)`)
        .join('\n');

    return [
        `Published site knowledge index (locale=${locale}, version=${contentVersion}):`,
        `- Scholar topics: ${home.scholar.topics.join(', ')}`,
        `- Research interests (${home.researchQuestions.length}):`,
        research,
        `- Previous publications (${home.publications.length}):`,
        publications,
        `- Side projects (${home.projects.length}):`,
        projects,
        'Use site tools for detailed content instead of guessing from the index alone.'
    ].join('\n');
};

const buildErrorPayload = (message: string) => ({
    ok: false,
    error: message
});

const buildScholarPayload = (scholar: ProfileMetricsSnapshot['scholar']) => ({
    ok: true,
    scholar
});

const buildResearchPayload = (items: ResearchQuestionCard[]) => ({
    ok: true,
    researchInterests: items.map((item) => ({
        id: item.id,
        title: item.title,
        question: item.question,
        whyItMatters: item.whyItMatters,
        currentDirection: item.currentDirection
    }))
});

const buildPublicationListPayload = (items: PublicationHighlight[]) => ({
    ok: true,
    previousPublications: items.map((item) => ({
        id: item.id,
        title: item.title,
        year: item.year,
        venue: item.venue,
        citations: item.citations,
        tags: item.tags,
        summary: item.summary
    }))
});

const buildProjectListPayload = (items: FeaturedProject[]) => ({
    ok: true,
    sideProjects: items.map((item) => ({
        id: item.id,
        name: item.name,
        language: item.language,
        stars: item.stars,
        updatedAt: item.updatedAt,
        description: item.description
    }))
});

const buildPublicationDetailPayload = (item: PublicationHighlight | undefined) =>
    item
        ? {
              ok: true,
              publication: {
                  id: item.id,
                  title: item.title,
                  authors: item.authors,
                  venue: item.venue,
                  year: item.year,
                  citations: item.citations,
                  tags: item.tags,
                  impact: item.impact,
                  summary: item.summary,
                  url: item.url
              }
          }
        : buildErrorPayload('Unknown publication id.');

const buildProjectDetailPayload = (item: FeaturedProject | undefined) =>
    item
        ? {
              ok: true,
              project: {
                  id: item.id,
                  name: item.name,
                  description: item.description,
                  url: item.url,
                  language: item.language,
                  stars: item.stars,
                  updatedAt: item.updatedAt
              }
          }
        : buildErrorPayload('Unknown project id.');

export const createSiteToolRegistry = (locale: string): SiteToolRegistry => {
    const published = getStaticPublishedContent(locale);
    const home = published.bundle.home;
    const refs = buildSiteRefs(home);
    const siteOverview = buildSiteOverview(home, published.locale, published.versionId);

    const publicationById = new Map(home.publications.map((item) => [item.id, item]));
    const projectById = new Map(home.projects.map((item) => [item.id, item]));

    const tools: SiteToolDefinition[] = [
        {
            name: 'get_site_overview',
            declaration: {
                name: 'get_site_overview',
                description:
                    'Read the published site structure, section counts, and item ids before choosing more specific site tools.',
                parameters: {
                    type: 'OBJECT',
                    properties: {}
                }
            },
            execute: () => ({
                label: 'Reading site overview',
                target: 'site overview',
                refs: ['site:overview'],
                payload: {
                    ok: true,
                    overview: siteOverview
                }
            })
        },
        {
            name: 'get_scholar_profile',
            declaration: {
                name: 'get_scholar_profile',
                description:
                    'Read the published scholar profile, including topics and citation metrics.',
                parameters: {
                    type: 'OBJECT',
                    properties: {}
                }
            },
            execute: () => ({
                label: 'Reading scholar profile',
                target: 'scholar profile',
                refs: ['scholar:profile'],
                payload: buildScholarPayload(home.scholar)
            })
        },
        {
            name: 'get_research_interests',
            declaration: {
                name: 'get_research_interests',
                description:
                    'Read the full published research interests section, including questions, why they matter, and current directions.',
                parameters: {
                    type: 'OBJECT',
                    properties: {}
                }
            },
            execute: () => ({
                label: 'Reading research interests',
                target: 'research interests',
                refs: home.researchQuestions.map((item) => researchRef(item.id)),
                payload: buildResearchPayload(home.researchQuestions)
            })
        },
        {
            name: 'get_previous_publications',
            declaration: {
                name: 'get_previous_publications',
                description:
                    'Read the list of previous publications with ids, venues, years, tags, and summaries.',
                parameters: {
                    type: 'OBJECT',
                    properties: {}
                }
            },
            execute: () => ({
                label: 'Reading previous publications',
                target: 'previous publications',
                refs: home.publications.map((item) => publicationRef(item.id)),
                payload: buildPublicationListPayload(home.publications)
            })
        },
        {
            name: 'get_publication_detail',
            declaration: {
                name: 'get_publication_detail',
                description: 'Read the full published details for one publication by id.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        id: {
                            type: 'STRING',
                            description: 'Publication id from get_previous_publications.',
                            enum: home.publications.map((item) => item.id)
                        }
                    },
                    required: ['id']
                }
            },
            execute: (args) => {
                const id = asString(args.id);
                const publication = publicationById.get(id);

                return {
                    label: publication
                        ? `Reading publication: ${publication.title}`
                        : 'Reading publication details',
                    target: publication?.id ?? (id || 'publication detail'),
                    refs: publication ? [publicationRef(publication.id)] : [],
                    payload: buildPublicationDetailPayload(publication)
                };
            }
        },
        {
            name: 'get_side_projects',
            declaration: {
                name: 'get_side_projects',
                description:
                    'Read the list of side projects with ids, languages, stars, and short descriptions.',
                parameters: {
                    type: 'OBJECT',
                    properties: {}
                }
            },
            execute: () => ({
                label: 'Reading side projects',
                target: 'side projects',
                refs: home.projects.map((item) => projectRef(item.id)),
                payload: buildProjectListPayload(home.projects)
            })
        },
        {
            name: 'get_project_detail',
            declaration: {
                name: 'get_project_detail',
                description: 'Read the full published details for one side project by id.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        id: {
                            type: 'STRING',
                            description: 'Project id from get_side_projects.',
                            enum: home.projects.map((item) => item.id)
                        }
                    },
                    required: ['id']
                }
            },
            execute: (args) => {
                const id = asString(args.id);
                const project = projectById.get(id);

                return {
                    label: project ? `Reading project: ${project.name}` : 'Reading project details',
                    target: project?.id ?? (id || 'project detail'),
                    refs: project ? [projectRef(project.id)] : [],
                    payload: buildProjectDetailPayload(project)
                };
            }
        }
    ];

    return {
        locale: published.locale,
        contentVersion: published.versionId,
        refs,
        siteIndexText: buildSiteIndexText(home, published.locale, published.versionId),
        toolDeclarations: tools.map((tool) => tool.declaration),
        executeTool: (name, args) => {
            const tool = tools.find((candidate) => candidate.name === name);
            if (!tool) {
                return null;
            }

            return tool.execute(asRecord(args));
        }
    };
};
