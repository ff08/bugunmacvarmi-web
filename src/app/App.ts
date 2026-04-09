import type { Match, SheetSource } from "../lib/sheets";
import { fetchMatchesFromSheet } from "../lib/sheets";
import { getGMTOffsetLabel } from "../lib/time";
import { isFresh, readCache, writeCache } from "../lib/cache";
import { renderPoliciesPage } from "./policies";

type AppState = {
  loading: boolean;
  error: string | null;
  matches: Match[];
  filter: string;
  showPast: boolean;
  lastUpdated: number | null;
  usedCache: boolean;
  sport: SportKey;
  view: ViewKey;
  theme: ThemeKey;
};

type SportKey = "football" | "basketball";
type ViewKey = "matches" | "policies";
type ThemeKey = "light" | "dark";

const SOURCES: Record<SportKey, { label: string; sheet: SheetSource }> = {
  football: {
    label: "Futbol",
    sheet: { sheetId: "1BPzyNLclxAvhNg2t4puSyrA-VLGb_RuFqPmdr5PheBg", gid: "0" },
  },
  basketball: {
    label: "Basketbol",
    sheet: { sheetId: "1BPzyNLclxAvhNg2t4puSyrA-VLGb_RuFqPmdr5PheBg", gid: "48872055" },
  },
};

function cacheKeyForSport(sport: SportKey): string {
  return `bmv:matches:v1:${sport}`;
}

const CACHE_TTL_MS = 2 * 60 * 1000;
const PAST_THRESHOLD_MIN = 90;

function splitCurrentPast(matches: Match[], now = new Date()): { current: Match[]; past: Match[] } {
  const threshold = now.getTime() - PAST_THRESHOLD_MIN * 60 * 1000;
  const current: Match[] = [];
  const past: Match[] = [];

  for (const m of matches) {
    if (m.date.getTime() > threshold) current.push(m);
    else past.push(m);
  }

  current.sort((a, b) => a.date.getTime() - b.date.getTime());
  past.sort((a, b) => a.date.getTime() - b.date.getTime());
  return { current, past };
}

function normalizeForSearch(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replaceAll("İ", "i")
    .replaceAll("I", "ı")
    .trim();
}

function matchPassesFilter(m: Match, q: string): boolean {
  if (!q) return true;
  const hay = normalizeForSearch(`${m.teams} ${m.channel}`);
  return hay.includes(q);
}

