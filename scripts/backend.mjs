import { spawn } from 'node:child_process'
import { projectRoot, loadEnvironment, backendArguments } from './environment.mjs'

loadEnvironment()
const child = spawn('bash', [...backendArguments(), ...process.argv.slice(2)], {
  cwd: projectRoot, stdio: 'inherit', env: process.env,
})
let stopping = false
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (stopping) return
  stopping = true
  child.kill(signal)
  setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }, 5000).unref()
})
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', (code, signal) => { process.exitCode = stopping ? 0 : code ?? (signal ? 1 : 0) })
