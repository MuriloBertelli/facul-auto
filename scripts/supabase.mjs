import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'

const environment = {
  ...process.env,
  SUPABASE_HOME: process.env.SUPABASE_HOME || resolve('.cache/supabase'),
  SUPABASE_TELEMETRY_DISABLED: 'true',
}

// BusyBox wget ignores NO_PROXY in the Auth container's loopback health check.
// Scope this Docker client configuration to the local stack, keeping HTTPS
// egress and the host's proxy configuration intact. Registry images are public.
if (process.argv[2] === 'start' && !environment.DOCKER_CONFIG && !environment.DOCKER_CONTEXT
    && (environment.HTTP_PROXY || environment.http_proxy)
    && (environment.HTTPS_PROXY || environment.https_proxy)) {
  const httpsProxy = environment.HTTPS_PROXY || environment.https_proxy
  const proxy = new URL(httpsProxy)
  if (proxy.username || proxy.password) {
    console.error('Configure DOCKER_CONFIG para os contêineres locais sem copiar credenciais de proxy.')
    process.exit(1)
  }
  environment.DOCKER_CONFIG = resolve('.cache/docker-supabase')
  await mkdir(environment.DOCKER_CONFIG, { recursive: true, mode: 0o700 })
  await writeFile(resolve(environment.DOCKER_CONFIG, 'config.json'), JSON.stringify({
    proxies: { default: {
      httpsProxy,
      noProxy: environment.NO_PROXY || environment.no_proxy || 'localhost,127.0.0.1,::1',
    } },
  }), { mode: 0o600 })
}

const child = spawn(process.execPath, [
  fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url)),
  ...process.argv.slice(2),
], {
  stdio: 'inherit',
  env: environment,
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1) })
