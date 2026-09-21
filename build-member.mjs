// =============================================================================
// build-member.mjs -- rebuild member/ from the app repo.
//
//   node build-member.mjs [path-to-AORA-repo]
//
// The published member app is the app repo's own demo bundle, inlined into ONE
// self-contained HTML file by tools/scripts/bundle-demo.mjs. Everything that
// matters is that script's: it refuses a live build, refuses a stale build,
// fails if an asset reference survives the inlining, and injects the deep-link
// shim this host needs by name. This wrapper only sets the build environment,
// puts the result in place, and copies the one thing that cannot be inlined.
//
// The bundle used to be assembled by hand, which is how it came to sit nine
// days behind the app and lose a whole feature without anyone noticing. This
// script exists so it is generated instead.
//
// WHY ONE FILE AND NOT A DIRECTORY. A plain Expo export publishes its
// JavaScript under _expo/, and GitHub Pages runs Jekyll, which drops any path
// beginning with an underscore: the page publishes and its bundle 404s. The
// export also mirrors node_modules paths for a few navigation icons, one of
// which reaches 265 characters and so cannot be added to a git index on
// Windows without core.longpaths. Inlining sidesteps both, which is why the
// bundle was a single file to begin with.
//
// The exercise drawings are the exception and are copied as ordinary files:
// the Toolkit fetches them at runtime by URL, so they cannot be inlined. Their
// paths are short and none of them begins with an underscore.
// =============================================================================
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// bundle-demo.mjs hard-codes this host's deep-link prefix, so the base path the
// app is built with has to agree with it. If one moves, the other must.
const BASE = '/aora-demo/member';

const repo = resolve(process.argv[2] ?? join(HERE, '..', 'AORA_App_Repo_Starter_Kit'));
const dist = join(repo, 'apps', 'member', 'dist');

const run = (cmd, args, cwd, env) =>
  execFileSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });

const tmp = mkdtempSync(join(tmpdir(), 'aora-demo-member-'));
const single = join(tmp, 'member.html');
try {
  console.log(`building apps/member (EXPO_PUBLIC_DEMO=1, base ${BASE})`);
  run('pnpm', ['run', 'build'], join(repo, 'apps', 'member'), {
    EXPO_PUBLIC_DEMO: '1',
    EXPO_PUBLIC_WEB_BASE_URL: BASE,
    EXPO_PUBLIC_SPANISH: 'on',
    // Not a draft build: this host is the public demo, not the internal test
    // site, where DRAFT labelling means something different.
    EXPO_PUBLIC_DRAFT: '0',
  });

  console.log('inlining with tools/scripts/bundle-demo.mjs');
  run('node', [join('tools', 'scripts', 'bundle-demo.mjs'), 'member', single], repo);
  // bundle-demo writes an artifact-shaped sibling beside its output. This host
  // publishes the page itself, so that one is not wanted here.
  rmSync(single.replace(/\.html$/, '.artifact.html'), { force: true });

  const html = readFileSync(single, 'utf8');
  // Refuse rather than publish a page that cannot restore a deep link: the
  // links on the landing page would quietly land on Home instead of the screen
  // they name, which is the kind of breakage nobody reports.
  if (!html.includes(`'${BASE}/'`)) {
    throw new Error(`the bundle carries no deep-link shim for ${BASE} (did bundle-demo change?)`);
  }

  rmSync(join(HERE, 'member'), { recursive: true, force: true });
  cpSync(join(dist, 'exercise-art'), join(HERE, 'member', 'exercise-art'), { recursive: true });
  writeFileSync(join(HERE, 'member', 'index.html'), html);

  console.log('member/ rebuilt. Review `git status`, then commit and push to publish.');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
