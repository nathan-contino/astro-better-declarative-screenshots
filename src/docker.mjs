// manages the Docker container lifecycle for screenshot sessions.
// starts the container, optionally loads a kickstart file, then polls
// a health check URL until the app is ready (or timeout).

import { execSync, spawn } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Start the Docker service described in config.docker and wait for it to be healthy.
 *
 * @param {import('./config.mjs').ConfigSchema['_type']['docker']} dockerConfig
 * @param {string} projectRoot
 * @returns {Promise<void>}
 */
export async function startDocker(dockerConfig, projectRoot) {
  if (!dockerConfig) return;

  const composePath = dockerConfig.compose
    ? path.resolve(projectRoot, dockerConfig.compose)
    : null;

  if (composePath) {
    const env = buildEnv(dockerConfig.env ?? {}, dockerConfig.kickstart, projectRoot);

    console.log(`[docker] starting services via ${path.basename(composePath)}`);
    execSync(
      `docker compose -f "${composePath}" up -d${dockerConfig.service ? ' ' + dockerConfig.service : ''}`,
      { stdio: 'inherit', env: { ...process.env, ...env } }
    );
  }

  console.log(`[docker] waiting for ${dockerConfig.healthcheck.url}`);
  await pollHealthcheck(dockerConfig.healthcheck);
  console.log('[docker] app is ready');
}

/**
 * Stop and remove containers started for this session.
 *
 * @param {import('./config.mjs').ConfigSchema['_type']['docker']} dockerConfig
 * @param {string} projectRoot
 */
export function stopDocker(dockerConfig, projectRoot) {
  if (!dockerConfig?.compose) return;

  const composePath = path.resolve(projectRoot, dockerConfig.compose);
  console.log('[docker] stopping services');
  try {
    execSync(
      `docker compose -f "${composePath}" down`,
      { stdio: 'inherit' }
    );
  } catch (e) {
    console.warn('[docker] warning: docker compose down failed:', e.message);
  }
}

async function pollHealthcheck({ url, timeout = 60000, interval = 2000 }) {
  const deadline = Date.now() + timeout;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(interval) });
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
    await sleep(interval);
  }

  throw new Error(
    `[docker] health check timed out after ${timeout}ms waiting for ${url}: ${lastError?.message}`
  );
}

function buildEnv(extraEnv, kickstartPath, projectRoot) {
  const env = { ...extraEnv };
  if (kickstartPath) {
    const absPath = path.resolve(projectRoot, kickstartPath);
    let content;
    try {
      content = readFileSync(absPath, 'utf8');
    } catch {
      throw new Error(`[docker] kickstart file not found: ${absPath}`);
    }
    // pass kickstart content as an env var; the docker-compose file is expected
    // to wire it into the container as FUSIONAUTH_APP_KICKSTART_FILE or similar
    env.SCREENSHOT_KICKSTART_CONTENT = content;
    env.SCREENSHOT_KICKSTART_PATH = absPath;
  }
  return env;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
