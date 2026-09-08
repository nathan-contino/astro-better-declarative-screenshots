import { z } from 'zod';
import { pathToFileURL } from 'url';
import { existsSync } from 'fs';
import path from 'path';

const WindowSizeSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const DockerSchema = z.object({
  // path to a docker-compose file, or an inline service definition
  compose: z.string().optional(),
  // service name to wait on (if using compose)
  service: z.string().optional(),
  // health check URL -- polled until 200 or timeout
  healthcheck: z.object({
    url: z.string().url(),
    timeout: z.number().int().positive().default(60000),
    interval: z.number().int().positive().default(2000),
  }),
  // path to a kickstart/bootstrap file passed to the container
  kickstart: z.string().optional(),
  // arbitrary env vars merged into the container environment
  env: z.record(z.string()).optional(),
});

const ChromeSchema = z.object({
  // 'safari-macos' | 'none'
  style: z.enum(['safari-macos', 'none']).default('safari-macos'),
  // show the URL bar in the chrome
  showUrl: z.boolean().default(true),
  // dark chrome (title bar) regardless of page dark mode
  dark: z.boolean().default(false),
  // drop shadow radius in pixels; 0 to disable
  shadowBlur: z.number().int().min(0).default(40),
  // extra padding around the window to make room for the shadow
  shadowPadding: z.number().int().min(0).default(48),
});

const ConfigSchema = z.object({
  // base URL of the running app
  baseUrl: z.string().url(),

  // where to write screenshot PNGs -- relative to the project root
  outputDir: z.string().default('./src/assets/screenshots'),

  // default window dimensions
  window: WindowSizeSchema.default({ width: 1280, height: 800 }),

  // minimum and maximum window dimensions enforced globally
  minWindow: WindowSizeSchema.default({ width: 640, height: 400 }),
  maxWindow: WindowSizeSchema.default({ width: 2560, height: 1600 }),

  // maximum dimensions for full-page captures
  maxFullPage: WindowSizeSchema.default({ width: 2560, height: 8000 }),

  // window chrome style
  chrome: ChromeSchema.default({}),

  // browser engine -- webkit gives the most Safari-accurate render
  browser: z.enum(['webkit', 'chromium', 'firefox']).default('webkit'),

  // default color scheme
  colorScheme: z.enum(['light', 'dark']).default('light'),

  // docker service configuration
  docker: DockerSchema,

  // strict mode -- fail the build when a screenshot file is missing
  // defaults to true when SCREENSHOTS_STRICT=true env var is set
  strict: z.boolean().default(process.env.SCREENSHOTS_STRICT === 'true'),

  // called once before all screenshots are taken (good for login flows)
  beforeAll: z.function().args(z.any()).returns(z.promise(z.any())).optional(),

  // called before each individual screenshot
  beforeScreenshot: z.function().args(z.any(), z.any()).returns(z.promise(z.any())).optional(),

  // called once after all screenshots are taken
  afterAll: z.function().returns(z.promise(z.any())).optional(),
});

export async function loadConfig(projectRoot) {
  const candidates = [
    path.join(projectRoot, 'screenshot.config.mjs'),
    path.join(projectRoot, 'screenshot.config.js'),
  ];

  const configPath = candidates.find(existsSync);
  if (!configPath) {
    throw new Error(
      `No screenshot.config.mjs found in ${projectRoot}. ` +
      `Create one -- see the README for the full config reference.`
    );
  }

  const raw = await import(pathToFileURL(configPath).href);
  const config = raw.default ?? raw;

  const result = ConfigSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`screenshot.config.mjs is invalid:\n${issues}`);
  }

  return result.data;
}

export { ConfigSchema };
