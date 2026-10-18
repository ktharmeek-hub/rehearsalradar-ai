import { useEffect, useState } from "react";

interface AudioPreviewProps {
  file: File;
  label: string;
}

export default function AudioPreview({ file, label }: AudioPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    // The file stays on this device until Analyze/Compare is pressed.
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Release the browser's temporary URL on replacement or unmount.
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);

  return (
    <div className="mt-3 rounded-xl border border-emerald-500/20 bg-slate-800/80 p-4">
      <p className="break-all text-sm font-medium text-emerald-300">
        Selected: {file.name}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        {sizeInMB} MB • Preview before AI analysis
      </p>
      <audio
        key={previewUrl ?? file.name}
        aria-label={`${label} playback preview`}
        controls
        preload="metadata"
        src={previewUrl ?? undefined}
        className="mt-3 w-full"
      >
        Your browser does not support audio preview.
      </audio>
      <p className="mt-2 text-xs text-slate-400">
        Local preview only. Some audio codecs may not play in the browser,
        even if FFmpeg can analyze the file.
      </p>
    </div>
  );
}
