# Card catalog

The library contains **357 distinct designs/revisions across 95 brands**. It includes regional cards outside nationwide interoperability, commemorative and tourist editions, retired systems, and the restricted or experimental physical cards listed by the references.

## One local manifest

`catalog/cards.json` is the only application catalog manifest. Each entry contains its metadata and one local image path (or an empty path when no image is available). Pictures are served from the mounted `ASSETS_DIR` cache (default `assets/` locally, `/assets` in Docker), with descriptive paths such as `ayuca/ayuca-standard.png` and `toica/toica-piyorin.png`. Their browser URLs remain `/cards/<brand>/<filename>`. The startup downloader fetches only missing files from direct image URLs in `imageSourceUrl`. The browser reads the local cache. Source sites are needed to fill missing files, while already cached images work offline. No artwork is included in the public source tree or Docker build.

Scraping, comparison and deduplication files were temporary research artifacts. They are not part of the project or its Docker image. Future edits can be made directly to this manifest. IDs use lowercase card/edition names, with issuer or revision distinctions where needed. Keep these IDs stable when editing display labels. The 2026.10.29 release replaces source-derived IDs with descriptive IDs; `src/lib/catalog-id-migrations.ts` retains the old-to-new mapping for upgrades and restored backups. SQLite moves every personal field to the new ID and removes the obsolete catalog row in one transaction. Unrelated archived and custom cards are retained.

## Coverage checked on 2026-10-26

| Reference | Listings accounted for |
| --- | --- |
| [Eli Fessler’s Japanese IC cards](https://japan.elifessler.com/ic-cards/) | All 170 table entries, retaining intentional issuer/back revisions. |
| [Transit Cards — manaca & TOICA](https://transitcards.xyz/manaca-toica/) | All 37 pictured Japanese spreadsheet listings. Its landing-page count of 33 is outdated. Non-Japanese collections are outside this app’s scope. |
| [交通系ICカードpedia](https://jamfunk.jp/ic/メインページ) | 280 card records from 121 main-index entries, 91 existing detail pages, three index-only page targets, and explicitly named textual variants. All 44 variation bullets were accounted for; two were continuation notes, not extra designs. |

These 487 source records were reconciled with 131 duplicate/representative-front mappings. PiTaPa Basic from the original catalog adds one design that those records do not cover, giving 357 entries. The original 22 named IDs are retained; source-based IDs added by the import are migrated to descriptive names by the 2026.10.29 release.

Front-only references attach to a representative documented revision; that does not merge separately documented issuer/back variants. Identical fronts can therefore appear more than once, with the distinction explained in the card details. One Rinkai Suica revision match is unresolved because Eli’s newer revision is not explained; those source revisions remain separate pending evidence. Completion means this catalog, not every card ever issued in Japan.

Three physical MOBIRY DAYS keyring cards are included as labelled by the source. Non-card figurines, equipment illustrations, ordinary back images and duplicate depictions are excluded. The wiki’s mislabelled Fukushima back photograph was identified and merged with its front.

## Artwork

**324 entries have artwork references; 33 have an explicit “Image needed” placeholder.** There are 314 cache paths because some issuer/back revisions share the same front. Failed downloads also show the placeholder until the image is available. Missing artwork principally comes from text-only historical listings. Broken source links use alternate direct image files where available. PASMO and Kitaca use Eli’s raster fronts, and the 8000-series nimoca uses the issuer artwork reproduced on the 阪和線の沿線から blog. The downloader needs no per-card extraction instructions or PDF tools.

All currently referenced cache files are authentic raster fronts from collector references or issuers. No generated designs or fake vector wrappers are used. Rare historical scans vary in quality and some are low resolution. The UI keeps a consistent frame and contains each image without stretching or cropping the card.

Every pictured entry retains image provenance and credit. [Jamfunk’s reuse policy](https://jamfunk.jp/ic/著作権や商標について) requests credited republication and preferably a link; contributor credits and operator rights still matter. A broad open redistribution license has not been established for the other source artwork. Downloading images into a private cache does not grant new rights, and the application’s code license does not relicense the artwork.

## Metadata conventions

Catalog descriptions summarize the referenced observations in wording written for this project. Redundant source captions are omitted; card names, printed labels, issuer codes and other identifying facts remain intact. Source links and artwork credits are retained independently of the prose. Collector revision numbers are reference identifiers, not a claim that issuers use the same numbering.

- Regions describe the card’s originating issuer/marketed variant, not the collector’s purchase location or every place the card is accepted.
- Brand introduction and individual design introduction are separate. Collector acquisition/manufacturing dates are not launch dates.
- Issuance and transport-service status are separate. Collector evidence does not establish current factory production or stock. Unconfirmed values remain `Unknown`.
- Existing issuer-verified purchase information remains intact. Newly imported cards identify their originating operator; current sales locations and eligibility may be unverified. Official launch details are included where checked.
- Source links and revision notes are tucked into the detail panel. They help resolve similar-looking editions and check changing sales information, and cached collection use works offline on the LAN.
