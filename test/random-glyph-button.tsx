import { roots } from "../data/roots-latest.js"
import { formativeToIthkuil } from "../generate/index.js"
import { Anchor, CharacterRow, fitViewBox, textToScript } from "../script/index.js"

const ROOTS = roots
  .map((entry) => entry.cr)
  .filter((root) => root.length > 0 && !root.includes("["))

const TYPES = ["UNF/C", "FRM"] as const
const SPECS = ["BSC", "CTE", "CSV", "OBJ"] as const
const CASES = ["THM", "ABS", "ERG", "AFF", "STM", "INS"] as const

function randomItem<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!
}

function randomWord(): string {
  for (let i = 0; i < 40; i++) {
    try {
      const type = randomItem(TYPES)
      const word = formativeToIthkuil({
        type,
        root: randomItem(ROOTS),
        shortcut: Math.random() < 0.3,
        specification: Math.random() < 0.5 ? randomItem(SPECS) : undefined,
        case: type == "UNF/C" && Math.random() < 0.5 ? randomItem(CASES) : undefined,
      })

      if (word) {
        return word
      }
    } catch {
      // Retry until we hit a valid combination.
    }
  }

  return formativeToIthkuil({ type: "UNF/C", root: "l" })
}

const SCIFI_VN = [
  "RTR",
  "PRG",
  "REP",
  "PCL",
  "CNT",
  "ATP",
  "DUP",
  "MNO",
  "1:BEN",
  "3:DET",
] as const

function randomScifiWord(): string {
  for (let i = 0; i < 80; i++) {
    try {
      const type = randomItem(TYPES)
      const slotVAffixes =
        Math.random() < 0.75 ?
          [
            {
              type: randomItem([1, 2] as const),
              degree: randomItem([1, 2, 3, 4, 5, 6, 7, 8, 9] as const),
              cs: randomItem(["k", "t", "r", "s", "c", "kl", "ţr"] as const),
            },
          ]
        : undefined

      const word = formativeToIthkuil({
        type,
        root: randomItem(ROOTS),
        shortcut: Math.random() < 0.5,
        specification: randomItem(SPECS),
        case: type == "UNF/C" ? randomItem(CASES) : undefined,
        vn: Math.random() < 0.7 ? randomItem(SCIFI_VN) : undefined,
        slotVAffixes,
      })

      if (word) {
        return word
      }
    } catch {
      // Retry until we hit a valid combination.
    }
  }

  return formativeToIthkuil({ type: "UNF/C", root: "rr", specification: "OBJ" })
}

function renderWord(word: string, mount: HTMLElement, label: HTMLElement) {
  const script = textToScript(word, false)
  mount.innerHTML = ""

  if (!script.ok) {
    label.textContent = `Error: ${script.reason}`
    return
  }

  const svg = (
    <svg
      fill="#2DB0FA"
      stroke="none"
    >
      <Anchor at="cc">
        <CharacterRow>{script.value}</CharacterRow>
      </Anchor>
    </svg>
  ) as SVGSVGElement

  fitViewBox(svg, 20)
  svg.style.width = "100%"
  svg.style.height = "220px"
  svg.style.display = "block"
  svg.style.background = "#ffffff"
  svg.style.border = "1px solid #d7dce3"
  svg.style.borderRadius = "10px"

  mount.appendChild(svg)
  label.textContent = `Word: ${word}`
}

type BatchItem = {
  id: string
  phrase: string
  glyphCount: number
  phraseFile: string
  phraseWidth?: number
  phraseHeight?: number
  glyphs: {
    index: number
    file: string
    rawWidth?: number
    rawHeight?: number
    width: number
    height: number
  }[]
}

type BatchManifest = {
  count?: number
  minGlyphs?: number
  maxGlyphs?: number
  resolvedSeed?: number
  glyphTargetHeight?: number
  items?: BatchItem[]
}

