#!/usr/bin/env node

import { existsSync } from "node:fs"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { createSVGWindow } from "svgdom"

const SVG_NS = "http://www.w3.org/2000/svg"
const DEFAULT_COUNT = 20
const DEFAULT_MIN_GLYPHS = 1
const DEFAULT_MAX_GLYPHS = 10
const DEFAULT_SEED = null
const DEFAULT_OUT_DIR = "../Foxgote.com2/public/ithkuil-glyph-phrases"
const DEFAULT_BAN_CURLY_DIACRITICS = true
const DEFAULT_BAN_DOT_DIACRITIC = false
const DEFAULT_MIN_RAW_GLYPH_HEIGHT = 40

const TYPES = ["UNF/C", "FRM"]
const SPECS = ["BSC", "CTE", "CSV", "OBJ"]
const CASES = ["THM", "ABS", "ERG", "AFF", "STM", "INS"]
const SCIFI_VN = ["RTR", "PRG", "REP", "PCL", "CNT", "ATP", "DUP", "MNO", "1:BEN", "3:DET"]
const SCIFI_SLOT_V_CS = ["k", "t", "r", "s", "c", "kl", "kr"]
const SYNTHETIC_START_ONSETS = [
  "m",
  "k",
  "b",
  "t",
  "d",
  "n",
  "r",
  "s",
  "l",
  "v",
  "g",
  "p",
  "f",
  "h",
  "z",
  "sh",
  "ch",
  "th",
  "dr",
  "kr",
  "gr",
  "br",
  "tr",
  "kl",
  "bl",
  "st",
  "sk",
  "sp",
  "sn",
  "sm",
  "pl",
  "pr",
]
const SYNTHETIC_MID_ONSETS = [...SYNTHETIC_START_ONSETS, "y", "w", "nj"]
const SYNTHETIC_VOWELS = [
  "e",
  "i",
  "o",
  "u",
  "a",
  "ai",
  "ei",
  "ia",
  "io",
  "oa",
  "ou",
]
const SYNTHETIC_CODAS = [
  "",
  "",
  "",
  "n",
  "r",
  "l",
  "s",
  "m",
  "k",
  "t",
  "d",
  "g",
  "sh",
  "ch",
  "j",
  "nj",
  "nd",
  "rk",
  "rt",
]
const RANDOM_LETTER_STARTS = [
  "e",
  "i",
  "o",
  "u",
  "b",
  "c",
  "d",
  "f",
  "g",
  "h",
  "j",
  "k",
  "l",
  "m",
  "n",
  "p",
  "q",
  "r",
  "s",
  "t",
  "v",
  "w",
  "x",
  "y",
  "z",
  "ch",
  "sh",
  "th",
  "kh",
  "ph",
  "ts",
  "tr",
  "kr",
  "gr",
  "pl",
  "br",
  "dr",
  "st",
  "sk",
  "sp",
  "sn",
  "sm",
  "hl",
  "hr",
  "hm",
  "hn",
]
const RANDOM_LETTER_PARTS = [
  "a",
  "e",
  "i",
  "o",
  "u",
  "w",
  "y",
  "h",
  "r",
  "l",
  "m",
  "n",
  "p",
  "t",
  "k",
  "s",
  "f",
  "v",
  "z",
  "ch",
  "sh",
  "th",
  "kh",
  "ts",
  "tr",
  "kr",
  "gr",
  "pl",
  "br",
  "dr",
  "st",
  "sk",
  "sp",
  "sn",
  "sm",
  "ae",
  "ai",
  "ei",
  "io",
  "ou",
  "oa",
  "ui",
  "ia",
  "eo",
  "ue",
  "'",
]
const CURLY_DIACRITIC_SIGNATURES = [
  "q -6.55 11.7 -14.4 12.25",
  "q 6.55 -11.7 14.4 -12.25",
  "q -0.75 -5.3 -5.4 -8.4",
  "q 0.75 5.3 5.4 8.4",
  "q -3.3 5.85 -2.55 11.1",
]
const SINGULAR_DOT_DIACRITIC_SIGNATURES = [
  "l 7.5 7.5 l 7.5 -7.5 l -7.5 -7.5 l -7.5 7.5 z",
]

