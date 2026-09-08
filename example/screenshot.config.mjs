// example screenshot.config.mjs for the FusionAuth docs site
// place at your Astro project root

export default {
  // base URL of the running app (local or in Docker)
  baseUrl: 'http://localhost:9011',

  // where to write screenshots; relative to project root
  outputDir: 'public/screenshots',

  // default viewport
  window: { width: 1280, height: 800 },

  // Playwright browser engine
  browser: 'webkit',

  // macOS Safari-style chrome with drop shadow
  chrome: {
    style:         'safari-macos',
    showUrl:       true,
    dark:          false,
    shadowBlur:    40,
    shadowPadding: 48,
  },

  // docker setup -- start the app and wait for it to be healthy
  docker: {
    compose:  'docker-compose.yml',
    service:  'fusionauth',
    kickstart: 'kickstart/kickstart.json',
    healthcheck: {
      url:      'http://localhost:9011/api/status',
      timeout:  90000,
      interval: 2000,
    },
    env: {
      DATABASE_PASSWORD: 'change-in-production',
    },
  },

  // called once before any screenshot is taken -- log in, set up app state, etc.
  beforeAll: async (context) => {
    const page = await context.newPage();
    await page.goto('http://localhost:9011/admin/login');
    await page.fill('#loginId', 'admin@example.com');
    await page.fill('#password', 'password');
    await page.click('[type=submit]');
    await page.waitForURL('**/admin/**');
    await page.close();
  },

  // called before each individual screenshot -- navigate or set up state
  beforeScreenshot: async (page, { url, name }) => {
    // page is already navigated to url by this point
    // close any open modals, dismiss notifications, etc.
    await page.evaluate(() => {
      document.querySelectorAll('.notification, .toast').forEach(el => el.remove());
    });
  },
};
