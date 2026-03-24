import { Show, SignIn, SignUp, useAuth } from "@clerk/react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import RecordingButton from "~/components/recording-button";
import { apiFetch } from "~/lib/api";
import { useIsMobile } from "~/lib/use-is-mobile";
import type { Route } from "./+types/home";

interface Notebook {
  id: number;
  name: string;
  is_default: boolean;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "RiffNote" },
    { name: "description", content: "Voice to structured notes" },
  ];
}

export default function Home() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNbId, setSelectedNbId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");

  // Fetch notebooks when signed in
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      const token = await getToken();
      if (!token) return;
      const data = await apiFetch<Notebook[]>("/api/notebooks", token);
      setNotebooks(data);
      // Default to the default notebook
      const defaultNb = data.find((n) => n.is_default);
      setSelectedNbId(defaultNb ? defaultNb.id : data[0]?.id ?? null);
    })();
  }, [isLoaded, isSignedIn]);

  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    if (!selectedNbId) return;
    setUploading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
      const formData = new FormData();
      formData.append("notebook_id", String(selectedNbId));
      formData.append("audio", blob, `recording.${ext}`);

      const note = await apiFetch<{ id: number }>(
        "/api/notes",
        token,
        { method: "POST", body: formData }
      );

      navigate(`/notes/${note.id}`, { replace: true });
    } catch (e: any) {
      setUploading(false);
      alert(e.message || "Upload failed");
    }
  }, [selectedNbId, getToken, navigate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "2rem" }}>
      <Show when="signed-out">
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            maxWidth: 900,
            width: "100%",
            minHeight: isMobile ? "auto" : 480,
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid #e5e7eb",
            boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
            margin: isMobile ? "0 16px" : 0,
          }}
          className="bg-white dark:bg-gray-900 dark:border-gray-700"
        >
          {/* Left: intro */}
          <div style={{ flex: 1, padding: isMobile ? "32px 24px" : "56px 48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 16 }}>RiffNote</h1>
            <p style={{ fontSize: "1.1rem", color: "#6b7280", lineHeight: 1.8, marginBottom: 24 }}>
              语音转结构化笔记工具。
              <br />
              随时随地录音，AI 自动将口语转化为条理清晰的文字。
            </p>
            <ul style={{ fontSize: "0.95rem", color: "#9ca3af", lineHeight: 2.2, listStyle: "none", padding: 0 }}>
              <li>🎙️ 随时录音，捕捉灵感</li>
              <li>✨ AI 转写并整理成结构化笔记</li>
              <li>📝 自由编辑，分类管理</li>
            </ul>
          </div>

          {/* Right: auth with tab */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderLeft: isMobile ? "none" : "1px solid #e5e7eb",
              borderTop: isMobile ? "1px solid #e5e7eb" : "none",
              padding: "32px 16px",
            }}
            className="bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
          >
            <div style={{ display: "flex", marginBottom: 16, borderRadius: 8, overflow: "hidden", border: "1px solid #d1d5db" }}>
              <button
                onClick={() => setAuthTab("signin")}
                style={{
                  padding: "6px 20px",
                  fontSize: "0.85rem",
                  border: "none",
                  cursor: "pointer",
                  background: authTab === "signin" ? "#2563eb" : "transparent",
                  color: authTab === "signin" ? "white" : "inherit",
                }}
              >
                登录
              </button>
              <button
                onClick={() => setAuthTab("signup")}
                style={{
                  padding: "6px 20px",
                  fontSize: "0.85rem",
                  border: "none",
                  borderLeft: "1px solid #d1d5db",
                  cursor: "pointer",
                  background: authTab === "signup" ? "#2563eb" : "transparent",
                  color: authTab === "signup" ? "white" : "inherit",
                }}
              >
                注册
              </button>
            </div>
            {authTab === "signin" ? (
              <SignIn routing="hash" />
            ) : (
              <SignUp routing="hash" />
            )}
          </div>
        </div>
      </Show>

      <Show when="signed-in">
        <h1 style={{ fontSize: "1.3rem", fontWeight: 600, marginBottom: "2rem", color: "#6b7280" }}>
          今天有什么要记录的吗？
        </h1>

        {uploading ? (
          <div className="text-gray-400" style={{ fontSize: "1.1rem" }}>Uploading...</div>
        ) : (
          <>
            {notebooks.length > 0 && selectedNbId && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "2rem", fontSize: "0.85rem", color: "#9ca3af" }}>
                <span>录入到</span>
                <select
                  value={selectedNbId}
                  onChange={(e) => setSelectedNbId(Number(e.target.value))}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    fontSize: "0.85rem",
                    background: "transparent",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  {notebooks.map((nb) => (
                    <option key={nb.id} value={nb.id}>{nb.name}</option>
                  ))}
                </select>
              </div>
            )}

            <RecordingButton onRecordingComplete={handleRecordingComplete} />
          </>
        )}
      </Show>
    </div>
  );
}
