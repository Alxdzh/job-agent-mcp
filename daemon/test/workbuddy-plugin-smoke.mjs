import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const daemonDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = path.resolve(daemonDir, '..')
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))

const manifest = readJson('.workbuddy-plugin/plugin.json')
assert.equal(manifest.name, 'job-agent-mcp')
assert.equal(manifest.version, '1.0.4')
assert.equal(manifest.mcpServers, './.mcp.json')

const marketplace = readJson('.workbuddy-plugin/marketplace.json')
assert.equal(marketplace.plugins[0].source, '.')
assert.equal(marketplace.plugins[0].name, 'job-agent-mcp')
assert.equal(marketplace.plugins[0].version, '1.0.4')

const config = readJson('.mcp.json')
const server = config.mcpServers['job-agent']
assert.equal(server.type, 'stdio')
assert.equal(server.command, 'node')
assert.deepEqual(server.args, ['${CODEBUDDY_PLUGIN_ROOT}/tools/workbuddy-mcp-launcher.mjs'])
assert.equal(server.cwd, '${CODEBUDDY_PLUGIN_ROOT}')
assert.equal(server.env.JOB_AGENT_RELEASE_VERSION, '1.0.4')
assert.equal(server.env.JOB_AGENT_RESET_DELIVERY_DEFAULTS, '1')

const launcher = fs.readFileSync(path.join(root, 'tools', 'workbuddy-mcp-launcher.mjs'), 'utf8')
assert.match(launcher, /PUPPETEER_SKIP_DOWNLOAD/)
assert.match(launcher, /NODE_OPTIONS: ''/)
assert.match(launcher, /stdio: 'inherit'/)
assert.match(launcher, /resetDeliveryDefaults/)
assert.match(launcher, /delivery-defaults-reset-v1/)
assert.match(launcher, /ensureConfigTemplates/)
const boss = fs.readFileSync(path.join(daemonDir, 'src', 'boss.mjs'), 'utf8')
assert.doesNotMatch(boss, /单证员/)

const resetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'job-agent-reset-smoke-'))
const resetFiles = ['boss.json', 'zhilian.json', 'job51.json', 'liepin.json']
for (const name of resetFiles) {
  fs.writeFileSync(path.join(resetRoot, name), JSON.stringify({
    enabled: true,
    daemonCity: name === 'boss.json' ? '示例城市' : '',
    expectCityList: name === 'boss.json' ? ['示例城市'] : [],
    expectSalaryLow: 5,
    expectJobNameRegExpStr: name === 'boss.json' ? '示例职位' : '',
    blockCompanyNameRegExpStr: '示例排除',
    jobSourceList: [{ type: 'search', enabled: true, children: name === 'boss.json' ? [{ type: 'search-kw', enabled: true, keyword: '示例职位' }] : [] }]
  }))
}
const previousResetFlag = process.env.JOB_AGENT_RESET_DELIVERY_DEFAULTS
process.env.JOB_AGENT_RESET_DELIVERY_DEFAULTS = '1'
try {
  const launcherUrl = new URL('../../tools/workbuddy-mcp-launcher.mjs', import.meta.url)
  const { resetDeliveryDefaults } = await import(launcherUrl)
  resetDeliveryDefaults(resetRoot)
  const resetBoss = JSON.parse(fs.readFileSync(path.join(resetRoot, 'boss.json'), 'utf8'))
  assert.equal(resetBoss.daemonCity, '')
  assert.deepEqual(resetBoss.expectCityList, [])
  assert.equal(resetBoss.expectJobNameRegExpStr, '')
  assert.deepEqual(resetBoss.jobSourceList[0].children, [])
  assert.equal(resetBoss.expectSalaryLow, 5)
  assert.equal(resetBoss.blockCompanyNameRegExpStr, '示例排除')
  assert.equal(fs.existsSync(path.join(resetRoot, '.delivery-defaults-reset-v1')), true)
} finally {
  if (previousResetFlag === undefined) delete process.env.JOB_AGENT_RESET_DELIVERY_DEFAULTS
  else process.env.JOB_AGENT_RESET_DELIVERY_DEFAULTS = previousResetFlag
  fs.rmSync(resetRoot, { recursive: true, force: true })
}
console.log('WorkBuddy plugin smoke test passed')
