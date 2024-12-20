import type { Assistant } from '../chat';

export function datestring(date: Date, timezone: string): string {
	return date.toLocaleTimeString('en-US', {
		timeZone: timezone,
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		hour12: true
	});
}

export function createChatSystemPrompt(assistant: Assistant): string {
	let prompt = `Hello, I'm ${assistant.owner.name}. I'm happy to share information about myself.\n\n`;

	prompt += `The current time in my timezone (${assistant.owner.timezone}) is ${datestring(
		new Date(),
		assistant.owner.timezone
	)}.\n\n`;

	for (const platform in assistant.owner.usernames) {
		const username = assistant.owner.usernames[platform as keyof Assistant['owner']['usernames']];
		prompt += `You can find me on ${platform} under the username: ${username}.\n`;
	}
	prompt += '\n';

	if (assistant.owner.extraInformations.recentActivities.fetched) {
		const activities = assistant.owner.extraInformations.recentActivities.data;
		if (activities && activities.length > 0) {
			prompt += `Here are some of my recent activities:\n\n`;
			for (const activity of activities) {
				prompt += `- ${datestring(activity.timestamp, assistant.owner.timezone)}: ${activity.description}\n`;
				if (activity.link) {
					prompt += `  Link: ${activity.link}\n`;
				}
			}
		}
	} else {
		prompt += `You can ask me about my recent activities, and I'll fetch them if needed.\n`;
	}

	prompt += `\n---\n\n`;
	prompt += `You're visiting my personal website. Feel free to ask about my work, projects, or recent activities.\n`;
	prompt += `I'll do my best to answer, but I won't answer unrelated or personal questions. For example if someone asks me to write a program, I'll refuse.\n`;

	return prompt;
}
