#!/usr/bin/env node

import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { createSVGWindow } from "svgdom"

const WIDTH_UNITS = [1, 2, 3, 4, 5]
const DEFAULT_PER_POOL = 200
const DEFAULT_BASE_COUNT = 1200
const DEFAULT_SEED = null
const DEFAULT_OUT_DIR = ".tmp/glyph-pools"
const DEFAULT_MANIFEST = "glyph-pools-manifest.json"
const DEFAULT_SINGLE_SPRITE_FILE = "glyph-pool.svg"
const DEFAULT_BAN_CURLY_DIACRITICS = true
const NORMALIZED_VIEWBOX = {
  minX: -120,
  minY: -90,
  width: 240,
  height: 180,
}
const NORMALIZED_PADDING_RATIO = 0.07

const TYPES = ["UNF/C", "FRM"]
const SPECS = ["BSC", "CTE", "CSV", "OBJ"]
const CASES = ["THM", "ABS", "ERG", "AFF", "STM", "INS"]
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
const CURLY_DIACRITIC_SIGNATURES = [
  "q -6.55 11.7 -14.4 12.25",
  "q 6.55 -11.7 14.4 -12.25",
  "q -0.75 -5.3 -5.4 -8.4",
  "q 0.75 5.3 5.4 8.4",
  "q -3.3 5.85 -2.55 11.1",
]

