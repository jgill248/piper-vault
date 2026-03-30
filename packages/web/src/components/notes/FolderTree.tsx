import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderPlus } from 'lucide-react';
import type { NoteFolder } from '@delve/shared';

interface FolderTreeProps {
  readonly folders: readonly NoteFolder[];
  readonly selectedPath: string | undefined;
  readonly onSelectPath: (path: string | undefined) => void;
  readonly onCreateFolder: (path: string, onSuccess?: () => void) => void;
}

interface TreeNode {
  name: string;
  fullPath: string;
  folder?: NoteFolder;
  children: TreeNode[];
}

function buildTree(folders: readonly NoteFolder[]): TreeNode[] {
  const root: TreeNode[] = [];
  const nodeMap = new Map<string, TreeNode>();

  for (const folder of folders) {
    const parts = folder.path.split('/');
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]!;
      currentPath = i === 0 ? name : `${currentPath}/${name}`;

      if (!nodeMap.has(currentPath)) {
        const node: TreeNode = {
          name,
          fullPath: currentPath,
          folder: currentPath === folder.path ? folder : undefined,
          children: [],
        };
        nodeMap.set(currentPath, node);

        if (i === 0) {
          root.push(node);
        } else {
          const parentPath = parts.slice(0, i).join('/');
          const parent = nodeMap.get(parentPath);
          if (parent) {
            parent.children.push(node);
          }
        }
      } else if (currentPath === folder.path) {
        nodeMap.get(currentPath)!.folder = folder;
      }
    }
  }

  return root;
}

function TreeItem({
  node,
  selectedPath,
  onSelectPath,
  depth = 0,
}: {
  node: TreeNode;
  selectedPath: string | undefined;
  onSelectPath: (path: string | undefined) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const isSelected = selectedPath === node.fullPath;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <button
        onClick={() => onSelectPath(isSelected ? undefined : node.fullPath)}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs font-label transition-colors ${
          isSelected
            ? 'text-primary bg-surface-container-high'
            : 'text-secondary hover:text-on-surface hover:bg-surface'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="inline-flex items-center p-0 cursor-pointer"
          >
            {expanded ? (
              <ChevronDown size={12} strokeWidth={1.5} />
            ) : (
              <ChevronRight size={12} strokeWidth={1.5} />
            )}
          </span>
        ) : (
          <span className="w-3" />
        )}
        <Folder size={12} strokeWidth={1.5} />
        <span className="truncate">{node.name}</span>
      </button>
      {expanded &&
        node.children.map((child) => (
          <TreeItem
            key={child.fullPath}
            node={child}
            selectedPath={selectedPath}
            onSelectPath={onSelectPath}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

export function FolderTree({
  folders,
  selectedPath,
  onSelectPath,
  onCreateFolder,
}: FolderTreeProps) {
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const tree = buildTree(folders);

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      const path = selectedPath
        ? `${selectedPath}/${newFolderName.trim()}`
        : newFolderName.trim();
      onCreateFolder(path, () => {
        setNewFolderName('');
        setShowNewFolder(false);
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/20">
        <span className="text-xs font-label text-on-surface-variant uppercase tracking-wider">
          Folders
        </span>
        <button
          onClick={() => setShowNewFolder(!showNewFolder)}
          className="p-1 text-on-surface-variant hover:text-primary transition-colors"
          title="New folder"
        >
          <FolderPlus size={12} strokeWidth={1.5} />
        </button>
      </div>

      {showNewFolder && (
        <div className="px-3 py-2 border-b border-outline-variant/20">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') setShowNewFolder(false);
            }}
            className="input-cmd w-full text-xs"
            placeholder="Folder name..."
            autoFocus
          />
        </div>
      )}

      {/* All Notes (root) */}
      <button
        onClick={() => onSelectPath(undefined)}
        className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-label transition-colors ${
          selectedPath === undefined
            ? 'text-primary bg-surface-container-high'
            : 'text-secondary hover:text-on-surface hover:bg-surface'
        }`}
      >
        <Folder size={12} strokeWidth={1.5} />
        All Notes
      </button>

      <div className="flex-1 overflow-auto">
        {tree.map((node) => (
          <TreeItem
            key={node.fullPath}
            node={node}
            selectedPath={selectedPath}
            onSelectPath={onSelectPath}
          />
        ))}
      </div>
    </div>
  );
}
