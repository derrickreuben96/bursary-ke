#!/usr/bin/env bun
/**
 * scripts/check-bursaries-i18n.ts
 *
 * Scans every `t("...")` call inside the Bursaries page and the bursary
 * homepage components, then verifies that each key:
 *   1. Exists in src/lib/i18n.tsx
 *   2. Has a non-empty Swahili (`sw`) translation
 *   3. Does not silently fall back to the English string
 *
 * Exits with status 1 (fails the build) if any key is missing or untranslated.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

const SOURCE_FILES = [
  "src/pages/Bursaries.tsx",
  "src/components/home/BursaryAdverts.tsx",
  "src/components/home/BursarySlider.tsx",
];

const I18N_FILE = "src/lib/i18n.tsx";

function extractKeys(src: string): string[] {
  // Match t("key") and t('key'); avoid template literals.
  const re = /\bt\(\s*["']([^"']+)["']\s*[,)]/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    found.add(m[1]);
  }
  return [...found];
}

function loadI18n(): Record<string, { en?: string; sw?: string }> {
  const src = readFileSync(resolve(ROOT, I18N_FILE), "utf8");
  // Match: "key": { en: "...", sw: "..." }
  // Allow translation values to span across lines and contain escaped quotes.
  const re =
    /"([^"]+)"\s*:\s*\{\s*en\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*sw\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
  const out: Record<string, { en: string; sw: string }> = {};
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out[m[1]] = { en: m[2], sw: m[3] };
  }
  return out;
}

function main() {
  const dict = loadI18n();
  const usedKeys = new Set<string>();
  for (const file of SOURCE_FILES) {
    const src = readFileSync(resolve(ROOT, file), "utf8");
    for (const k of extractKeys(src)) usedKeys.add(k);
  }

  const missing: string[] = [];
  const untranslated: string[] = [];
  const englishFallback: string[] = [];

  for (const key of usedKeys) {
    const entry = dict[key];
    if (!entry) {
      missing.push(key);
      continue;
    }
    if (!entry.sw || entry.sw.trim() === "") {
      untranslated.push(key);
      continue;
    }
    if (entry.sw === entry.en) {
      // Identical strings *can* be valid (e.g. proper nouns, "FAQ"), but flag
      // common content keys that should diverge between the two languages.
      const looksLikeContent = /[a-z]/.test(entry.en) && entry.en.split(/\s+/).length > 1;
      if (looksLikeContent) englishFallback.push(`${key} → "${entry.en}"`);
    }
  }

  const banner = (label: string) => `\n— ${label} —`;
  let failed = false;

  console.log(`Scanned ${usedKeys.size} t() keys across ${SOURCE_FILES.length} files.`);

  if (missing.length) {
    failed = true;
    console.error(banner("Missing i18n entries"));
    for (const k of missing) console.error(`  ✗ ${k}`);
  }
  if (untranslated.length) {
    failed = true;
    console.error(banner("Empty Swahili translation"));
    for (const k of untranslated) console.error(`  ✗ ${k}`);
  }
  if (englishFallback.length) {
    failed = true;
    console.error(banner("Swahili identical to English (likely a fallback)"));
    for (const k of englishFallback) console.error(`  ✗ ${k}`);
  }

  if (failed) {
    console.error(
      "\nBursaries i18n scan FAILED. Add or update the entries in src/lib/i18n.tsx."
    );
    process.exit(1);
  }

  console.log("✓ All Bursaries i18n keys present with Swahili translations.");
}

main();
