import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DAEMON = path.join(ROOT, 'daemon')
const MCP_ENTRY = path.join(DAEMON, 'mcp-server.mjs')
const DEFAULT_NAME = 'job-agent'

function usage() {
  console.log(`Usage: node tools/install-mcp.mjs [options]

Options:
  --client auto|all|codex|claude|opencode|workbuddy   Client to configure (default: auto)
                                                        WorkBuddy uses ~/.workbuddy/mcp.json and needs no CLI
  --name NAME                                         MCP server name (default: job-agent)
  --skip-deps                                         Do not run npm install
  --print                                              Print a generic mcpServers JSON block
  --help                                               Show this help

Examples:
  node tools/install-mcp.mjs --client auto
  node tools/install-mcp.mjs --client codex
  node tools/install-mcp.mjs --client claude
`)
}

function parseArgs(argv) {
  const options = { client: 'auto', name: DEFAULT_NAME, skipDeps: false, print: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--skip-deps') options.skipDeps = true
    else if (arg === '--print') options.print = true
    else if (arg === '--client') options.client = argv[++i] || ''
    else if (arg.startsWith('--client=')) options.client = arg.slice('--client='.length)
    else if (arg === '--name') options.name = argv[++i] || ''
    else if (arg.startsWith('--name=')) options.name = arg.slice('--name='.length)
    else throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

function normalizeClient(value) {
  const normalized = String(value || '').toLowerCase()
  const aliases = {
    'claude-code': 'claude',
    'claudecode': 'claude',
    'codebuddy': 'workbuddy',
    'work-buddy': 'workbuddy',
    'workbuddy': 'workbuddy'
  }
  return aliases[normalized] || normalized
}

function resolveExecutable(command) {
  if (path.isAbsolute(command) && fs.existsSync(command)) return command
  const finder = process.platform === 'win32' ? 'where.exe' : 'which'
  const result = spawnSync(finder, [command], { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) return ''
  return String(result.stdout || '').split(/\r?\n/).map(line => line.trim()).find(Boolean) || ''
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || ROOT,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: false
  })
  if (result.error) throw result.error
  return result
}

function ensureDependencies() {
  const markers = [
    path.join(DAEMON, 'node_modules', '@modelcontextprotocol', 'sdk', 'package.json'),
    path.join(DAEMON, 'node_modules', 'puppeteer', 'package.json'),
    path.join(DAEMON, 'node_modules', 'puppeteer-core', 'package.json'),
    path.join(DAEMON, 'node_modules', 'puppeteer-extra', 'package.json'),
    path.join(DAEMON, 'node_modules', 'puppeteer-extra-plugin-anonymize-ua', 'package.json'),
    path.join(DAEMON, 'node_modules', 'puppeteer-extra-plugin-stealth', 'package.json'),
    path.join(DAEMON, 'node_modules', 'patch-package', 'package.json')
  ]
  const anonymizeUaSource = path.join(DAEMON, 'node_modules', 'puppeteer-extra-plugin-anonymize-ua', 'index.js')
  const patchApplied = fs.existsSync(anonymizeUaSource)
    && fs.readFileSync(anonymizeUaSource, 'utf8').includes('async onBrowser(browser)')
  if (markers.every(marker => fs.existsSync(marker)) && patchApplied) return
  const npm = resolveExecutable(process.platform === 'win32' ? 'npm.cmd' : 'npm')
  if (!npm) throw new Error('找不到 npm。请先安装 Node.js 22.12+，或先运行 install.bat。')
  console.log('[Job Agent] Installing MCP dependencies...')
  const result = run(npm, ['install', '--no-audit', '--no-fund'], {
    cwd: DAEMON,
    // Keep npm independent from host-injected Node --require hooks. They can
    // replace npm's normal cleanup phase and make reify fail before install.
    env: { PUPPETEER_SKIP_DOWNLOAD: '1', NODE_OPTIONS: '' }
  })
  if (result.status !== 0) throw new Error(`npm install failed with exit code ${result.status}.`)
}

function detectChrome() {
  const candidates = [
    process.env.BOSS_CHROME_PATH,
    process.env.CHROME_PATH
  ]
  if (process.platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
      process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : ''
    )
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  } else {
    candidates.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome')
  }
  return [...new Set(candidates.filter(Boolean))].find(candidate => {
    try { return fs.existsSync(candidate) }
    catch { return false }
  }) || ''
}

function buildServerEntry(name) {
  const configDir = path.resolve(process.env.JOB_AGENT_CONFIG_DIR || path.join(os.homedir(), '.job-agent', 'config'))
  const storageDir = path.resolve(process.env.JOB_AGENT_STORAGE_DIR || path.join(os.homedir(), '.job-agent', 'storage'))
  const stateDir = path.join(DAEMON, 'state')
  const chrome = detectChrome()
  return {
    mcpServers: {
      [name]: {
        type: 'stdio',
        command: process.execPath,
        args: [MCP_ENTRY],
        cwd: DAEMON,
        env: {
          JOB_AGENT_CONFIG_DIR: configDir,
          JOB_AGENT_STORAGE_DIR: storageDir,
          BOSS_DAEMON_STATE: stateDir,
          BOSS_CHROME_PATH: chrome
        }
      }
    }
  }
}

