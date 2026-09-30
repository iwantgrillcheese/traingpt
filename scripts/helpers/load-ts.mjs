import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const root = new URL('../../', import.meta.url);
export async function load(path, mocks = {}, env = {}) {
  const context = vm.createContext({ Response, Request, URL, AbortSignal, console, process: { env } });
  const cache = new Map();
  const pending = new Map();
  async function resolve(specifier, parent = root.href) {
    if (cache.has(specifier) && mocks[specifier]) return cache.get(specifier);
    if (mocks[specifier] || !specifier.startsWith('.') && !specifier.startsWith('@/') && !specifier.startsWith('file:')) {
      // These tests must never reach AI, even when OPENAI_API_KEY is absent.
      assert.ok(specifier !== 'openai' || mocks[specifier], 'Plan creation must not depend on AI');
      const values = mocks[specifier] ?? await import(specifier);
      const mod = new vm.SyntheticModule(Object.keys(values), function () {
        for (const [key, value] of Object.entries(values)) this.setExport(key, value);
      }, { context });
      cache.set(specifier, mod);
      return mod;
    }
    const url = specifier.startsWith('@/') ? new URL(specifier.slice(2), root) : new URL(specifier, parent);
    if (!url.pathname.endsWith('.ts')) url.pathname += '.ts';
    if (cache.has(url.href)) return cache.get(url.href);
    if (pending.has(url.href)) return pending.get(url.href);
    const creation = (async () => {
    const source = stripTypeScriptTypes(await readFile(url, 'utf8'));
    const mod = new vm.SourceTextModule(source, { context, identifier: url.href,
      importModuleDynamically: async (specifier, parent) => {
        const child = await resolve(specifier, parent.identifier);
        if (child.status === 'unlinked') await child.link((s, p) => resolve(s, p.identifier));
        if (child.status === 'linked') await child.evaluate();
        return child;
      },
    });
    cache.set(url.href, mod);
    return mod;
    })();
    pending.set(url.href, creation);
    return creation;
  }
  const mod = await resolve(new URL(path, root).href);
  await mod.link((s, p) => resolve(s, p.identifier));
  await mod.evaluate();
  return mod.namespace;
}
