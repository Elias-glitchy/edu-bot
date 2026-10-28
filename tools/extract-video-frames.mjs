import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  "file:///C:/Users/elias/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs"
);

const [videoPath, outputDir, intervalArg = "5", widthArg = "640"] = process.argv.slice(2);

if (!videoPath || !outputDir) {
  console.error("Usage: node extract-video-frames.mjs <video> <output-dir> [interval-seconds] [width]");
  process.exit(1);
}

const explicitTimes = intervalArg.startsWith("times:")
  ? intervalArg.slice("times:".length).split(",").map(Number)
  : null;
const interval = explicitTimes ? null : Number(intervalArg);
const targetWidth = Number(widthArg);
if ((!explicitTimes && !(interval > 0)) || explicitTimes?.some((time) => !(time >= 0)) || !(targetWidth > 0)) {
  throw new Error("interval-seconds/times and width must contain valid positive numbers");
}

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const videoUrl = pathToFileURL(path.resolve(videoPath)).href;
  await page.goto(videoUrl, { waitUntil: "commit", timeout: 30_000 });
  await page.locator("video").evaluate((video) => {
    video.muted = true;
    video.controls = false;
    Object.assign(video.style, {
      display: "block",
      width: "100vw",
      height: "100vh",
      objectFit: "contain",
    });
    Object.assign(document.body.style, {
      margin: "0",
      background: "#000",
      overflow: "hidden",
    });
  });

  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return Number.isFinite(video?.duration) && video.videoWidth > 0 && video.videoHeight > 0;
  }, { timeout: 30_000 });

  const metadata = await page.locator("video").evaluate((video) => ({
    duration: video.duration,
    width: video.videoWidth,
    height: video.videoHeight,
  }));

  const targetHeight = Math.round(targetWidth * metadata.height / metadata.width);
  await page.setViewportSize({ width: targetWidth, height: targetHeight });

  const timestamps = explicitTimes
    ? [...new Set(explicitTimes)].filter((time) => time < metadata.duration).sort((a, b) => a - b)
    : [];
  if (!explicitTimes) {
    for (let t = 0; t < metadata.duration; t += interval) timestamps.push(t);
    if (timestamps.at(-1) < metadata.duration - 0.5) timestamps.push(Math.max(0, metadata.duration - 0.25));
  }

  for (let i = 0; i < timestamps.length; i += 1) {
    const t = timestamps[i];
    await page.locator("video").evaluate(async (video, seekTime) => {
      if (Math.abs(video.currentTime - seekTime) < 0.02 && video.readyState >= 2) return;
      await new Promise((resolve, reject) => {
        const onSeeked = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(video.error ?? new Error("Video seek failed"));
        };
        const cleanup = () => {
          video.removeEventListener("seeked", onSeeked);
          video.removeEventListener("error", onError);
        };
        video.addEventListener("seeked", onSeeked, { once: true });
        video.addEventListener("error", onError, { once: true });
        video.currentTime = Math.min(seekTime, Math.max(0, video.duration - 0.05));
      });
    }, t);

    const stamp = t.toFixed(2).padStart(8, "0").replace(".", "_");
    const fileName = `${String(i + 1).padStart(4, "0")}_${stamp}s.jpg`;
    await page.locator("video").screenshot({
      path: path.join(outputDir, fileName),
      type: "jpeg",
      quality: 84,
    });
    if ((i + 1) % 25 === 0 || i === timestamps.length - 1) {
      console.log(`captured ${i + 1}/${timestamps.length}`);
    }
  }

  const manifest = { source: path.resolve(videoPath), ...metadata, interval, targetWidth, frames: timestamps.length };
  await fs.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest));
} finally {
  await browser.close();
}
