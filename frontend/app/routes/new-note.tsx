import { useAuth } from "@clerk/react";
import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router";
import RecordingButton from "~/components/recording-button";
import { apiFetch } from "~/lib/api";

type Phase = "idle" | "uploading" | "error";

export default function NewNotePage() {
  const { id: notebookId } = useParams();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    setPhase("uploading");
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
      const formData = new FormData();
      formData.append("notebook_id", notebookId!);
      formData.append("audio", blob, `recording.${ext}`);

      const note = await apiFetch<{ id: string }>(
        "/api/notes",
        token,
        { method: "POST", body: formData }
      );

      // Navigate immediately — note-detail.tsx handles polling
      navigate(`/notes/${note.id}`, { replace: true });
    } catch (e: any) {
      setPhase("error");
      setError(e.message || "Upload failed");
    }
  }, [notebookId, getToken, navigate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 24 }}>
      {phase === "idle" && (
        <>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>New Recording</h1>
          <RecordingButton onRecordingComplete={handleRecordingComplete} />
        </>
      )}

      {phase === "uploading" && (
        <div style={{ textAlign: "center" }}>
          <div className="text-gray-400" style={{ fontSize: "1.1rem" }}>Uploading...</div>
        </div>
      )}

      {phase === "error" && (
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#ef4444", marginBottom: 16 }}>{error}</p>
          <button
            onClick={() => { setPhase("idle"); setError(null); }}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: "transparent",
              cursor: "pointer",
              color: "inherit",
            }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
