"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  ExternalLink,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import {
  CATALOG_VERSION,
  CATEGORIES,
  REGIONS,
  statistics,
  type Card,
  type CollectionPatch,
} from "@/lib/types";

type Filters = {
  q: string;
  brand: string;
  region: string;
  category: string;
  issuance: string;
  service: string;
  ownership: string;
  sort: string;
};
const defaults: Filters = {
  q: "",
  brand: "",
  region: "",
  category: "",
  issuance: "",
  service: "",
  ownership: "",
  sort: "",
};
function readFilters(): Filters {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(
    Object.keys(defaults).map((key) => [key, params.get(key) || ""]),
  ) as Filters;
}
function Art({ card, large = false }: { card: Card; large?: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <div
      className={`card-art ${large ? "large" : ""}`}
      style={{ "--brand-color": card.color } as CSSProperties}
    >
      {card.image && !broken ? (
        <img
          src={card.image}
          alt={`${card.brand} — ${card.name} card front`}
          loading={large ? "eager" : "lazy"}
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="missing-art">
          <CreditCard size={32} />
          <strong>{card.brand}</strong>
          <span>Image needed</span>
        </div>
      )}
    </div>
  );
}
function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
  onCloseFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
  onCloseFocus?: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal ${wide ? "wide" : ""}`}
          onCloseAutoFocus={(event) => {
            if (onCloseFocus) {
              event.preventDefault();
              onCloseFocus();
            }
          }}
        >
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={21} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function External({ href, children }: { href?: string; children: ReactNode }) {
  if (!href || !/^https?:\/\//.test(href)) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children} <ExternalLink size={12} />
    </a>
  );
}

export default function Collection({ initialCards }: { initialCards: Card[] }) {
  const [cards, setCards] = useState(initialCards);
  const [filters, setFilters] = useState<Filters>(defaults);
  const [advanced, setAdvanced] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [about, setAbout] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mutationVersion = useRef(0);
  const [toast, setToast] = useState<{
    message: string;
    error?: boolean;
    undo?: { id: string; owned: boolean };
  } | null>(null);
  const lastSelected = useRef<string | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const aboutButton = useRef<HTMLButtonElement>(null);
  const galleryHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setFilters(readFilters());
    const pop = () => setFilters(readFilters());
    const refresh = async () => {
      if (busyRef.current) return;
      const version = mutationVersion.current;
      try {
        const response = await fetch("/api/cards", { cache: "no-store" });
        if (response.ok) {
          const next = await response.json();
          if (!busyRef.current && version === mutationVersion.current)
            setCards(next);
        }
      } catch {
        /* Keep the current collection visible until the next refresh. */
      }
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  function filter(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next))
      if (value) params.set(key, value);
    window.history.replaceState(
      null,
      "",
      params.size ? `?${params}` : window.location.pathname,
    );
  }
  async function save(
    id: string,
    patch: CollectionPatch,
    offerUndo = true,
  ): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    mutationVersion.current++;
    const previous = cards.find((c) => c.id === id)!;
    try {
      const response = await fetch(`/api/cards/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setCards((current) => current.map((c) => (c.id === id ? result : c)));
      setToast({
        message:
          patch.owned === undefined
            ? "Your notes are saved."
            : patch.owned
              ? `${previous.brand} added to your collection.`
              : `${previous.brand} marked as not owned.`,
        undo:
          offerUndo && patch.owned !== undefined
            ? { id, owned: previous.owned }
            : undefined,
      });
      return true;
    } catch (error) {
      setToast({
        message:
          error instanceof Error
            ? error.message
            : "Could not save. Please try again.",
        error: true,
      });
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const stats = statistics(cards);
  const brands = useMemo(
    () =>
      [...new Set(cards.map((c) => c.brand))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [cards],
  );
  const active = cards.find((c) => c.id === selected);
  const matching = cards.filter((c) => {
    const text =
      `${c.brand} ${c.name} ${c.japaneseName} ${c.aliases} ${c.issuer} ${c.region}`
        .normalize("NFKC")
        .toLowerCase();
    return (
      text.includes(filters.q.normalize("NFKC").trim().toLowerCase()) &&
      (!filters.brand || c.brand === filters.brand) &&
      (!filters.region || c.region === filters.region) &&
      (!filters.category || c.category === filters.category) &&
      (!filters.issuance || c.issuance === filters.issuance) &&
      (!filters.service || c.service === filters.service) &&
      (!filters.ownership ||
        (filters.ownership === "owned" ? c.owned : !c.owned))
    );
  });
  const hasFilters = Object.entries(filters).some(
    ([k, v]) => k !== "sort" && !!v,
  );
  function section(owned: boolean) {
    const subset = matching.filter((c) => c.owned === owned);
    if (!subset.length && (hasFilters || !owned)) return null;
    const groupNames = [...new Set(subset.map((c) => c.brand))].sort((a, b) => {
      if (owned && filters.sort === "recent") {
        const newest = (brand: string) =>
          Math.max(
            ...subset
              .filter((c) => c.brand === brand)
              .map((c) => Date.parse(c.addedAt || "1970-01-01")),
          );
        return newest(b) - newest(a) || a.localeCompare(b);
      }
      return a.localeCompare(b);
    });
    return (
      <section
        className="gallery-section"
        aria-label={owned ? "My collection" : "Still to collect"}
      >
        <div className="section-heading">
          <h2>{owned ? "Owned" : "Missing"}</h2>
          <span>{subset.length}</span>
        </div>
        {!subset.length ? (
          <p className="empty-collection">Tap a card to mark it as owned.</p>
        ) : (
          <div className="card-grid">
            {groupNames.flatMap((brand) =>
              subset
                .filter((c) => c.brand === brand)
                .sort((a, b) =>
                  owned && filters.sort === "recent"
                    ? (b.addedAt || "").localeCompare(a.addedAt || "")
                    : Number(b.category === "Standard") -
                        Number(a.category === "Standard") ||
                      a.name.localeCompare(b.name),
                )
                .map((card) => (
                  <button
                    key={card.id}
                    id={`card-${card.id}`}
                    data-testid={`card-${card.id}`}
                    className={`card-tile ${owned ? "is-owned" : "is-missing"}`}
                    onClick={() => {
                      lastSelected.current = card.id;
                      setSelected(card.id);
                    }}
                    aria-label={`View ${card.brand} ${card.name}`}
                  >
                    <Art card={card} />
                    <div className="tile-copy">
                      <div className="tile-brand">
                        <h3>{card.brand}</h3>
                        {owned && <Check size={15} aria-label="Owned" />}
                      </div>
                      <p>{card.name}</p>
                    </div>
                  </button>
                )),
            )}
          </div>
        )}
      </section>
    );
  }

  const notification = toast && (
    <div
      className={`toast ${toast.error ? "error" : ""}`}
      role={toast.error ? "alert" : "status"}
    >
      <span>
        {toast.error ? <CircleHelp size={18} /> : <Check size={18} />}
        {toast.message}
      </span>
      {toast.undo && (
        <button
          disabled={busy}
          onClick={() => {
            const undo = toast.undo!;
            void save(undo.id, { owned: undo.owned }, false);
          }}
        >
          Undo
        </button>
      )}
      <button aria-label="Dismiss notification" onClick={() => setToast(null)}>
        <X size={16} />
      </button>
    </div>
  );
  return (
    <>
      <header className="site-header">
        <h1 ref={galleryHeading} tabIndex={-1}>
          IC cards
        </h1>
        <div className="header-actions">
          <button
            ref={aboutButton}
            className="icon-button"
            aria-label="About the catalog"
            onClick={() => setAbout(true)}
          >
            <CircleHelp size={20} />
          </button>
          <button
            ref={addButton}
            className="button primary"
            aria-label="Add missing design"
            onClick={() => setAdding(true)}
          >
            <Plus size={18} /> Add
          </button>
        </div>
      </header>
      <main>
        <section className="stats" aria-label="Collection statistics">
          <div>
            <span>
              <strong data-testid="owned-count">{stats.owned}</strong> /{" "}
              {stats.total}
            </span>
            <small>Owned</small>
          </div>
          <div>
            <span>
              <strong>{stats.brands}</strong> / {stats.totalBrands}
            </span>
            <small>Brands</small>
          </div>
          <div>
            <span>
              <strong>{stats.nationwide}</strong> / 10
            </span>
            <small>Nationwide</small>
          </div>
          <div>
            <span>
              <strong>{stats.regions}</strong> / 8
            </span>
            <small>Regions</small>
          </div>
        </section>
        <div className="browse-controls">
          <div className="search-row">
            <label className="search">
              <Search size={18} />
              <input
                type="search"
                aria-label="Search cards"
                placeholder="Search cards"
                value={filters.q}
                onChange={(e) => filter({ q: e.target.value })}
              />
              {filters.q && (
                <button
                  aria-label="Clear search"
                  onClick={() => filter({ q: "" })}
                >
                  <X size={18} />
                </button>
              )}
            </label>
            <button
              className={`icon-button filter-toggle ${advanced ? "active" : ""}`}
              aria-label="Filters"
              aria-expanded={advanced}
              aria-controls="card-filters"
              onClick={() => setAdvanced(!advanced)}
            >
              <SlidersHorizontal size={20} />
              {(filters.brand ||
                filters.region ||
                filters.category ||
                filters.issuance ||
                filters.service ||
                filters.sort) && <i className="filter-dot" />}
            </button>
          </div>
          <div className="segmented" aria-label="Ownership filter">
            {[
              ["", "All", stats.total],
              ["owned", "Owned", stats.owned],
              ["missing", "Missing", stats.total - stats.owned],
            ].map(([value, label, count]) => (
              <button
                key={value}
                aria-pressed={filters.ownership === value}
                className={filters.ownership === value ? "active" : ""}
                onClick={() => filter({ ownership: String(value) })}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>
        </div>
        {advanced && (
          <div className="filters-panel" id="card-filters">
            <div className="filter-fields">
              <label>
                Region
                <select
                  aria-label="Region"
                  value={filters.region}
                  onChange={(e) => filter({ region: e.target.value })}
                >
                  <option value="">All regions</option>
                  {REGIONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                  <option>Unknown</option>
                </select>
              </label>
              <label>
                Brand
                <select
                  aria-label="Brand"
                  value={filters.brand}
                  onChange={(e) => filter({ brand: e.target.value })}
                >
                  <option value="">All brands</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b} (
                      {cards.filter((c) => c.brand === b && c.owned).length}/
                      {cards.filter((c) => c.brand === b).length})
                    </option>
                  ))}
                </select>
              </label>
              {(
                [
                  ["category", "Design type", CATEGORIES],
                  [
                    "issuance",
                    "Issuance",
                    ["Current", "Discontinued", "Limited edition", "Unknown"],
                  ],
                  ["service", "Service", ["Active", "Retired", "Unknown"]],
                ] as const
              ).map(([key, label, options]) => (
                <label key={key}>
                  {label}
                  <select
                    aria-label={label}
                    value={filters[key]}
                    onChange={(e) => filter({ [key]: e.target.value })}
                  >
                    <option value="">All</option>
                    {options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                Sort
                <select
                  aria-label="Sort cards"
                  value={filters.sort}
                  onChange={(e) => filter({ sort: e.target.value })}
                >
                  <option value="">Brand A–Z</option>
                  <option value="recent">Recently collected</option>
                </select>
              </label>
            </div>
            <div className="filter-actions">
              <button
                className="button secondary"
                onClick={() => filter(defaults)}
              >
                Reset filters
              </button>
              <button
                className="button primary"
                onClick={() => setAdvanced(false)}
              >
                Done
              </button>
            </div>
          </div>
        )}
        {hasFilters && (
          <div className="results-line">
            <span>
              {matching.length} {matching.length === 1 ? "design" : "designs"}
            </span>
            <button onClick={() => filter(defaults)}>Clear filters</button>
          </div>
        )}
        {!matching.length && (
          <div className="no-results">
            <h2>No cards found.</h2>
            <button
              className="button secondary"
              onClick={() => filter(defaults)}
            >
              Show all cards
            </button>
          </div>
        )}
        {section(true)}
        {section(false)}
      </main>
      <Modal
        open={!!active}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={active ? `${active.brand} · ${active.name}` : "Card details"}
        description={active?.japaneseName || "Card details"}
        wide
        onCloseFocus={() => {
          const button = document.getElementById(
            `card-${lastSelected.current}`,
          );
          (button || galleryHeading.current)?.focus({ preventScroll: true });
        }}
      >
        {active && (
          <CardDetails key={active.id} card={active} busy={busy} save={save} />
        )}
        {notification}
      </Modal>
      <Modal
        open={adding}
        onOpenChange={(open) => {
          if (!busy) setAdding(open);
        }}
        title="Add design"
        description="Add a design that is not in the catalog."
        onCloseFocus={() => addButton.current?.focus()}
      >
        {adding && (
          <AddDesign
            brands={brands}
            busy={busy}
            onSubmit={async (form) => {
              if (busyRef.current) return;
              busyRef.current = true;
              setBusy(true);
              mutationVersion.current++;
              try {
                const response = await fetch("/api/cards", {
                  method: "POST",
                  body: form,
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                setCards((current) => [...current, result]);
                setAdding(false);
                lastSelected.current = result.id;
                setSelected(result.id);
                setToast({
                  message: "Design added. You can now mark it as owned.",
                });
              } catch (error) {
                setToast({
                  message:
                    error instanceof Error
                      ? error.message
                      : "Could not add this design. Please try again.",
                  error: true,
                });
              } finally {
                busyRef.current = false;
                setBusy(false);
              }
            }}
          />
        )}
        {notification}
      </Modal>
      <Modal
        open={about}
        onOpenChange={setAbout}
        title="About the catalog"
        description={`Catalog · ${CATALOG_VERSION}`}
        onCloseFocus={() => aboutButton.current?.focus()}
      >
        <div className="about-content">
          <p>
            {stats.total} designs across {stats.totalBrands} brands, including
            regional, commemorative and retired cards.
          </p>
          <p>
            Distinct front and back revisions count separately. Regions refer
            to a card’s origin. The nationwide total counts brands, not designs.
          </p>
          <p>
            Card details include purchase information, availability, and artwork
            credits. Some references have no photo or confirmed sales status.
            Check the issuer’s website for current stock.
          </p>
          <h3>References</h3>
          <div className="source-links">
            <External href="https://transitcards.xyz/">
              Transit card design index
            </External>
            <External href="https://japan.elifessler.com/ic-cards/">
              Eli’s Japanese IC card catalog
            </External>
            <External href="https://jamfunk.jp/ic/メインページ">
              交通系ICカードpedia
            </External>
          </div>
          <p className="local-note">
            Data is stored on this server. Anyone with access to the app can
            edit the collection.
          </p>
        </div>
      </Modal>
      {!active && !adding && notification}
    </>
  );
}

function CardDetails({
  card,
  busy,
  save,
}: {
  card: Card;
  busy: boolean;
  save: (
    id: string,
    patch: CollectionPatch,
    undo?: boolean,
  ) => Promise<boolean>;
}) {
  const [notes, setNotes] = useState(card.notes);
  const [date, setDate] = useState(card.acquiredDate || "");
  const dirty = notes !== card.notes || date !== (card.acquiredDate || "");
  return (
    <div className="detail-body">
      <div className="detail-visual">
        <Art card={card} large />
        <div className="detail-chips">
          <span className={card.owned ? "chip green" : "chip"}>
            {card.owned ? <Check size={13} /> : <Plus size={13} />}
            {card.owned ? "In your collection" : "Still to collect"}
          </span>
          <span className="chip">{card.category}</span>
        </div>
        <button
          className={`button full ${card.owned ? "secondary" : "primary"}`}
          disabled={busy}
          onClick={() => void save(card.id, { owned: !card.owned })}
        >
          {busy ? (
            "Saving…"
          ) : card.owned ? (
            "Mark as not owned"
          ) : (
            <>
              <Plus size={17} /> Mark as owned
            </>
          )}
        </button>
      </div>
      <div className="detail-info">
        <h3>Card information</h3>
        <dl className="card-facts">
          <div>
            <dt>Home region</dt>
            <dd>{card.region}</dd>
          </div>
          <div>
            <dt>Issued by</dt>
            <dd>{card.issuer}</dd>
          </div>
          <div>
            <dt>Brand introduced</dt>
            <dd>{card.brandIntroduced || "Unknown"}</dd>
          </div>
          <div>
            <dt>Design introduced</dt>
            <dd>{card.designIntroduced || "Unknown"}</dd>
          </div>
          <div>
            <dt>Issuance / production</dt>
            <dd>{card.issuance}</dd>
          </div>
          <div>
            <dt>Transport service</dt>
            <dd>{card.service}</dd>
          </div>
          <div>
            <dt>Compatibility</dt>
            <dd>{card.compatibility}</dd>
          </div>
        </dl>
        <div className="purchase-info">
          <h4>
            <MapPin size={15} /> Where to find it
          </h4>
          <p>
            {card.purchaseLocations ||
              "Purchase locations have not been verified for this design."}
          </p>
          {card.availabilityNote && (
            <p className="availability-note">{card.availabilityNote}</p>
          )}
          <External href={card.purchaseUrl || card.sourceUrl}>
            {card.purchaseUrl ? "Check with the issuer" : "View collector reference"}
          </External>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save(card.id, { notes, acquiredDate: date || null }, false);
          }}
          className="personal-form"
        >
          <h3>Notes</h3>
          <label>
            Acquired on <span className="optional">optional</span>
            <input
              type="date"
              aria-label="Acquired on"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Collection notes{" "}
            <textarea
              maxLength={5000}
              rows={3}
              placeholder="Collection notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <button
            className="button secondary"
            type="submit"
            disabled={busy || !dirty}
          >
            {busy ? "Saving…" : "Save notes"}
          </button>
        </form>
        <details className="provenance">
          <summary>
            Sources & artwork credits <ChevronDown size={14} />
          </summary>
          {card.variantDetails && <p>{card.variantDetails}</p>}
          <p>
            {card.verifiedDate
              ? `Metadata checked ${card.verifiedDate}.`
              : card.catalogedDate
                ? `Cataloged from collector references ${card.catalogedDate}. Current sales and stock may be unverified.`
                : "Personal entry; metadata not independently verified."}
          </p>
          <div className="source-links">
            <External href={card.sourceUrl}>Card reference</External>
            {(card.metadataSources || [])
              .filter(
                (url) => url !== card.sourceUrl && url !== card.purchaseUrl,
              )
              .map((url, i) => (
                <External key={url} href={url}>
                  Additional source {i + 1}
                </External>
              ))}
            <External href={card.imageSourceUrl}>Artwork source</External>
          </div>
          <p>{card.imageCredit}</p>
          <p>{card.imageLicense}</p>
        </details>
      </div>
    </div>
  );
}
function AddDesign({
  brands,
  busy,
  onSubmit,
}: {
  brands: string[];
  busy: boolean;
  onSubmit: (form: FormData) => Promise<void>;
}) {
  const [preview, setPreview] = useState("");
  const previewUrl = useRef("");
  useEffect(() => () => URL.revokeObjectURL(previewUrl.current), []);
  function changePhoto(file?: File) {
    const url = file ? URL.createObjectURL(file) : "";
    URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = url;
    setPreview(url);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit(new FormData(event.currentTarget));
  }
  return (
    <form className="add-form" onSubmit={submit}>
      <label className="upload-box">
        {preview ? (
          <img src={preview} alt="New card preview" />
        ) : (
          <>
            <Upload size={27} />
            <strong>Add a card-front photo</strong>
            <span>JPEG, PNG or WebP · up to 5 MB</span>
          </>
        )}
        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Card front image"
          onChange={(e) => changePhoto(e.target.files?.[0])}
        />
      </label>
      <div className="form-row">
        <label>
          Brand
          <input
            required
            maxLength={80}
            name="brand"
            list="brands"
            placeholder="e.g. Suica"
          />
          <datalist id="brands">
            {brands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </label>
        <label>
          Design name
          <input
            required
            maxLength={160}
            name="name"
            placeholder="e.g. Anniversary edition"
          />
        </label>
      </div>
      <label>
        Japanese name <span className="optional">optional</span>
        <input name="japaneseName" maxLength={100} placeholder="日本語の名前" />
      </label>
      <div className="form-row">
        <label>
          Home region
          <select aria-label="Home region" name="region" defaultValue="Unknown">
            <option>Unknown</option>
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          Design type
          <select aria-label="Design type" name="category">
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Notes <span className="optional">optional</span>
        <textarea
          name="notes"
          maxLength={5000}
          rows={3}
          placeholder="Collection notes"
        />
      </label>
      <p className="form-hint">
        Use a photo you have permission to use, without personal names or card
        numbers. You can mark the design as owned after adding it.
      </p>
      <button className="button primary full" disabled={busy}>
        {busy ? (
          "Adding design…"
        ) : (
          <>
            <Plus size={17} /> Add to catalog
          </>
        )}
      </button>
    </form>
  );
}
