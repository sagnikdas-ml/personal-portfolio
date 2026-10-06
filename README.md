# Sagnik Das Portfolio

Personal portfolio and writing site for Sagnik Das. The site includes the main portfolio, a personal archive, and the Simply ML blog.

## Local development

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. To preview the Cloudflare Worker routes locally, use `npm run dev:worker` instead and open `http://localhost:8787`.

## Content and builds

- Blog posts live in `content/blog/`.
- Personal notes live in `content/personal-notes/`.
- `npm run build:content` updates the generated content data.
- `npm run build:blog` rebuilds the blog in `blog/`.
- `npm run build` runs both build steps.

## Deployment

```sh
npm run deploy:vercel
npm run deploy:cloudflare
```

Cloudflare deployments use `_worker.js` and require the worker's runtime secrets to be configured in Wrangler. Keep secrets out of the repository.