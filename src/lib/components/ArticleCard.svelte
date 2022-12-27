<script lang="ts">
	import type { PostMetadata } from "$lib/server/blog/db";

	export let post: PostMetadata;
</script>

<div class="article-card w-full pb-4">
	<a href="/blog/post/{post.slug}">
		<div
			class="w-full bg-slate-100 rounded-lg shadow shadow-slate-300 p-2 hover:shadow-md transition-all"
		>
			<div class="h-full flex flex-col md:flex-row justify-between">
				<div class="w-full md:h-full flex justify-center md:max-w-xs">
					<div
						class="w-full md:h-full flex justify-center aspect-video rounded-lg shadow shadow-slate-300 bg-center bg-contain bg-no-repeat"
						style="background-image: url({post.cover})"
					/>
				</div>
				<div class="flex-1 h-full py-2 md:py-0">
					<div class="h-full flex flex-col md:flex-row justify-between md:items-end">
						<div class="flex flex-row">
							<div class="flex flex-row items-center">
								<div class="flex flex-row items-center">
									<h2 class="ml-2 text-slate-700 font-bold md:text-2xl">
										{post.title}
									</h2>
								</div>
							</div>
						</div>
						<div class="flex flex-row">
							<div class="flex flex-row items-center mr-2">
								<p class="ml-2 text-slate-500">
									{new Date(post.date).toDateString()} · {post.readtime} read
								</p>
							</div>
						</div>
					</div>
					<hr class="border border-slate-300 m-2" />

					<div class="w-full">
						<div class="flex flex-row items-center">
							{#each post.tags as tag}
								<p class="ml-2 text-slate-400">
									#{tag.name}
								</p>
							{/each}
						</div>
						<p class="ml-2 text-slate-600">
							{post.description}
						</p>
					</div>
				</div>
			</div>
		</div>
	</a>
</div>
