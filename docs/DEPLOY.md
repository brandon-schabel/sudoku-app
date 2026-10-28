# Preview and GitHub Pages deployment

## Free preview

Run the static app locally with `node tests/e2e/server.mjs` and expose it through a temporary HTTPS tunnel such as Cloudflare Quick Tunnel or the equivalent tunnel service available to the team. Set `BASE_URL` to that URL when running Playwright. The server serves only app files, rejects hidden paths and traversal, and needs no runtime dependency.

## GitHub Pages

The `pages.yml` workflow runs `node --test` and the Playwright suite on pushes to `main`, then deploys only after both pass. The deploy job is restricted to `brandon-schabel/sudoku-app`. Its allowlist includes `index.html`, `styles.css`, `src/`, `assets/`, `styles/`, `manifest.webmanifest`, `sw.js`, `privacy.html`, and `.nojekyll`; repository docs, tests, tools, and package files are excluded. The workflow is committed but has not been dispatched.

To enable Pages, open **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**, then save. The published URL appears in the deployment summary after the next successful push to `main`.