function parseArgs(argv) {
  let count = DEFAULT_COUNT
  let minGlyphs = DEFAULT_MIN_GLYPHS
  let maxGlyphs = DEFAULT_MAX_GLYPHS
  let seedInput = DEFAULT_SEED
  let outDir = DEFAULT_OUT_DIR
  let banCurlyDiacritics = DEFAULT_BAN_CURLY_DIACRITICS
  let banDotDiacritic = DEFAULT_BAN_DOT_DIACRITIC
  let minRawGlyphHeight = DEFAULT_MIN_RAW_GLYPH_HEIGHT

  for (const arg of argv) {
    if (arg == "--help" || arg == "-h") {
      printHelpAndExit()
    }

    if (arg.startsWith("--count=")) {
      count = Number(arg.slice("--count=".length))
      continue
    }

    if (arg.startsWith("--min-glyphs=")) {
      minGlyphs = Number(arg.slice("--min-glyphs=".length))
      continue
    }

    if (arg.startsWith("--max-glyphs=")) {
      maxGlyphs = Number(arg.slice("--max-glyphs=".length))
      continue
    }

    if (arg.startsWith("--seed=")) {
      seedInput = arg.slice("--seed=".length)
      continue
    }

    if (arg.startsWith("--out-dir=")) {
      outDir = arg.slice("--out-dir=".length)
      continue
    }

    if (arg == "--ban-curly") {
      banCurlyDiacritics = true
      continue
    }

    if (arg == "--allow-curly") {
      banCurlyDiacritics = false
      continue
    }

    if (arg == "--ban-dot-diacritic") {
      banDotDiacritic = true
      continue
    }

    if (arg == "--allow-dot-diacritic") {
      banDotDiacritic = false
      continue
    }

    if (arg.startsWith("--min-raw-glyph-height=")) {
      minRawGlyphHeight = Number(arg.slice("--min-raw-glyph-height=".length))
      continue
    }
  }

  if (!Number.isFinite(count) || count <= 0) {
    throw new Error(`Invalid --count value: ${count}`)
  }

  if (!Number.isFinite(minGlyphs) || minGlyphs <= 0) {
    throw new Error(`Invalid --min-glyphs value: ${minGlyphs}`)
  }

  if (!Number.isFinite(maxGlyphs) || maxGlyphs <= 0) {
    throw new Error(`Invalid --max-glyphs value: ${maxGlyphs}`)
  }

  if (minGlyphs > maxGlyphs) {
    throw new Error(`--min-glyphs (${minGlyphs}) must be <= --max-glyphs (${maxGlyphs}).`)
  }

  if (!Number.isFinite(minRawGlyphHeight) || minRawGlyphHeight <= 0) {
    throw new Error(`Invalid --min-raw-glyph-height value: ${minRawGlyphHeight}`)
  }

  const { seed, seedLabel } = resolveSeed(seedInput)

  return {
    count: Math.floor(count),
    minGlyphs: Math.floor(minGlyphs),
    maxGlyphs: Math.floor(maxGlyphs),
    seed,
    seedLabel,
    outDir,
    banCurlyDiacritics,
    banDotDiacritic,
    minRawGlyphHeight,
  }
}

function printHelpAndExit() {
  console.log(
    [
      "Build random Ithkuil phrase bundles and split each phrase into tightly trimmed per-glyph SVGs.",
      "",
      "Usage:",
      "  node tools/build-glyph-phrase-slices.mjs [options]",
      "",
      "Options:",
      `  --count=<n>           Number of phrases to generate (default: ${DEFAULT_COUNT})`,
      `  --min-glyphs=<n>      Minimum glyphs per phrase (default: ${DEFAULT_MIN_GLYPHS})`,
      `  --max-glyphs=<n>      Maximum glyphs per phrase (default: ${DEFAULT_MAX_GLYPHS})`,
      "  --seed=<value>        Deterministic RNG seed, number or string (default: random)",
      `  --out-dir=<path>      Output directory (default: ${DEFAULT_OUT_DIR})`,
      `  --ban-curly           Skip curved diacritics (default: ${DEFAULT_BAN_CURLY_DIACRITICS})`,
      "  --allow-curly         Allow curved diacritics",
      `  --ban-dot-diacritic   Skip singular DOT diacritics (default: ${DEFAULT_BAN_DOT_DIACRITIC})`,
      "  --allow-dot-diacritic Allow singular DOT diacritics",
      `  --min-raw-glyph-height=<n>  Reject phrases with tiny glyph slices (default: ${DEFAULT_MIN_RAW_GLYPH_HEIGHT})`,
    ].join("\n"),
  )
  process.exit(0)
}

