import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// WorkBuddy plugin entrypoint. It is deliberately dependency-free so WorkBuddy
// can install the npm dependencies on first launch without a separate CLI step.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DAEMON = path.join(ROOT, 'daemon')
const MCP_ENTRY = path.join(DAEMON, 'mcp-server.mjs')

const dependencyMarkers = [
  path.join(DAEMON, 'node_modules', '@modelcontextprotocol', 'sdk', 'package.json'),
  path.join(DAEMON, 'node_modules', 'puppeteer', 'package.json'),
  path.join(DAEMON, 'node_modules', 'puppeteer-core', 'package.json'),
  path.join(DAEMON, 'node_modules', 'puppeteer-extra', 'package.json'),
  path.join(DAEMON, 'node_modules', 'puppeteer-extra-plugin-anonymize-ua', 'package.json'),
  path.join(DAEMON, 'node_modules', 'puppeteer-extra-plugin-stealth', 'package.json'),
  path.join(DAEMON, 'node_modules', 'patch-package', 'package.json')
]

function exists(file) {
  try { return fs.existsSync(file) } catch { return false }
}

function dependenciesReady() {
  const patch = path.join(DAEMON, 'node_modules', 'puppeteer-extra-plugin-anonymize-ua', 'index.js')
  if (!dependencyMarkers.every(exists) || !exists(patch)) return false
  try {
    const source = fs.readFileSync(patch, 'utf8')
    return source.includes('async onBrowser(browser)') && source.includes('async handler (page)')
  } catch {
    return false
  }
}

function resolveExecutable(command) {
  const finder = process.platform === 'win32' ? 'where.exe' : 'which'
  const result = spawnSync(finder, [command], { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) return ''
  return String(result.stdout || '').split(/\r?\n/).map(line => line.trim()).find(Boolean) || ''
}

function resolveNpm() {
  const nodeDir = path.dirname(process.execPath)
  const candidates = process.platform === 'win32'
    ? [process.env.NPM_CMD, path.join(nodeDir, 'npm.cmd'), path.join(nodeDir, 'npm.exe')]
    : [process.env.NPM_CMD, path.join(nodeDir, 'npm')]
  for (const candidate of candidates.filter(Boolean)) {
    if (exists(candidate)) return { command: candidate, args: [] }
  }

  const bundledNpm = process.platform === 'win32'
    ? path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js')
    : path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (exists(bundledNpm)) return { command: process.execPath, args: [bundledNpm] }

  const resolved = resolveExecutable(process.platform === 'win32' ? 'npm.cmd' : 'npm')
  return resolved ? { command: resolved, args: [] } : null
}

function installDependencies() {
  if (dependenciesReady()) return
  const npm = resolveNpm()
  if (!npm) throw new Error('WorkBuddy 的 Node.js 运行时没有找到 npm，无法首次准备 MCP 依赖。')

  process.stderr.write('[job-agent] 首次启动，正在准备 MCP 依赖；不会下载额外 Chromium。\n')
  const result = spawnSync(npm.command, [...npm.args, 'install', '--no-audit', '--no-fund'], {
    cwd: DAEMON,
    env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: '1', NODE_OPTIONS: '' },
    // stdout belongs to the MCP protocol. Keep npm progress off the protocol
    // channel; npm errors still remain visible to the host through stderr.
    stdio: ['ignore', 'ignore', 'inherit'],
    windowsHide: true
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`MCP 依赖安装失败，npm 退出码：${result.status}。`)
  process.stderr.write('[job-agent] MCP 依赖准备完成。\n')
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) } catch { return null }
}

function ensureConfigTemplates(configDir) {
  const exampleDir = path.join(DAEMON, 'config.example')
  if (!exists(exampleDir)) return
  for (const name of fs.readdirSync(exampleDir).filter(item => item.endsWith('.json'))) {
    const target = path.join(configDir, name)
    if (!exists(target)) fs.copyFileSync(path.join(exampleDir, name), target)
  }
}

