import { spawn } from 'node:child_process'

const procs = []
const run = (cmd, args) => {
  const p = spawn(cmd, args, { stdio: 'inherit', shell: true })
  procs.push(p)
  p.on('exit', (code) => {
    killAll()
    process.exit(code ?? 0)
  })
  return p
}

const killAll = () => {
  for (const p of procs) {
    if (p && !p.killed) {
      try {
        p.kill('SIGINT')
      } catch {}
    }
  }
}

process.on('SIGINT', () => {
  killAll()
  process.exit(0)
})
process.on('SIGTERM', () => {
  killAll()
  process.exit(0)
})

run('vite', [])
run('npm', ['run', '--prefix', './api', 'start:dev'])
