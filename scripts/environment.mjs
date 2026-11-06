import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export function loadEnvironment() {
  for (const name of [process.env.CAMPUSFLOW_ENV_FILE, '.env.local', '.env'].filter(Boolean)) {
    const path = resolve(projectRoot, name)
    if (existsSync(path)) process.loadEnvFile(path)
  }
}
export function backendArguments() {
  const args = ['scripts/maven.sh', '-f', 'backend/pom.xml', 'spring-boot:run']
  if (existsSync('/etc/ssl/certs/java/cacerts')) {
    args.push('-Dspring-boot.run.jvmArguments=-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts')
  }
  return args
}