function hashStringToUint32(value) {
  let hash = 0x811c9dc5

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

function resolveSeed(seedInput) {
  if (seedInput == null) {
    return {
      seed: (Math.random() * 0xffffffff) >>> 0,
      seedLabel: null,
    }
  }

  const normalized = String(seedInput).trim()
  if (!normalized) {
    return {
      seed: (Math.random() * 0xffffffff) >>> 0,
      seedLabel: null,
    }
  }

  const numeric = Number(normalized)
  if (Number.isFinite(numeric)) {
    return { seed: Math.floor(numeric), seedLabel: normalized }
  }

  return { seed: hashStringToUint32(normalized), seedLabel: normalized }
}

function hashTextFNV1a(value) {
  let hash = 0x811c9dc5

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, "0")
}

function setupSvgDomGlobals() {
  const window = createSVGWindow()
  const document = window.document

  if (!document.body) {
    Object.defineProperty(document, "body", { value: document.documentElement })
  }

  globalThis.window = window
  globalThis.document = document
  globalThis.Node = window.Node
  globalThis.Element = window.Element
  globalThis.SVGElement = window.SVGElement
  globalThis.SVGGraphicsElement = window.SVGGraphicsElement
  globalThis.SVGPathElement = window.SVGPathElement
  globalThis.SVGSVGElement = window.SVGSVGElement || window.SVGGraphicsElement
  globalThis.SVGGElement = window.SVGGElement || window.SVGGraphicsElement

  // svgdom does not currently implement these methods, but some compact-row
  // spacing logic calls them. Returning false keeps layout deterministic
  // without crashing.
  if (window.SVGPathElement?.prototype) {
    if (typeof window.SVGPathElement.prototype.isPointInStroke != "function") {
      window.SVGPathElement.prototype.isPointInStroke = () => false
    }

    if (typeof window.SVGPathElement.prototype.isPointInFill != "function") {
      window.SVGPathElement.prototype.isPointInFill = () => false
    }
  }
}

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomItem(rng, list) {
  return list[Math.floor(rng() * list.length)]
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min
}

function randomFormativeWord(rng, roots, formativeToIthkuil) {
  for (let i = 0; i < 50; i++) {
    try {
      const type = randomItem(rng, TYPES)
      const word = formativeToIthkuil({
        type,
        root: randomItem(rng, roots),
        shortcut: rng() < 0.5,
        specification: randomItem(rng, SPECS),
        case: type == "UNF/C" ? randomItem(rng, CASES) : undefined,
      })

      if (word) {
        return word
      }
    } catch {
      // Retry until valid combination.
    }
  }

  return null
}

function randomScifiDenseFormativeWord(rng, roots, formativeToIthkuil) {
  for (let i = 0; i < 80; i++) {
    try {
      const type = randomItem(rng, TYPES)
      const slotVAffixes =
        rng() < 0.75 ?
          [
            {
              type: randomItem(rng, [1, 2]),
              degree: randomItem(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]),
              cs: randomItem(rng, SCIFI_SLOT_V_CS),
            },
          ]
        : undefined
      const word = formativeToIthkuil({
        type,
        root: randomItem(rng, roots),
        shortcut: rng() < 0.5,
        specification: randomItem(rng, SPECS),
        case: type == "UNF/C" ? randomItem(rng, CASES) : undefined,
        vn: rng() < 0.7 ? randomItem(rng, SCIFI_VN) : undefined,
        slotVAffixes,
      })

      if (word) {
        return word
      }
    } catch {
      // Retry until valid combination.
    }
  }

  return null
}

