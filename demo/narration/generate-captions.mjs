#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const narrationDir = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(narrationDir, "output");
const timing = JSON.parse(await readFile(resolve(outputDir, "timing.manifest.json"), "utf8"));
const formatTime = (ms, separator) => {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const milliseconds = total % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${separator}${String(milliseconds).padStart(3, "0")}`;
};
const captions = [];
for (const scene of timing.scenes) {
  const sentences = scene.spokenText.match(/[^.!?]+[.!?]+/g) ?? [scene.spokenText];
  const weights = sentences.map((sentence) => sentence.trim().split(/\s+/).length);
  const weightTotal = weights.reduce((a, b) => a + b, 0);
  let cursor = scene.actualStartMs;
  sentences.forEach((sentence, index) => {
    const duration =
      index === sentences.length - 1
        ? scene.actualEndMs - cursor
        : Math.round(scene.actualDurationMs * (weights[index] / weightTotal));
    captions.push({ startMs: cursor, endMs: cursor + duration, text: sentence.trim() });
    cursor += duration;
  });
}
const srt = captions
  .map(
    (caption, index) =>
      `${index + 1}\n${formatTime(caption.startMs, ",")} --> ${formatTime(caption.endMs, ",")}\n${caption.text}\n`,
  )
  .join("\n");
const vtt = `WEBVTT\n\n${captions.map((caption) => `${formatTime(caption.startMs, ".")} --> ${formatTime(caption.endMs, ".")}\n${caption.text}\n`).join("\n")}`;
await writeFile(resolve(outputDir, "narration.srt"), srt);
await writeFile(resolve(outputDir, "narration.vtt"), vtt);
console.log(
  `Wrote ${captions.length} sentence-level captions. They cover audio through ${formatTime(timing.totalDurationMs, ".")}.`,
);
