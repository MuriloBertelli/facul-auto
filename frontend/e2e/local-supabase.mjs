import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
let status
try {
  status = JSON.parse(execFileSync(process.execPath, ['scripts/supabase.mjs', 'status', '-o', 'json'], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }))
} catch { throw new Error('Inicie o Supabase local com npm run db:start antes da integração.') }
const url = new URL(status.API_URL)
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '54321',
  'Este teste aceita somente o Supabase local na porta 54321.')
const publicKey = status.PUBLISHABLE_KEY || status.ANON_KEY
const adminKey = status.SECRET_KEY || status.SERVICE_ROLE_KEY
assert.ok(publicKey && adminKey, 'Bindings locais não encontrados.')
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url.href, adminKey, options)
const owner = createClient(url.href, publicKey, options)
const other = createClient(url.href, publicKey, options)
const anon = createClient(url.href, publicKey, options)
const users = []
let child
let checks = 0
function passed(label) { checks++; console.log(`✓ ${label}`) }

try {
  const credentials = []
  for (let i = 0; i < 2; i++) {
    const email = `campusflow-test-${randomUUID()}@example.test`
    const password = randomBytes(24).toString('base64url')
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    assert.ok(!result.error && result.data.user, 'Falha ao criar usuário local descartável.')
    users.push(result.data.user.id)
    credentials.push({ email, password })
  }
  const login = await owner.auth.signInWithPassword(credentials[0])
  const otherLogin = await other.auth.signInWithPassword(credentials[1])
  assert.ok(!login.error && login.data.session && !otherLogin.error && otherLogin.data.session)
  passed('Supabase autentica dois usuários locais descartáveis')
  const inserted = await owner.from('assignments').insert({ title: 'Integração Java descartável', course_name: 'Teste local' }).select().single()
  assert.ok(!inserted.error && inserted.data.user_id === users[0])
  passed('PostgREST cria o trabalho para o usuário autenticado')
  const updated = await owner.from('assignments').update({ status: 'ready' }).eq('id', inserted.data.id).select().single()
  assert.ok(!updated.error && updated.data.status === 'ready')
  passed('O proprietário atualiza o trabalho')
  const foreign = await other.from('assignments').select('*').eq('id', inserted.data.id)
  assert.ok(!foreign.error && foreign.data.length === 0)
  const foreignUpdate = await other.from('assignments').update({ status: 'submitted' }).eq('id', inserted.data.id).select()
  assert.ok(!foreignUpdate.error && foreignUpdate.data.length === 0)
  passed('RLS impede leitura e alteração entre usuários reais')
  const forged = await other.from('assignments').insert({ title: 'Inserção inválida', course_name: 'Teste', user_id: users[0] })
  assert.ok(forged.error)
  const anonymous = await anon.from('assignments').select('*')
  assert.ok(anonymous.error)
  passed('RLS rejeita proprietário forjado e acesso anônimo')

  const probe = createServer()
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  child = spawn('bash', ['-c', 'source scripts/java-toolchain.sh; exec "$JAVA_HOME/bin/java" -jar backend/target/facul-auto-api.jar'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), SUPABASE_URL: url.origin,
      SUPABASE_PUBLISHABLE_KEY: publicKey, SUPABASE_OWNER_USER_ID: users[0],
      CANVAS_BASE_URL: '', CANVAS_API_TOKEN: '', CANVAS_SUBMISSIONS_ENABLED: 'false',
      APP_ALLOWED_ORIGINS: 'http://127.0.0.1:8888' },
  })
  child.stdout.resume()
  child.stderr.resume()
  const base = `http://127.0.0.1:${port}`
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) break
    try { ready = (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) })).ok } catch {}
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  assert.ok(ready, 'A API Java local não iniciou. Execute npm run build:backend antes do teste.')
  passed('O JAR Spring Boot inicia e responde ao health check real')
  const read = headers => fetch(`${base}/api/canvas/courses`, { headers })
  assert.equal((await read({})).status, 401)
  assert.equal((await read({ authorization: 'Bearer invalid-local-test' })).status, 401)
  passed('A API Java recusa requisições sem sessão ou com sessão inválida')
  const authorized = await read({ authorization: `Bearer ${login.data.session.access_token}` })
  assert.equal(authorized.status, 503)
  assert.match((await authorized.json()).error, /Canvas/)
  passed('A API Java valida a sessão Supabase real e exige configurar o Canvas')
  assert.equal((await read({ authorization: `Bearer ${otherLogin.data.session.access_token}` })).status, 403)
  passed('A API Java bloqueia outra conta autenticada antes do Canvas')
  const preflight = await fetch(`${base}/api/canvas/submissions`, { method: 'OPTIONS', headers: {
    Origin: 'http://127.0.0.1:8888', 'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'authorization,content-type',
  } })
  assert.equal(preflight.status, 200)
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://127.0.0.1:8888')
  assert.notEqual(preflight.headers.get('access-control-allow-credentials'), 'true')
  passed('CORS permite a origem exata e os cabeçalhos de sessão, sem cookies')
  const badOrigin = await fetch(`${base}/api/health`, { headers: { Origin: 'https://untrusted.example' } })
  assert.equal(badOrigin.status, 403)
  passed('CORS recusa uma origem não autorizada')
  const removed = await owner.from('assignments').delete().eq('id', inserted.data.id).select()
  assert.ok(!removed.error && removed.data.length === 1)
  passed('O proprietário exclui o trabalho descartável')
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
  for (const id of users) {
    const result = await admin.auth.admin.deleteUser(id)
    assert.ok(!result.error, 'Não foi possível remover um usuário local descartável.')
  }
}
console.log(`${checks} verificações Java/Supabase passaram; usuários e processo descartáveis removidos. Nenhum Canvas real foi acessado.`)
