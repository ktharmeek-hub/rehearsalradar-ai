import type { AnalysisResponse } from "./audioApi";

const API_URL = "http://127.0.0.1:8000";

export type HistoryMode = "free" | "compare";

export interface HistorySummary {
  id: number;
  created_at: string;
  mode: HistoryMode;
  singing_filename: string;
  reference_filename: string | null;
  duration_seconds: number;
  median_pitch_hz: number | null;
}

export interface HistoryEntry {
  id: number;
  created_at: string;
  mode: HistoryMode;
  singing: AnalysisResponse;
  reference: AnalysisResponse | null;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error("Cannot reach the backend. Start FastAPI and try again.");
  }

  if (!response.ok) {
    let message = `History request failed (${response.status})`;
    try {
      const body: { detail?: unknown } = await response.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // Keep the HTTP status message when the response is not JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function saveHistory(
  mode: HistoryMode,
  singing: AnalysisResponse,
  reference: AnalysisResponse | null = null
): Promise<{ id: number; created_at: string }> {
  return fetchJson(`${API_URL}/history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, singing, reference }),
  });
}

export async function listHistory(): Promise<HistorySummary[]> {
  return fetchJson(`${API_URL}/history?limit=50`);
}

export async function getHistory(id: number): Promise<HistoryEntry> {
  return fetchJson(`${API_URL}/history/${id}`);
}

export async function deleteHistory(id: number): Promise<void> {
  await fetchJson<void>(`${API_URL}/history/${id}`, { method: "DELETE" });
}
