import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * Vite plugin: writes `THIRD-PARTY-NOTICES.txt` into the build output.
 *
 * Why: MIT, BSD, ISC and Apache-2.0 packages require their copyright and
 * licence text to travel with every copy we hand out. The JavaScript goes to
 * every visitor's browser, and Vite strips comments, so the texts would be
 * lost. This plugin lists the packages that are really inside the bundle (not
 * every dependency) with their licence files. See `.context/licence-study.md`.
 *
 * It also fails the build when a bundled package is under a strong-copyleft
 * licence (GPL, AGPL, LGPL, SSPL, BUSL), so one cannot ship by accident.
 *
 * The same file lives in `admin/` (the two workspaces are built from separate
 * Docker contexts, so they cannot share it). Keep the two copies equal.
 */

const NODE_MODULES = '/node_modules/';
const LICENCE_FILE = /^(licen[cs]e|copying|notice)([.-].*)?$/i;
const COPYLEFT = /\b(A?GPL|LGPL|SSPL|BUSL)/i;

export interface NoticeEntry {
    name: string;
    version: string;
    licence: string;
    source: string;
    /** Name from package.json, shown when the package ships no licence file. */
    author: string;
    texts: { file: string; text: string }[];
}

export interface NoticesOptions {
    /** Shown in the file header, for example "Ladu web app". */
    title: string;
    /**
     * Packages whose code reaches the build through CSS (`@import 'pkg'`), which
     * the JavaScript module list does not show.
     */
    extraPackages?: string[];
}

/** The package a bundled module file belongs to, or null if it is not from node_modules. */
export function packageFromModuleId(id: string): { name: string; root: string } | null {
    // `\0` marks Rollup virtual modules; `?query` is added by some plugins.
    if (id.startsWith('\0')) return null;
    const clean = id.split('?')[0].replace(/\\/g, '/');
    const at = clean.lastIndexOf(NODE_MODULES);
    if (at === -1) return null;
    const parts = clean.slice(at + NODE_MODULES.length).split('/');
    const name = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
    if (!name || name.endsWith('/undefined')) return null;
    return { name, root: clean.slice(0, at + NODE_MODULES.length) + name };
}

/** True when every alternative of an SPDX expression is strong copyleft. */
export function isCopyleft(expression: string): boolean {
    const alternatives = expression
        .split(/\s+OR\s+/i)
        .map((part) => part.replace(/[()]/g, '').trim());
    return alternatives.every((part) => COPYLEFT.test(part));
}

function findPackageDir(name: string, fromDir: string): string | null {
    let dir = fromDir;
    for (;;) {
        const candidate = path.join(dir, 'node_modules', name);
        if (existsSync(path.join(candidate, 'package.json'))) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

function readEntry(root: string): NoticeEntry {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
        name?: string;
        version?: string;
        license?: string | { type?: string };
        licenses?: { type?: string }[];
        repository?: string | { url?: string };
        homepage?: string;
        author?: string | { name?: string };
    };
    const declared =
        typeof pkg.license === 'string'
            ? pkg.license
            : (pkg.license?.type ?? pkg.licenses?.map((l) => l.type).join(' OR ') ?? 'UNKNOWN');
    const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
    const texts = readdirSync(root)
        .filter((file) => LICENCE_FILE.test(file))
        .sort()
        .map((file) => ({ file, text: readFileSync(path.join(root, file), 'utf8').trim() }))
        .filter((item) => item.text.length > 0);
    return {
        name: pkg.name ?? path.basename(root),
        version: pkg.version ?? '',
        licence: declared,
        source: (repo ?? pkg.homepage ?? '').replace(/^git\+/, ''),
        author: (typeof pkg.author === 'string' ? pkg.author : pkg.author?.name) ?? '',
        texts,
    };
}

export function renderNotices(title: string, entries: NoticeEntry[]): string {
    const rule = '-'.repeat(78);
    const head = [
        `THIRD-PARTY NOTICES - ${title}`,
        '',
        'This file lists the open-source packages included in the code that your',
        'browser downloads from this site, with their licences. It is generated',
        'at build time.',
        '',
        'Ladu itself is under the MIT licence: https://github.com/kraud/ladu',
        '',
        `${entries.length} packages.`,
        '',
    ].join('\n');
    const body = entries.map((entry) => {
        const lines = [rule, `${entry.name}@${entry.version}`, `Licence: ${entry.licence}`];
        if (entry.source) lines.push(`Source: ${entry.source}`);
        if (entry.author) lines.push(`Author: ${entry.author}`);
        lines.push('');
        if (entry.texts.length === 0) {
            lines.push('(The package ships no licence file. See its source above.)');
        }
        for (const item of entry.texts) {
            if (entry.texts.length > 1) lines.push(`[${item.file}]`);
            lines.push(item.text, '');
        }
        return lines.join('\n');
    });
    return `${head}\n${body.join('\n')}\n`;
}

export function thirdPartyNotices(options: NoticesOptions): Plugin {
    return {
        name: 'third-party-notices',
        apply: 'build',
        generateBundle(_output, bundle) {
            const roots = new Set<string>();
            for (const item of Object.values(bundle)) {
                if (item.type !== 'chunk') continue;
                for (const [id, info] of Object.entries(item.modules)) {
                    if (info.renderedLength === 0) continue; // tree-shaken away
                    const pkg = packageFromModuleId(id);
                    if (pkg) roots.add(pkg.root);
                }
            }
            for (const name of options.extraPackages ?? []) {
                const dir = findPackageDir(name, process.cwd());
                if (!dir) this.error(`third-party-notices: package "${name}" not found`);
                roots.add(dir);
            }

            const byKey = new Map<string, NoticeEntry>();
            for (const root of roots) {
                const entry = readEntry(root);
                byKey.set(`${entry.name}@${entry.version}`, entry);
            }
            const entries = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));

            for (const entry of entries) {
                if (isCopyleft(entry.licence)) {
                    this.error(
                        `third-party-notices: ${entry.name}@${entry.version} is under ${entry.licence} (copyleft). Review .context/licence-study.md before shipping it.`,
                    );
                }
                if (entry.licence === 'UNKNOWN') {
                    this.warn(`third-party-notices: ${entry.name}@${entry.version} declares no licence`);
                }
                if (entry.texts.length === 0) {
                    this.warn(`third-party-notices: ${entry.name}@${entry.version} has no licence file`);
                }
            }

            this.emitFile({
                type: 'asset',
                fileName: 'THIRD-PARTY-NOTICES.txt',
                source: renderNotices(options.title, entries),
            });
        },
    };
}
