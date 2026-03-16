<script lang="ts">
    import { privacyPolicyContent } from '$lib/content/privacy-policy';
    import { siteConfig } from '$lib/config/site';

    const content = privacyPolicyContent;
</script>

<svelte:head>
    <title>{content.title} | {siteConfig.identity.name}</title>
    <meta name="description" content={content.summary} />
</svelte:head>

<section class="mx-auto w-full max-w-5xl py-2 sm:py-4">
    <div
        class="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,20,33,0.8),rgba(9,12,22,0.58))] px-6 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.34)] sm:px-8 sm:py-9"
    >
        <p class="text-xs font-semibold tracking-[0.24em] text-cyan-300/82 uppercase">
            {content.eyebrow}
        </p>
        <h1 class="mt-3 text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
            {content.title}
        </h1>
        <p class="mt-4 max-w-3xl text-base leading-7 text-zinc-300 sm:text-lg">
            {content.summary}
        </p>
        <p class="mt-5 text-sm text-zinc-500">Last updated {content.updatedAt}</p>
    </div>

    <nav
        aria-label="Privacy sections"
        class="mt-6 flex flex-wrap gap-2 rounded-[1.75rem] border border-white/8 bg-white/3 p-3"
    >
        {#each content.sectionLinks as section (section.id)}
            <a
                href={`#${section.id}`}
                class="inline-flex items-center rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/7 hover:text-zinc-100"
            >
                {section.label}
            </a>
        {/each}
    </nav>

    <div class="mt-6 space-y-6">
        <section
            id="overview"
            class="privacy-section rounded-[1.75rem] border border-white/8 bg-white/3 p-6 sm:p-7"
        >
            <h2 class="text-2xl font-semibold tracking-tight text-zinc-50">Overview</h2>
            <div class="mt-4 space-y-4 text-sm leading-7 text-zinc-300 sm:text-base">
                {#each content.overview as paragraph (paragraph)}
                    <p>{paragraph}</p>
                {/each}
            </div>
        </section>

        <section
            id="information-we-use"
            class="privacy-section rounded-[1.75rem] border border-white/8 bg-white/3 p-6 sm:p-7"
        >
            <h2 class="text-2xl font-semibold tracking-tight text-zinc-50">Information we use</h2>
            <div class="mt-5 grid gap-4 lg:grid-cols-2">
                {#each content.informationWeUse as item (item.id)}
                    <article class="rounded-[1.5rem] border border-white/8 bg-black/18 p-5">
                        <h3 class="text-lg font-semibold tracking-tight text-zinc-100">
                            {item.title}
                        </h3>
                        <p class="mt-3 text-sm leading-7 text-zinc-300">{item.description}</p>
                    </article>
                {/each}
            </div>
        </section>

        <section
            id="how-we-use-it"
            class="privacy-section rounded-[1.75rem] border border-white/8 bg-white/3 p-6 sm:p-7"
        >
            <h2 class="text-2xl font-semibold tracking-tight text-zinc-50">How we use it</h2>
            <ul class="mt-4 space-y-3 text-sm leading-7 text-zinc-300 sm:text-base">
                {#each content.howWeUseIt as item (item)}
                    <li class="flex gap-3">
                        <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/80"></span>
                        <span>{item}</span>
                    </li>
                {/each}
            </ul>
        </section>

        <section
            id="third-party-services"
            class="privacy-section rounded-[1.75rem] border border-white/8 bg-white/3 p-6 sm:p-7"
        >
            <h2 class="text-2xl font-semibold tracking-tight text-zinc-50">Third-party services</h2>
            <div class="mt-5 grid gap-4">
                {#each content.thirdPartyServices as service (service.id)}
                    <article class="rounded-[1.5rem] border border-white/8 bg-black/18 p-5">
                        <h3 class="text-lg font-semibold tracking-tight text-zinc-100">
                            {service.name}
                        </h3>
                        <dl class="mt-4 grid gap-4 text-sm leading-7 text-zinc-300 lg:grid-cols-3">
                            <div>
                                <dt
                                    class="text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase"
                                >
                                    Purpose
                                </dt>
                                <dd class="mt-2">{service.purpose}</dd>
                            </div>
                            <div>
                                <dt
                                    class="text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase"
                                >
                                    Possible data involved
                                </dt>
                                <dd class="mt-2">{service.possibleData}</dd>
                            </div>
                            <div>
                                <dt
                                    class="text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase"
                                >
                                    Processing scope
                                </dt>
                                <dd class="mt-2">{service.processingScope}</dd>
                            </div>
                        </dl>
                    </article>
                {/each}
            </div>
        </section>

        <section
            id="cookies-and-browser-state"
            class="privacy-section rounded-[1.75rem] border border-white/8 bg-white/3 p-6 sm:p-7"
        >
            <h2 class="text-2xl font-semibold tracking-tight text-zinc-50">
                Cookies and browser state
            </h2>
            <ul class="mt-4 space-y-3 text-sm leading-7 text-zinc-300 sm:text-base">
                {#each content.cookiesAndBrowserState as item (item)}
                    <li class="flex gap-3">
                        <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80"
                        ></span>
                        <span>{item}</span>
                    </li>
                {/each}
            </ul>
        </section>

        <section
            id="what-we-do-not-use"
            class="privacy-section rounded-[1.75rem] border border-white/8 bg-white/3 p-6 sm:p-7"
        >
            <h2 class="text-2xl font-semibold tracking-tight text-zinc-50">What we do not use</h2>
            <ul class="mt-4 space-y-3 text-sm leading-7 text-zinc-300 sm:text-base">
                {#each content.whatWeDoNotUse as item (item)}
                    <li class="flex gap-3">
                        <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/80"></span>
                        <span>{item}</span>
                    </li>
                {/each}
            </ul>
        </section>

        <section
            id="updates"
            class="privacy-section rounded-[1.75rem] border border-white/8 bg-white/3 p-6 sm:p-7"
        >
            <h2 class="text-2xl font-semibold tracking-tight text-zinc-50">Updates</h2>
            <div class="mt-4 space-y-4 text-sm leading-7 text-zinc-300 sm:text-base">
                {#each content.updates as paragraph (paragraph)}
                    <p>{paragraph}</p>
                {/each}
            </div>
        </section>
    </div>
</section>

<style>
    .privacy-section {
        scroll-margin-top: calc(3.5rem + 1.25rem);
    }
</style>
