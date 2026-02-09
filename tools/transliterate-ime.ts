import { readFileSync } from "node:fs"
import { resolve } from "node:path"

interface MappingEntry {
  name: string
  codepoint: string
  category: "base" | "mark" | "structure" | "ligature" | string
  input_sequence: string
}

interface MappingFile {
  version: string
  entries: MappingEntry[]
}

function loadMapping(): MappingFile {
  const file = resolve(process.cwd(), "font/mapping.json")
  const raw = readFileSync(file, "utf8")
  const parsed = JSON.parse(raw) as MappingFile

  if (!Array.isArray(parsed.entries)) {
    throw new Error("Invalid mapping.json: missing entries array")
  }

  return parsed
}

function asCharFromHexCodepoint(hex: string): string {
  const value = Number.parseInt(hex, 16)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid codepoint: ${hex}`)
  }
  return String.fromCodePoint(value)
}

function toUPlus(codepoint: number): string {
  return `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`
}

function transliterate(input: string, entries: MappingEntry[]): string {
  const sorted = entries
    .filter((entry) => entry.input_sequence.length > 0)
    .slice()
    .sort((a, b) => b.input_sequence.length - a.input_sequence.length)

  let output = ""
  let i = 0

  while (i < input.length) {
    if (input[i] == " ") {
      output += " "
      i++
      continue
    }

    let matched = false

    for (const entry of sorted) {
      if (input.startsWith(entry.input_sequence, i)) {
        output += asCharFromHexCodepoint(entry.codepoint)
        i += entry.input_sequence.length
        matched = true
        break
      }
    }

    if (!matched) {
      output += input[i]
      i++
    }
  }

  return output
}

function explainCodepoints(text: string): string {
  return Array.from(text, (ch) => toUPlus(ch.codePointAt(0)!)).join(" ")
}

function main() {
  const input = process.argv.slice(2).join(" ")

  if (!input) {
    console.error("Usage: node tools/transliterate-ime.js \"k. t- s~ r'\"")
    process.exit(1)
  }

  const mapping = loadMapping()
  const output = transliterate(input, mapping.entries)

  console.log(output)
  console.log(explainCodepoints(output))
}

main()