async function loadBatchPreview(mount: HTMLElement, label: HTMLElement) {
  const candidates = [
    "./.tmp/ithkuil-glyph-phrases/manifest.json",
    "./.tmp/seed-test/manifest.json",
  ]

  let manifest: BatchManifest | undefined
  let basePath = ""

  for (const path of candidates) {
    try {
      const res = await fetch(path, { cache: "no-store" })
      if (!res.ok) {
        continue
      }

      manifest = (await res.json()) as BatchManifest
      basePath = path.replace(/manifest\.json$/, "")
      break
    } catch {
      // Try next candidate.
    }
  }

  if (!manifest || !Array.isArray(manifest.items) || manifest.items.length == 0) {
    label.textContent =
      "Batch preview: no manifest found. Put one at .tmp/ithkuil-glyph-phrases/manifest.json or .tmp/seed-test/manifest.json"
    return
  }

  const glyphEntries = manifest.items.flatMap((item) =>
    item.glyphs.map((glyph) => ({
      phraseId: item.id,
      phrase: item.phrase,
      glyphCount: item.glyphCount,
      phraseWidth: item.phraseWidth ?? 150,
      phraseHeight: item.phraseHeight ?? 70,
      glyphIndex: glyph.index,
      file: glyph.file,
      rawWidth: glyph.rawWidth ?? glyph.width,
      rawHeight: glyph.rawHeight ?? glyph.height,
      width: glyph.width,
      height: glyph.height,
    })),
  )
  const phraseCardWidth = 150
  const phraseCardHeight = 70

  label.textContent = `Batch compare preview: phrases=${manifest.items.length}, glyphs=${glyphEntries.length}, unifiedH=${manifest.glyphTargetHeight}, seed=${manifest.resolvedSeed}`

  mount.innerHTML = ""
  mount.style.display = "flex"
  mount.style.flexDirection = "column"
  mount.style.gap = "8px"

  const phraseHeading = document.createElement("div")
  phraseHeading.textContent = "Phrases"
  phraseHeading.style.cssText = "font-size:12px;font-weight:600;color:#2f3f50"

  const phraseLine = document.createElement("div")
  phraseLine.style.cssText =
    "display:flex;gap:8px;overflow-x:auto;padding:10px;background:#ffffff;border:1px solid #d7dce3;border-radius:10px"

  for (const item of manifest.items) {
    const card = document.createElement("article")
    card.style.cssText =
      "flex:0 0 auto;width:150px;padding:8px;border:1px solid #e1e6ed;border-radius:8px;background:#fbfdff"

    const img = document.createElement("img")
    img.src = `${basePath}${item.phraseFile}`
    img.alt = `${item.id} phrase`
    img.loading = "lazy"
    img.style.cssText =
      "display:block;width:100%;height:70px;object-fit:contain;object-position:center bottom"

    const title = document.createElement("div")
    title.textContent = `${item.id} (${item.glyphCount})`
    title.style.cssText = "margin-top:6px;font-size:11px;color:#1f4d89;line-height:1.2"

    const phrase = document.createElement("div")
    phrase.textContent = item.phrase
    phrase.title = item.phrase
    phrase.style.cssText =
      "margin-top:4px;font-size:10px;color:#5b6b7a;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"

    card.append(img, title, phrase)
    phraseLine.appendChild(card)
  }

  const glyphHeading = document.createElement("div")
  glyphHeading.textContent = "Single Glyph Slices"
  glyphHeading.style.cssText = "font-size:12px;font-weight:600;color:#2f3f50"

  const glyphLine = document.createElement("div")
  glyphLine.style.cssText =
    "display:flex;gap:8px;overflow-x:auto;padding:10px;background:#ffffff;border:1px solid #d7dce3;border-radius:10px"
  const glyphCardRenderHeight = 70

  for (const entry of glyphEntries) {
    const renderHeight = glyphCardRenderHeight
    const renderWidth = Math.max(
      18,
      Math.round((entry.width / Math.max(1, entry.height)) * renderHeight),
    )

    const card = document.createElement("article")
    card.style.cssText =
      `flex:0 0 auto;width:${renderWidth + 16}px;padding:8px;border:1px solid #e1e6ed;border-radius:8px;background:#fbfdff`

    const img = document.createElement("img")
    img.src = `${basePath}${entry.file}`
    img.alt = `${entry.phraseId} glyph-${String(entry.glyphIndex).padStart(2, "0")}`
    img.loading = "lazy"
    img.style.cssText =
      `display:block;width:${renderWidth}px;height:${renderHeight}px;object-fit:contain;object-position:center bottom`

    const title = document.createElement("div")
    title.textContent = `${entry.phraseId} g${entry.glyphIndex}`
    title.style.cssText = "margin-top:6px;font-size:11px;color:#1f4d89;line-height:1.2"

    const phrase = document.createElement("div")
    phrase.textContent = `${Math.round(entry.width)}x${Math.round(entry.height)}`
    phrase.title = `${entry.phrase} (${entry.glyphCount})`
    phrase.style.cssText =
      "margin-top:4px;font-size:10px;color:#5b6b7a;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"

    card.append(img, title, phrase)
    glyphLine.appendChild(card)
  }

  const sentenceHeading = document.createElement("div")
  sentenceHeading.textContent = "Single Slice Sentence"
  sentenceHeading.style.cssText = "font-size:12px;font-weight:600;color:#2f3f50"

  const sentenceContainer = document.createElement("div")
  sentenceContainer.style.cssText =
    "padding:10px;background:#ffffff;border:1px solid #d7dce3;border-radius:10px"

  const sentenceParagraph = document.createElement("p")
  sentenceParagraph.style.cssText =
    "margin:0;display:flex;gap:4px;align-items:flex-end;overflow-x:auto;padding:2px 0;white-space:nowrap"
  const sentenceGlyphHeight = 52

  for (const entry of glyphEntries) {
    const renderHeight = sentenceGlyphHeight
    const renderWidth = Math.max(
      12,
      Math.round((entry.width / Math.max(1, entry.height)) * renderHeight),
    )

    const glyphImg = document.createElement("img")
    glyphImg.src = `${basePath}${entry.file}`
    glyphImg.alt = `${entry.phraseId} glyph-${String(entry.glyphIndex).padStart(2, "0")}`
    glyphImg.loading = "lazy"
    glyphImg.style.cssText =
      `display:block;width:${renderWidth}px;height:${renderHeight}px;object-fit:contain;object-position:center bottom;flex:0 0 auto`
    sentenceParagraph.appendChild(glyphImg)
  }

  sentenceContainer.appendChild(sentenceParagraph)

  mount.append(
    phraseHeading,
    phraseLine,
    glyphHeading,
    glyphLine,
    sentenceHeading,
    sentenceContainer,
  )
}

