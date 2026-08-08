#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import {
  findProjectDomain,
  parseDeploymentUrl,
  parseNamespaceList,
  parseProjectList,
  parseSecretNames,
  upsertPagesBuildOutputDir,
  upsertProductionKvBinding,
} from './cloudflare-setup-lib.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = path.join(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler',
);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function parseArgs(argv) {
  const options = {
    yes: false,
    project: '',
    namespace: '',
    adminUser: '',
    rotateAdmin: false,
    skipDeploy: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--yes' || argument === '-y') options.yes = true;
    else if (argument === '--skip-deploy') options.skipDeploy = true;
    else if (argument === '--rotate-admin') options.rotateAdmin = true;
    else if (argument === '--project') options.project = argv[++index] ?? '';
    else if (argument === '--namespace') options.namespace = argv[++index] ?? '';
    else if (argument === '--admin-user') options.adminUser = argv[++index] ?? '';
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`Unknown option: ${argument}`);
  }
  return options;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const pipedOutput = options.capture || options.tee;
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: process.env,
      stdio: [options.input === undefined ? 'inherit' : 'pipe', pipedOutput ? 'pipe' : 'inherit', pipedOutput ? 'pipe' : 'inherit'],
    });
    let stdout = '';
    let stderr = '';
    if (pipedOutput) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
        if (options.tee) process.stdout.write(chunk);
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
        if (options.tee) process.stderr.write(chunk);
      });
    }
    if (options.input !== undefined) child.stdin.end(`${options.input}\n`);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${path.basename(command)} exited with code ${code}${stderr ? `\n${stderr}` : ''}`));
    });
  });
}

async function question(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(prompt);
  } finally {
    rl.close();
  }
}

async function askText(label, fallback) {
  const answer = (await question(`${label} (${fallback}): `)).trim();
  return answer || fallback;
}

async function askYesNo(label, fallback = true) {
  const answer = (await question(`${label} ${fallback ? '[Y/n]' : '[y/N]'} `)).trim().toLowerCase();
  if (!answer) return fallback;
  return answer === 'y' || answer === 'yes';
}

async function askHidden(label) {
  if (!process.stdin.isTTY) {
    throw new Error('Hidden password input requires a terminal. Set TELEGRAPH_ADMIN_PASSWORD for non-interactive use.');
  }
  process.stdout.write(label);
  const silentOutput = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const rl = createInterface({ input: process.stdin, output: silentOutput, terminal: true });
  try {
    return await rl.question('');
  } finally {
    rl.close();
    process.stdout.write('\n');
  }
}

function validateName(value, label) {
  if (!value || /[\r\n\0]/.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}

async function listNamespaces() {
  const { stdout } = await run(wrangler, ['kv', 'namespace', 'list'], { capture: true });
  return parseNamespaceList(stdout);
}

async function listSecrets(project) {
  const { stdout } = await run(
    wrangler,
    ['pages', 'secret', 'list', '--project-name', project],
    { capture: true },
  );
  return parseSecretNames(stdout);
}

async function getProjectDomain(project) {
  const { stdout } = await run(wrangler, ['pages', 'project', 'list', '--json'], { capture: true });
  return findProjectDomain(parseProjectList(stdout), project);
}

async function planAdminCredentials(project, options) {
  const secrets = await listSecrets(project);
  const hasUser = secrets.has('BASIC_USER');
  const hasPassword = secrets.has('BASIC_PASS');
  if (hasUser && hasPassword && !options.rotateAdmin) {
    const keep = options.yes || await askYesNo('Admin credentials already exist. Keep them?', true);
    if (keep) return { action: 'keep' };
  }

  const replacingCompleteCredentials = hasUser && hasPassword;
  const enable = replacingCompleteCredentials || options.yes || options.rotateAdmin
    || await askYesNo('Protect the dashboard with admin credentials?', true);
  if (!enable) return { action: 'none' };

  const user = validateName(
    options.adminUser || process.env.TELEGRAPH_ADMIN_USER || (options.yes ? 'admin' : await askText('Admin username', 'admin')),
    'Admin username',
  );
  let password = process.env.TELEGRAPH_ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    const autoGenerate = options.yes || await askYesNo('Generate a strong admin password automatically?', true);
    if (autoGenerate) {
      if (!process.stdin.isTTY) {
        throw new Error('Set TELEGRAPH_ADMIN_PASSWORD when using --yes outside an interactive terminal.');
      }
      password = randomBytes(24).toString('base64url');
      generated = true;
    } else {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const first = await askHidden('Admin password: ');
        const second = await askHidden('Confirm admin password: ');
        if (first.length < 12) console.log('Password must contain at least 12 characters.');
        else if (first !== second) console.log('Passwords do not match.');
        else {
          password = first;
          break;
        }
      }
      if (!password) throw new Error('Could not confirm a valid admin password.');
    }
  }
  if (password.length < 12) throw new Error('Admin password must contain at least 12 characters.');
  return { action: 'set', user, password, generated };
}

async function applyAdminCredentials(project, plan) {
  if (plan.action !== 'set') return;
  await run(wrangler, ['pages', 'secret', 'put', 'BASIC_USER', '--project-name', project], { input: plan.user });
  await run(wrangler, ['pages', 'secret', 'put', 'BASIC_PASS', '--project-name', project], { input: plan.password });
}

async function ensureNamespace(title, existing) {
  if (existing) {
    console.log(`Using existing KV namespace: ${title}`);
    return existing;
  }
  console.log(`Creating KV namespace: ${title}`);
  await run(wrangler, ['kv', 'namespace', 'create', title]);
  const namespace = (await listNamespaces()).find((item) => item.title === title);
  if (!namespace?.id) throw new Error(`KV namespace ${title} was created but could not be resolved.`);
  return namespace;
}

async function deployWithBinding(project, namespaceId) {
  const tempDir = path.join(repoRoot, '.wrangler', `setup-${Date.now()}-${process.pid}`);
  await mkdir(tempDir, { recursive: true });
  try {
    await run(wrangler, ['pages', 'download', 'config', project, '--force'], { cwd: tempDir });
    const configPath = path.join(tempDir, 'wrangler.toml');
    const config = await readFile(configPath, 'utf8');
    const withOutputDirectory = upsertPagesBuildOutputDir(config, '../../dist');
    await writeFile(configPath, upsertProductionKvBinding(withOutputDirectory, 'img_url', namespaceId), { mode: 0o600 });
    await cp(path.join(repoRoot, 'functions'), path.join(tempDir, 'functions'), { recursive: true });
    const result = await run(wrangler, [
      'pages', 'deploy', path.join(repoRoot, 'dist'), '--project-name', project,
      '--branch', 'main', '--commit-dirty=true', '--cwd', tempDir,
    ], { tee: true });
    return parseDeploymentUrl(`${result.stdout}\n${result.stderr}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function verifyDeployment(url, expectDashboard, expectAdmin, attempts = 6) {
  if (!url) return { ok: false, ready: false };
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const configResponse = await fetch(`${url}/api/config`, { headers: { Accept: 'application/json' } });
      const config = await configResponse.json();
      const manageResponse = await fetch(`${url}/api/manage/check`, { redirect: 'manual' });
      const dashboardOk = !expectDashboard || config?.setup?.dashboard === 'ok';
      const authOk = expectAdmin ? manageResponse.status === 401 : manageResponse.status !== 503;
      if (configResponse.ok && dashboardOk && authOk) {
        return { ok: true, ready: Boolean(config?.ready), setup: config?.setup };
      }
    } catch {
      // Cloudflare can briefly return an older edge deployment while production propagates.
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return { ok: false, ready: false };
}

