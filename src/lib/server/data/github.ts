import { octokit } from '$lib/server/api';
import type { Activity } from '../chat';

export async function getGitHubActivities(user: string): Promise<Activity[]> {
	const response = await octokit.activity.listPublicEventsForUser({
		username: user
	});
	const activities = response.data
		.map((event) => {
			let description = '';
			if (event.type === 'CreateEvent') {
				// @ts-expect-error
				description = `[GitHub] Created ${event.payload.ref_type} ${event.payload.ref}`;
			} else if (event.type === 'PullRequestEvent' && event.payload.action === 'opened') {
				// @ts-expect-error
				description = `[GitHub] Opened a pull request: ${event.payload.pull_request.title}`;
			} else if (event.type === 'IssueCommentEvent') {
				// @ts-expect-error
				description = `[GitHub] Commented on an issue: ${event.payload.issue.title}`;
			}
			return {
				timestamp: event.created_at ? new Date(event.created_at) : null,
				description,
				link: event.repo.url
			};
		})
		.filter((activity) => activity.timestamp !== null && activity.description !== '') as Activity[];
	return activities;
}
