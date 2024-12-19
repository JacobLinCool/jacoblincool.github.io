import type { Activity } from '$lib/chat';

export async function getHuggingfaceActivities(user: string): Promise<Activity[]> {
	const url = `https://huggingface.co/api/recent-activity?limit=20&activityType=all-without-repo-discussions&feedType=user&skip=0&entity=${user}`;
	const response = await fetch(url);
	const data = await response.json();

	const activities = data.recentActivity.map((activity: any) => {
		let description = '';
		let link: string | undefined = undefined;
		if (activity.type === 'update') {
			if (activity.repoType === 'model') {
				description = `[Hugging Face] Updated a model "${activity.repoId}"`;
				link = `https://huggingface.co/${activity.repoId}`;
			} else if (activity.repoType === 'dataset') {
				description = `[Hugging Face] Updated a dataset "${activity.repoId}"`;
				link = `https://huggingface.co/datasets/${activity.repoId}`;
			} else if (activity.repoType === 'space') {
				description = `[Hugging Face] Updated a space "${activity.repoId}"`;
				link = `https://huggingface.co/spaces/${activity.repoId}`;
			}
		}
		return {
			timestamp: new Date(activity.time),
			description,
			link
		};
	});

	return activities;
}
