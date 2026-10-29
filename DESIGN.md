# Japanese IC Card Collection — project design

Design baseline · 26 October 2026 · Collection MVP implemented; see README.md for setup, validation, and implementation differences.

## Product direction

A personal, locally hosted collection album for physical Japanese transport IC cards. Open the app to see the cards you own, discover missing designs, and mark a new acquisition with one action. Card artwork should be the focus, supported by useful collection statistics.

**Confirmed collection unit: distinct physical designs, grouped by brand.** Owning one Suica design does not mark every Suica design as owned. Mobile cards are separate from this physical collection, even if their travel history is imported later.

The application will use Next.js, initialized with `create-next-app`, run as a single Node.js Docker container, and persist its data in SQLite on the TrueNAS server. There will be no accounts, login, or multi-user model.

## MVP scope

| Include | Defer |
| --- | --- |
| Responsive collection gallery, owned designs first | Apple Wallet or Suica history integration |
| Distinct designs grouped by brand | Interactive rail map and station visits |
| Mark owned / mark not owned, with undo | Tracking individual duplicate copies and condition |
| Search and collection filters | Prices, valuations, trading, and purchasing |
| Collection statistics | Automatic discovery of new card releases |
| Curated catalog covering nationwide and regional systems | Comprehensive catalog editing tools |
| Uniform local images for released catalog entries | Back-of-card photography for every design |
| Small “Add missing design” form with image upload | Native iPhone app, NFC reader, cloud synchronization |
| Docker Compose deployment, backup and restore instructions | Public hosting and authentication |

Optional acquisition date and notes fit within the MVP card details. Existing cards can be marked owned without knowing when they were acquired.

## Collection experience

### Home page

The page has four areas in this order:

1. **Header:** project name and an “Add missing design” action.
2. **Collection summary:** owned designs, brands represented, nationwide set progress, and regional coverage.
3. **Search and filters:** name search; brand, region, ownership, design type, and issuance/service status.
4. **Gallery:** “Owned” followed by “Missing,” with adjacent designs sorted by brand. A design appears in exactly one section.

The same brand can appear in both sections. Each tile shows its brand and design name. The brand filter includes owned/total counts and applies to both sections.

Default sorting is brand name, then standard designs before other editions, then design name. Offer “Recently added to my collection” as an alternate sort within the owned section. Search matches Japanese names, English names, romanized aliases, issuer, and edition title. Filters apply to both sections; retain them in the URL.

Global statistics remain global when filters change. Show a separate matching-results count above the gallery. This avoids a search making the collection total appear to shrink.

### Visual direction

Updated after mobile-use feedback: use a dark default theme, plain labels, compact statistics, and a single-column card layout on phones. Remove the marketing intro, decorative illustrations, taglines, and footer. Keep owned designs first and designs of the same brand adjacent; show the brand on each tile rather than dedicating a separate column to each brand.

Search and ownership tabs remain visible while scrolling. Additional filters and sorting open on demand. Use at least 44-pixel touch targets, 16-pixel form inputs, safe-area spacing, and full-screen card details on phones. Preserve keyboard access and do not rely on color alone to show ownership. Desktop uses the same compact interface with additional grid columns.

### Selecting and claiming a card

Selecting a tile opens an accessible details dialog on desktop or a full-screen detail view on mobile. It displays the larger image, brand and edition name, Japanese name, issuer, home region, compatibility category, issuance/service status, source links, and personal notes.

The primary action is **“Mark as owned”** or **“Mark as not owned.”** A successful change moves the card to the appropriate section, updates the statistics, and offers an undo notification. Keep the detail view open and preserve keyboard focus and scroll position as the gallery changes.

Use an explicit desired ownership state in the server request, rather than a blind toggle, so retries cannot reverse the change. Disable repeated submission while saving; if saving fails, restore the prior UI and show a retry option. Removing ownership retains notes and any acquisition date for easy correction.

The optional acquisition date remains blank unless entered. “Added to collection” is the time of marking ownership and must not be presented as the purchase date.

