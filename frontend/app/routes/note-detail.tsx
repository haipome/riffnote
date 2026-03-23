import { useAuth } from "@clerk/react";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { apiFetch } from "~/lib/api";

interface NoteData {
  id: number;
  notebook_id: number;
  title: string;
  content_json: any;
  status: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export default function NoteDetailPage() {
  const { id } = useParams();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [note, setNote] = useState<NoteData | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef<NoteData | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing..." }),
    ],
    content: null,
    onUpdate: ({ editor }) => {
      debouncedSave({ content_json: editor.getJSON() });
    },
  });

  // Keep ref in sync
  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  // Load note data
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = await getToken();
      if (!token || !id || cancelled) return;

      const data = await apiFetch<NoteData>(`/api/notes/${id}`, token);
      if (cancelled) return;

      setNote(data);
      setTitle(data.title);
      setLoading(false);

      if (data.status === "completed" && data.content_json && editor) {
        editor.commands.setContent(data.content_json);
      }

      if (data.status === "processing") {
        poll(token);
      }
    }

    async function poll(token: string) {
      if (cancelled) return;
      const freshToken = await getToken();
      if (!freshToken || cancelled) return;

      const status = await apiFetch<{ status: string; error_message?: string }>(
        `/api/notes/${id}/status`,
        freshToken
      );

      if (cancelled) return;

      if (status.status === "completed") {
        const data = await apiFetch<NoteData>(`/api/notes/${id}`, freshToken);
        if (cancelled) return;
        setNote(data);
        setTitle(data.title);
        setLoading(false);
        if (data.content_json && editor) {
          editor.commands.setContent(data.content_json);
        }
      } else if (status.status === "failed") {
        setNote((prev) => prev ? { ...prev, status: "failed", error_message: status.error_message } : prev);
      } else {
        setTimeout(() => poll(freshToken), 500);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id, editor]);

  const save = useCallback(async (updates: Record<string, any>) => {
    const token = await getToken();
    if (!token || !id) return;
    setSaving(true);
    await apiFetch(`/api/notes/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    setSaving(false);
  }, [id, getToken]);

  const debouncedSave = useCallback((updates: Record<string, any>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => save(updates), 1500);
  }, [save]);

  function handleTitleBlur() {
    if (note && title !== note.title) {
      save({ title });
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this note?")) return;
    const token = await getToken();
    if (!token || !note) return;
    await apiFetch(`/api/notes/${note.id}`, token, { method: "DELETE" });
    navigate(`/notebooks/${note.notebook_id}`, { replace: true });
  }

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center" }} className="text-gray-400">Loading...</div>;
  }

  if (!note) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Note not found</div>;
  }

  if (note.status === "processing") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
        <div style={{ fontSize: "1.1rem" }}>Processing with AI...</div>
        <p className="text-gray-400" style={{ fontSize: "0.85rem" }}>Transcribing and restructuring your recording</p>
      </div>
    );
  }

  if (note.status === "failed") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
        <p style={{ color: "#ef4444" }}>Processing failed</p>
        <p className="text-gray-400" style={{ fontSize: "0.85rem" }}>{note.error_message}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 2rem 4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
          {saving ? "Saving..." : "Saved"}
        </div>
        <button
          onClick={handleDelete}
          style={{
            padding: "4px 12px",
            borderRadius: 6,
            border: "1px solid #fecaca",
            background: "transparent",
            color: "#ef4444",
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          Delete
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleTitleBlur}
        style={{
          width: "100%",
          fontSize: "1.75rem",
          fontWeight: 700,
          border: "none",
          outline: "none",
          background: "transparent",
          color: "inherit",
          marginBottom: "1.5rem",
          padding: 0,
        }}
        placeholder="Untitled"
      />

      <div className="tiptap-editor">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
