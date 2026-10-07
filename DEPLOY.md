# Deploy to Vercel

1. Push this repository, including the lockfile, assets and `public/mockServiceWorker.js`, to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Keep the repository root as the root directory. Select **Vite** and **Node.js 24.x**.
4. Use these settings (already provided in `vercel.json`):
   - Install: `npm ci`
   - Build: `npm run build`
   - Output: `dist`
5. No environment variables or backend services are required. Click **Deploy**.
6. Open the generated URL, start a match, open Options and Ranking, then refresh the page.

The published demo uses MSW in the browser. **Do not remove `mockServiceWorker.js` from the build.** Confirmed matches, pending uploads and settings persist in that browser's local storage. This is a simulated ranking, not a shared online database.

If Vercel enables Deployment Protection, disable it for the evaluation URL so reviewers can open the game without signing in. Share the production URL and the Git commit used for the deployment.

Local production preview:

```sh
npm ci
npm run build
npm run preview
```

This repository has not been deployed by the coding agent. Publishing and pushing are left to the repository owner.

Reference: [Vercel's Vite guide](https://vercel.com/docs/frameworks/frontend/vite).
