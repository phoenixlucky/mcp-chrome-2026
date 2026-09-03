import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export interface ArtifactMetadata {
  artifactId: string;
  contentType: string;
  size: number;
  sha256: string;
}

interface UploadState extends ArtifactMetadata {
  nextSeq: number;
  bytes: number;
  hash: crypto.Hash;
  partPath: string;
}

export interface StoredArtifact {
  metadata: ArtifactMetadata;
  filePath: string;
  downloadToken: string;
}

const CHUNK_SIZE = 512 * 1024;
const DEFAULT_MAX_ARTIFACT_SIZE = 50 * 1024 * 1024;
const DEFAULT_MAX_ARTIFACT_DIR_SIZE = 512 * 1024 * 1024;
const DEFAULT_TTL_MS = 60 * 60 * 1000;
const ARTIFACT_ID = /^[a-zA-Z0-9_-]{1,128}$/;

function envBytes(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export class ArtifactStore {
  readonly rootDir: string;
  private readonly maxArtifactSize = envBytes(
    'CHROME_MCP_MAX_ARTIFACT_SIZE_BYTES',
    DEFAULT_MAX_ARTIFACT_SIZE,
  );
  private readonly maxDirectorySize = envBytes(
    'CHROME_MCP_MAX_ARTIFACT_DIR_SIZE_BYTES',
    DEFAULT_MAX_ARTIFACT_DIR_SIZE,
  );
  private readonly ttlMs = envBytes('CHROME_MCP_ARTIFACT_TTL_MS', DEFAULT_TTL_MS);
  private readonly uploads = new Map<string, UploadState>();
  private readonly completed = new Map<string, StoredArtifact>();
  private readonly downloadTokens = new Map<string, string>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor(rootDir = path.join(os.tmpdir(), 'chrome-mcp-artifacts')) {
    this.rootDir = rootDir;
    fs.mkdirSync(rootDir, { recursive: true });
    this.cleanupExpired();
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), Math.min(this.ttlMs, 15 * 60_000));
    this.cleanupTimer.unref();
  }

  receiveChunk(chunk: {
    artifactId: string;
    contentType: string;
    size: number;
    sha256: string;
    seq: number;
    eof: boolean;
    data: string;
  }): ArtifactMetadata | undefined {
    if (!ARTIFACT_ID.test(chunk.artifactId)) throw new Error('Invalid artifactId');
    if (!chunk.contentType || chunk.size > this.maxArtifactSize) {
      throw new Error('Artifact exceeds the configured size limit');
    }
    if (chunk.seq < 0 || !/^[a-f0-9]{64}$/i.test(chunk.sha256)) {
      throw new Error('Invalid artifact chunk metadata');
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(chunk.data)) throw new Error('Invalid artifact chunk data');

    let upload = this.uploads.get(chunk.artifactId);
    if (!upload) {
      if (chunk.seq !== 0) throw new Error('Artifact must start at seq 0');
      const partPath = path.join(this.rootDir, `${chunk.artifactId}.part`);
      try {
        fs.unlinkSync(partPath);
      } catch {
        // A stale partial upload can be safely replaced by a new artifact ID.
      }
      upload = {
        artifactId: chunk.artifactId,
        contentType: chunk.contentType,
        size: chunk.size,
        sha256: chunk.sha256.toLowerCase(),
        nextSeq: 0,
        bytes: 0,
        hash: crypto.createHash('sha256'),
        partPath,
      };
      this.uploads.set(chunk.artifactId, upload);
    }

    if (
      chunk.seq !== upload.nextSeq ||
      chunk.contentType !== upload.contentType ||
      chunk.size !== upload.size ||
      chunk.sha256.toLowerCase() !== upload.sha256
    ) {
      this.discard(chunk.artifactId);
      throw new Error('Artifact chunk sequence or metadata mismatch');
    }

    const data = Buffer.from(chunk.data, 'base64');
    if (
      upload.bytes + data.length > upload.size ||
      upload.bytes + data.length > this.maxArtifactSize
    ) {
      this.discard(chunk.artifactId);
      throw new Error('Artifact exceeds the configured size limit');
    }
    if (this.directorySize() + data.length > this.maxDirectorySize) {
      this.discard(chunk.artifactId);
      throw new Error('Artifact directory is full');
    }

    fs.appendFileSync(upload.partPath, data);
    upload.hash.update(data);
    upload.bytes += data.length;
    upload.nextSeq += 1;
    if (!chunk.eof) return undefined;

    if (upload.bytes !== upload.size || upload.hash.digest('hex') !== upload.sha256) {
      this.discard(chunk.artifactId);
      throw new Error('Artifact size or sha256 mismatch');
    }

    const filePath = path.join(this.rootDir, `${chunk.artifactId}.artifact`);
    fs.renameSync(upload.partPath, filePath);
    this.uploads.delete(chunk.artifactId);
    const stored = {
      metadata: {
        artifactId: upload.artifactId,
        contentType: upload.contentType,
        size: upload.size,
        sha256: upload.sha256,
      },
      filePath,
      downloadToken: crypto.randomBytes(24).toString('base64url'),
    };
    this.completed.set(chunk.artifactId, stored);
    this.downloadTokens.set(chunk.artifactId, stored.downloadToken);
    return stored.metadata;
  }

  get(artifactId: string): StoredArtifact | undefined {
    const stored = this.completed.get(artifactId);
    if (!stored || !fs.existsSync(stored.filePath)) {
      this.completed.delete(artifactId);
      this.downloadTokens.delete(artifactId);
      return undefined;
    }
    return stored;
  }

  consumeDownloadToken(artifactId: string, token: string): boolean {
    const expected = this.downloadTokens.get(artifactId);
    if (!expected || !token || expected !== token) return false;
    this.downloadTokens.delete(artifactId);
    return true;
  }

  cleanupIncomplete(): void {
    for (const artifactId of this.uploads.keys()) this.discard(artifactId);
  }

  cleanupExpired(): void {
    const cutoff = Date.now() - this.ttlMs;
    for (const [artifactId, stored] of this.completed) {
      try {
        if (fs.statSync(stored.filePath).mtimeMs < cutoff) {
          fs.unlinkSync(stored.filePath);
          this.completed.delete(artifactId);
          this.downloadTokens.delete(artifactId);
        }
      } catch {
        this.completed.delete(artifactId);
        this.downloadTokens.delete(artifactId);
      }
    }
    for (const file of fs.readdirSync(this.rootDir)) {
      if (!file.endsWith('.part')) continue;
      const filePath = path.join(this.rootDir, file);
      try {
        if (fs.statSync(filePath).mtimeMs < cutoff) fs.unlinkSync(filePath);
      } catch {
        // Best-effort cleanup only.
      }
    }
  }

  dispose(): void {
    clearInterval(this.cleanupTimer);
    this.cleanupIncomplete();
  }

  private discard(artifactId: string): void {
    const upload = this.uploads.get(artifactId);
    this.uploads.delete(artifactId);
    if (!upload) return;
    try {
      fs.unlinkSync(upload.partPath);
    } catch {
      // The partial file may already be gone.
    }
  }

  private directorySize(): number {
    return fs.readdirSync(this.rootDir).reduce((total, file) => {
      try {
        return total + fs.statSync(path.join(this.rootDir, file)).size;
      } catch {
        return total;
      }
    }, 0);
  }
}

export { CHUNK_SIZE };
