
export interface UploadResponse {
  status: string;
  filename: string;
  duration_seconds: number;
  file_size_mb: number;
  message: string;
}

export async function uploadAudio(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;

  try {
    response = await fetch("http://127.0.0.1:8000/upload", {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error("Cannot connect to backend. Check if FastAPI is running.");
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Audio upload failed");
  }

  return data as UploadResponse;
}


export interface PitchPoint {
  time: number;
  pitch_hz: number | null;
}

export interface AnalysisResponse {
  filename: string;
  duration_seconds: number;
  file_size_mb: number;
  status: "success" | "no_pitch_detected";
  pitch_contour: PitchPoint[];
  median_pitch_hz: number | null;
  min_pitch_hz: number | null;
  max_pitch_hz: number | null;
}

export async function analyzeAudio(
  file: File
): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;

  try {
    response = await fetch("http://127.0.0.1:8000/analyze", {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(
      "Cannot connect to AI backend. Check if FastAPI is running."
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "AI pitch analysis failed"
    );
  }

  return data as AnalysisResponse;
}