function parseArgs(argv) {
  let perPool = DEFAULT_PER_POOL
  let baseCount = DEFAULT_BASE_COUNT
  let seedInput = DEFAULT_SEED
  let outDir = DEFAULT_OUT_DIR
  let manifestFile = DEFAULT_MANIFEST
  let banCurlyDiacritics = DEFAULT_BAN_CURLY_DIACRITICS

  for (const arg of argv) {
    if (arg == "--help" || arg == "-h") {
      printHelpAndExit()
    }

    if (arg.startsWith("--per-pool=")) {
      perPool = Number(arg.slice("--per-pool=".length))
      continue
    }

    if (arg.startsWith("--count-per-pool=")) {
      perPool = Number(arg.slice("--count-per-pool=".length))
      continue
    }

    if (arg.startsWith("--base-count=")) {
      baseCount = Number(arg.slice("--base-count=".length))
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

    if (arg.startsWith("--manifest=")) {
      manifestFile = arg.slice("--manifest=".length)
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
  }

  if (!Number.isFinite(perPool) || perPool <= 0) {
    throw new Error(`Invalid --per-pool value: ${perPool}`)
  }

  if (!Number.isFinite(baseCount) || baseCount <= 0) {
    throw new Error(`Invalid --base-count value: ${baseCount}`)
  }

  const { seed, seedLabel } = resolveSeed(seedInput)

  return {
    perPool: Math.floor(perPool),
    baseCount: Math.max(Math.floor(baseCount), Math.floor(perPool) * 5),
    seed,
    seedLabel,
    outDir,
    manifestFile,
    banCurlyDiacritics,
  }
}

function printHelpAndExit() {
  console.log(
    [
      "Build 5 Ithkuil glyph sprite pools by width class (w1..w5).",
      "",
      "Usage:",
      "  node tools/build-glyph-pools.mjs [options]",
      "",
      "Options:",
      `  --per-pool=<n>       Symbols per width pool (default: ${DEFAULT_PER_POOL})`,
      `  --base-count=<n>     Initial candidate count before sampling (default: ${DEFAULT_BASE_COUNT})`,
      "  --seed=<value>       Deterministic RNG seed, number or string (default: random)",
      `  --out-dir=<path>     Output directory (default: ${DEFAULT_OUT_DIR})`,
      `  --manifest=<name>    Manifest file name inside out-dir (default: ${DEFAULT_MANIFEST})`,
      `  --ban-curly          Skip symbols containing curved diacritics (default: ${DEFAULT_BAN_CURLY_DIACRITICS})`,
      "  --allow-curly        Allow curved diacritics",
      "",
      "Outputs:",
      "  glyph-pool-w1.svg ... glyph-pool-w5.svg (same symbol count in each pool).",
      `  ${DEFAULT_SINGLE_SPRITE_FILE} (exactly 5 symbols: w1..w5, one per width class).`,
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

function hashTextFNV1a(value) {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

function deriveWidthPools(items) {
  const widthPools = Object.fromEntries(WIDTH_UNITS.map((unit) => [String(unit), []]))

  for (const item of items) {
    const glyphCount = Number.isFinite(item.glyphCount) ? item.glyphCount : 0
    const widthUnit = Math.min(5, Math.max(1, glyphCount))

    item.widthUnit = widthUnit
    widthPools[String(widthUnit)].push(item.id)
  }

  return {
    widthPools,
    widthThresholds: [1, 2, 3, 4],
    widthRule: "byGlyphCount: w1=1, w2=2, w3=3, w4=4, w5=5+",
  }
}

function pickTightHeightWindowIds({ sourceIds, perPool, itemById, rng }) {
  const entries = sourceIds
    .map((id) => {
      const item = itemById.get(id)
      const height = item?.normalizedHeight
      return { id, height }
    })
    .filter((entry) => Number.isFinite(entry.height))
    .sort((a, b) => {
      if (a.height != b.height) {
        return a.height - b.height
      }

      return a.id.localeCompare(b.id)
    })

  if (entries.length < perPool) {
    return []
  }

  const globalMedian = entries[Math.floor((entries.length - 1) / 2)].height
  let bestStart = 0
  let bestRange = Number.POSITIVE_INFINITY
  let bestMedianDistance = Number.POSITIVE_INFINITY

  for (let start = 0; start <= entries.length - perPool; start++) {
    const end = start + perPool - 1
    const range = entries[end].height - entries[start].height
    const sampleMedian = entries[start + Math.floor((perPool - 1) / 2)].height
    const medianDistance = Math.abs(sampleMedian - globalMedian)

    if (
      range < bestRange ||
      (range == bestRange && medianDistance < bestMedianDistance)
    ) {
      bestRange = range
      bestMedianDistance = medianDistance
      bestStart = start
    }
  }

  const chosen = entries.slice(bestStart, bestStart + perPool).map((entry) => entry.id)

  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[chosen[i], chosen[j]] = [chosen[j], chosen[i]]
  }

  return chosen
}

function sampleIdsPerWidth({ widthPools, perPool, itemById, rng }) {
  const sampledPools = {}
  const selectedIds = []

  for (const unit of WIDTH_UNITS) {
    const key = String(unit)
    const sourceIds = Array.isArray(widthPools[key]) ? [...widthPools[key]] : []

    if (sourceIds.length < perPool) {
      throw new Error(
        `Width pool ${key} only has ${sourceIds.length} IDs; need ${perPool}. Increase --base-count.`,
      )
    }

    let picked = pickTightHeightWindowIds({
      sourceIds,
      perPool,
      itemById,
      rng,
    })

    if (picked.length < perPool) {
      for (let i = sourceIds.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[sourceIds[i], sourceIds[j]] = [sourceIds[j], sourceIds[i]]
      }

      picked = sourceIds.slice(0, perPool)
    }

    sampledPools[key] = picked
    selectedIds.push(...picked)
  }

  return { sampledPools, selectedIds }
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

function shouldRejectLeadingA(word, rng) {
  const lower = word.toLowerCase()

  if (lower.startsWith("aw")) {
    return rng() < 0.95
  }

  if (lower.startsWith("a")) {
    return rng() < 0.8
  }

  return false
}

function countParsedGlyphs(scriptValue) {
  if (!Array.isArray(scriptValue)) {
    return 0
  }

  return scriptValue.length
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

function createRandomWordGenerator({ rng, roots, formativeToIthkuil }) {
  return () => {
    for (let i = 0; i < 160; i++) {
      let candidate
      const modeRoll = rng()

      if (modeRoll < 0.08) {
        candidate = randomFormativeWord(rng, roots, formativeToIthkuil)
      } else if (modeRoll < 0.28) {
        candidate = randomTinyWord(rng)
      } else if (modeRoll < 0.92) {
        candidate = randomSyntheticWord(rng)
      } else {
        candidate = `Q2${randomSyntheticWord(rng)}`
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

function sanitizeSymbolPaint(content) {
  return content.replace(/\sfill="([^"]+)"/gi, (match, value) => {
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
}

function normalizeSymbolContent(content, sourceViewBox) {
  const src = parseViewBox(sourceViewBox)
  const dst = NORMALIZED_VIEWBOX
  const usableWidth = dst.width * (1 - NORMALIZED_PADDING_RATIO * 2)
  const usableHeight = dst.height * (1 - NORMALIZED_PADDING_RATIO * 2)

  const scale = Math.min(usableWidth / src.width, usableHeight / src.height)
  const srcCenterX = src.minX + src.width / 2
  const srcCenterY = src.minY + src.height / 2
  const dstCenterX = dst.minX + dst.width / 2
  const dstCenterY = dst.minY + dst.height / 2
  const translateX = dstCenterX - srcCenterX * scale
  const translateY = dstCenterY - srcCenterY * scale

  const transform = `translate(${formatNumber(translateX)} ${formatNumber(translateY)}) scale(${formatNumber(scale)})`
  const normalizedViewBox = `${dst.minX} ${dst.minY} ${dst.width} ${dst.height}`
  const paintNormalizedContent = sanitizeSymbolPaint(content)
  const normalizedContent = `<g fill="currentColor" transform="${transform}">${paintNormalizedContent}</g>`
  const normalizedWidth = (src.width * scale) / dst.width
  const normalizedHeight = (src.height * scale) / dst.height
  const normalizedAspect = normalizedHeight > 0 ? normalizedWidth / normalizedHeight : 1

  return {
    normalizedViewBox,
    normalizedContent,
    normalizedScale: scale,
    normalizedWidth,
    normalizedHeight,
    normalizedAspect,
  }
}

function renderWordAsSymbol({ word, id, textToScript, Anchor, CharacterRow, fitViewBox }) {
  const script = withSuppressedExpectedErrors(() => textToScript(word, false))

  if (!script.ok) {
    throw new Error(script.reason)
  }

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("fill", "#0b2a6f")
  svg.setAttribute("stroke", "none")
  svg.appendChild(
    Anchor({
      at: "cc",
      children: CharacterRow({ children: script.value }),
    }),
  )
  fitViewBox(svg, 20)

  const sourceViewBox = svg.getAttribute("viewBox")
  if (!sourceViewBox) {
    throw new Error(`No viewBox for "${word}"`)
  }

  const {
    normalizedViewBox,
    normalizedContent,
    normalizedScale,
    normalizedWidth,
    normalizedHeight,
    normalizedAspect,
  } = normalizeSymbolContent(svg.innerHTML, sourceViewBox)
  const glyphCount = countParsedGlyphs(script.value)

  return {
    symbol: `<symbol id="${id}" viewBox="${normalizedViewBox}">${normalizedContent}</symbol>`,
    hash: hashTextFNV1a(`${normalizedViewBox}|${normalizedContent}`),
    glyphCount,
    normalizedScale,
    normalizedWidth,
    normalizedHeight,
    normalizedAspect,
  }
}

function containsCurlyDiacritic(svgSymbol) {
  const normalized = svgSymbol.replace(/\s+/g, " ").trim()
  return CURLY_DIACRITIC_SIGNATURES.some((signature) => normalized.includes(signature))
}

function buildSprite(symbols, headerComment) {
  return [
    headerComment,
    '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">',
    "  <defs>",
    ...symbols.map((symbol) => `    ${symbol}`),
    "  </defs>",
    "</svg>",
    "",
  ].join("\n")
}

function applyScaleToSymbol(symbolText, factor) {
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.000001) {
    return symbolText
  }

  const openIndex = symbolText.indexOf(">")
  const closeIndex = symbolText.lastIndexOf("</symbol>")
  if (openIndex < 0 || closeIndex < 0 || closeIndex <= openIndex) {
    return symbolText
  }

  const head = symbolText.slice(0, openIndex + 1)
  const body = symbolText.slice(openIndex + 1, closeIndex)
  const tail = symbolText.slice(closeIndex)

  return `${head}<g transform="scale(${formatNumber(factor)})">${body}</g>${tail}`
}

function withSymbolId(symbolText, symbolId) {
  return symbolText.replace(/<symbol\b[^>]*\bid="[^"]*"/, (openTag) =>
    openTag.replace(/\bid="[^"]*"/, `id="${symbolId}"`),
  )
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

async function main() {
  const {
    perPool,
    baseCount,
    seed,
    seedLabel,
    outDir,
    manifestFile,
    banCurlyDiacritics,
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

  const symbolsById = new Map()
  const items = []
  const hashSet = new Set()

  let targetCount = Math.max(baseCount, perPool * 5)
  const maxAttempts = targetCount * (banCurlyDiacritics ? 180 : 70) * 5
  let attempts = 0

  while (attempts < maxAttempts) {
    while (items.length < targetCount && attempts < maxAttempts) {
      attempts++

      const word = nextWord()
      const id = `g-${String(items.length + 1).padStart(4, "0")}`

      try {
        const rendered = renderWordAsSymbol({
          word,
          id,
          textToScript,
          Anchor,
          CharacterRow,
          fitViewBox,
        })

        if (hashSet.has(rendered.hash)) {
          continue
        }

        if (banCurlyDiacritics && containsCurlyDiacritic(rendered.symbol)) {
          continue
        }

        hashSet.add(rendered.hash)
        symbolsById.set(id, rendered.symbol)
        items.push({
          id,
          word,
          hash: rendered.hash,
          glyphCount: rendered.glyphCount,
          normalizedScale: rendered.normalizedScale,
          normalizedWidth: rendered.normalizedWidth,
          normalizedHeight: rendered.normalizedHeight,
          normalizedAspect: rendered.normalizedAspect,
        })
      } catch {
        // Skip invalid parse/render results.
      }
    }

    const { widthPools, widthThresholds, widthRule } = deriveWidthPools(items)
    const hasEnough = WIDTH_UNITS.every(
      (unit) => (widthPools[String(unit)]?.length || 0) >= perPool,
    )

    if (hasEnough) {
      const sampleRng = mulberry32(seed ^ 0x9e3779b9)
      const itemById = new Map(items.map((item) => [item.id, item]))
      const { sampledPools } = sampleIdsPerWidth({
        widthPools,
        perPool,
        itemById,
        rng: sampleRng,
      })

      const generatedAt = new Date().toISOString()
      const seedSummary =
        seedLabel == null ? `random (resolved=${seed})` : `${seedLabel} (resolved=${seed})`
      const resolvedOutDir = path.resolve(process.cwd(), outDir)
      await mkdir(resolvedOutDir, { recursive: true })

      const poolFiles = {}
      const sampledItems = []
      const poolTargetHeights = {}
      const singleSpriteSymbols = []
      const sampledIds = WIDTH_UNITS.flatMap((unit) => sampledPools[String(unit)] || [])
      let globalTargetHeight = Number.POSITIVE_INFINITY

      for (const id of sampledIds) {
        const item = itemById.get(id)
        if (item && Number.isFinite(item.normalizedHeight)) {
          globalTargetHeight = Math.min(globalTargetHeight, item.normalizedHeight)
        }
      }

      if (!Number.isFinite(globalTargetHeight) || globalTargetHeight <= 0) {
        globalTargetHeight = 1
      }

      for (const unit of WIDTH_UNITS) {
        const key = String(unit)
        const ids = sampledPools[key]
        const poolSymbols = []
        const poolEntries = []
        const targetHeight = globalTargetHeight

        for (const id of ids) {
          const symbol = symbolsById.get(id)
          const item = itemById.get(id)
          if (!symbol || !item) {
            throw new Error(`Missing sampled symbol "${id}" in pool ${key}.`)
          }

          poolEntries.push({ symbol, item })
        }

        poolTargetHeights[key] = targetHeight

        for (const entry of poolEntries) {
          const itemHeight = Number.isFinite(entry.item.normalizedHeight)
            ? entry.item.normalizedHeight
            : targetHeight
          const normalizeFactor = itemHeight > 0 ? targetHeight / itemHeight : 1
          const normalizedSymbol = applyScaleToSymbol(entry.symbol, normalizeFactor)

          poolSymbols.push(normalizedSymbol)
          sampledItems.push({
            ...entry.item,
            widthUnit: unit,
            normalizedScale: entry.item.normalizedScale * normalizeFactor,
            normalizedWidth: entry.item.normalizedWidth * normalizeFactor,
            normalizedHeight: entry.item.normalizedHeight * normalizeFactor,
            heightNormalizeScale: normalizeFactor,
          })
        }

        const filename = `glyph-pool-w${key}.svg`
        poolFiles[key] = filename
        const sprite = buildSprite(
          poolSymbols,
          `<!-- Generated by tools/build-glyph-pools.mjs at ${generatedAt}; width=w${key}; count=${perPool}; seed=${seedSummary}; banCurly=${banCurlyDiacritics} -->`,
        )
        await writeFile(path.join(resolvedOutDir, filename), sprite, "utf8")

        if (poolSymbols.length > 0) {
          singleSpriteSymbols.push(withSymbolId(poolSymbols[0], `w${key}`))
        }
      }

      const singleSprite = buildSprite(
        singleSpriteSymbols,
        `<!-- Generated by tools/build-glyph-pools.mjs at ${generatedAt}; symbols=5; one-per-width(w1..w5); seed=${seedSummary}; banCurly=${banCurlyDiacritics} -->`,
      )
      await writeFile(
        path.join(resolvedOutDir, DEFAULT_SINGLE_SPRITE_FILE),
        singleSprite,
        "utf8",
      )

      const manifestPath = path.join(resolvedOutDir, manifestFile)
      await writeFile(
        manifestPath,
        JSON.stringify(
          {
            generatedAt,
            perPool,
            total: perPool * WIDTH_UNITS.length,
            seed: seedLabel,
            resolvedSeed: seed,
            banCurlyDiacritics,
            widthUnits: WIDTH_UNITS,
            widthThresholds,
            widthRule,
            poolTargetHeights,
            singleSpriteFile: DEFAULT_SINGLE_SPRITE_FILE,
            poolFiles,
            pools: sampledPools,
            items: sampledItems,
          },
          null,
          2,
        ),
        "utf8",
      )

      console.log(`Generated 5 width pools in ${path.relative(process.cwd(), resolvedOutDir)}`)
      for (const unit of WIDTH_UNITS) {
        console.log(`  w${unit}: ${poolFiles[String(unit)]} (${perPool} symbols)`)
      }
      console.log(`Single sprite: ${DEFAULT_SINGLE_SPRITE_FILE} (5 symbols, w1..w5)`)
      console.log(`Manifest: ${path.relative(process.cwd(), manifestPath)}`)
      return
    }

    targetCount += Math.max(250, perPool * 2)
  }

  throw new Error(
    `Could not satisfy per-pool=${perPool} after ${attempts} attempts. Try increasing --base-count.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
