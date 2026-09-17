import { execFileSync } from 'node:child_process'
export default function globalTeardown() {
  execFileSync('npm', ['--prefix', '../backend', 'run', '-s', 'e2e:fixture', '--', 'down'], { stdio: 'inherit' })
}
