# ImageKit timeline upload setup

The personal page now includes an **Add photos** button. After this one-time setup, photos, titles, dates, and links can be published directly from the website without opening ImageKit.

## Production setup

From the project directory, set these Cloudflare Worker secrets:

```sh
npx wrangler secret put IMAGEKIT_PRIVATE_KEY
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_SESSION_SECRET
```

- `IMAGEKIT_PRIVATE_KEY` must be an ImageKit private key with **Media management: Read and write** permission. A read-only restricted key can display the timeline but cannot upload, edit, or delete photos.
- `ADMIN_PASSWORD` is the fixed password used by the website upload dialog. Use at least 12 characters.
- `ADMIN_SESSION_SECRET` signs the eight-hour admin session cookie. Generate a different random value with `openssl rand -base64 32`.

Do not add these values to `wrangler.toml` or commit them to Git.

Deploy after setting the secrets:

```sh
npm run deploy:cloudflare
```

The workflow uses the existing `title`, `caption`, `date`, `category`, `location`, and `alt` metadata fields. It does not need permission to create ImageKit account-level metadata fields. Photos are resized and converted in the browser before being sent through the Worker to ImageKit. Multiple photos selected together become one timeline moment and share the entered title, subtitle, date, category, location, and links.

## Local testing

Create an ignored `.dev.vars` file:

```dotenv
IMAGEKIT_PRIVATE_KEY="your_imagekit_private_key"
ADMIN_PASSWORD="your_local_admin_password"
ADMIN_SESSION_SECRET="a_separate_long_random_value"
```

Then run the Worker locally (the dedicated script keeps Wrangler's changing state outside the static asset directory):

```sh
npm run dev:worker
```

Open `http://localhost:8787/personal`, click **Add photos**, and sign in with `ADMIN_PASSWORD`. A plain static server such as `npm run dev` can display the page but cannot run the secure upload API.

## Upload behavior

- 1–12 JPEG, PNG, or WebP photos per timeline moment
- title, subtitle, and date are required
- category and location are supported; location is optional
- up to six optional HTTP/HTTPS links
- chronological rendering based on the entered date
- responsive bento-style galleries and a scroll-animated timeline
- partial ImageKit uploads are rolled back if any image in the group fails
