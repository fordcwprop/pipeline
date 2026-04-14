#!/usr/bin/env node
/**
 * Build frontend/public/underwriting.json from the dev-agent skills + memory.
 *
 * Usage:
 *   node scripts/build-underwriting.mjs [--dev-agent PATH] [--memory PATH]
 *
 * Defaults assume the dev-agent repo is mounted at the usual sandbox path.
 * Override with --dev-agent / --memory or env vars DEV_AGENT_DIR / MEMORY_DIR
 * when running outside the sandbox.
 *
 * The generated file powers the Underwriting page (frontend/src/pages/Underwriting.jsx).
 * Regenerate any time skills or memory change, then commit the updated JSON.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')

function getArg(flag) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : null
}

const DEV_AGENT_DIR =
  getArg('--dev-agent') ||
  process.env.DEV_AGENT_DIR ||
  '/sessions/confident-festive-mendel/mnt/Dev Agent'

const MEMORY_DIR =
  getArg('--memory') ||
  process.env.MEMORY_DIR ||
  '/sessions/confident-festive-mendel/mnt/.auto-memory'

const OUT_PATH = path.join(REPO_ROOT, 'frontend', 'public', 'underwriting.json')

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8') } catch { return null }
}

function parseFrontmatter(md) {
  if (!md || !md.startsWith('---')) return { meta: {}, body: md || '' }
  const end = md.indexOf('\n---', 3)
  if (end < 0) return { meta: {}, body: md }
  const header = md.slice(3, end).trim()
  const body = md.slice(end + 4).replace(/^\s*\n/, '')
  const meta = {}
  let lastKey = null
  for (const rawLine of header.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (m) {
      meta[m[1]] = m[2].trim()
      lastKey = m[1]
    } else if (lastKey && /^\s+\S/.test(line)) {
      // folded / continuation value
      meta[lastKey] = (meta[lastKey] + ' ' + line.trim()).trim()
    }
  }
  // Clean YAML block scalar indicators and surrounding quotes
  for (const k of Object.keys(meta)) {
    let v = meta[k]
    if (v.startsWith('>') || v.startsWith('|')) v = v.slice(1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    meta[k] = v.trim()
  }
  return { meta, body }
}

function collectSkills() {
  const skillsDir = path.join(DEV_AGENT_DIR, 'skills')
  if (!fs.existsSync(skillsDir)) {
    console.error(`No skills directory at ${skillsDir}`)
    return []
  }
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.endsWith('.skill') && !e.name.startsWith('.'))
    .map(e => e.name)
    .sort()

  const skills = []
  for (const id of entries) {
    const skillMdPath = path.join(skillsDir, id, 'SKILL.md')
    const skillMd = readFileSafe(skillMdPath)
    if (!skillMd) continue
    const { meta, body } = parseFrontmatter(skillMd)

    const refs = []
    const refsDir = path.join(skillsDir, id, 'references')
    if (fs.existsSync(refsDir)) {
      for (const f of fs.readdirSync(refsDir).sort()) {
        if (!f.endsWith('.md')) continue
        const content = readFileSafe(path.join(refsDir, f))
        if (content) refs.push({ name: f, content })
      }
    }

    skills.push({
      id,
      name: meta.name || id,
      description: meta.description || '',
      skill_md: body,
      references: refs,
    })
  }
  return skills
}

function collectMemories() {
  if (!fs.existsSync(MEMORY_DIR)) {
    console.error(`No memory directory at ${MEMORY_DIR}`)
    return []
  }
  const files = fs.readdirSync(MEMORY_DIR)
    .filter(f => f.endsWith('.md') && f !== 'MEMORY.md')
    .sort()
  const memories = []
  for (const f of files) {
    const raw = readFileSafe(path.join(MEMORY_DIR, f))
    if (!raw) continue
    const { meta, body } = parseFrontmatter(raw)
    memories.push({
      file: f,
      name: meta.name || f.replace(/\.md$/, ''),
      description: meta.description || '',
      type: meta.type || 'unknown',
      content: body,
    })
  }
  return memories
}

function main() {
  const skills = collectSkills()
  const memories = collectMemories()
  const today = new Date().toISOString().slice(0, 10)
  const doc = {
    version: '1.1',
    last_updated: today,
    generated_by: 'scripts/build-underwriting.mjs',
    skills,
    memories,
  }
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(doc, null, 2) + '\n')
  console.log(`Wrote ${OUT_PATH}`)
  console.log(`  skills:   ${skills.length}`)
  console.log(`  memories: ${memories.length}`)
}

main()
