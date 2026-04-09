/**
 * Bugün Maç Var mı? — maç listesi (Google Sheets GViz)
 * Ana sayfa: #currentTbody vb. elementlere bağlanır; iframe gerekmez.
 */
(function () {
  "use strict";

  const SHEET_ID = "1BPzyNLclxAvhNg2t4puSyrA-VLGb_RuFqPmdr5PheBg";
  const GID_FOOTBALL = "0";
  const GID_BASKETBALL = "48872055";
  const PAST_THRESHOLD_MIN = 90;

  function buildUrl(gid) {
    return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&tq&gid=${encodeURIComponent(gid)}`;
  }

  function extractGvizJson(text) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < 0 || end <= start) throw new Error("GViz JSON bulunamadı");
    return JSON.parse(text.slice(start, end + 1));
  }

  function fmtLocalTime(d) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function getTodayISO_TR() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  function parseTRTimeToDate(timeTR) {
    const parts = String(timeTR).trim().split(":");
    if (parts.length !== 2) return null;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;

    const iso = `${getTodayISO_TR()}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+03:00`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderRows(items, el) {
    if (!el) return;
    el.innerHTML = items
      .map(
        (x) => `
              <tr>
                <td>${escapeHtml(x.teams)}</td>
                <td>${escapeHtml(x.timeLocal || x.timeTR)}</td>
                <td>${escapeHtml(x.channel)}</td>
              </tr>
            `,
      )
      .join("");
  }

  const HDR_HIDDEN_CLASS = "hdr--hidden";
  const MOBILE_HEADER_MQ = "(max-width: 640px)";

  function initMobileHeaderScroll() {
    const hdr = document.querySelector(".hdr");
    if (!hdr) return;

    const mq = window.matchMedia(MOBILE_HEADER_MQ);
    let lastY = window.scrollY || document.documentElement.scrollTop;
    let ticking = false;

    function apply() {
      ticking = false;
      if (!mq.matches) {
        hdr.classList.remove(HDR_HIDDEN_CLASS);
        lastY = window.scrollY || document.documentElement.scrollTop;
        return;
      }

      const y = window.scrollY || document.documentElement.scrollTop;
      const dy = y - lastY;
      lastY = y;

      if (y < 12) {
        hdr.classList.remove(HDR_HIDDEN_CLASS);
        return;
      }

      if (dy > 4) {
        hdr.classList.add(HDR_HIDDEN_CLASS);
      } else if (dy < -4) {
        hdr.classList.remove(HDR_HIDDEN_CLASS);
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    mq.addEventListener("change", () => {
      if (!mq.matches) hdr.classList.remove(HDR_HIDDEN_CLASS);
    });
  }

  function initMain() {
    const currentTbody = document.getElementById("currentTbody");
    if (!currentTbody) return;

    let currentGid = GID_FOOTBALL;

    setHeaderDate();
    setTimezoneInfo();

    function setHeaderDate() {
      const el = document.getElementById("headerDate");
      if (!el) return;
      el.textContent = new Intl.DateTimeFormat("tr-TR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date());
    }

    function setTimezoneInfo() {
      const offsetMinutes = new Date().getTimezoneOffset();
      const offsetHours = -offsetMinutes / 60;
      const off = offsetHours % 1 === 0 ? String(offsetHours) : offsetHours.toFixed(1).replace(/\.0$/, "");
      const gmt = `GMT${offsetHours >= 0 ? "+" : ""}${off}`;
      let tzId = "";
      try {
        tzId = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      } catch {
        /* ignore */
      }
      const tzInfo = document.getElementById("tzInfo");
      if (tzInfo) {
        tzInfo.textContent = `Maç saatleri yerel saatinize göre listelenir. (${gmt})`;
      }
      const hdr = document.getElementById("tzHeader");
      if (hdr) {
        hdr.textContent = tzId
          ? `Yerel saat dilimi: ${tzId} (${gmt})`
          : `Yerel saat dilimi: ${gmt}`;
      }
    }

    function setLastUpdated(ts) {
      const el = document.getElementById("lastUpdated");
      if (!el) return;
      const d = new Date(ts);
      const str = d.toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
      el.textContent = `Son güncelleme: ${str}`;
    }

    function showError(msg) {
      const el = document.getElementById("err");
      if (!el) return;
      el.textContent = msg;
      el.classList.remove("hidden");
    }

    function clearError() {
      const el = document.getElementById("err");
      if (!el) return;
      el.classList.add("hidden");
      el.textContent = "";
    }

    async function load() {
      clearError();
      const startedAt = Date.now();
      const res = await fetch(buildUrl(currentGid));
      if (!res.ok) throw new Error(`Veri alınamadı (HTTP ${res.status})`);
      const text = await res.text();
      const json = extractGvizJson(text);
      const rows = json?.table?.rows ?? [];

      const matches = rows
        .map((r) => {
          const c = r?.c ?? [];
          const timeTR = String(c?.[0]?.f ?? c?.[0]?.v ?? "").trim();
          const channel = String(c?.[1]?.v ?? "").trim();
          const teams = String(c?.[2]?.v ?? "").trim();
          if (!timeTR || timeTR.toLowerCase() === "saat") return null;

          const date = parseTRTimeToDate(timeTR);
          if (!date) return null;

          return { timeTR, channel, teams, date, timeLocal: fmtLocalTime(date) };
        })
        .filter(Boolean);

      const now = Date.now();
      const threshold = now - PAST_THRESHOLD_MIN * 60 * 1000;

      const current = [];
      const past = [];
      for (const m of matches) (m.date.getTime() > threshold ? current : past).push(m);

      current.sort((a, b) => a.date - b.date);
      past.sort((a, b) => a.date - b.date);

      renderRows(current, document.getElementById("currentTbody"));
      renderRows(past, document.getElementById("pastTbody"));
      setTimezoneInfo();
      setLastUpdated(startedAt);
    }

    const togglePast = document.getElementById("togglePast");
    const pastBox = document.getElementById("pastBox");
    if (togglePast && pastBox) {
      togglePast.addEventListener("click", () => {
        pastBox.classList.toggle("hidden");
        togglePast.textContent = pastBox.classList.contains("hidden")
          ? "Geçmiş Maçları Göster"
          : "Geçmiş Maçları Gizle";
      });
    }

    function setSportButtons(active) {
      const f = document.getElementById("sportFootball");
      const b = document.getElementById("sportBasketball");
      if (!f || !b) return;
      const isFootball = active === "football";
      f.classList.toggle("active", isFootball);
      b.classList.toggle("active", !isFootball);
      f.setAttribute("aria-selected", isFootball ? "true" : "false");
      b.setAttribute("aria-selected", !isFootball ? "true" : "false");
    }

    document.getElementById("sportFootball")?.addEventListener("click", () => {
      currentGid = GID_FOOTBALL;
      setSportButtons("football");
      load().catch((err) => showError(err?.message || "Bir hata oluştu"));
    });

    document.getElementById("sportBasketball")?.addEventListener("click", () => {
      currentGid = GID_BASKETBALL;
      setSportButtons("basketball");
      load().catch((err) => showError(err?.message || "Bir hata oluştu"));
    });

    load().catch((err) => {
      console.error(err);
      showError(err?.message || "Bir hata oluştu");
    });
  }

  function boot() {
    initMain();
    initMobileHeaderScroll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.BugunMacVarMi = {
    version: "1",
    initMain,
    initMobileHeaderScroll,
    buildUrl,
    SHEET_ID,
    GID_FOOTBALL,
    GID_BASKETBALL,
  };
})();
