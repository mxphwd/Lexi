import { stableHash } from "./normalize";
import { validateDv11Package, type Dv11KnowledgeStore } from "./store";
import type { Dv11KnowledgePackage, Dv11PackageManifest } from "./types";

export type Dv11PackageDescriptor = {
  manifest: Dv11PackageManifest;
  load: (signal?: AbortSignal) => Promise<Dv11KnowledgePackage>;
  estimatedBytes: number;
  routes: readonly string[];
};

export type Dv11PackageLoadResult = {
  packageId: string;
  installed: boolean;
  fromCache: boolean;
  durationMilliseconds: number;
  bytes: number;
};

type Loaded = { pack: Dv11KnowledgePackage; bytes: number; lastUsed: number };

function abort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Package load canceled.", "AbortError");
}

export class Dv11PackageRegistry {
  private readonly descriptors = new Map<string, Dv11PackageDescriptor>();
  private readonly loaded = new Map<string, Loaded>();
  private readonly inflight = new Map<string, Promise<Dv11PackageLoadResult>>();
  private cachedBytes = 0;

  constructor(private readonly store: Dv11KnowledgeStore, private readonly byteBudget = 64 * 1024 * 1024) {}

  register(descriptor: Dv11PackageDescriptor) {
    const current = this.descriptors.get(descriptor.manifest.packageId);
    if (current && current.manifest.contentHash !== descriptor.manifest.contentHash) throw new Error(`Package descriptor conflict: ${descriptor.manifest.packageId}`);
    if (descriptor.manifest.minimumRuntime !== "DV11" || descriptor.manifest.schemaVersion !== 1) throw new Error(`Package ${descriptor.manifest.packageId} is not DV11 compatible.`);
    this.descriptors.set(descriptor.manifest.packageId, descriptor);
  }

  loadedPackageIds() {
    return this.store.manifests().map((manifest) => manifest.packageId);
  }

  async installResolved(pack: Dv11KnowledgePackage, routes: readonly string[] = ["*"], signal?: AbortSignal) {
    const installed = this.store.manifests().find((manifest) => manifest.packageId === pack.manifest.packageId);
    if (installed) {
      if (installed.contentHash !== pack.manifest.contentHash) throw new Error(`Installed package conflict: ${pack.manifest.packageId}`);
      return { packageId: pack.manifest.packageId, installed: true, fromCache: true, durationMilliseconds: 0, bytes: 0 } satisfies Dv11PackageLoadResult;
    }
    const bytes = new TextEncoder().encode(JSON.stringify(pack)).byteLength;
    this.register({ manifest: pack.manifest, routes, estimatedBytes: bytes, load: async () => pack });
    return this.load(pack.manifest.packageId, signal);
  }

  candidatesForRoute(route: string) {
    return [...this.descriptors.values()].filter((descriptor) => descriptor.routes.includes(route) || descriptor.routes.includes("*"));
  }

  async load(packageId: string, signal?: AbortSignal): Promise<Dv11PackageLoadResult> {
    abort(signal);
    const cached = this.loaded.get(packageId);
    if (cached) {
      cached.lastUsed = Date.now();
      return { packageId, installed: true, fromCache: true, durationMilliseconds: 0, bytes: cached.bytes };
    }
    const active = this.inflight.get(packageId);
    if (active) return active;
    const descriptor = this.descriptors.get(packageId);
    if (!descriptor) throw new Error(`Unknown DV11 package ${packageId}.`);
    const task = (async () => {
      const start = performance.now();
      for (const dependency of descriptor.manifest.dependencies) await this.load(dependency.packageId, signal);
      abort(signal);
      const pack = await descriptor.load(signal);
      abort(signal);
      if (pack.manifest.packageId !== packageId || pack.manifest.contentHash !== descriptor.manifest.contentHash) throw new Error(`Package identity or hash mismatch for ${packageId}.`);
      const installed = new Map(this.store.manifests().map((manifest) => [manifest.packageId, manifest]));
      const errors = validateDv11Package(pack, installed);
      if (errors.length) throw new Error(errors.join("\n"));
      const bytes = new TextEncoder().encode(JSON.stringify(pack)).byteLength;
      if (descriptor.estimatedBytes && Math.abs(bytes - descriptor.estimatedBytes) / Math.max(1, descriptor.estimatedBytes) > 0.25) throw new Error(`Package size validation failed for ${packageId}.`);
      this.store.addPackage(pack);
      this.loaded.set(packageId, { pack, bytes, lastUsed: Date.now() });
      this.cachedBytes += bytes;
      this.evict();
      return { packageId, installed: true, fromCache: false, durationMilliseconds: performance.now() - start, bytes };
    })().finally(() => this.inflight.delete(packageId));
    this.inflight.set(packageId, task);
    return task;
  }

  private evict() {
    if (this.cachedBytes <= this.byteBudget) return;
    for (const [id, loaded] of [...this.loaded].sort((left, right) => left[1].lastUsed - right[1].lastUsed)) {
      // Indexed facts remain queryable; eviction releases only parsed payloads.
      this.loaded.delete(id);
      this.cachedBytes -= loaded.bytes;
      if (this.cachedBytes <= this.byteBudget) break;
    }
  }

  stats() {
    return { registered: this.descriptors.size, loadedPayloads: this.loaded.size, cachedBytes: this.cachedBytes, byteBudget: this.byteBudget, inflight: this.inflight.size, registryHash: stableHash([...this.descriptors.keys()].sort().join("|")) };
  }
}