const app = document.createElement("main")
app.style.cssText =
  "min-height:100vh;display:flex;align-items:center;justify-content:center;background:#edf1f5;padding:24px;font-family:ui-monospace,Consolas,Menlo,monospace"

const panel = document.createElement("section")
panel.style.cssText =
  "width:min(920px,96vw);background:#f9fbfc;border:1px solid #dbe1e8;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px"

const controls = document.createElement("div")
controls.style.cssText = "display:flex;gap:10px;align-items:center;flex-wrap:wrap"

const button = document.createElement("button")
button.textContent = "Generate Random Glyph"
button.style.cssText =
  "padding:10px 14px;border:1px solid #b7c2cf;background:#ffffff;border-radius:8px;cursor:pointer"

const input = document.createElement("input")
input.type = "text"
input.placeholder = "Type Ithkuil word or phrase"
input.style.cssText =
  "padding:10px 12px;border:1px solid #b7c2cf;background:#ffffff;border-radius:8px;min-width:260px;flex:1"

const submit = document.createElement("button")
submit.textContent = "Render Input"
submit.style.cssText =
  "padding:10px 14px;border:1px solid #b7c2cf;background:#ffffff;border-radius:8px;cursor:pointer"

const label = document.createElement("div")
label.style.cssText = "font-size:13px;color:#334155;word-break:break-word"

const mount = document.createElement("div")

const divider = document.createElement("hr")
divider.style.cssText = "border:none;border-top:1px solid #dbe1e8;margin:6px 0"

const altControls = document.createElement("div")
altControls.style.cssText = "display:flex;gap:10px;align-items:center;flex-wrap:wrap"

const altButton = document.createElement("button")
altButton.textContent = "Generate Sci-Fi Dense Glyph"
altButton.style.cssText =
  "padding:10px 14px;border:1px solid #9fc2df;background:#eaf4ff;border-radius:8px;cursor:pointer"

const altLabel = document.createElement("div")
altLabel.style.cssText = "font-size:13px;color:#334155;word-break:break-word"

const altMount = document.createElement("div")

const batchDivider = document.createElement("hr")
batchDivider.style.cssText = "border:none;border-top:1px solid #dbe1e8;margin:6px 0"

const batchLabel = document.createElement("div")
batchLabel.style.cssText = "font-size:13px;color:#334155;word-break:break-word"

const batchMount = document.createElement("div")

button.onclick = () => {
  renderWord(randomWord(), mount, label)
}

submit.onclick = () => {
  const text = input.value.trim()

  if (!text) {
    label.textContent = "Enter a word or phrase first."
    return
  }

  renderWord(text, mount, label)
}

input.addEventListener("keydown", (event) => {
  if (event.key == "Enter") {
    submit.click()
  }
})

altButton.onclick = () => {
  renderWord(randomScifiWord(), altMount, altLabel)
}

controls.append(button, input, submit)
altControls.append(altButton)
panel.append(
  controls,
  label,
  mount,
  divider,
  altControls,
  altLabel,
  altMount,
  batchDivider,
  batchLabel,
  batchMount,
)
app.appendChild(panel)
document.body.style.margin = "0"
document.body.appendChild(app)

renderWord(randomWord(), mount, label)
renderWord(randomScifiWord(), altMount, altLabel)
void loadBatchPreview(batchMount, batchLabel)
