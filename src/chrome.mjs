// composes a macOS Safari-style window chrome around a screenshot buffer.
// everything is generated programmatically via sharp + SVG -- no PNG templates.

import sharp from 'sharp';

const TITLE_BAR_HEIGHT = 38;
const TRAFFIC_LIGHT_Y = 12;
const TRAFFIC_LIGHT_X0 = 14;
const TRAFFIC_LIGHT_RADIUS = 6;
const TRAFFIC_LIGHT_GAP = 8;
const URL_BAR_HEIGHT = 28;
const URL_BAR_MARGIN_X = 80;
const URL_BAR_MARGIN_Y = 5;
const URL_BAR_RADIUS = 6;
const TOTAL_CHROME_HEIGHT = TITLE_BAR_HEIGHT + URL_BAR_HEIGHT + URL_BAR_MARGIN_Y;

/**
 * @param {Buffer} screenshotBuffer - PNG of the page content
 * @param {object} opts
 * @param {string} [opts.url=''] - URL to display in the address bar
 * @param {boolean} [opts.dark=false] - use dark chrome
 * @param {boolean} [opts.showUrl=true] - render the URL bar
 * @param {number} [opts.shadowBlur=40] - drop shadow blur radius in px (0 = no shadow)
 * @param {number} [opts.shadowPadding=48] - extra padding to accommodate the shadow
 * @returns {Promise<Buffer>} PNG with chrome composited on top
 */
export async function addChrome(screenshotBuffer, opts = {}) {
  const {
    url = '',
    dark = false,
    showUrl = true,
    shadowBlur = 40,
    shadowPadding = 48,
  } = opts;

  const pageImg = sharp(screenshotBuffer);
  const { width: pageWidth, height: pageHeight } = await pageImg.metadata();

  const chromeHeight = showUrl ? TOTAL_CHROME_HEIGHT : TITLE_BAR_HEIGHT;
  const totalWidth = pageWidth + (shadowBlur > 0 ? shadowPadding * 2 : 0);
  const totalHeight = pageHeight + chromeHeight + (shadowBlur > 0 ? shadowPadding * 2 : 0);

  const windowX = shadowBlur > 0 ? shadowPadding : 0;
  const windowY = shadowBlur > 0 ? shadowPadding : 0;
  const windowWidth = pageWidth;
  const windowHeight = pageHeight + chromeHeight;

  // color scheme
  const bg = dark ? '#2b2b2b' : '#ececec';
  const urlBarBg = dark ? '#3c3c3e' : '#ffffff';
  const urlTextColor = dark ? '#e0e0e0' : '#333';
  const titleTextColor = dark ? '#ddd' : '#333';

  const chromeSvg = buildChromeSvg({
    windowWidth,
    chromeHeight,
    bg,
    urlBarBg,
    urlTextColor,
    titleTextColor,
    showUrl,
    url,
  });

  const chromeBuf = await sharp(Buffer.from(chromeSvg))
    .resize(windowWidth, chromeHeight)
    .png()
    .toBuffer();

  // drop shadow is rendered as a blurred dark rect behind the window
  // we composite: shadow canvas > page content > chrome bar
  const layers = [];

  if (shadowBlur > 0) {
    const shadowSvg = buildShadowSvg({
      totalWidth,
      totalHeight,
      windowX,
      windowY,
      windowWidth,
      windowHeight,
      shadowBlur,
    });
    const shadowBuf = await sharp(Buffer.from(shadowSvg))
      .resize(totalWidth, totalHeight)
      .png()
      .toBuffer();
    layers.push({ input: shadowBuf, top: 0, left: 0 });
  }

  // page content goes below the chrome bar
  layers.push({ input: screenshotBuffer, top: windowY + chromeHeight, left: windowX });
  // chrome bar on top
  layers.push({ input: chromeBuf, top: windowY, left: windowX });

  const base = {
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  };

  return sharp(base).composite(layers).png().toBuffer();
}

function buildChromeSvg({ windowWidth, chromeHeight, bg, urlBarBg, urlTextColor, titleTextColor, showUrl, url }) {
  // traffic light colors (always colored, not grayed out, for visual appeal)
  const tlColors = ['#ff5f57', '#febc2e', '#28c840'];

  const lights = tlColors.map((color, i) => {
    const cx = TRAFFIC_LIGHT_X0 + i * (TRAFFIC_LIGHT_RADIUS * 2 + TRAFFIC_LIGHT_GAP);
    return `<circle cx="${cx}" cy="${TRAFFIC_LIGHT_Y}" r="${TRAFFIC_LIGHT_RADIUS}" fill="${color}"/>`;
  }).join('\n');

  let urlBar = '';
  if (showUrl) {
    const barX = URL_BAR_MARGIN_X;
    const barY = TITLE_BAR_HEIGHT + URL_BAR_MARGIN_Y;
    const barW = windowWidth - URL_BAR_MARGIN_X * 2;
    const displayUrl = url.length > 80 ? url.slice(0, 77) + '...' : url;
    urlBar = `
      <rect x="${barX}" y="${barY}" width="${barW}" height="${URL_BAR_HEIGHT}" rx="${URL_BAR_RADIUS}" fill="${urlBarBg}"/>
      <text
        x="${barX + barW / 2}"
        y="${barY + URL_BAR_HEIGHT / 2 + 1}"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="12"
        fill="${urlTextColor}"
      >${escapeXml(displayUrl)}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${windowWidth}" height="${chromeHeight}">
    <rect width="${windowWidth}" height="${chromeHeight}" fill="${bg}" rx="10" ry="10"/>
    <rect x="0" y="10" width="${windowWidth}" height="${chromeHeight - 10}" fill="${bg}"/>
    ${lights}
    ${urlBar}
  </svg>`;
}

function buildShadowSvg({ totalWidth, totalHeight, windowX, windowY, windowWidth, windowHeight, shadowBlur }) {
  // feDropShadow filter approximates a realistic drop shadow
  const halfBlur = shadowBlur / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}">
    <defs>
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow
          dx="0" dy="${halfBlur / 2}"
          stdDeviation="${halfBlur}"
          flood-color="rgba(0,0,0,0.4)"
        />
      </filter>
    </defs>
    <rect
      x="${windowX}" y="${windowY}"
      width="${windowWidth}" height="${windowHeight}"
      rx="10" ry="10"
      fill="white"
      filter="url(#shadow)"
    />
  </svg>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
