import { execFileSync } from 'node:child_process'
export default function globalSetup() {
  execFileSync('npm', ['--prefix', '../backend', 'run', '-s', 'e2e:fixture', '--', 'up'], { stdio: 'inherit' })
}
