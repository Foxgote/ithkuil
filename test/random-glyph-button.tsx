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
panel.append(controls, label, mount, divider, altControls, altLabel, altMount)
app.appendChild(panel)
document.body.style.margin = "0"
document.body.appendChild(app)

renderWord(randomWord(), mount, label)
renderWord(randomScifiWord(), altMount, altLabel)
