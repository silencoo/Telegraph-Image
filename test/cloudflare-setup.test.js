const assert = require('node:assert/strict');

describe('Cloudflare setup helpers', () => {
  let helpers;

  before(async () => {
    helpers = await import('../scripts/cloudflare-setup-lib.mjs');
  });

  it('adds an img_url binding to the production Pages environment', () => {
    const source = 'name = "images"\n\n[env.production.vars]\nSITE_NAME = "Images"\n';
    const result = helpers.upsertProductionKvBinding(source, 'img_url', 'namespace-id');

    assert.match(result, /\[\[env\.production\.kv_namespaces\]\]/);
    assert.match(result, /binding = "img_url"/);
    assert.match(result, /id = "namespace-id"/);
    assert.match(result, /SITE_NAME = "Images"/);
  });

  it('updates an existing binding without duplicating it', () => {
    const source = [
      'name = "images"',
      '',
      '[[env.production.kv_namespaces]]',
      'binding = "img_url"',
      'id = "old-id"',
      '',
    ].join('\n');
    const result = helpers.upsertProductionKvBinding(source, 'img_url', 'new-id');

    assert.equal((result.match(/binding = "img_url"/g) || []).length, 1);
    assert.match(result, /id = "new-id"/);
    assert.doesNotMatch(result, /old-id/);
  });

  it('adds the Pages build output directory at the TOML root', () => {
    const source = 'name = "images"\n\n[env.production.vars]\nSITE_NAME = "Images"\n';
    const result = helpers.upsertPagesBuildOutputDir(source, '../../dist');

    assert.match(result, /^name = "images"\n\npages_build_output_dir = "\.\.\/\.\.\/dist"/);
    assert.ok(result.indexOf('pages_build_output_dir') < result.indexOf('[env.production.vars]'));
  });

  it('parses Wrangler namespace output with terminal styling', () => {
    const result = helpers.parseNamespaceList('\u001b[32m[{"id":"1","title":"images-metadata"}]\u001b[0m');
    assert.deepEqual(result, [{ id: '1', title: 'images-metadata' }]);
  });

  it('parses only secret names without exposing values', () => {
    const result = helpers.parseSecretNames([
      'The production environment has access to:',
      '  - BASIC_USER: Value Encrypted',
      '  - BASIC_PASS: Value Encrypted',
    ].join('\n'));
    assert.deepEqual([...result], ['BASIC_USER', 'BASIC_PASS']);
  });

  it('resolves the generated Pages production domain', () => {
    const projects = helpers.parseProjectList('[{"Project Name":"images","Project Domains":"images-4fk.pages.dev"}]');
    assert.equal(helpers.findProjectDomain(projects, 'images'), 'images-4fk.pages.dev');
  });

  it('extracts a unique deployment URL from Wrangler output', () => {
    assert.equal(
      helpers.parseDeploymentUrl('Deployment complete: https://84a945c0.images-4fk.pages.dev'),
      'https://84a945c0.images-4fk.pages.dev',
    );
  });
});
