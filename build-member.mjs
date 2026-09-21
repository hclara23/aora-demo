// =============================================================================
// build-member.mjs -- rebuild member/ from the app repo.
//
//   node build-member.mjs [path-to-AORA-repo]
//
// The published member app is an Expo web export of apps/member, built in DEMO
// mode (in-memory data, no API, no sign-in) at this site's base path. It used
// to be a single HTML file assembled by hand, which is how it came to sit nine
// days behind the app and lose a whole feature without anyone noticing. This
// script exists so that never happens again: the bundle is generated, not
// edited.
//
// THE DEEP-LINK SHIM. GitHub Pages serves 404.html for any path it has no file
// for, so /aora-demo/member/book reaches 404.html, which stores the path and
// sends the browser to /aora-demo/member/. The script injected below is the
// other half: it reads that path back and puts it in the address bar before
// the app boots, so Expo Router matches the route the visitor actually asked
// for. Without it those links land on Home instead. It lives here rather than
// in apps/member because the whole mechanism is a property of THIS host, not
// of the app.
// =============================================================================
import { execFileSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = '/aora-demo/member';

const repo = resolve(process.argv[2] ?? join(HERE, '..', 'AORA_App_Repo_Starter_Kit'));
const member = join(repo, 'apps', 'member');

// The shim, as one line per statement so the injected block stays readable in
// the published HTML for anyone who views source.
const SHIM = `<script>
try {
  const path = sessionStorage.getItem('aora.demo.deep-link');
  sessionStorage.removeItem('aora.demo.deep-link');
  if (path && path.startsWith('${BASE}/') && !path.includes('\\\\')) {
    history.replaceState(null, '', path);
  }
} catch {}
</script>`;

const out = mkdtempSync(join(tmpdir(), 'aora-demo-member-'));
try {
  console.log(`building apps/member (EXPO_PUBLIC_DEMO=1, base ${BASE})`);
  execFileSync('pnpm', ['exec', 'expo', 'export', '--platform', 'web', '--output-dir', out], {
    cwd: member,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      EXPO_PUBLIC_DEMO: '1',
      EXPO_PUBLIC_WEB_BASE_URL: BASE,
      EXPO_PUBLIC_SPANISH: 'on',
      // Not a draft build: this host is the public demo, not the internal
      // test site, and DRAFT labelling there means something different.
      EXPO_PUBLIC_DRAFT: '0',
    },
  });

  const indexPath = join(out, 'index.html');
  const html = readFileSync(indexPath, 'utf8');

  // Refuse rather than publish a bundle the base path did not reach: a wrong
  // base URL produces a page that loads nothing, and it is easier to catch
  // here than from a blank screen in a browser.
  if (!html.includes(`${BASE}/_expo/`)) {
    throw new Error(`the export does not load from ${BASE}/_expo/ (EXPO_PUBLIC_WEB_BASE_URL rewritten?)`);
  }
  if (html.includes('aora.demo.deep-link')) {
    throw new Error('the export already carries the shim; injecting it again would duplicate it');
  }

  writeFileSync(indexPath, html.replace('<head>', `<head>\n${SHIM}`));

  // Replace wholesale. Copying over the top would leave behind the previous
  // build's content-hashed bundles, which nothing would ever serve again.
  rmSync(join(HERE, 'member'), { recursive: true, force: true });
  cpSync(out, join(HERE, 'member'), { recursive: true });
  console.log('member/ rebuilt. Review `git status`, then commit and push to publish.');
} finally {
  rmSync(out, { recursive: true, force: true });
}
