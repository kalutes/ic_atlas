# IC Atlas

A mobile-first tracker for physical Japanese transport IC cards, with a dark default theme, compact stats, a single-column phone layout, and filters shown on demand. Built with `create-next-app`, Next.js App Router, TypeScript, Tailwind CSS, SQLite, Drizzle, and accessible Radix dialogs. One Node.js app, no accounts, no cloud dependencies during normal use.

The catalog contains **357 designs/revisions across 95 brands**, expanded from the three collector references. 324 entries have downloadable artwork references; 33 source listings have no available picture and show “Image needed”. Ownership starts empty. The app tracks distinct designs, not individual duplicate copies.

- Owned cards first, grouped by brand, with lightly muted unowned artwork.
- Claim/unclaim with undo; optional acquisition date and collection notes.
- Global stats, brand progress, Japanese/English search, region/design/status filters, and recent-collection sorting. Filters remain in the URL.
- Card profiles: issuer, home region, brand/design introduction years, issuance and service status, purchase guidance, and sources.
- Personal missing designs with optional JPEG/PNG/WebP upload. Images are validated, normalized, and stored locally.
- SQLite migrations/catalog updates preserve ownership, notes and personal designs.
- Production Docker image, Compose configuration, health check, backup and restore scripts.

Read [DESIGN.md](DESIGN.md) for the project design and [CATALOG.md](CATALOG.md) for coverage and artwork provenance. Apple Wallet history and the rail map remain future features.

## Local development

Use Node.js 22.22.0 or a compatible supported Node 22 release. SQLite's native module requires Python 3, Make, and a C++ compiler when a prebuilt binary is unavailable (e.g. `python3 make g++` on Debian/Ubuntu).

```sh
npm ci
npm run assets:download
npm run dev
```

Open http://localhost:3000. The first server start creates `data/collection.sqlite`. Personal data and the downloaded `assets/` cache are ignored by Git and Docker build context. No real collection data is seeded.

For a local production build:

```sh
npm run build
npm start
```

The build prepares the Next.js standalone directory with code, UI icons and the catalog manifest. Card artwork is downloaded separately. `npm start` fills missing images before starting the server; its default database is `data/collection.sqlite` and its image cache is `assets/`. `PORT`, `HOSTNAME`, `DATA_DIR`, `ASSETS_DIR` and `APP_ORIGIN` can be supplied as environment variables. Use absolute paths outside build output for custom data/cache locations. Set `DOWNLOAD_ASSETS=0` to start without attempting downloads.

## Docker Compose

Build the image on a machine with Docker, for the target server architecture:

```sh
docker build -t ic-atlas:0.1.0 .
cp .env.example .env
mkdir -p data assets
docker compose up -d
```

The defaults expose the app only at http://localhost:3000. The container runs as UID/GID 1000; both mounted directories must be writable by those IDs or by the IDs configured in `.env`. The build compiles the SQLite native dependency inside Linux; it does not copy host `node_modules` into the image.

For your LAN, edit `.env` before starting:

| Variable | Example | Purpose |
| --- | --- | --- |
| `IC_ATLAS_IMAGE` | `ic-atlas:0.1.0` | A locally loaded or registry-hosted versioned image |
| `IC_ATLAS_DATA_DIR` | `/mnt/tank/apps/ic-atlas/data` | Persistent database and personal uploads |
| `IC_ATLAS_ASSETS_DIR` | `/mnt/tank/apps/ic-atlas/assets` | Persistent downloaded card artwork |
| `DOWNLOAD_ASSETS` | `1` | Fetch missing images before startup; `0` skips downloads |
| `BIND_ADDRESS` | `192.168.1.20` | Server interface to expose |
| `APP_PORT` | `3000` | Host port |
| `APP_ORIGIN` | `http://192.168.1.20:3000` | Exact URL origin used by the browser, no trailing slash |
| `APP_UID` / `APP_GID` | `1000` / `1000` | Non-root identity with write access to the dataset |

`APP_ORIGIN` prevents writes from unrelated websites. It must match the browser URL, including protocol and port. If using a reverse proxy, set it to the externally visible LAN origin. A mismatched origin allows reads but rejects writes with a useful error.

Mount **the entire data directory**, not just the SQLite file. SQLite WAL uses adjacent `-wal`/`-shm` files. Run one replica and place the database on a local TrueNAS dataset, not an SMB/NFS-mounted filesystem.