function genericConfig(name) {
  return buildServerEntry(name)
}

function sameServer(value) {
  const target = path.resolve(MCP_ENTRY).replaceAll('\\', '/')
  const candidates = typeof value === 'string'
    ? [value]
    : isObject(value)
      ? [value.command, value.args, value.cwd]
      : []
  return candidates.some(candidate => {
    const source = Array.isArray(candidate) ? candidate.join(' ') : String(candidate || '')
    return source.replaceAll('\\', '/').includes(target)
  })
}

function inspectNativeServer(cli, name) {
  return run(cli, ['mcp', 'get', name], { capture: true })
}

function addNativeClient(client, cli, name) {
  const existing = inspectNativeServer(cli, name)
  const existingOutput = `${existing.stdout || ''}\n${existing.stderr || ''}`
  if (existing.status === 0) {
    if (sameServer(existingOutput)) {
      console.log(`[Job Agent] ${client}: ${name} is already registered.`)
      return
    }
    throw new Error(`${client} already has an MCP server named ${name}, but it points to a different command. Use --name with another name or remove the old entry first.`)
  }

  const nodeCommand = process.execPath
  const args = {
    claude: ['mcp', 'add', '--transport', 'stdio', '--scope', 'user', name, '--', nodeCommand, MCP_ENTRY],
    codex: ['mcp', 'add', name, '--', nodeCommand, MCP_ENTRY]
  }[client]
  if (!args) throw new Error(`Unsupported native client: ${client}`)
  const result = run(cli, args)
  if (result.status !== 0) throw new Error(`${client} rejected the MCP registration.`)
  console.log(`[Job Agent] ${client}: registered ${name}.`)
}

function readJsonc(file) {
  if (!fs.existsSync(file)) return {}
  const source = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  let output = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    const next = source[i + 1]
    if (inString) {
      output += char
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      output += char
    } else if (char === '/' && next === '/') {
      i += 2
      while (i < source.length && source[i] !== '\n') i += 1
      output += '\n'
    } else if (char === '/' && next === '*') {
      i += 2
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1
      i += 1
    } else {
      output += char
    }
  }
  return JSON.parse(output.replace(/,\s*([}\]])/g, '$1') || '{}')
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function workbuddyConfigPath() {
  return path.join(os.homedir(), '.workbuddy', 'mcp.json')
}

function isConfigLockError(error) {
  return ['EPERM', 'EBUSY', 'EACCES'].includes(error?.code)
}

function sleepSync(milliseconds) {
  const buffer = new SharedArrayBuffer(4)
  Atomics.wait(new Int32Array(buffer), 0, 0, milliseconds)
}

function writeConfigWithRetry(file, contents) {
  let lastError
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      fs.writeFileSync(file, contents, 'utf8')
      return
    } catch (error) {
      lastError = error
      if (!isConfigLockError(error) || attempt === 7) throw error
      console.log(`[Job Agent] WorkBuddy 配置文件暂时被占用，${attempt + 1}/7 秒后重试...`)
      sleepSync(1000)
    }
  }
  throw lastError
}

function printWorkbuddyFallback(file, block) {
  console.log('\n[Job Agent] WorkBuddy 正在运行并占用配置文件锁，无法自动写入。')
  console.log('请重启 WorkBuddy 后重新运行安装，或在 WorkBuddy「自定义连接器」中粘贴下面的配置并点“信任”。')
  console.log('配置文件：' + file + '\n')
  console.log(JSON.stringify(block, null, 2))
}

function updateWorkbuddy(name) {
  const file = workbuddyConfigPath()
  const block = buildServerEntry(name)
  const entry = block.mcpServers[name]
  try {
    const config = readJsonc(file)
    if (!isObject(config)) throw new Error('WorkBuddy config must contain a JSON object: ' + file)
    if (config.mcpServers == null) config.mcpServers = {}
    if (!isObject(config.mcpServers)) throw new Error('WorkBuddy mcpServers must be an object: ' + file)

    const old = config.mcpServers[name]
    if (old) {
      if (sameServer(old)) {
        console.log('[Job Agent] workbuddy: ' + name + ' is already registered in ' + file + '.')
        return
      }
      throw new Error('WorkBuddy already has an MCP server named ' + name + ', but it points to a different command. Use --name with another name or edit ' + file + '.')
    }

    fs.mkdirSync(path.dirname(file), { recursive: true })
    if (fs.existsSync(file)) {
      const backup = file + '.job-agent.bak-' + Date.now()
      fs.copyFileSync(file, backup)
      console.log('[Job Agent] WorkBuddy config backup: ' + backup)
    }
    config.mcpServers[name] = entry
    writeConfigWithRetry(file, JSON.stringify(config, null, 2) + '\n')
    console.log('[Job Agent] workbuddy: registered ' + name + ' in ' + file + '.')
  } catch (error) {
    if (isConfigLockError(error)) {
      printWorkbuddyFallback(file, block)
      return
    }
    throw error
  }
}