function randomSyntheticWord(rng) {
  const syllables = randomInt(rng, 2, 4)
  let word = randomItem(rng, SYNTHETIC_START_ONSETS) + randomItem(rng, SYNTHETIC_VOWELS)

  for (let i = 1; i < syllables; i++) {
    if (rng() < 0.5) {
      word += randomItem(rng, SYNTHETIC_CODAS)
    }

    word += randomItem(rng, SYNTHETIC_MID_ONSETS)
    word += randomItem(rng, SYNTHETIC_VOWELS)
  }

  if (rng() < 0.72) {
    word += randomItem(rng, SYNTHETIC_CODAS)
  }

  return word.slice(0, 12)
}

function randomTinyWord(rng) {
  let word = randomItem(rng, SYNTHETIC_START_ONSETS) + randomItem(rng, ["e", "i", "o", "u", "a"])

  if (rng() < 0.35) {
    word += randomItem(rng, ["", "n", "r", "l", "s", "k", "t"])
  }

  return word.slice(0, 5)
}

function randomLetterWord(rng) {
  const targetLength = randomInt(rng, 3, 12)
  let word = randomItem(rng, RANDOM_LETTER_STARTS)

  while (word.length < targetLength) {
    word += randomItem(rng, RANDOM_LETTER_PARTS)
  }

  return word.slice(0, targetLength)
}

function shouldRejectLeadingA(word, rng) {
  void rng
  const lower = word.toLowerCase()

  return lower.startsWith("aw") || lower.startsWith("a")
}

function containsCurlyDiacritic(svgFragment) {
  const normalized = svgFragment.replace(/\s+/g, " ").trim()
  return CURLY_DIACRITIC_SIGNATURES.some((signature) => normalized.includes(signature))
}

function containsSingularDotDiacritic(svgFragment) {
  const normalized = svgFragment.replace(/\s+/g, " ").trim()
  return SINGULAR_DOT_DIACRITIC_SIGNATURES.some((signature) =>
    normalized.includes(signature),
  )
}

function createRandomWordGenerator({ rng, roots, formativeToIthkuil }) {
  return () => {
    for (let i = 0; i < 220; i++) {
      let candidate
      const modeRoll = rng()

      if (modeRoll < 0.58) {
        candidate = randomScifiDenseFormativeWord(rng, roots, formativeToIthkuil)
      } else if (modeRoll < 0.82) {
        candidate = randomLetterWord(rng)
      } else if (modeRoll < 0.9) {
        candidate = randomSyntheticWord(rng)
      } else if (modeRoll < 0.96) {
        candidate = randomTinyWord(rng)
      } else {
        candidate = randomFormativeWord(rng, roots, formativeToIthkuil)
      }

      if (!candidate) {
        continue
      }

      if (shouldRejectLeadingA(candidate, rng)) {
        continue
      }

      if (/[^\x00-\x7f]/.test(candidate) && rng() < 0.9) {
        continue
      }

      return candidate
    }

    return "Q2mare"
  }
}

function withSuppressedExpectedErrors(fn) {
  const originalConsoleError = console.error
  console.error = () => {}

  try {
    return fn()
  } finally {
    console.error = originalConsoleError
  }
}

function countParsedGlyphs(scriptValue) {
  if (!Array.isArray(scriptValue)) {
    return 0
  }

  return scriptValue.length
}

function parseViewBox(viewBoxValue) {
  const values = viewBoxValue
    .trim()
    .split(/\s+/)
    .map(Number)

  if (values.length != 4 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid viewBox: ${viewBoxValue}`)
  }

  const [minX, minY, width, height] = values
  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid viewBox dimensions: ${viewBoxValue}`)
  }

  return { minX, minY, width, height }
}

function formatNumber(value) {
  return Number.parseFloat(value.toFixed(6)).toString()
}

