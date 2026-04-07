import chokidar from 'chokidar';
import { extname } from 'node:path';
import { FILE_EXTENSIONS } from '@delve/shared';

export interface FileWatcherEvents {
  onAdd: (filePath: string) => void;
  onChange: (filePath: string) => void;
  onUnlink: (filePath: string) => void;
  onError?: (error: Error) => void;
}

export interface FileWatcherOptions {
  readonly recursive?: boolean;
  readonly debounceMs?: number;
  readonly ignored?: string[];
  readonly supportedExtensions?: string[];
}

const DEFAULT_SUPPORTED_EXTENSIONS = Object.keys(FILE_EXTENSIONS);
const DEFAULT_DEBOUNCE_MS = 500;

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;

  constructor(
    private readonly dirPath: string,
    private readonly events: FileWatcherEvents,
    private readonly options?: FileWatcherOptions,
  ) {}

  async start(): Promise<void> {
    if (this.watcher !== null) {
      return;
    }

    const supportedExtensions =
      this.options?.supportedExtensions ?? DEFAULT_SUPPORTED_EXTENSIONS;
    const debounceMs = this.options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    const recursive = this.options?.recursive ?? true;

    // Build ignore list: dotfiles, tilde-files, .tmp files, plus any custom ignores
    const ignored: (string | RegExp)[] = [
      /(^|[/\\])\../, // dotfiles / hidden files
      /~$/,            // editor backup files
      /\.tmp$/,        // tmp files
    ];
    if (this.options?.ignored) {
      ignored.push(...this.options.ignored);
    }

    this.watcher = chokidar.watch(this.dirPath, {
      persistent: true,
      ignoreInitial: false,
      followSymlinks: false,
      depth: recursive ? undefined : 0,
      ignored,
      awaitWriteFinish: {
        stabilityThreshold: debounceMs,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('add', (filePath: string) => {
        if (this.isSupportedFile(filePath, supportedExtensions)) {
          this.events.onAdd(filePath);
        }
      })
      .on('change', (filePath: string) => {
        if (this.isSupportedFile(filePath, supportedExtensions)) {
          this.events.onChange(filePath);
        }
      })
      .on('unlink', (filePath: string) => {
        if (this.isSupportedFile(filePath, supportedExtensions)) {
          this.events.onUnlink(filePath);
        }
      })
      .on('error', (error: Error) => {
        if (this.events.onError) {
          this.events.onError(error);
        }
      });

    // Wait for the initial scan to complete
    await new Promise<void>((resolve) => {
      this.watcher!.on('ready', resolve);
    });
  }

  async stop(): Promise<void> {
    if (this.watcher !== null) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  isWatching(): boolean {
    return this.watcher !== null;
  }

  private isSupportedFile(filePath: string, supportedExtensions: string[]): boolean {
    const ext = extname(filePath).toLowerCase();
    return supportedExtensions.includes(ext);
  }
}
