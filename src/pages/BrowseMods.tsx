import { type ReactNode, useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Search,
  Download,
  Package,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  SlidersHorizontal,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { searchMods } from "@/lib/tauri";
import type { ModSearchResult, SearchSort, ModSource } from "@/lib/types";

// --- Constants ---

const PAGE_SIZE = 20;
const DEBOUNCE_DELAY_MS = 400;

const SORT_OPTIONS: readonly { value: SearchSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "downloads", label: "Downloads" },
  { value: "updated", label: "Recently Updated" },
  { value: "newest", label: "Newest" },
];

const LOADER_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "fabric", label: "Fabric" },
  { value: "forge", label: "Forge" },
  { value: "neoforge", label: "NeoForge" },
  { value: "quilt", label: "Quilt" },
];

const MC_VERSIONS: readonly string[] = [
  "1.21.5",
  "1.21.4",
  "1.21.3",
  "1.21.1",
  "1.20.6",
  "1.20.4",
  "1.20.1",
  "1.19.4",
  "1.19.2",
];

const SOURCE_BADGE_VARIANT: Record<
  ModSource,
  "success" | "warning" | "default"
> = {
  modrinth: "success",
  curseforge: "warning",
  local: "default",
};

// --- Helpers ---

function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

// --- Sub-components ---

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}): ReactNode {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="rounded-lg border border-border-default bg-surface-700 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ModCard({ mod }: { mod: ModSearchResult }): ReactNode {
  return (
    <Card hoverable className="flex items-start gap-4">
      {/* Icon */}
      {mod.icon_url !== undefined ? (
        <img
          src={mod.icon_url}
          alt={mod.name}
          className="h-12 w-12 shrink-0 rounded-lg object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-600">
          <Package size={20} className="text-zinc-500" />
        </div>
      )}

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-zinc-100">
            {mod.name}
          </h3>
          <Badge variant={SOURCE_BADGE_VARIANT[mod.source]}>{mod.source}</Badge>
        </div>
        <span className="text-xs text-zinc-500">by {mod.author}</span>
        <p className="line-clamp-2 text-xs text-zinc-600">{mod.description}</p>
        {mod.loaders.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {mod.loaders.map((loader) => (
              <span
                key={loader}
                className="rounded bg-surface-600 px-1.5 py-0.5 text-[10px] text-zinc-500"
              >
                {loader}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xs text-zinc-600">
          {formatDownloads(mod.downloads)}
        </span>
        <Button size="sm" variant="secondary" icon={<Download size={12} />}>
          Install
        </Button>
      </div>
    </Card>
  );
}

function Pagination({
  offset,
  limit,
  totalHits,
  onPageChange,
}: {
  offset: number;
  limit: number;
  totalHits: number;
  onPageChange: (newOffset: number) => void;
}): ReactNode {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(totalHits / limit));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <Button
        size="sm"
        variant="ghost"
        icon={<ChevronLeft size={14} />}
        disabled={!hasPrev}
        onClick={() => {
          onPageChange(offset - limit);
        }}
      >
        Previous
      </Button>
      <span className="text-xs text-zinc-500">
        Page {currentPage} of {totalPages}
      </span>
      <Button
        size="sm"
        variant="ghost"
        icon={<ChevronRight size={14} />}
        disabled={!hasNext}
        onClick={() => {
          onPageChange(offset + limit);
        }}
      >
        Next
      </Button>
    </div>
  );
}

// --- Main Component ---

export function BrowseMods(): ReactNode {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SearchSort>("relevance");
  const [loaderFilter, setLoaderFilter] = useState("");
  const [versionFilter, setVersionFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [offset, setOffset] = useState(0);

  const [results, setResults] = useState<ModSearchResult[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const debouncedQuery = useDebounce(query, DEBOUNCE_DELAY_MS);

  const doSearch = useCallback(
    async (searchOffset: number): Promise<void> => {
      setLoading(true);
      setError(undefined);
      try {
        const response = await searchMods({
          query: debouncedQuery,
          game_version: versionFilter !== "" ? versionFilter : undefined,
          loader: loaderFilter !== "" ? loaderFilter : undefined,
          category: undefined,
          sort: sortBy,
          offset: searchOffset,
          limit: PAGE_SIZE,
        });
        setResults(response.hits);
        setTotalHits(response.total_hits);
        setOffset(response.offset);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setResults([]);
        setTotalHits(0);
      } finally {
        setLoading(false);
      }
    },
    [debouncedQuery, sortBy, loaderFilter, versionFilter],
  );

  // Re-search when filters change (reset to page 1)
  useEffect(() => {
    doSearch(0);
  }, [doSearch]);

  const handlePageChange = useCallback(
    (newOffset: number): void => {
      doSearch(newOffset);
      // Scroll to top of results
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [doSearch],
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Browse Mods</h1>
        <p className="text-sm text-zinc-500">Search CurseForge and Modrinth</p>
      </div>

      {/* Search bar + filter toggle */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search mods..."
            icon={<Search size={16} />}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
          />
        </div>
        <Button
          variant={showFilters ? "secondary" : "ghost"}
          size="md"
          icon={<SlidersHorizontal size={16} />}
          onClick={() => {
            setShowFilters((prev) => !prev);
          }}
        >
          Filters
        </Button>
      </div>

      {/* Filters bar */}
      {showFilters && (
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border-default bg-surface-800 p-4">
          <FilterSelect
            label="Sort by"
            value={sortBy}
            options={SORT_OPTIONS}
            onChange={(v) => {
              setSortBy((v !== "" ? v : "relevance") as SearchSort);
            }}
          />
          <FilterSelect
            label="Loader"
            value={loaderFilter}
            options={LOADER_OPTIONS}
            onChange={setLoaderFilter}
          />
          <FilterSelect
            label="MC Version"
            value={versionFilter}
            options={MC_VERSIONS.map((v) => ({ value: v, label: v }))}
            onChange={setVersionFilter}
          />
          {(loaderFilter !== "" || versionFilter !== "") && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setLoaderFilter("");
                setVersionFilter("");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-accent" />
          <span className="ml-3 text-sm text-zinc-500">Searching mods...</span>
        </div>
      )}

      {/* Error */}
      {error !== undefined && !loading && (
        <Card className="border-red-900/30">
          <div className="flex items-center gap-3 p-4">
            <AlertCircle size={18} className="shrink-0 text-red-400" />
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium text-red-300">
                Search failed
              </span>
              <span className="text-xs text-zinc-500">{error}</span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                doSearch(offset);
              }}
            >
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* Results */}
      {!loading && error === undefined && (
        <>
          {/* Results count */}
          {results.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-600">
                {totalHits.toLocaleString()} results found
              </span>
            </div>
          )}

          {/* Mod list */}
          <div className="flex flex-col gap-3">
            {results.map((mod) => (
              <ModCard key={`${mod.source}-${mod.id}`} mod={mod} />
            ))}
          </div>

          {/* Empty state */}
          {results.length === 0 && debouncedQuery !== "" && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
              <Package size={40} className="mb-3 text-zinc-700" />
              <p className="text-sm">
                No mods found for &quot;{debouncedQuery}&quot;
              </p>
              <p className="text-xs text-zinc-700">
                Try different keywords or filters
              </p>
            </div>
          )}

          {/* Welcome state */}
          {results.length === 0 && debouncedQuery === "" && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
              <Search size={40} className="mb-3 text-zinc-700" />
              <p className="text-sm">Search for mods to get started</p>
              <p className="text-xs text-zinc-700">
                Results from CurseForge and Modrinth
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalHits > PAGE_SIZE && (
            <Pagination
              offset={offset}
              limit={PAGE_SIZE}
              totalHits={totalHits}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
}
