import type { Asset, State } from "./domain";

export const QR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export type PublicAsset = {
  assetId: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  status: Asset["status"];
  condition: Asset["conditionStatus"];
};

// Deliberate allowlist: never spread an asset or serialize the tenant aggregate here.
export function publicAssetCard(state: State, asset: Asset): PublicAsset {
  return {
    assetId: asset.assetCode,
    name: asset.assetName,
    category:
      state.categories.find((c) => c.id === asset.assetCategoryId)
        ?.categoryName || "Not specified",
    brand: asset.manufacturer || "Not specified",
    model: asset.model || "Not specified",
    status: asset.status,
    condition: asset.conditionStatus,
  };
}