function sanitizeSvgPaint(content) {
  return content
    .replace(/\sfill="([^"]+)"/gi, (match, value) => {
      const normalized = String(value).trim().toLowerCase()

      if (
        normalized == "none" ||
        normalized == "currentcolor" ||
        normalized == "inherit" ||
        normalized.startsWith("url(")
      ) {
        return match
      }

      return ' fill="currentColor"'
    })
    .replace(/\sstroke="([^"]+)"/gi, (match, value) => {
      const normalized = String(value).trim().toLowerCase()

      if (
        normalized == "none" ||
        normalized == "currentcolor" ||
        normalized == "inherit" ||
        normalized.startsWith("url(")
      ) {
        return match
      }

      return ' stroke="currentColor"'
    })
}

function renderCharactersAsSvg({ characters, Anchor, CharacterRow, fitViewBox }) {
  const svg = document.createElementNS(SVG_NS, "svg")
  svg.setAttribute("fill", "currentColor")
  svg.setAttribute("stroke", "none")
  svg.appendChild(
    Anchor({
      at: "cc",
      children: CharacterRow({ children: characters }),
    }),
  )
  fitViewBox(svg, 0)

  const viewBoxValue = svg.getAttribute("viewBox")
  if (!viewBoxValue) {
    throw new Error("No viewBox generated.")
  }

  const viewBox = parseViewBox(viewBoxValue)
  return {
    content: sanitizeSvgPaint(svg.innerHTML),
    viewBox,
  }
}

function toZeroOriginSvg({ content, viewBox }, scale = 1) {
  const appliedScale = Number.isFinite(scale) && scale > 0 ? scale : 1
  const scaledWidth = viewBox.width * appliedScale
  const scaledHeight = viewBox.height * appliedScale
  const width = formatNumber(scaledWidth)
  const height = formatNumber(scaledHeight)
  const tx = formatNumber(-viewBox.minX)
  const ty = formatNumber(-viewBox.minY)
  const zeroOriginContent =
    Math.abs(viewBox.minX) < 0.000001 && Math.abs(viewBox.minY) < 0.000001 ?
      content
    : `<g transform="translate(${tx} ${ty})">${content}</g>`
  const transformedContent =
    Math.abs(appliedScale - 1) < 0.000001 ?
      zeroOriginContent
    : `<g transform="scale(${formatNumber(appliedScale)})">${zeroOriginContent}</g>`

  return {
    svgText: [
      `<svg xmlns="${SVG_NS}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="currentColor" stroke="none">`,
      transformedContent,
      "</svg>",
      "",
    ].join("\n"),
    width: scaledWidth,
    height: scaledHeight,
    viewBox: `0 0 ${width} ${height}`,
  }
}

function toFixedHeightGlyphSvg({ content, viewBox }, targetHeight) {
  const canvasHeight =
    Number.isFinite(targetHeight) && targetHeight >= viewBox.height ? targetHeight : viewBox.height
  const yPad = (canvasHeight - viewBox.height) / 2
  const txValue = -viewBox.minX
  const tyValue = -viewBox.minY + yPad
  const tx = formatNumber(txValue)
  const ty = formatNumber(tyValue)
  const width = formatNumber(viewBox.width)
  const height = formatNumber(canvasHeight)
  const transformedContent =
    Math.abs(txValue) < 0.000001 && Math.abs(tyValue) < 0.000001 ?
      content
    : `<g transform="translate(${tx} ${ty})">${content}</g>`

  return {
    svgText: [
      `<svg xmlns="${SVG_NS}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="currentColor" stroke="none">`,
      transformedContent,
      "</svg>",
      "",
    ].join("\n"),
    width: viewBox.width,
    height: canvasHeight,
    viewBox: `0 0 ${width} ${height}`,
  }
}

function ensureCompiledModules() {
  const required = ["data/index.js", "generate/index.js", "script/index.js"]
  const missing = required.filter((file) => !existsSync(path.resolve(process.cwd(), file)))

  if (missing.length > 0) {
    throw new Error(
      `Missing compiled JS modules: ${missing.join(", ")}. Run "npm run build" first.`,
    )
  }
}

