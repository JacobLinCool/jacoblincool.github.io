<script lang="ts">
	import { page } from "$app/stores";
	import type { PostMetadata } from "$lib/server/blog";

	export let data: { posts: PostMetadata[] };
</script>

<div class="w-full pt-24 px-4 md:px-8 lg:px-16">
	<h1 class="text-4xl leading-snug md:leading-snug md:text-6xl font-bold">{$page.params.tag}</h1>
	<hr class="w-1/2 border-2 border-slate-300 my-4" />

	<div>
		<p class="mb-4">Posts tagged with #{$page.params.tag}</p>
	</div>

	<div class="w-full">
		{#each data.posts as post}
			<div class="w-full pb-4">
				<a href="/blog/post/{post.slug}">
					<div
						class="w-full bg-slate-100 rounded-lg shadow shadow-slate-300 p-2 hover:shadow-md transition-all"
					>
						<div class="h-full flex flex-col md:flex-row justify-between">
							<div class="w-full md:h-full flex justify-center md:max-w-xs">
								<div
									class="w-full md:h-full flex justify-center aspect-video rounded-lg shadow shadow-slate-300 bg-center bg-contain bg-no-repeat"
									style="background-image: url({post.meta.cover})"
								/>
							</div>
							<div class="flex-1 h-full py-2 md:py-0">
								<div class="h-full flex flex-col md:flex-row justify-between md:items-end">
									<div class="flex flex-row">
										<div class="flex flex-row items-center">
											<div class="flex flex-row items-center">
												<h2 class="ml-2 text-slate-700 font-bold md:text-2xl">
													{post.meta.title}
												</h2>
											</div>
										</div>
									</div>
									<div class="flex flex-row">
										<div class="flex flex-row items-center mr-2">
											<p class="ml-2 text-slate-500 transition-all">
												{new Date(post.meta.date).toDateString()}
											</p>
										</div>
									</div>
								</div>
								<hr class="border border-slate-300 m-2" />
								<div class="flex flex-row justify-between items-end">
									<div class="flex flex-row">
										<div class="flex flex-row items-center">
											<p class="ml-2 text-slate-500 transition-all">
												{post.meta.description}
											</p>
										</div>
									</div>
									<div class="flex flex-row">
										<div class="flex flex-row items-center mr-2">
											<p class="ml-2 text-slate-500 transition-all">{post.meta.readtime} read</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</a>
			</div>
		{/each}
	</div>
</div>