function looksLikeFlatOpenCodeServers(value) {
  if (!isObject(value) || !Object.keys(value).length) return false
  return Object.values(value).every(item => isObject(item) && ('type' in item || 'command' in item || 'url' in item))
}

function openCodeConfigPath() {
  if (process.env.OPENCODE_CONFIG) return path.resolve(process.env.OPENCODE_CONFIG)
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
  const directory = path.join(configHome, 'opencode')
  const jsonc = path.join(directory, 'opencode.jsonc')
  const json = path.join(directory, 'opencode.json')
  return fs.existsSync(jsonc) ? jsonc : fs.existsSync(json) ? json : json
}

function updateOpenCode(name) {
  const file = openCodeConfigPath()
  const config = readJsonc(file)
  if (!isObject(config)) throw new Error(`OpenCode config must contain a JSON object: ${file}`)
  if (!Object.keys(config).length) config.$schema = 'https://opencode.ai/config.json'
  if (!isObject(config.mcp)) config.mcp = {}

  let servers
  if (isObject(config.mcp.servers)) {
    servers = config.mcp.servers
  } else if (looksLikeFlatOpenCodeServers(config.mcp)) {
    servers = config.mcp
  } else {
    config.mcp.servers = {}
    servers = config.mcp.servers
  }

  const entry = {
    type: 'local',
    command: [process.execPath, MCP_ENTRY],
    cwd: ROOT
  }
  const old = servers[name]
  if (old) {
    const command = Array.isArray(old.command) ? old.command.join(' ') : String(old.command || '')
    if (command.replaceAll('\\', '/').includes('/mcp-server.mjs')) {
      console.log(`[Job Agent] opencode: ${name} is already registered in ${file}.`)
      return
    }
    throw new Error(`OpenCode already has an MCP server named ${name}, but it points to a different command. Use --name with another name or edit ${file}.`)
  }

  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (fs.existsSync(file)) {
    const backup = `${file}.job-agent.bak-${Date.now()}`
    fs.copyFileSync(file, backup)
    console.log(`[Job Agent] OpenCode config backup: ${backup}`)
  }
  servers[name] = entry
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  console.log(`[Job Agent] opencode: registered ${name} in ${file}.`)
}

function isWorkbuddyInstalled() {
  const home = os.homedir()
  const config = path.join(home, '.workbuddy', 'mcp.json')
  const directory = path.join(home, '.workbuddy')
  if (fs.existsSync(config) || fs.existsSync(directory)) return true
  return Boolean(resolveExecutable('workbuddy') || resolveExecutable('codebuddy'))
}

function installedClients() {
  const clients = []
  const codex = resolveExecutable('codex')
  const claude = resolveExecutable('claude')
  const opencode = resolveExecutable('opencode')
  if (codex) clients.push({ name: 'codex', cli: codex })
  if (claude) clients.push({ name: 'claude', cli: claude })
  if (opencode) clients.push({ name: 'opencode', cli: opencode })
  if (isWorkbuddyInstalled()) clients.push({ name: 'workbuddy', cli: null })
  return clients
}

function printGenericConfig(name) {
  console.log(JSON.stringify(genericConfig(name), null, 2))
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    usage()
    return
  }
  if (!options.name || !/^[A-Za-z0-9_-]+$/.test(options.name)) {
    throw new Error('MCP server name may contain only letters, numbers, hyphens, and underscores.')
  }
  if (options.print) {
    printGenericConfig(options.name)
    return
  }
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major < 22 || (major === 22 && minor < 12)) {
    throw new Error('Node.js 22.12+ is required.')
  }
  if (!options.skipDeps) ensureDependencies()

  const requested = normalizeClient(options.client)
  if (requested === 'opencode') {
    updateOpenCode(options.name)
    return
  }
  if (requested === 'all' || requested === 'auto') {
    const clients = installedClients()
    if (!clients.length) throw new Error('没有检测到 Codex、Claude Code、OpenCode 或 WorkBuddy/CodeBuddy CLI。请安装其中一个客户端，或用 --print 查看通用配置。')
    for (const client of clients) {
      if (client.name === 'opencode') updateOpenCode(options.name)
      else if (client.name === 'workbuddy') updateWorkbuddy(options.name)
      else addNativeClient(client.name, client.cli, options.name)
    }
    return
  }
  if (!['codex', 'claude', 'workbuddy'].includes(requested)) {
    throw new Error(`Unsupported client: ${options.client}`)
  }
  if (requested === 'workbuddy') {
    updateWorkbuddy(options.name)
    return
  }
  const cli = resolveExecutable(requested)
  if (!cli) throw new Error(`没有检测到 ${requested} CLI。请先安装客户端，或用 --print 查看通用配置。`)
  addNativeClient(requested, cli, options.name)
}

try {
  main()
} catch (err) {
  console.error(`[Job Agent] MCP installation failed: ${err?.message || err}`)
  process.exit(1)
}
