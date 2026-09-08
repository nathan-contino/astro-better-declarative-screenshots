# astro-better-declarative-screenshots

Declarative, Docker-backed screenshots for Astro documentation sites.

Define which pages to screenshot and which elements to highlight directly in your MDX. The package handles starting Docker, capturing pages with Playwright WebKit, compositing a macOS Safari-style window chrome, and writing PNGs. A CI workflow detects visual regressions by diffing new captures against committed references.

## How it works

1. You declare screenshots in MDX using `<Screenshot>` and `<Highlight>` components.
2. Running `take-screenshots` scans your source files, boots Docker, opens each URL in Playwright WebKit, injects highlights, composites chrome, and writes PNGs to your output directory.
3. You commit the PNG files. The `<Screenshot>` component renders them as `<img>` tags at build time.
4. In CI, `check-screenshots` recaptures every page and diffs against the committed files. It exits non-zero if anything changed beyond the configured pixel threshold, and uploads diff images as build artifacts.

## Quick start

```sh
npm install astro-better-declarative-screenshots
npx playwright install --with-deps webkit
```

Add the integration to `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import screenshots from 'astro-better-declarative-screenshots';

export default defineConfig({
  integrations: [screenshots()],
});
```

Create `screenshot.config.mjs` at your project root (see [CONFIGURATION.md](./CONFIGURATION.md) for all options):

```js
export default {
  baseUrl: 'http://localhost:9011',
  outputDir: 'public/screenshots',
  docker: {
    compose:   'docker-compose.yml',
    service:   'app',
    kickstart: 'kickstart/bootstrap.json',
    healthcheck: {
      url:     'http://localhost:9011/api/status',
      timeout: 60000,
    },
  },
};
```

Use `<Screenshot>` in your MDX files:

```mdx
import Screenshot from 'astro-better-declarative-screenshots/Screenshot.astro';
import Highlight from 'astro-better-declarative-screenshots/Highlight.astro';

<Screenshot url="/admin/group/add">
  <Highlight selector="#name" style="border" color="#f60" label="Group name" />
</Screenshot>
```

Take screenshots:

```sh
npx take-screenshots
```

## Components

### `<Screenshot>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `url` | `string` | required | URL path (relative) or full URL to capture |
| `id` | `string` | auto-derived | Explicit output filename (without extension) |
| `alt` | `string` | derived from name | Alt text for the rendered image |
| `width` | `number` | from config | Viewport width for this screenshot |
| `height` | `number` | from config | Viewport height for this screenshot |
| `fullPage` | `boolean` | `false` | Capture full scrollable page height |

### `<Highlight>`

Must be a direct child of `<Screenshot>`.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `selector` | `string` | required | CSS selector for the element to highlight |
| `style` | `'border' \| 'arrow' \| 'both'` | `'border'` | How to draw the highlight |
| `color` | `string` | `'#f60'` | Highlight color (any CSS color) |
| `label` | `string` | `''` | Text label drawn near the highlighted element |
| `borderWidth` | `number` | `3` | Border thickness in pixels |

## Filename derivation

Screenshot filenames are derived from the URL path and highlight selectors:

- `/admin/group/add` with no highlights -> `admin-group-add.png`
- `/admin/group` with `#name` highlighted -> `admin-group-name.png`
- Same URL, same selectors, second occurrence -> `admin-group-1.png`

To avoid collision issues, set an explicit `id` prop when the same URL appears multiple times with the same highlights.

## CLI reference

### `take-screenshots`

Captures all screenshots and writes them to `outputDir`.

```sh
npx take-screenshots [--filter <string>] [--strict]
```

Options:
- `--filter <string>` -- only capture screenshots whose name or URL contains this string
- `--strict` -- exit non-zero if any screenshot fails to capture

### `check-screenshots`

Captures all screenshots, diffs against committed references, and exits non-zero if anything changed.

```sh
npx check-screenshots [--filter <string>] [--diff-dir <path>] [--threshold <ratio>] [--fail-on-missing]
```

Options:
- `--filter <string>` -- only check screenshots matching this string
- `--diff-dir <path>` -- where to write diff images (default: `.screenshot-diffs`)
- `--threshold <ratio>` -- fraction of pixels that may differ before failure (default: `0.001` = 0.1%)
- `--fail-on-missing` -- exit non-zero if any reference file is missing

## Environment variables

- `SCREENSHOTS_STRICT=true` -- strict mode: the `<Screenshot>` component throws at build time if the PNG is missing
- `SCREENSHOTS_DIR` -- override the output directory (useful for CI artifact staging)

## CI setup

See [`.github/workflows/check-screenshots.yml`](./.github/workflows/check-screenshots.yml) for an example weekly workflow that runs `check-screenshots` and uploads diff images as artifacts.

## License

MIT
