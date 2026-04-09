import { buildDateAssumingTurkeyUTCPlus3, formatLocalTime } from "./time";

export type Match = {
  teams: string;
  channel: string;
  timeTR: string;
  date: Date;
  timeLocal: string;
};

export type SheetSource = {
  sheetId: string;
  gid: string;
};

function buildGvizUrl(src: SheetSource): string {
  const { sheetId, gid } = src;
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&tq&gid=${gid}`;
}

function extractGvizJson(text: string): unknown {
  // Typical format:
  // /*O_o*/\ngoogle.visualization.Query.setResponse({...});
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("GViz JSON bulunamadı (beklenmeyen yanıt).");
  }
  const jsonString = text.slice(start, end + 1);
  return JSON.parse(jsonString);
}

function cellToString(cell: any): string {
  if (!cell) return "";
  return String(cell.f ?? cell.v ?? "").trim();
}

export async function fetchMatchesFromSheet(
  src: SheetSource,
  now = new Date(),
): Promise<Match[]> {
  const url = buildGvizUrl(src);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet verisi alınamadı. HTTP ${res.status}`);

  const text = await res.text();
  const parsed: any = extractGvizJson(text);
  const rows: any[] = parsed?.table?.rows ?? [];

  const matches: Match[] = [];
  for (const row of rows) {
    const c = row?.c ?? [];
    const timeTR = cellToString(c[0]);
    const channel = cellToString(c[1]);
    const teams = cellToString(c[2]);

    if (!timeTR || timeTR.toLowerCase() === "saat") continue;

    const date = buildDateAssumingTurkeyUTCPlus3(timeTR, now);
    if (!date) continue;

    matches.push({
      teams,
      channel,
      timeTR,
      date,
      timeLocal: formatLocalTime(date),
    });
  }

  return matches;
}

