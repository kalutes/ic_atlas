export const REGIONS = [
  "Hokkaido",
  "Tohoku",
  "Kanto",
  "Chubu",
  "Kansai",
  "Chugoku",
  "Shikoku",
  "Kyushu / Okinawa",
] as const;
export const CATEGORIES = [
  "Standard",
  "Tourist",
  "Commemorative",
  "Regional",
] as const;
export const NATIONWIDE = [
  "Kitaca",
  "Suica",
  "PASMO",
  "TOICA",
  "manaca",
  "ICOCA",
  "PiTaPa",
  "SUGOCA",
  "nimoca",
  "Hayakaken",
];
export const CATALOG_VERSION = "2026.10.29";
export type Design = {
  id: string;
  brand: string;
  japaneseName: string;
  name: string;
  issuer: string;
  region: string;
  category: string;
  compatibility: string;
  issuance: string;
  service: string;
  image: string;
  sourceUrl: string;
  imageSourceUrl: string;
  imageCredit: string;
  imageLicense: string;
  verifiedDate: string;
  aliases: string;
  color: string;
  brandIntroduced?: string;
  designIntroduced?: string;
  purchaseLocations?: string;
  purchaseUrl?: string;
  availabilityNote?: string;
  metadataSources?: string[];
  catalogedDate?: string;
  variantDetails?: string;
};
export type Card = Design & {
  custom: boolean;
  owned: boolean;
  acquiredDate: string | null;
  addedAt: string | null;
  notes: string;
  updatedAt: string | null;
};
export type CollectionPatch = {
  owned?: boolean;
  acquiredDate?: string | null;
  notes?: string;
};
export function statistics(cards: Card[]) {
  const owned = cards.filter((c) => c.owned);
  const brands = new Set(owned.map((c) => c.brand));
  return {
    owned: owned.length,
    total: cards.length,
    brands: brands.size,
    totalBrands: new Set(cards.map((c) => c.brand)).size,
    nationwide: NATIONWIDE.filter((b) =>
      [...brands].some((x) => x.toLowerCase() === b.toLowerCase()),
    ).length,
    regions: new Set(
      owned
        .map((c) => c.region)
        .filter((r) => REGIONS.includes(r as (typeof REGIONS)[number])),
    ).size,
    percent: cards.length ? Math.round((owned.length / cards.length) * 100) : 0,
  };
}
