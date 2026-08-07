import type { Id } from "../../../convex/_generated/dataModel";
import { type CategoryKey, normalizeSubteamName } from "./categories";

interface Subteam {
  _id: Id<"subteams">;
  subteamName: string;
}

export function createSubteamMaps(subteams: Subteam[] | undefined): {
  keyToSubteamId: Map<CategoryKey, Id<"subteams">>;
  subteamIdToKey: Map<Id<"subteams">, CategoryKey>;
} {
  const keyToSubteamId = new Map<CategoryKey, Id<"subteams">>();
  const subteamIdToKey = new Map<Id<"subteams">, CategoryKey>();
  if (!subteams) {
    return { keyToSubteamId, subteamIdToKey };
  }

  for (const subteam of subteams) {
    const key = normalizeSubteamName(subteam.subteamName);
    if (!key) {
      continue;
    }
    subteamIdToKey.set(subteam._id, key);
    if (!keyToSubteamId.has(key)) {
      keyToSubteamId.set(key, subteam._id);
    }
  }
  return { keyToSubteamId, subteamIdToKey };
}
