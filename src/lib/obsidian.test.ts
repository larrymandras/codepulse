import { describe, it, expect } from 'vitest';
import { parseVault, type GraphData, type GraphNode } from './obsidian';

/**
 * Minimal mocks of the File System Access API surface that parseVault consumes:
 * a directory handle exposes async-iterable `values()`; a file handle exposes
 * `getFile()` → `{ text() }`. We duck-type just enough and cast at the boundary.
 */
interface MockFile {
  kind: 'file';
  name: string;
  getFile: () => Promise<{ text: () => Promise<string> }>;
}
interface MockDir {
  kind: 'directory';
  name: string;
  values: () => AsyncGenerator<MockEntry>;
}
type MockEntry = MockFile | MockDir;

function file(name: string, content = ''): MockFile {
  return {
    kind: 'file',
    name,
    getFile: async () => ({ text: async () => content }),
  };
}

function dir(name: string, entries: MockEntry[]): MockDir {
  return {
    kind: 'directory',
    name,
    async *values() {
      for (const e of entries) yield e;
    },
  };
}

/** Run the parser against a mock vault root. */
function parse(root: MockDir): Promise<GraphData> {
  return parseVault(root as unknown as FileSystemDirectoryHandle);
}

const byId = (g: GraphData, id: string): GraphNode | undefined =>
  g.nodes.find((n) => n.id === id);

describe('parseVault', () => {
  it('returns an empty graph for an empty vault', async () => {
    const g = await parse(dir('vault', []));
    expect(g.nodes).toEqual([]);
    expect(g.links).toEqual([]);
  });

  it('creates a node per .md file with id/name/path and root group', async () => {
    const g = await parse(dir('vault', [file('Alpha.md'), file('Beta.md')]));
    expect(g.nodes).toHaveLength(2);
    const alpha = byId(g, 'Alpha');
    expect(alpha).toMatchObject({
      id: 'Alpha',
      name: 'Alpha',
      path: 'Alpha.md',
      group: 'root',
    });
  });

  it('ignores non-markdown files', async () => {
    const g = await parse(
      dir('vault', [file('a.md'), file('notes.txt', 'x'), file('image.png')]),
    );
    expect(g.nodes.map((n) => n.id)).toEqual(['a']);
  });

  it('extracts [[wikilinks]] as links', async () => {
    const g = await parse(
      dir('vault', [file('a.md', 'see [[b]] for more'), file('b.md')]),
    );
    expect(g.links).toContainEqual({ source: 'a', target: 'b' });
  });

  it('strips aliases and surrounding whitespace from links', async () => {
    const g = await parse(
      dir('vault', [
        file('a.md', 'ref [[ Target Note | nickname ]]'),
        file('Target Note.md'),
      ]),
    );
    expect(g.links).toContainEqual({ source: 'a', target: 'Target Note' });
  });

  it('captures multiple links from a single file (no dedupe)', async () => {
    const g = await parse(
      dir('vault', [file('a.md', '[[b]] then [[c]] then [[b]]'), file('b.md'), file('c.md')]),
    );
    const fromA = g.links.filter((l) => l.source === 'a');
    expect(fromA).toHaveLength(3);
    expect(fromA.filter((l) => l.target === 'b')).toHaveLength(2);
    expect(fromA.filter((l) => l.target === 'c')).toHaveLength(1);
  });

  it('skips hidden directories like .obsidian and .git', async () => {
    const g = await parse(
      dir('vault', [
        file('a.md'),
        dir('.obsidian', [file('app.md')]),
        dir('.git', [file('config.md')]),
      ]),
    );
    expect(g.nodes.map((n) => n.id)).toEqual(['a']);
  });

  it('recurses subdirectories and groups by top-level folder', async () => {
    const g = await parse(
      dir('vault', [
        file('Home.md'),
        dir('projects', [
          file('Alpha.md'),
          dir('sub', [file('Deep.md')]),
        ]),
      ]),
    );
    expect(byId(g, 'Home')).toMatchObject({ group: 'root', path: 'Home.md' });
    expect(byId(g, 'Alpha')).toMatchObject({ group: 'projects', path: 'projects/Alpha.md' });
    expect(byId(g, 'Deep')).toMatchObject({ group: 'projects', path: 'projects/sub/Deep.md' });
  });

  it('sizes nodes by incoming link count (val = (1 + incoming) * 2)', async () => {
    // a and b both link to c; c has 2 incoming, a/b have 0.
    const g = await parse(
      dir('vault', [file('a.md', '[[c]]'), file('b.md', '[[c]]'), file('c.md')]),
    );
    expect(byId(g, 'c')?.val).toBe(6); // (1 + 2) * 2
    expect(byId(g, 'a')?.val).toBe(2); // (1 + 0) * 2
  });

  it('caps node size at 20 for highly-linked nodes', async () => {
    // 12 files link to hub → (1 + 12) * 2 = 26, capped to 20.
    const linkers = Array.from({ length: 12 }, (_, i) => file(`n${i}.md`, '[[hub]]'));
    const g = await parse(dir('vault', [...linkers, file('hub.md')]));
    expect(byId(g, 'hub')?.val).toBe(20);
  });

  it('creates unresolved placeholder nodes for links to missing files', async () => {
    const g = await parse(dir('vault', [file('a.md', 'points to [[ghost]]')]));
    expect(g.links).toContainEqual({ source: 'a', target: 'ghost' });
    expect(byId(g, 'ghost')).toMatchObject({
      id: 'ghost',
      group: 'unresolved',
      path: '',
      val: 1,
    });
  });

  it('does not duplicate an unresolved node referenced by multiple links', async () => {
    const g = await parse(
      dir('vault', [file('a.md', '[[ghost]]'), file('b.md', '[[ghost]]')]),
    );
    expect(g.nodes.filter((n) => n.id === 'ghost')).toHaveLength(1);
  });
});