### Statistics

| Statistic | Definition |
| --- | --- |
| Designs owned | Number of distinct designs currently marked owned |
| Catalog completion | Owned designs / all visible collectible designs in this catalog version |
| Brands represented | Brands with at least one owned design / brands in the catalog |
| Nationwide ten | Number of the ten nationwide brands with at least one owned design, out of ten |
| Regions represented | Home regions represented by owned designs, out of the app’s eight regional groups |
| Recent additions | Most recently marked-owned designs, using recorded time rather than acquisition date |

Use eight explicit home-region groups: Hokkaido, Tohoku, Kanto, Chubu, Kansai, Chugoku, Shikoku, and Kyushu/Okinawa. Multi-region designs can contribute to multiple regions, while each design counts only once in the total. Home region refers to the issuer/design’s origin, not every place the card can be used. Custom entries with unknown region do not increase regional coverage.

Show per-brand owned/total counts in the brand filter. Completion measures **cataloged designs**, never every Japanese IC card. Adding catalog entries can increase the denominator; show the catalog version/date in an information panel. Retired designs remain collectible and count in overall completion.

## Catalog design and coverage

### What belongs in the catalog

The long-term target is all identifiable physical Japanese transport IC card designs, including regional cards outside nationwide interoperability, commemorative editions, tourist editions, and retired designs. This is a catalog-building effort as well as a software project. This design document does not establish an exhaustive inventory or a verified total.

The current catalog expands the original starter set to 357 designs/revisions across 95 brands using the three collector references. Its coverage inventory identifies included sources and remaining image gaps. The collection UI supports the full scope from day one, while catalog releases progressively expand coverage. “All cards” in the interface means all entries in the installed catalog.

| Catalog group | Initial coverage approach |
| --- | --- |
| Nationwide brands | Standard physical designs for Kitaca, Suica, PASMO, TOICA, manaca, ICOCA, PiTaPa, SUGOCA, nimoca, and Hayakaken |
| Regional systems | Include OKICA from the first release; audit regional rail and bus operators nationwide for further brands and designs |
| Regional partner cards | Include verified designs from JR East’s regional partner program, such as totra and odeca; give each marketed brand its own group |
| Special editions | Add identified tourist, commemorative, collaboration, and regional artwork variants under their relevant brands |
| Retired cards | Preserve verified historical designs, including PASPY examples, with clear status labels |