The separate assets mount is served at `/cards/<brand>/<filename>`. The container fills missing files from the URLs in `catalog/cards.json`, skips existing files and shares downloads where cards use the same source. First startup needs outbound internet access and can take several minutes. A run has a five-minute download budget; requests have timeouts and one retry for transient failures. Missing/failed images show placeholders, the app still starts, and another start resumes the missing downloads. Existing cached images work offline. A cache permission error stops startup with an error rather than silently writing elsewhere.

To retry missing images while the app runs:

```sh
docker compose exec ic-atlas node scripts/download-assets.mjs
# Or locally:
npm run assets:download
```

The manual command exits with a nonzero status if any requested images remain unavailable; normal app startup still proceeds. Reload the collection after a manual download finishes. The downloader never overwrites existing nonempty images; remove a particular cached file if you want to fetch it again.

There is no authentication: anyone who can reach the app can edit the collection. Keep it on your trusted LAN. No public deployment is configured.

### GitHub Actions and GHCR

[The Docker workflow](.github/workflows/docker-publish.yml) checks pull requests, pushes to `main`, version tags matching `v*`, and manual runs. It runs lint, TypeScript and data tests, builds the production image, and checks startup downloads, cache reuse and backup/restore using generated test artwork. It needs no local database, real card images or custom repository secrets.

After verification, `main` and version-tag runs publish a `linux/amd64` image to `ghcr.io/<owner>/<repository>`. Image names are derived from the repository automatically. The workflow uses the built-in `GITHUB_TOKEN`, with package write access only in the publishing job, and pins the actions to fixed commits. Pull requests only verify the build.

Tags include `latest` for `main`, `sha-<commit>` for each published commit, and the Git tag itself for a release such as `v0.1.0`. To use a published release, set this in your server's `.env`:

```dotenv
IC_ATLAS_IMAGE=ghcr.io/your-account/your-repository:v0.1.0
```

Then run `docker compose pull` and `docker compose up -d`. GHCR packages initially default to private; set the package's visibility to public if you want anonymous pulls on TrueNAS. See [GitHub's Container registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

The uploadable source excludes the assets cache, collection database, backups, local credentials/agent directories, environment files other than `.env.example`, and generated output. Preserve those local directories on the server; they are separate from the published code and image.

### TrueNAS Custom App

On a Docker-capable TrueNAS release, create datasets/directories for data and assets and grant the configured UID/GID read/write access. Use the TrueNAS dataset permissions UI rather than making a dataset world-writable.

The Compose file uses a prebuilt image, so the TrueNAS app UI does not need this source checkout. Transfer the locally built image if you are not using a private registry:

```sh
# On the build machine:
docker save ic-atlas:0.1.0 -o ic-atlas-0.1.0.tar
# Transfer the archive to your server, then on the Docker host:
docker load -i ic-atlas-0.1.0.tar
```

In **Apps → Discover → Install via YAML**, paste `docker-compose.yml` and replace interpolated values with the actual image, data and assets dataset paths, UID/GID, LAN IP and origin. The TrueNAS UI will not automatically read the `.env` file from your development machine. Alternatively, run Docker Compose from a server-side directory containing the Compose file and `.env`.

If your TrueNAS edition does not provide Docker-based Apps, use a Linux VM running Docker Compose. Host edition/version, architecture, path, and LAN addressing are deployment-specific; this repository does not modify your TrueNAS configuration.

```sh
docker compose ps
docker compose logs --tail=50 ic-atlas
```

`/api/health` returns success only after the database and catalog initialize. Startup errors do not reset data. The runtime image has no compiler toolchain and runs without elevated capabilities.

## Backup and restore

Create an online backup, including a consistent SQLite snapshot, personal uploaded images, and version metadata:

```sh
# Docker:
docker compose exec ic-atlas node scripts/backup.mjs
# Or local Node:
npm run backup
```

Backups are placed in `DATA_DIR/backups/<timestamp-id>/`. Copy those backups to a separate dataset/device or include them in your TrueNAS snapshot/replication plan. A backup on the same disk is not protection against loss of that disk. Uploaded images are immutable; backing them up after the database snapshot preserves all referenced files. The downloaded card-art cache is separate and is not included by the backup script. Snapshot/copy the assets dataset as well if you want a complete offline restore or protection against source images disappearing.

Restore only while the app is stopped, into a new **empty** data directory. The script refuses a nonempty target:

