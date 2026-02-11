import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = path.join(repoRoot, 'build')

const apiPackageJsonPath = path.join(repoRoot, 'api', 'package.json')
const apiLockPath = path.join(repoRoot, 'api', 'pnpm-lock.yaml')

const buildPackageJsonPath = path.join(buildDir, 'package.json')
const buildLockPath = path.join(buildDir, 'pnpm-lock.yaml')

await mkdir(buildDir, { recursive: true })

const apiPackageJson = JSON.parse(await readFile(apiPackageJsonPath, 'utf8'))
apiPackageJson.scripts ??= {}
apiPackageJson.scripts.start = 'node ./api/main.js'
apiPackageJson.scripts['start:prod'] = 'node ./api/main.js'

await writeFile(buildPackageJsonPath, `${JSON.stringify(apiPackageJson, null, 2)}\n`, 'utf8')
await copyFile(apiLockPath, buildLockPath)