function printSummary({ project, domain, enableDashboard, namespaceTitle, namespaceExists, adminPlan, skipDeploy }) {
  console.log('\nSetup summary');
  console.log(`  Pages project: ${project}`);
  console.log(`  Production:    ${domain ?? 'resolved after deployment'}`);
  console.log(`  KV namespace:  ${enableDashboard ? `${namespaceTitle} (${namespaceExists ? 'reuse' : 'create'})` : 'disabled'}`);
  console.log(`  KV binding:    ${enableDashboard ? 'img_url' : 'none'}`);
  const adminLabel = adminPlan.action === 'keep' ? 'keep existing credentials' : adminPlan.action === 'set' ? `set user ${adminPlan.user}` : 'disabled';
  console.log(`  Admin login:   ${adminLabel}`);
  console.log(`  Deployment:    ${skipDeploy ? 'skip' : 'build and deploy'}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: npm run setup:cloudflare -- [--project NAME] [--namespace NAME] [--admin-user NAME] [--rotate-admin] [--yes] [--skip-deploy]');
    return;
  }

  const project = validateName(
    options.project || (options.yes ? 'images' : await askText('Cloudflare Pages project name', 'images')),
    'Project name',
  );
  const enableDashboard = options.yes || await askYesNo('Enable upload history, the management dashboard, and KV-backed features?', true);
  const namespaceTitle = validateName(
    options.namespace || `${project}-metadata`,
    'KV namespace name',
  );
  const namespaces = enableDashboard ? await listNamespaces() : [];
  const existingNamespace = namespaces.find((item) => item.title === namespaceTitle);
  const adminPlan = enableDashboard ? await planAdminCredentials(project, options) : { action: 'none' };
  const domain = await getProjectDomain(project);

  printSummary({
    project,
    domain,
    enableDashboard,
    namespaceTitle,
    namespaceExists: Boolean(existingNamespace),
    adminPlan,
    skipDeploy: options.skipDeploy,
  });
  const apply = options.yes || await askYesNo('Apply this setup?', true);
  if (!apply) return;

  const namespace = enableDashboard ? await ensureNamespace(namespaceTitle, existingNamespace) : undefined;
  await applyAdminCredentials(project, adminPlan);
  if (adminPlan.generated) {
    console.log(`\nGenerated admin credentials (shown once):\n  Username: ${adminPlan.user}\n  Password: ${adminPlan.password}\n`);
  }

  await run(npm, ['run', 'build']);
  if (options.skipDeploy) {
    console.log('Build complete. Deployment skipped by request.');
    return;
  }

  let deploymentUrl;
  if (namespace) deploymentUrl = await deployWithBinding(project, namespace.id);
  else {
    const result = await run(wrangler, [
      'pages', 'deploy', 'dist', '--project-name', project, '--branch', 'main', '--commit-dirty=true',
    ], { tee: true });
    deploymentUrl = parseDeploymentUrl(`${result.stdout}\n${result.stderr}`);
  }

  const expectAdmin = adminPlan.action !== 'none';
  const deploymentHealth = await verifyDeployment(deploymentUrl, enableDashboard, expectAdmin);
  if (!deploymentHealth.ok) throw new Error('The deployment completed, but its health check did not pass.');
  const productionUrl = domain ? `https://${domain}` : undefined;
  const productionHealth = await verifyDeployment(productionUrl, enableDashboard, expectAdmin);

  console.log('\nDeployment verified');
  if (productionUrl) console.log(`  Site:      ${productionUrl}`);
  if (productionUrl) console.log(`  Dashboard: ${productionUrl}/admin`);
  if (deploymentUrl) console.log(`  Version:   ${deploymentUrl}`);
  console.log(`  Health:    ${productionHealth.ok ? 'production endpoint verified' : 'deployment verified; production is still propagating'}`);
  const activeHealth = productionHealth.ok ? productionHealth : deploymentHealth;
  console.log(`  Config:    ${activeHealth.ready ? 'ready' : 'incomplete; check required storage credentials'}`);
}

main().catch((error) => {
  console.error(`Setup failed: ${error.message}`);
  process.exitCode = 1;
});
