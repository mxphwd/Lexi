import type { Dv9RuntimeEntry } from "@/modules/dv9/types";
import { dv11LexicalPackageFromEntry } from "./lexical-package";
import type { Dv11KnowledgeStore } from "./store";

export { dv11LexicalPackageFromEntry } from "./lexical-package";

export function installDv9LexicalEntry(store: Dv11KnowledgeStore, entry: Dv9RuntimeEntry) {
  const pack = dv11LexicalPackageFromEntry(entry);
  if (store.manifests().some((manifest) => manifest.packageId === pack.manifest.packageId)) return false;
  store.addPackage(pack);
  return true;
}
