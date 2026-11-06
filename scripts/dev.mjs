import { spawn } from 'node:child_process'
import { projectRoot as root, loadEnvironment } from './environment.mjs'

loadEnvironment()
const children = []
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    child.kill('SIGTERM')
  }
  setTimeout(() => {
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }, 10_000).unref()
  process.exitCode = code
}
function start(command, args) {
  const child = spawn(command, args, {
    cwd: root, stdio: 'inherit', env: process.env,
  })
  children.push(child)
  child.on('error', error => { console.error(error.message); stop(1) })
  child.on('exit', code => { if (!stopping) stop(code || 1) })
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop())
start(process.execPath, ['scripts/backend.mjs'])
start('npm', ['run', 'dev', '--workspace', '@campusflow/frontend'])
