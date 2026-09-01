import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const daemonDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = path.resolve(daemonDir, '..')
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))

const manifest = readJson('.workbuddy-plugin/plugin.json')
assert.equal(manifest.name, 'job-agent-mcp')
assert.equal(manifest.version, '1.0.2')
assert.equal(manifest.mcpServers, './.mcp.json')

const marketplace = readJson('.workbuddy-plugin/marketplace.json')
assert.equal(marketplace.plugins[0].source, '.')
assert.equal(marketplace.plugins[0].name, 'job-agent-mcp')
assert.equal(marketplace.plugins[0].version, '1.0.2')

const config = readJson('.mcp.json')
const server = config.mcpServers['job-agent']
assert.equal(server.type, 'stdio')
assert.equal(server.command, 'node')
assert.deepEqual(server.args, ['${CODEBUDDY_PLUGIN_ROOT}/tools/workbuddy-mcp-launcher.mjs'])
assert.equal(server.cwd, '${CODEBUDDY_PLUGIN_ROOT}')

const launcher = fs.readFileSync(path.join(root, 'tools', 'workbuddy-mcp-launcher.mjs'), 'utf8')
assert.match(launcher, /PUPPETEER_SKIP_DOWNLOAD/)
assert.match(launcher, /NODE_OPTIONS: ''/)
assert.match(launcher, /stdio: 'inherit'/)
console.log('WorkBuddy plugin smoke test passed')
