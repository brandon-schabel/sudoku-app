# Preview and GitHub Pages deployment

## Free preview

For a free preview without changing repository settings, run the app locally with `node tools/serve.mjs` and expose it through a temporary HTTPS tunnel such as Cloudflare Quick Tunnel or the equivalent tunnel service available to the team. Share the generated URL and set `BASE_URL` to that URL when running Playwright. The static app needs no build step or server side state.

## GitHub Pages

The `pages.yml` workflow deploys the repository root from `main` after a push. It stages a clean static copy and excludes `node_modules`, `www`, `ios`, `android`, `tests`, and `store` before uploading the Pages artifact. The workflow is committed but has not been dispatched.

Brandon's one-click setup: in GitHub, open **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**, then save. The first deployment runs on the next push to `main`; the published URL appears in that workflow's deployment summary. Keep the repository root as the static site source through the workflow; do not select a branch folder source.
