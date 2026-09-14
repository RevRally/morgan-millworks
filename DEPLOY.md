# Morgan-Millworks — deploying to Netlify

There are two ways to run this site. Read the first section before choosing.

## Which one you want

**Instant publishing (recommended).** Bruce presses Publish in the editor
and the change is live for everyone in seconds. Requires the site to be
connected to a Git repository, because the publishing code needs one
dependency installed and Netlify only installs dependencies during a
build. Drag-and-drop deploys skip the build entirely, so they cannot run
it.

**Plain static.** Drag the `site` folder onto Netlify. The website works
perfectly and the editor still works, but Publish falls back to building
a file that has to be uploaded by hand — the loop this project has been
trying to get rid of. The editor says so plainly at the top, so there is
no mystery about which mode is in force.

Nothing is lost by starting static and switching to Git later.

## What goes on the server

```
site/index.html                 the website — this folder is the web root
netlify/functions/site-data.mjs the content store
netlify/functions/photo.mjs     serves uploaded photographs
netlify.toml                    configuration
package.json                    the one dependency
```

Only `site` is served to visitors. The functions, the configuration and
this file all sit **outside** it on purpose — server code must not be
downloadable from the website.

## Setting up instant publishing

1. Put these files in a Git repository (GitHub is easiest) with the layout
   shown above.
2. In Netlify: **Site configuration → Build & deploy → Link repository**,
   and point it at that repo. The build command and publish directory come
   from `netlify.toml`; leave them alone.
3. **Site configuration → Environment variables** → add `EDITOR_PASSWORD`,
   set to the password Bruce types to sign in. **Not optional** — without
   it, publishing is refused outright and the editor says so. There is no
   fallback password, so a skipped step locks the editor rather than
   leaving it open.
4. Deploy.

Design changes from then on are a `git push`, not a drag-and-drop.

## Checking it worked

Open `/api/site-data` on the live site.

- `{"ok":true,"data":null}` — working. The empty answer is the healthy one
  before anything has been published.
- **The website itself appears** — the functions did not load, so the
  request fell through to the page. The deploy was manual, or the build did
  not run. Check the deploy log shows `npm install`, and that
  `netlify.toml` is at the repository root beside `package.json`.

Then try `/.netlify/functions/site-data`, which Netlify always answers on
regardless of any routing rules. If that one works and `/api/site-data`
does not, publishing still works — the editor tries both.

The editor is also explicit about it: the line under the tabs reads
either "Live since …" or a plain statement that instant publishing is not
switched on for this page.

## Running static on purpose

Drag the `site` folder onto the deploy dropzone and ignore everything
outside it. The editor detects that the publishing addresses do not answer
and falls back by itself, saying so in red under the tabs.

## A note on timing

Both functions read and write with strong consistency, so a change is
readable the instant it is written. Without that, Netlify's storage may
serve the previous content for a short window after a write — which would
look exactly like a publish that did not take.

## Backing up the content

With instant publishing on, the content lives in Netlify's storage rather
than in the HTML. To keep a copy, open `/api/site-data` on the live site
and save what it returns. The Netlify UI also lists it under
**Data & storage → Blobs**.