The ten-brand set is documented by [JR West’s interoperability guide](https://www.jr-odekake.net/icoca/area/). Regional partner cards combine local services with Suica functionality; they should not all be classified as local-only. [JR East’s regional card overview](https://www.jreast.co.jp/suica/corporate/regional.html/)

Okinawa’s OKICA is itself an IC card. The relevant distinction is nationwide interoperability, not whether it contains an IC chip. Yui Rail accepts OKICA and nationwide cards; that does not make OKICA a member of the nationwide ten. [Yui Rail card information](https://www.yui-rail.co.jp/ticketinfo-ticket/ticketinfo/okica/), [Yui Rail usage guide](https://www.yui-rail.co.jp/howto/guide/)

An ended transport service does not make a physical card irrelevant to a collector. PASPY’s official site documents service termination and different issuer artwork. [PASPY service notice](https://paspy.jp/news_20250303/)

### Design identity and metadata

A different printed artwork, issuer-specific face, or identifiable edition is a separate design. A personalized name, serial number, balance, or commuter-pass overprint alone does not create a new design. Reprints with indistinguishable artwork share an entry unless a collector-relevant physical difference is documented. Front artwork is the MVP identification method; meaningful reverse-only differences can be recorded with notes and supporting evidence.

Keep brand separate from network family: a regional Suica partner can have its own brand while sharing the Suica network. Store compatibility at the design/generation level because a brand can migrate systems over time. Use categories such as nationwide member, nationwide-compatible partner, regional-only, other, and unknown. Do not imply unrestricted use on every route from a compatibility badge.

Separate **issuance status** (current, discontinued, limited edition, unknown) from **service status** (active, retired, unknown). Stop-selling and stop-working are different events. Every researched entry records a source URL and verification date; uncertain information stays explicitly unknown.

### Images and catalog maintenance

Uniformity comes from consistent processing of authentic card images, not generated approximations of logos and Japanese lettering.

- Prefer the user’s scans/photos, permissioned issuer artwork, or appropriately licensed images. Track image provenance and reuse terms independently of factual sources; an image appearing on an issuer site does not establish permission to redistribute it.
- Normalize perspective, orientation, crop, and background; preserve the actual printed artwork and colors. Strip unnecessary image metadata and omit personal names and card identifiers.
- Produce consistent front-image masters, for example 1000 × 630, plus smaller thumbnails. Store optimized files locally; do not hotlink images at runtime.
- Use a reviewed card-front image where a source provides one. The expanded library retains explicitly listed historical or text-only designs without inventing artwork; these show an “Image needed” placeholder.
- Add catalog content through versioned data releases. Use stable IDs so renamed cards and improved pictures preserve ownership. Merge duplicate entries with explicit ID redirects rather than dropping personal data.

The MVP “Add missing design” form accepts a brand, design name, optional region/notes, and a front image. It uses the same image frame and database model. Advanced bulk editing and elaborate photo correction can follow later. Custom entries survive bundled catalog updates and can later be linked to an official catalog ID.

Before implementation release, complete a catalog audit: verify each included design, obtain its image, record provenance, and publish a coverage checklist. Exhaustive historical completeness remains an open research task, not an implied launch claim.

## Application architecture

| Layer | Proposed choice | Reason |
| --- | --- | --- |
| Framework | Next.js App Router, initialized using `create-next-app` | Matches the requested Node.js stack and keeps frontend/server together |
| Language and UI | TypeScript, Tailwind CSS, accessible dialog/form primitives | Consistent styling and maintainable interfaces |
| Server | Next.js Node runtime, Server Components for reads, Server Actions for mutations | One application process and no separate backend service |
| Persistence | SQLite with Drizzle ORM and `better-sqlite3` | Local file storage with typed queries and explicit migrations |
| Packaging | Multi-stage Docker image with Next.js standalone output | Deployable production artifact |
| Testing | Focused data tests and Playwright user-flow tests | Verify collection behavior and persistence |

Pin stable compatible dependency versions and a supported Node.js LTS version when implementation starts. Commit the package lockfile. Do not depend on a floating `latest` image for deployment. Drizzle documents support for the proposed SQLite driver. [Drizzle SQLite documentation](https://orm.drizzle.team/docs/sqlite/get-started-sqlite)

Next.js supports Node/Docker self-hosting and standalone output. Include public assets, static build assets, migrations, seed catalog, and the native SQLite dependency in the image; test the resulting image on the server’s CPU architecture. [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)

The browser communicates only with the app. Server code owns database access. Render collection state dynamically and invalidate affected views after mutations; never embed the live collection into a build-time snapshot. Refresh stale views when a tab regains focus. No Redis, separate database container, background queue, or hosted API is needed for the MVP.

Catalog images are downloaded into a separate mounted assets cache at startup. Normal collection use works without internet access once the cache is populated. Source URLs are needed for missing images; external factual links remain optional.

### Conceptual data model

| Entity | Main fields |
| --- | --- |
| Brand | Stable ID, display/Japanese names, aliases, issuer, network family, nationwide-ten membership |
| Card design | Stable ID, brand ID, edition name, aliases, design category, home regions, compatibility, issuance/service status, release date if known, source URL, verified date, bundled/custom origin |
| Image asset | ID, local path, dimensions, source/creator, rights/attribution, review status |
| Collection entry | Unique design ID, owned boolean, nullable acquisition date, added-to-collection timestamp, notes, updated timestamp |
| Catalog metadata | Installed catalog version and coverage description |
| Schema migrations | Applied migration versions |

There is no user table. A missing collection row means unowned. One collection row per design prevents duplicate counting; multiple physical copies are outside the MVP.

Catalog data and personal collection data remain separate tables even though they share a database. Seed on first launch; later catalog versions upsert metadata by stable ID without resetting ownership or notes. Keep archived designs addressable. Schema migration and catalog import are separate, transactional operations.

## TrueNAS deployment and persistence

The implementation deliverables will include a production Dockerfile, `docker-compose.yml`, configuration examples, and a short deployment/backup guide. This draft intentionally contains no implementation or Compose code.

Assume a Docker-capable TrueNAS edition. TrueNAS documents installing custom apps from Compose YAML; confirm the user’s exact TrueNAS version and CPU architecture before packaging. If the server uses an edition without this app runtime, a Linux VM running Docker is the fallback. [TrueNAS custom app deployment](https://apps.truenas.com/managing-apps/installing-custom-apps/)

The Compose deployment has one app service, a versioned prebuilt image, a configurable LAN host port mapped to container port 3000, an automatic restart policy, and a health check. Building the image is a separate documented step; the TrueNAS UI must not depend on a local source checkout or build context.

| Setting | Proposed value/behavior |
| --- | --- |
| Persistent mount | A dedicated host dataset, e.g. `/mnt/<pool>/apps/ic-cards`, mounted at `/data` |
| Database | `/data/collection.sqlite` |
| Personal images | `/data/uploads/` |
| Backups | `/data/backups/`, with copies/snapshots retained outside the live dataset |
| Runtime identity | Non-root UID/GID with write access to the mounted dataset |
| Application origin | Configured LAN URL/host; optional existing reverse proxy |
| Time handling | Timestamps stored consistently; dates displayed using Asia/Tokyo; acquisition dates stored as dates |

**Mount the directory, not just the SQLite file.** SQLite WAL mode creates adjacent journal/shared-memory files. The database must live on storage local to the TrueNAS host, directly bind-mounted into its container, rather than on an SMB/NFS mount. Use a single application replica, foreign-key enforcement, short write transactions, and a busy timeout. [SQLite WAL documentation](https://www.sqlite.org/wal.html)

On startup, validate data-directory permissions, apply migrations once, import any new bundled catalog version, and then report readiness. Migration failure leaves the app unready with a useful log; it must not silently start against a partially updated schema. An upgrade must preserve the mounted data and must not run a reset/reseed operation.

Back up using SQLite’s online backup mechanism, or stop the app and copy the data directory. Do not copy only the live main database while ignoring its WAL. Include uploaded images and catalog/schema version information. For a coordinated filesystem backup, stopping the small app during a TrueNAS snapshot is a simple option. Test restoring into an empty directory/container before declaring deployment complete. [SQLite backup documentation](https://sqlite.org/backup.html)

No login means anyone with network access to the app can edit the collection. Bind/expose it only on the intended local network. Mutating requests still require normal same-origin checks and server validation; no public port forwarding is part of this design. Uploaded files receive type/size checks and safe generated filenames. These measures do not introduce accounts.

## Later feature: Suica travel history

### Feasibility findings

An interactive visited-stations map is feasible independently of Wallet integration. Automatic Apple Wallet synchronization is not an established integration path for this project.

| Approach | Finding | Decision |
| --- | --- | --- |
| Browser/server reads Apple Wallet | No supported public Suica-history API identified in the reviewed documentation | Do not promise automatic sync |
| Native iOS companion with PassKit | Pass access is entitlement-limited; ordinary pass access does not establish access to another issuer’s journey ledger | A native app alone does not solve the problem |
| FinanceKit | Apple’s documented supported products/regions do not include Japanese Suica transit history | Not a usable route based on current documentation |
| JR East Suica app/member website | Provides history viewing; member site supports printing | Best candidate for a user-initiated import |
| Screenshot/OCR import | Technically plausible, but format and recognition quality need validation | Later fallback with review before saving |
| Manual station marking / app-defined CSV | Does not depend on Wallet APIs | Reliable first version |

The API conclusion is an assessment of the published interfaces, not proof that no private issuer integration exists. Apple documents restricted pass access and FinanceKit availability separately. [Apple Wallet documentation](https://developer.apple.com/documentation/passkit/wallet), [PassKit pass library](https://developer.apple.com/documentation/passkit/pkpasslibrary), [FinanceKit availability](https://developer.apple.com/financekit/)

For Apple Pay Suica, JR East documents up to 100 history entries within the preceding 26 weeks, through the previous day, in the Suica app/member site; the member site can print history. Exact behavior should be checked using the user’s own current setup before implementing an importer. Frequent use can push trips out of the 100-entry window before 26 weeks elapse. [JR East Apple Pay Suica history](https://www.jreast.co.jp/appsuica/use/sf/chk_account.html)

JR East also documents that some other operators’ station names can be masked. History therefore cannot be assumed to provide every station name or a complete lifetime travel record. [JR East history limitations](https://www.jreast.co.jp/mobilesuica/use/sf/chk_account.html)

### Recommended import workflow

1. Run a small feasibility investigation using an actual history sample from the user’s Apple Wallet Suica, checking whether that card is available through the Suica app/member site.
2. Prefer user-initiated printing to PDF or copied history text. Print support is documented; PDF text extraction and format stability still need testing. Do not assume JR East provides a CSV download or public API.
3. Parse locally into a review screen. Preserve raw station labels and source date, and distinguish rail travel from top-ups, purchases, refunds, and bus entries.
4. Match station aliases using operator and geographic context. Ask for a selection when a label is ambiguous or missing; never silently assign a common station name to the wrong city.
5. Save only confirmed visits. Record import provenance, allow correction, and support removal of an import batch without deleting visits supported by other evidence.

Store a hash to detect exact duplicate files. For overlapping exports, compare source/card alias, date, sequence where available, station labels, transaction type, and amounts/balance where supplied. Preserve legitimate repeated same-day trips; show uncertain duplicates for review instead of treating date plus endpoints as a unique journey ID.

Dates without times remain dates without invented timestamps. Imports should not require storing full card numbers or the user’s Apple/JR East credentials. Automated login/scraping is outside the proposed scope. History processing stays on the local server.

If regular import becomes useful, show the most recent successful import date and suggest a cadence based on usage. No schedule or automation is being created as part of this document.

## Later feature: interactive Japan rail map

### Data and rendering

Use **MapLibre GL JS** for a geographic map with line layers and station markers. It supports interactive vector/GeoJSON rendering. A geographically accurate view is the first target; a custom nationwide schematic is a separate design project. [MapLibre documentation](https://maplibre.org/maplibre-gl-js/docs/)

| Source | Role | Assessment |
| --- | --- | --- |
| MLIT National Land Numerical Information, N02 Railway | Primary nationwide route/station dataset | Recommended starting point |
| OpenStreetMap | Optional geography, detail, or coverage corrections | Useful supplement with separate provenance and attribution |
| Individual operator/open transit feeds | Targeted updates and station aliases | Optional enrichment, not a required nationwide dependency |

MLIT’s reviewed 2025 dataset represents passenger rail and tramway routes/stations as of 31 December 2025, including monorail classifications. It provides operator/line/station attributes and GeoJSON. Stations are line geometry, so derive suitable marker positions. Its stated license for recent editions is CC BY 4.0. Freight lines, private sidings, and ropeways are outside this starting scope. [MLIT N02 dataset and terms](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2025.html)

Thus “all rail lines” means all passenger lines in a documented dataset edition, including lines that do not accept Suica. Audit coverage against operators before describing it as complete, and preserve the dataset date in the UI. Update for openings, closures, and renamings rather than assuming the downloaded snapshot is live.

Preprocess the data into internal stations, lines, and line memberships. Convert coordinates as needed for the renderer, retain source IDs, and maintain an alias table for Japanese names, abbreviations, old names, and romanization. Use stable internal station IDs with versioned source mappings so an updated dataset cannot erase visit associations. Group interchange stations for display while preserving operator-specific records for matching.

Prototype with GeoJSON; measure mobile performance before choosing tiled output. If needed, package static vector tiles in a local archive. Serve map data, styles, glyphs, and any basemap locally to keep routine use independent of paid APIs. A minimal geographic backdrop is sufficient initially. Optional OpenStreetMap data carries its own attribution/ODbL terms; its public tile servers are not the proposed offline tile source. [OpenStreetMap licensing](https://www.openstreetmap.org/copyright)

### What a visit means

- Default “visited” means a confirmed entry station, exit station, or manually marked visit.
- Do not mark intermediate stations as visited simply because they lie between two endpoints.
- Endpoints do not establish the exact train, transfer pattern, route, or line ridden. Any inferred route must be labeled separately and excluded from confirmed travel statistics.
- Record evidence type: imported entry, imported exit, or manual. A station may have multiple evidence records but counts once in unique-station totals.
- Model station visits separately from line journeys. A visited interchange alone does not establish which of its lines was used.

The map shows muted unvisited stations, highlighted visited stations, search, region/operator/line filters, and a station panel with visit evidence and manual marking. At country scale, simplify lines and cluster or suppress station labels; reveal detail on zoom. Offer an accessible station list alongside the visual map.

Future statistics can include unique stations visited, prefectures with confirmed visits, and station coverage by line. Label the latter as stations visited on that line, not proof of riding the whole line. Historical/closed-station coverage can follow a later dataset review.

Future entities are station, station alias/source mapping, rail line, line-station membership, import batch, journey record, and visit evidence. Add them through migrations when that feature begins; the MVP does not need empty travel tables or a mapping dependency.

## Delivery sequence and acceptance

| Phase | Outcome |
| --- | --- |
| 1. Catalog preparation | Initial coverage inventory, stable design IDs, verified metadata, and image provenance |
| 2. Collection MVP | Next.js gallery, ownership actions, filters, stats, basic custom entries, SQLite persistence |
| 3. Local deployment | Production image, Compose file, TrueNAS guide, upgrade and restore verification |
| 4. Manual rail map | Nationwide dataset ingestion, station search, manual visits, geographic map |
| 5. History import investigation | Test actual Suica samples; document achievable fields and limitations |
| 6. Reviewed imports | Add the validated importer and matching/review workflow |

The collection MVP is ready when:

- A fresh deployment initializes the catalog without any account setup.
- Owned designs appear above unowned designs, grouped by brand; unowned images remain recognizable and selectable.
- Claiming, unclaiming, and undo update the gallery and all relevant statistics correctly.
- Ownership survives refresh, container replacement, and a catalog/schema upgrade.
- Every bundled design has a consistent image and traceable metadata; catalog gaps are stated.
- Search/filter combinations work with Japanese and English names; empty collection and no-results states are clear.
- A personal missing design can be added and survives later catalog updates.
- Save failures are visible, duplicate submissions are harmless, and keyboard/mobile operation works.
- Deployment uses one writable mounted data directory and a non-root process.
- A backup restores ownership, notes, custom entries, and uploaded images into a fresh deployment.

Verification will focus on those behaviors: ownership/state transitions and stats calculations, safe catalog updates, a browser flow for claim/unclaim/undo, and a real container persistence/restore exercise. No application tests are necessary for this documentation-only stage.

## Decisions still open

The collection unit is settled: **distinct designs grouped by brand**. The remaining choices do not block this draft:

- Project name and final visual theme; the collector’s album direction is the proposed default.
- Exact starter-catalog breadth. The goal includes all regional/historical designs, but a release needs an explicit researched coverage list rather than an unsupported total.
- Image sources for designs the user does not own; authentic, consistently presented images remain a release requirement.
- TrueNAS edition/version, CPU architecture, dataset path, LAN hostname, and available port before deployment.
- An actual Suica history sample and account-access check before committing to a specific importer.

The recommended first milestone is the collection app with a strong catalog and dependable local persistence. The rail map can then provide value with manual visits while history import is validated separately.