function fmtLastUpdated(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

type CookieConsent = { choice: "accepted" | "rejected"; at: number };
const COOKIE_KEY = "bmv:cookie-consent:v1";
const THEME_KEY = "bmv:theme:v1";

function readCookieConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(COOKIE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    if (!parsed || (parsed.choice !== "accepted" && parsed.choice !== "rejected") || typeof parsed.at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCookieConsent(choice: CookieConsent["choice"]): void {
  try {
    localStorage.setItem(COOKIE_KEY, JSON.stringify({ choice, at: Date.now() } satisfies CookieConsent));
  } catch {
    // ignore
  }
}

function readTheme(): ThemeKey | null {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "light" || raw === "dark") return raw;
    return null;
  } catch {
    return null;
  }
}

function writeTheme(theme: ThemeKey): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

function applyTheme(theme: ThemeKey): void {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

function clearCookieConsent(): void {
  try {
    localStorage.removeItem(COOKIE_KEY);
  } catch {
    // ignore
  }
}

function viewFromHash(hash: string): ViewKey {
  const h = (hash || "").toLowerCase();
  if (h.startsWith("#/politikalar")) return "policies";
  return "matches";
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSkeletonCards(count = 6): string {
  return Array.from({ length: count })
    .map(
      () => `
      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div class="h-5 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
        <div class="mt-3 flex items-center gap-3">
          <div class="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
          <div class="h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
        </div>
      </div>
    `,
    )
    .join("");
}

function renderCards(matches: Match[]): string {
  return matches
    .map((m) => {
      const time = m.timeLocal || m.timeTR;
      return `
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div class="text-base font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(m.teams)}</div>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span class="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">${escapeHtml(
              time,
            )}</span>
            <span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800 dark:text-slate-200">${escapeHtml(m.channel)}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderTable(matches: Match[]): string {
  return `
    <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table class="w-full border-collapse text-left text-sm">
        <thead class="bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <tr>
            <th class="p-3 font-semibold">Takımlar</th>
            <th class="p-3 font-semibold">Saat</th>
            <th class="p-3 font-semibold">Kanal</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
          ${matches
            .map((m) => {
              const time = m.timeLocal || m.timeTR;
              return `
                <tr class="hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30">
                  <td class="p-3 text-slate-900 dark:text-slate-100">${escapeHtml(m.teams)}</td>
                  <td class="p-3 text-slate-700 dark:text-slate-300">${escapeHtml(time)}</td>
                  <td class="p-3 text-slate-700 dark:text-slate-300">${escapeHtml(m.channel)}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderState(root: HTMLElement, state: AppState): void {
  const now = new Date();
  const q = normalizeForSearch(state.filter);

  const filtered = state.matches.filter((m) => matchPassesFilter(m, q));
  const { current, past } = splitCurrentPast(filtered, now);

  const tz = getGMTOffsetLabel(now);
  const lastUpdatedText = state.lastUpdated ? fmtLastUpdated(state.lastUpdated) : "—";

  const sportLabel = SOURCES[state.sport].label;
  const consent = readCookieConsent();
  const showCookieModal = !consent;

  root.innerHTML = `
    <div class="min-h-screen">
      <header class="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div class="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div class="flex items-baseline gap-3">
              <div class="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Bugün Maç Var mı?</div>
            </div>
            <div class="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              <span class="font-medium">${escapeHtml(sportLabel)}</span> — maç saatleri yerel saatinize göre listelenir. <span class="font-medium">(${tz})</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            ${
              state.view === "matches"
                ? `
                  <div class="hidden sm:block">
                    <input
                      id="filterInput"
                      value="${escapeHtml(state.filter)}"
                      placeholder="Takım veya kanal ara…"
                      class="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>
                `
                : ""
            }
            <div class="inline-flex rounded-lg border border-slate-300 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              ${(
                Object.keys(SOURCES) as SportKey[]
              )
                .map((k) => {
                  const active = state.sport === k;
                  return `
                    <button
                      type="button"
                      data-sport="${k}"
                      class="${
                        active
                          ? "bg-indigo-600 text-white"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      } rounded-md px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      aria-pressed="${active ? "true" : "false"}"
                    >
                      ${escapeHtml(SOURCES[k].label)}
                    </button>
                  `;
                })
                .join("")}
            </div>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-5xl px-4 py-5">
        ${
          state.view === "matches"
            ? `
              <div class="flex items-center justify-between">
                <div class="sm:hidden">
                  <input
                    id="filterInput"
                    value="${escapeHtml(state.filter)}"
                    placeholder="Takım veya kanal ara…"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
                <div class="sm:hidden">
                  <a href="#/politikalar" class="text-sm font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-slate-100">Politikalar</a>
                </div>
              </div>
            `
            : `
              <div class="sm:hidden">
                <a href="#/" class="text-sm font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-slate-100">← Maçlara dön</a>
              </div>
            `
        }

        ${
          state.error
            ? `
              <div class="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
                <div class="font-semibold">Veri yüklenemedi</div>
                <div class="mt-1">${escapeHtml(state.error)}</div>
              </div>
            `
            : ""
        }

        ${
          state.view === "policies"
            ? renderPoliciesPage()
            : `
        <section class="mt-5">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-slate-900">Güncel Maçlar</h2>
            <div class="text-sm text-slate-600">${state.loading ? "Yükleniyor…" : `${current.length} maç`}</div>
          </div>

          <div class="mt-3 grid gap-3 sm:hidden" aria-busy="${state.loading ? "true" : "false"}">
            ${
              state.loading
                ? renderSkeletonCards()
                : current.length
                  ? renderCards(current)
                  : `<div class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">Bugün için maç bulunamadı.</div>`
            }
          </div>

          <div class="mt-3 hidden sm:block">
            ${
              state.loading
                ? `<div class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">Yükleniyor…</div>`
                : current.length
                  ? renderTable(current)
                  : `<div class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">Bugün için maç bulunamadı.</div>`
            }
          </div>
        </section>

        <section class="mt-6">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 class="text-base font-semibold text-slate-900">Geçmiş Maçlar</h2>
            <button
              id="togglePastBtn"
              class="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              aria-expanded="${state.showPast ? "true" : "false"}"
            >
              ${state.showPast ? "Geçmiş Maçları Gizle" : "Geçmiş Maçları Göster"}
            </button>
          </div>

          ${
            state.showPast
              ? `
                <div class="mt-3 grid gap-3 sm:hidden">
                  ${
                    past.length
                      ? renderCards(past)
                      : `<div class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">Geçmiş maç yok.</div>`
                  }
                </div>
                <div class="mt-3 hidden sm:block">
                  ${
                    past.length
                      ? renderTable(past)
                      : `<div class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">Geçmiş maç yok.</div>`
                  }
                </div>
              `
              : ""
          }
        </section>
        `
        }
      </main>

      <footer class="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div class="mx-auto max-w-5xl px-4 py-4">
          <nav class="mb-2 flex items-center gap-3 text-xs font-semibold">
            <a
              href="#/"
              class="${state.view === "matches" ? "text-slate-900 dark:text-slate-100" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}"
            >
              Maçlar
            </a>
            <span class="text-slate-300 dark:text-slate-700">•</span>
            <a
              href="#/politikalar"
              class="${state.view === "policies" ? "text-slate-900 dark:text-slate-100" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}"
            >
              Politikalar
            </a>
          </nav>
          <div class="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div>
              Son güncelleme: <span class="font-medium text-slate-700 dark:text-slate-200">${escapeHtml(lastUpdatedText)}</span>
              ${
                state.usedCache
                  ? `<span class="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Önbellek</span>`
                  : ""
              }
            </div>
            <div class="flex items-center justify-between gap-3 sm:justify-end">
              <div class="hidden sm:block">Saat dönüşümü cihazınızın yerel saat dilimine göre yapılır.</div>
              <button
                id="themeToggle"
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                aria-label="Tema değiştir"
              >
                ${state.theme === "dark" ? "Açık Mod" : "Koyu Mod"}
              </button>
            </div>
          </div>
          <div class="mt-2 text-xs text-slate-500 sm:hidden">
            Saat dönüşümü cihazınızın yerel saat dilimine göre yapılır.
          </div>
        </div>
      </footer>
    </div>

    ${
      showCookieModal
        ? `
          <div class="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-4 sm:pb-4">
            <div class="pointer-events-auto mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
              <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div class="text-sm text-slate-700">
                  <div class="font-semibold text-slate-900 dark:text-slate-100">Çerez Politikası</div>
                  <div class="mt-1 text-slate-600">
                    Deneyimi iyileştirmek için yerel depolama kullanıyoruz. Detaylar için
                    <a href="#/politikalar" class="font-semibold text-indigo-700 hover:text-indigo-800">Politikalar</a>.
                  </div>
                </div>
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    id="cookieReject"
                    class="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Reddet
                  </button>
                  <button
                    id="cookieAccept"
                    class="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Kabul Et
                  </button>
                </div>
              </div>
            </div>
          </div>
        `
        : ""
    }
  `;
}

async function loadMatchesWithCache(
  sport: SportKey,
): Promise<{
  matches: Match[];
  usedCache: boolean;
  fetchedAt: number;
  warning: string | null;
}> {
  const key = cacheKeyForSport(sport);
  const cached = readCache<Match[]>(key);
  if (cached && isFresh(cached.fetchedAt, CACHE_TTL_MS)) {
    // Dates are serialized as strings; rehydrate below
    const rehydrated = (cached.data ?? []).map((m: any) => ({
      ...m,
      date: new Date(m.date),
    })) as Match[];
    return { matches: rehydrated, usedCache: true, fetchedAt: cached.fetchedAt, warning: null };
  }

  try {
    const now = new Date();
    const matches = await fetchMatchesFromSheet(SOURCES[sport].sheet, now);
    const fetchedAt = Date.now();
    writeCache(key, { v: 1, fetchedAt, data: matches });
    return { matches, usedCache: false, fetchedAt, warning: null };
  } catch (e) {
    if (cached?.data?.length) {
      const rehydrated = (cached.data ?? []).map((m: any) => ({
        ...m,
        date: new Date(m.date),
      })) as Match[];
      return {
        matches: rehydrated,
        usedCache: true,
        fetchedAt: cached.fetchedAt,
        warning: "Güncel veri alınamadı; kayıtlı önbellek gösteriliyor.",
      };
    }
    throw e;
  }
}

export function renderApp(root: HTMLElement): void {
  const initialView = viewFromHash(location.hash);
  const initialTheme = readTheme() ?? "light";
  applyTheme(initialTheme);
  let state: AppState = {
    loading: true,
    error: null,
    matches: [],
    filter: "",
    showPast: false,
    lastUpdated: null,
    usedCache: false,
    sport: "football",
    view: initialView,
    theme: initialTheme,
  };

  const rerender = () => {
    const prevInput = root.querySelector<HTMLInputElement>("#filterInput");
    const wasFocused = prevInput ? document.activeElement === prevInput : false;
    const selStart = prevInput?.selectionStart ?? null;
    const selEnd = prevInput?.selectionEnd ?? null;

    renderState(root, state);

    const filterInput = root.querySelector<HTMLInputElement>("#filterInput");
    filterInput?.addEventListener("input", () => {
      state = { ...state, filter: filterInput.value };
      rerender();
    });

    root.querySelector<HTMLButtonElement>("#togglePastBtn")?.addEventListener("click", () => {
      state = { ...state, showPast: !state.showPast };
      rerender();
    });

    root.querySelectorAll<HTMLButtonElement>("button[data-sport]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sport = (btn.dataset.sport as SportKey | undefined) ?? "football";
        if (sport === state.sport) return;
        state = { ...state, sport, loading: true, error: null, usedCache: false, matches: [], lastUpdated: null };
        rerender();
        void bootstrapLoad();
      });
    });

    root.querySelector<HTMLButtonElement>("#themeToggle")?.addEventListener("click", () => {
      const next: ThemeKey = state.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      writeTheme(next);
      state = { ...state, theme: next };
      rerender();
    });

    root.querySelector<HTMLButtonElement>("#cookieAccept")?.addEventListener("click", () => {
      writeCookieConsent("accepted");
      rerender();
    });

    root.querySelector<HTMLButtonElement>("#cookieReject")?.addEventListener("click", () => {
      writeCookieConsent("rejected");
      rerender();
    });

    root.querySelector<HTMLButtonElement>("#openCookiePrefs")?.addEventListener("click", () => {
      clearCookieConsent();
      rerender();
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });

    if (wasFocused && filterInput) {
      filterInput.focus();
      if (selStart !== null && selEnd !== null) {
        try {
          filterInput.setSelectionRange(selStart, selEnd);
        } catch {
          // ignore (some input types / browsers may reject)
        }
      }
    }
  };

  rerender();

  const bootstrapLoad = async () => {
    try {
      const { matches, usedCache, fetchedAt, warning } = await loadMatchesWithCache(state.sport);
      state = { ...state, matches, loading: false, lastUpdated: fetchedAt, usedCache, error: warning };
      rerender();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
      state = { ...state, loading: false, error: msg };
      rerender();
    }
  };

  window.addEventListener("hashchange", () => {
    const nextView = viewFromHash(location.hash);
    if (nextView === state.view) return;
    state = { ...state, view: nextView };
    rerender();
  });

  void bootstrapLoad();
}

