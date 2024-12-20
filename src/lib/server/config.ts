import type { Config } from '$lib/config';
import type { Activity, ExtraInformation } from './chat';
import { getGitHubActivities } from './data/github';
import { getHuggingfaceActivities } from './data/huggingface';

export interface ServerConfig extends Config {
	owner: Config['owner'] & {
		extraInformations: Record<string, ExtraInformation>;
	};
}

async function getActivities(owner: ServerConfig['owner']): Promise<Activity[]> {
	const github = await getGitHubActivities(owner.usernames.github);
	const huggingface = await getHuggingfaceActivities(owner.usernames.huggingface);
	return [...github, ...huggingface].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function extendConfig(config: Config): ServerConfig {
	return {
		...config,
		owner: {
			...config.owner,
			extraInformations: {
				recentActivities: {
					fetcher: getActivities
				}
			}
		}
	};
}
