import { get, set } from 'idb-keyval';

export interface GraphNode {
  id: string;
  name: string;
  path: string;
  group: string;
  val: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const VAULT_HANDLE_KEY = 'obsidian_vault_handle';

export async function requestVaultDirectory(): Promise<FileSystemDirectoryHandle> {
  // @ts-ignore - File System Access API is not fully typed in all environments
  const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
  await set(VAULT_HANDLE_KEY, dirHandle);
  return dirHandle;
}

export async function getStoredVaultDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const dirHandle = await get(VAULT_HANDLE_KEY);
  if (!dirHandle) return null;

  // @ts-ignore
  const options = { mode: 'read' };
  // @ts-ignore
  if ((await dirHandle.queryPermission(options)) === 'granted') {
    return dirHandle;
  }
  // @ts-ignore
  if ((await dirHandle.requestPermission(options)) === 'granted') {
    return dirHandle;
  }
  return null;
}

export async function parseVault(dirHandle: FileSystemDirectoryHandle): Promise<GraphData> {
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  // Helper to recursively read all .md files
  async function readDirectory(dir: FileSystemDirectoryHandle, currentPath: string = '') {
    // @ts-ignore
    for await (const entry of dir.values()) {
      if (entry.kind === 'directory') {
        // Skip hidden directories like .obsidian or .git
        if (!entry.name.startsWith('.')) {
          await readDirectory(entry as FileSystemDirectoryHandle, `${currentPath}${entry.name}/`);
        }
      } else if (entry.kind === 'file' && entry.name.endsWith('.md')) {
        const file = await (entry as FileSystemFileHandle).getFile();
        const text = await file.text();
        
        const fileNameWithoutExt = entry.name.replace(/\.md$/, '');
        // Determine group by top level folder
        const topLevelFolder = currentPath.split('/')[0] || 'root';

        nodes.set(fileNameWithoutExt, {
          id: fileNameWithoutExt,
          name: fileNameWithoutExt,
          path: `${currentPath}${entry.name}`,
          group: topLevelFolder,
          val: 1, // Base size
        });

        // Parse [[links]]
        const linkRegex = /\[\[(.*?)\]\]/g;
        let match;
        while ((match = linkRegex.exec(text)) !== null) {
          // Obsidian links can have aliases: [[Link|Alias]]
          const linkTarget = match[1].split('|')[0].trim();
          if (linkTarget) {
            links.push({
              source: fileNameWithoutExt,
              target: linkTarget,
            });
          }
        }
      }
    }
  }

  await readDirectory(dirHandle);

  // Increase value (size) of nodes based on how many incoming links they have
  const nodeValues = new Map<string, number>();
  for (const link of links) {
    nodeValues.set(link.target, (nodeValues.get(link.target) || 1) + 1);
  }

  const finalNodes = Array.from(nodes.values()).map(node => ({
    ...node,
    val: Math.min((nodeValues.get(node.id) || 1) * 2, 20), // Cap size
  }));

  // Ensure all targets exist as nodes (for broken links)
  const existingNodeIds = new Set(nodes.keys());
  for (const link of links) {
    if (!existingNodeIds.has(link.target)) {
      existingNodeIds.add(link.target);
      finalNodes.push({
        id: link.target,
        name: link.target,
        path: '',
        group: 'unresolved',
        val: 1,
      });
    }
  }

  return { nodes: finalNodes, links };
}