function resetDeliveryDefaults(configDir) {
  if (process.env.JOB_AGENT_RESET_DELIVERY_DEFAULTS !== '1') return
  const marker = path.join(configDir, '.delivery-defaults-reset-v1')
  if (exists(marker)) return

  const platformFiles = ['boss.json', 'zhilian.json', 'job51.json', 'liepin.json']
  const resetPlatforms = []
  let complete = true
  for (const name of platformFiles) {
    const file = path.join(configDir, name)
    const config = readJson(file)
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      complete = false
      process.stderr.write(`[job-agent] 无法读取平台配置，暂不写入清理标记：${file}\n`)
      continue
    }
    const hasCity = Boolean(String(config.daemonCity || '').trim())
      || (Array.isArray(config.expectCityList) ? config.expectCityList.some(item => String(item || '').trim()) : Boolean(String(config.expectCityList || '').trim()))
    const hasKeywords = Boolean(String(config.expectJobNameRegExpStr || '').trim())
      || (Array.isArray(config.jobSourceList) && config.jobSourceList.some(source => Array.isArray(source?.children) && source.children.length > 0))
    if (hasCity || hasKeywords) {
      config.daemonCity = ''
      config.expectCityList = []
      if (Object.prototype.hasOwnProperty.call(config, 'liepinProvince')) config.liepinProvince = ''
      config.expectJobNameRegExpStr = ''
      config.jobSourceList = [{ type: 'search', enabled: true, children: [] }]
      try {
        fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n', 'utf8')
        resetPlatforms.push(name.replace(/\.json$/, ''))
      } catch (error) {
        complete = false
        process.stderr.write(`[job-agent] 旧版默认配置未能自动清理：${error.message}\n`)
      }
    }
  }
  if (!complete) return
  try {
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(marker, '1\n', 'utf8')
    process.stderr.write(resetPlatforms.length
      ? `[job-agent] 已清空旧投递默认：${resetPlatforms.join('、')} 的城市和岗位关键词；求职资料、统计、API 与登录状态未删除。\n`
      : '[job-agent] 已检查投递配置，未发现旧城市或岗位关键词默认。\n')
  } catch (error) {
    process.stderr.write(`[job-agent] 无法写入配置迁移标记：${error.message}\n`)
  }
}

function detectChrome() {
  const candidates = [process.env.BOSS_CHROME_PATH, process.env.CHROME_PATH]
  if (process.platform === 'win32') {
    candidates.push(
      process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
      process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : ''
    )
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  } else {
    candidates.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome')
  }
  return candidates.filter(Boolean).find(exists) || ''
}

function usablePath(value) {
  const text = String(value || '').trim()
  return text && !text.includes('${') && !text.startsWith('<') ? path.resolve(text) : ''
}

function buildRuntimeEnv() {
  const home = os.homedir()
  const configDir = usablePath(process.env.JOB_AGENT_CONFIG_DIR) || path.join(home, '.job-agent', 'config')
  const storageDir = usablePath(process.env.JOB_AGENT_STORAGE_DIR) || path.join(home, '.job-agent', 'storage')
  const stateDir = usablePath(process.env.BOSS_DAEMON_STATE) || path.join(home, '.job-agent', 'state')
  for (const directory of [configDir, storageDir, stateDir]) fs.mkdirSync(directory, { recursive: true })
  ensureConfigTemplates(configDir)
  resetDeliveryDefaults(configDir)

  return {
    ...process.env,
    JOB_AGENT_EDITION: 'mcp',
    JOB_AGENT_DEPENDENCY_ROOT: DAEMON,
    JOB_AGENT_CONFIG_DIR: configDir,
    JOB_AGENT_STORAGE_DIR: storageDir,
    BOSS_DAEMON_STATE: stateDir,
    BOSS_CHROME_PATH: process.env.BOSS_CHROME_PATH || detectChrome(),
    NODE_OPTIONS: ''
  }
}

function main() {
  if (!exists(MCP_ENTRY)) throw new Error(`找不到 MCP 服务入口：${MCP_ENTRY}`)
  installDependencies()
  const child = spawn(process.execPath, [MCP_ENTRY], {
    cwd: DAEMON,
    env: buildRuntimeEnv(),
    stdio: 'inherit',
    windowsHide: true
  })
  child.on('error', error => {
    process.stderr.write(`[job-agent] 无法启动 MCP 服务：${error.message}\n`)
    process.exit(1)
  })
  child.on('exit', code => process.exit(code ?? 1))
}

export { ensureConfigTemplates, resetDeliveryDefaults }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`[job-agent] 启动失败：${error?.stack || error?.message || error}\n`)
    process.exit(1)
  }
}