function buildRandomPhrase(rng, nextWord, targetGlyphCount) {
  const maxWords =
    targetGlyphCount <= 2 ? 1
    : targetGlyphCount <= 4 ? 2
    : targetGlyphCount <= 7 ? 3
    : 4
  const wordCount = randomInt(rng, 1, maxWords)
  return Array.from({ length: wordCount }, () => nextWord()).join(" ")
}

function selectPhrase({
  rng,
  nextWord,
  targetGlyphCount,
  textToScript,
}) {
  const phrase = buildRandomPhrase(rng, nextWord, targetGlyphCount)

  const parsed = withSuppressedExpectedErrors(() => textToScript(phrase, false))
  if (!parsed.ok) {
    return null
  }

  const glyphCount = countParsedGlyphs(parsed.value)
  if (glyphCount != targetGlyphCount) {
    return null
  }

  return {
    phrase,
    characters: parsed.value,
    glyphCount,
  }
}

async function main() {
  const {
    count,
    minGlyphs,
    maxGlyphs,
    seed,
    seedLabel,
    outDir,
    banCurlyDiacritics,
    banDotDiacritic,
    minRawGlyphHeight,
  } = parseArgs(process.argv.slice(2))

  ensureCompiledModules()
  setupSvgDomGlobals()

  const [{ roots }, { formativeToIthkuil }, scriptModule] = await Promise.all([
    import("../data/index.js"),
    import("../generate/index.js"),
    import("../script/index.js"),
  ])

  const { Anchor, CharacterRow, fitViewBox, textToScript } = scriptModule

  const rootList = roots
    .map((entry) => entry.cr)
    .filter((root) => typeof root == "string" && root.length > 0 && !root.includes("["))

  const rng = mulberry32(seed)
  const nextWord = createRandomWordGenerator({
    rng,
    roots: rootList,
    formativeToIthkuil,
  })

  const resolvedOutDir = path.resolve(process.cwd(), outDir)
  const generatedAt = new Date().toISOString()
  const seedSummary =
    seedLabel == null ? `random (resolved=${seed})` : `${seedLabel} (resolved=${seed})`

  await mkdir(resolvedOutDir, { recursive: true })
  await rm(path.join(resolvedOutDir, "phrases"), { recursive: true, force: true })
  await rm(path.join(resolvedOutDir, "manifest.json"), { force: true })
  await mkdir(path.join(resolvedOutDir, "phrases"), { recursive: true })

  const phraseHashSet = new Set()
  const items = []

  let attempts = 0
  const maxAttempts =
    count *
    (banCurlyDiacritics && banDotDiacritic ? 9000
    : banCurlyDiacritics || banDotDiacritic ? 6500
    : 3500)
  const targetRangeSize = maxGlyphs - minGlyphs + 1

  while (items.length < count && attempts < maxAttempts) {
    attempts++
    const targetGlyphCount = minGlyphs + (items.length % targetRangeSize)

    const candidate = selectPhrase({
      rng,
      nextWord,
      targetGlyphCount,
      textToScript,
    })

    if (!candidate) {
      continue
    }

    const phraseRender = renderCharactersAsSvg({
      characters: candidate.characters,
      Anchor,
      CharacterRow,
      fitViewBox,
    })

    const normalizedPhrase = toZeroOriginSvg(phraseRender)

    if (banCurlyDiacritics && containsCurlyDiacritic(normalizedPhrase.svgText)) {
      continue
    }
    if (banDotDiacritic && containsSingularDotDiacritic(normalizedPhrase.svgText)) {
      continue
    }

    const hash = hashTextFNV1a(normalizedPhrase.svgText)
    if (phraseHashSet.has(hash)) {
      continue
    }

    const phraseId = `phrase-${String(items.length + 1).padStart(3, "0")}`
    const glyphs = []
    let shouldRejectTinyGlyph = false
    for (const [glyphIndex, glyphCharacter] of candidate.characters.entries()) {
      const glyphRender = renderCharactersAsSvg({
        characters: [glyphCharacter],
        Anchor,
        CharacterRow,
        fitViewBox,
      })

      if (glyphRender.viewBox.height < minRawGlyphHeight) {
        shouldRejectTinyGlyph = true
        break
      }

      const glyphFile = `phrases/${phraseId}/glyph-${String(glyphIndex + 1).padStart(2, "0")}.svg`

      glyphs.push({
        index: glyphIndex + 1,
        file: glyphFile,
        rawRender: glyphRender,
      })
    }

    if (shouldRejectTinyGlyph) {
      continue
    }

    phraseHashSet.add(hash)

    const phraseFolder = path.join(resolvedOutDir, "phrases", phraseId)
    await mkdir(phraseFolder, { recursive: true })

    const phraseFile = `phrases/${phraseId}/phrase.svg`
    await writeFile(path.join(resolvedOutDir, phraseFile), normalizedPhrase.svgText, "utf8")

    items.push({
      id: phraseId,
      phrase: candidate.phrase,
      hash,
      glyphCount: candidate.glyphCount,
      phraseFile,
      phraseWidth: normalizedPhrase.width,
      phraseHeight: normalizedPhrase.height,
      phraseViewBox: normalizedPhrase.viewBox,
      glyphs,
    })
  }

  if (items.length < count) {
    throw new Error(
      `Generated ${items.length}/${count} phrases after ${attempts} attempts. Try reducing --count or widening glyph range.`,
    )
  }

  const allGlyphHeights = items.flatMap((item) =>
    item.glyphs.map((glyph) => glyph.rawRender.viewBox.height),
  )
  const glyphTargetHeight = Math.max(...allGlyphHeights)

  if (!Number.isFinite(glyphTargetHeight) || glyphTargetHeight <= 0) {
    throw new Error("Failed to resolve a valid unified glyph target height.")
  }

  const manifestItems = []

  for (const item of items) {
    const manifestGlyphs = []

    for (const glyph of item.glyphs) {
      const normalizedGlyph = toFixedHeightGlyphSvg(glyph.rawRender, glyphTargetHeight)
      await writeFile(path.join(resolvedOutDir, glyph.file), normalizedGlyph.svgText, "utf8")

      manifestGlyphs.push({
        index: glyph.index,
        file: glyph.file,
        rawWidth: glyph.rawRender.viewBox.width,
        rawHeight: glyph.rawRender.viewBox.height,
        width: normalizedGlyph.width,
        height: normalizedGlyph.height,
        viewBox: normalizedGlyph.viewBox,
      })
    }

    manifestItems.push({
      id: item.id,
      phrase: item.phrase,
      hash: item.hash,
      glyphCount: item.glyphCount,
      phraseFile: item.phraseFile,
      phraseWidth: item.phraseWidth,
      phraseHeight: item.phraseHeight,
      phraseViewBox: item.phraseViewBox,
      glyphs: manifestGlyphs,
    })
  }

  const manifestPath = path.join(resolvedOutDir, "manifest.json")
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        generatedAt,
        count,
        minGlyphs,
        maxGlyphs,
        seed: seedLabel,
        resolvedSeed: seed,
        seedSummary,
        banCurlyDiacritics,
        banDotDiacritic,
        minRawGlyphHeight,
        glyphTargetHeight,
        outDir: path.relative(process.cwd(), resolvedOutDir),
        items: manifestItems,
      },
      null,
      2,
    ),
    "utf8",
  )

  console.log(`Generated ${count} phrase bundles in ${path.relative(process.cwd(), resolvedOutDir)}`)
  console.log(`Glyph range: ${minGlyphs}-${maxGlyphs}`)
  console.log(`Ban curly diacritics: ${banCurlyDiacritics}`)
  console.log(`Ban singular DOT diacritic: ${banDotDiacritic}`)
  console.log(`Min raw glyph height: ${formatNumber(minRawGlyphHeight)}`)
  console.log(`Unified glyph height: ${formatNumber(glyphTargetHeight)}`)
  console.log(`Manifest: ${path.relative(process.cwd(), manifestPath)}`)
  console.log(`Seed: ${seedSummary}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
