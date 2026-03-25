import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
const scriptPath = resolve(currentDir, 'generate-pwa-icons.py')

const result = spawnSync('python', [scriptPath], { stdio: 'inherit' })

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)