```sh
docker compose stop ic-atlas
# Host Node installation, if available:
node scripts/restore.mjs /path/to/backup /path/to/empty-restored-data
```

Without Node on the host, use the image as a one-off restore tool, with the backup mounted read-only and an empty writable destination:

```sh
docker run --rm --user 1000:1000 \
  -v /path/to/backup:/backup:ro \
  -v /path/to/empty-restored-data:/restore \
  ic-atlas:0.1.0 node scripts/restore.mjs /backup /restore
```

Point `IC_ATLAS_DATA_DIR` at the restored directory and start the matching image version. Verify the collection and an uploaded image before deleting any original data. For a simpler cold backup, stop the app and snapshot/copy the entire live dataset. Do not copy only the active `.sqlite` file while ignoring its WAL.

For upgrades, take a backup first, change the image version, and recreate the container using the same data mount. Catalog metadata is upserted by stable ID without overwriting personal state. The schema uses versioned migrations and rejects databases newer than the app. If a migration requires rollback, restore the backup with the matching previous app image.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

The tests cover retry-safe ownership, notes, catalog updates and ID migrations, custom entries, backup/restore, downloads that skip existing files, shared sources, invalid/failed downloads, safe asset paths, and the mounted-image route. They use generated test artwork rather than depending on a downloaded collection.

Browser tests use a separate database. Start the built app on a test port in one terminal:

```sh
DATA_DIR=/tmp/ic-atlas-test APP_ORIGIN=http://127.0.0.1:3100 HOSTNAME=127.0.0.1 PORT=3100 npm start
```

In another terminal:

```sh
npx playwright install chromium
npm run test:e2e
```

Set `TEST_BASE_URL` to test another isolated deployment. Optionally set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing compatible Chromium binary. The tests write collection data and a custom entry, so do not point them at a real collection. They cover ownership/undo, notes, persistence after reload, search/filter persistence, failed writes, uploads, invalid requests, image loading, mobile overflow, and keyboard dialogs. Screenshots are saved in ignored `test-results/`.

After building `ic-atlas:0.1.0`, run the container recovery test with:

```sh
npm run test:docker
```

It uses a dedicated Compose project, localhost port 3101, and temporary data directories. It uses a local generated-image source to verify a cold startup download and cache reuse, then verifies container replacement, an online backup, restoration into an empty mount, and restored images. It removes its test containers and data afterward. Do not run another instance of this test at the same time.

Validation completed on Linux amd64: TypeScript check, production build, catalog and persistence tests, four Chromium browser tests, and the container persistence/restore test. The image has not been deployed to the user's TrueNAS server; other CPU architectures need a target-platform build and validation.

## Implementation notes

Catalog metadata is stored as typed JSON in a `designs` table, with personal state in a separate relational `collection` table. This is a small simplification of the conceptual design. Brands derive from catalog metadata, while the nationwide-ten milestone uses an explicit brand set. A missing personal row means unowned.

The app uses same-origin Next.js Route Handlers for mutations instead of Server Actions, giving browser tests and future import tools one explicit validated endpoint. The server owns all SQLite access. Reads are dynamic; changing ownership refreshes the current view and returning to a browser tab refreshes collection state.

The sole catalog manifest is `catalog/cards.json`; it contains each card’s metadata, local image URL and original source URL. Every pictured card uses a direct image URL; no PDF extraction or extra image instructions are required. The startup downloader stores artwork in brand folders under `ASSETS_DIR` and the app serves those files locally. Downloaded images are excluded from both Git and Docker builds. Temporary scraping and comparison files are not shipped. The catalog is versioned. Never reuse an existing ID for a different physical design. Custom IDs have a `custom-` prefix and are protected from bundled-ID collisions. Removed seed entries are retained so ownership is not deleted. The descriptive-ID migration maps the old imported IDs to their new card names and transfers personal state atomically; it does not create duplicate cards. If both IDs already have personal data, startup stops rather than overwriting either record.

The cache contains authentic raster card fronts from the listed collector and issuer sources. Exact design years and stock can remain unknown. Image rights/provenance are recorded per card; the assets are local reference copies, not a permission-cleared public distribution bundle. See `CATALOG.md` before redistributing images.

Before publishing an existing repository, check its history: ignore rules do not remove images from earlier commits. Public image registries should receive only the newly built image, which excludes the local artwork cache. Downloading at startup changes packaging; it does not grant additional reuse rights.
