import path from "node:path";

export function assetsDirectory() {
  return path.resolve(
    /* turbopackIgnore: true */ process.env.ASSETS_DIR || "./assets",
  );
}

export function assetPath(parts: string[]) {
  if (parts.length !== 2 || !/^[a-z0-9-]+$/.test(parts[0]) ||
      !/^[a-z0-9-]+\.(png|jpe?g|svg|gif|webp)$/.test(parts[1])) return null;
  return path.join(assetsDirectory(), ...parts);
}
