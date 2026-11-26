
import type { AnalysisResponse } from './audioApi'
import { supabase } from './supabaseClient'

export type HistoryMode = 'free' | 'compare'

export interface HistorySummary {
  id: number
  created_at: string
  mode: HistoryMode
  singing_filename: string
  reference_filename: string | null
  duration_seconds: number
  median_pitch_hz: number | null
}

export interface HistoryEntry {
  id: number
  created_at: string
  mode: HistoryMode
  singing: AnalysisResponse
  reference: AnalysisResponse | null
}

// Require a valid Supabase user.
async function requireUser() {
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    throw new Error('Please log in to access your history.')
  }

  return data.user
}

// Save analysis to the current user's Supabase history.
export async function saveHistory(
  mode: HistoryMode,
  singing: AnalysisResponse,
  reference: AnalysisResponse | null = null
): Promise<{ id: number; created_at: string }> {
  const user = await requireUser()

  const { data, error } = await supabase
    .from('singing_history')
    .insert({
      user_id: user.id,
      mode,
      singing_filename: singing.filename,
      reference_filename: reference?.filename ?? null,
      duration_seconds: singing.duration_seconds,
      median_pitch_hz: singing.median_pitch_hz,
      payload: { mode, singing, reference },
    })
    .select('id, created_at')
    .single()

  if (error) {
    throw new Error(`Cannot save history: ${error.message}`)
  }

  if (!data) {
    throw new Error('History was not saved.')
  }

  return {
    id: Number(data.id),
    created_at: String(data.created_at),
  }
}

// List the current user's recent analyses.
export async function listHistory(): Promise<HistorySummary[]> {
  const user = await requireUser()

  const { data, error } = await supabase
    .from('singing_history')
    .select('id, created_at, mode, singing_filename, reference_filename, duration_seconds, median_pitch_hz')
    .eq('user_id', user.id)
    .order('id', { ascending: false })
    .limit(50)

  if (error) {
    throw new Error(`Cannot load history: ${error.message}`)
  }

  return (data ?? []) as HistorySummary[]
}

// Open an individual saved analysis.
export async function getHistory(
  id: number
): Promise<HistoryEntry> {
  const user = await requireUser()

  const { data, error } = await supabase
    .from('singing_history')
    .select('id, created_at, payload')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    throw new Error(`Cannot open history: ${error.message}`)
  }

  if (!data) {
    throw new Error('History entry not found or not accessible.')
  }

  const payload = data.payload as {
    mode: HistoryMode
    singing: AnalysisResponse
    reference: AnalysisResponse | null
  }

  return {
    id: Number(data.id),
    created_at: String(data.created_at),
    ...payload,
  }
}

// Delete one of the current user's saved analyses.
export async function deleteHistory(id: number): Promise<void> {
  const user = await requireUser()

  const { data, error } = await supabase
    .from('singing_history')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')

  if (error) {
    throw new Error(`Cannot delete history: ${error.message}`)
  }

  if (!data || data.length === 0) {
    throw new Error('History entry not found or not accessible.')
  }
}
