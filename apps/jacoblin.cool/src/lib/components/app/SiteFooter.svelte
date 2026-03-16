<script lang="ts">
    import { resolve } from '$app/paths';
    import { privacyPolicyContent } from '$lib/content/privacy-policy';
</script>

<footer class="site-footer mt-12 border-t border-white/8 pt-6 pb-3 sm:mt-16 sm:pt-7">
    <div class="flex justify-center">
        <a
            href={resolve('/privacy')}
            class="inline-flex items-center rounded-full border border-white/12 bg-white/4 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/22 hover:bg-white/7 hover:text-zinc-100"
        >
            {privacyPolicyContent.footerLinkLabel}
        </a>
    </div>
</footer>
