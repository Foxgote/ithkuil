import { roots } from "../data/roots-latest.js"
import { formativeToIthkuil } from "../generate/index.js"
import { Anchor, CharacterRow, fitViewBox, textToScript } from "../script/index.js"

const ROOTS = roots
  .map((entry) => entry.cr)
  .filter((root) => root.length > 0 && !root.includes("["))

const TYPES = ["UNF/C", "FRM"] as const
const SPECS = ["BSC", "CTE", "CSV", "OBJ"] as const
const CASES = ["THM", "ABS", "ERG", "AFF", "STM", "INS"] as const

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomItem<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!
}

function randomInt(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min
}

function randomWord(rng: () => number): string {
  for (let i = 0; i < 40; i++) {
    try {
      const type = randomItem(rng, TYPES)

      const word = formativeToIthkuil({
        type,
        root: randomItem(rng, ROOTS),
        shortcut: rng() < 0.3,
        specification: rng() < 0.5 ? randomItem(rng, SPECS) : undefined,
        case: type == "UNF/C" && rng() < 0.5 ? randomItem(rng, CASES) : undefined,
      })

      if (word) {
        return word
      }
    } catch {
      // Retry until we hit a valid random combination.
    }
  }

  return formativeToIthkuil({ type: "UNF/C", root: "l" })
}

function randomPhrase(rng: () => number, minWords = 2, maxWords = 6): string {
  const count = randomInt(rng, minWords, maxWords)
  return Array.from({ length: count }, () => randomWord(rng)).join(" ")
}

function phraseToSvg(phrase: string, handwritten = false): SVGSVGElement {
  const script = textToScript(phrase, handwritten)

  if (!script.ok) {
    throw new Error(script.reason)
  }

  const svg = (
    <svg
      fill="#0b2a6f"
      stroke="none"
    >
      <Anchor at="cc">
        <CharacterRow>{script.value}</CharacterRow>
      </Anchor>
    </svg>
  ) as SVGSVGElement

  fitViewBox(svg, 20)

  return svg
}

function downloadFile(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const href = URL.createObjectURL(blob)
  const a = document.createElement("a")

  a.href = href
  a.download = filename
  a.click()

  URL.revokeObjectURL(href)
}

function hashTextFNV1a(value: string): string {
  let hash = 0x811c9dc5

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, "0")
}

const url = new URL(location.href)
const seed = Number(url.searchParams.get("seed") ?? "1337")
const count = Number(url.searchParams.get("count") ?? "20")
const handwritten = url.searchParams.get("hand") == "1"

const rng = mulberry32(seed)
const phrases = Array.from({ length: count }, () => randomPhrase(rng))
const generated: {
  id: string
  phrase: string
  svgText: string
  hash: string
}[] = []

const app = document.createElement("main")
app.style.cssText =
  "display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px;padding:16px;font-family:ui-monospace,Menlo,Consolas,monospace;background:#f2f3f5"

const controls = document.createElement("div")
controls.style.cssText = "grid-column:1/-1;display:flex;gap:12px;align-items:center"
const stats = document.createElement("span")

const manifestButton = document.createElement("button")
manifestButton.textContent = "Download manifest.json"
manifestButton.onclick = () => {
  downloadFile(
    "manifest.json",
    JSON.stringify(
      generated.map(({ id, phrase, hash }) => ({
        id,
        phrase,
        hash,
        filename: `${id}.svg`,
      })),
      null,
      2,
    ),
    "application/json",
  )
}

controls.append(
  Object.assign(document.createElement("strong"), { textContent: `seed=${seed}` }),
  Object.assign(document.createElement("span"), { textContent: `count=${count}` }),
  Object.assign(document.createElement("span"), {
    textContent: `handwritten=${handwritten}`,
  }),
)
controls.appendChild(manifestButton)
controls.appendChild(stats)
app.appendChild(controls)

for (const [index, phrase] of phrases.entries()) {
  const id = `ithkuil_${index.toString().padStart(3, "0")}`

  const card = document.createElement("section")
  card.style.cssText =
    "background:white;border:1px solid #d8dce3;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px"

  const heading = document.createElement("div")
  heading.textContent = `${id} :: ${phrase}`
  heading.style.cssText = "font-size:12px;color:#384152;word-break:break-word"

  const svg = phraseToSvg(phrase, handwritten)
  const svgText = svg.outerHTML
  const hash = hashTextFNV1a(svgText)
  generated.push({ id, phrase, svgText, hash })
  svg.style.cssText = "width:100%;height:110px;background:#fafbfc;border:1px solid #eef1f5"
  heading.textContent = `${id} :: ${phrase} :: ${hash}`

  const save = document.createElement("button")
  save.textContent = "Download SVG"
  save.onclick = () => {
    downloadFile(`${id}.svg`, svgText, "image/svg+xml")
  }

  card.append(heading, svg, save)
  app.appendChild(card)
}

const uniqueHashes = new Set(generated.map((item) => item.hash)).size
const duplicateCount = generated.length - uniqueHashes
stats.textContent = `unique=${uniqueHashes}/${generated.length}, duplicates=${duplicateCount}`

document.body.style.margin = "0"
document.body.appendChild(app)
