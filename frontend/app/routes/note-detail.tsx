import { useAuth } from "@clerk/react";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useIsMobile } from "~/lib/use-is-mobile";
import { apiFetch } from "~/lib/api";

interface NoteData {
  id: string;
  notebook_id: string;
  title: string;
  content: any;
  status: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export default function NoteDetailPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [note, setNote] = useState<NoteData | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pendingContent, setPendingContent] = useState<any>(null);
  const [retryKey, setRetryKey] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing..." }),
    ],
    content: null,
    editable: false,
    onUpdate: ({ editor }) => {
      // Only auto-save when in edit mode
      if (editor.isEditable) {
        debouncedSave({ content: editor.getJSON() });
      }
    },
  });

  // Apply pending content when editor becomes ready or content arrives
  useEffect(() => {
    if (editor && pendingContent) {
      editor.commands.setContent(pendingContent);
      setPendingContent(null);
      // Sync editor editable state with editing flag
      if (editing) {
        editor.setEditable(true);
      }
    }
  }, [editor, pendingContent, editing]);

  // Reset state when switching notes
  useEffect(() => {
    setEditing(false);
    setLoading(true);
    setNote(null);
    if (editor) {
      editor.setEditable(false);
      editor.commands.clearContent();
    }
  }, [id]);

  // Load note data + poll if processing
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

      if (data.status === "completed" && data.content) {
        setPendingContent(data.content);
        // Auto-enter edit mode if ?edit=1
        if (searchParams.get("edit") === "1") {
          setEditing(true);
          setSearchParams({}, { replace: true });
        }
      }

      if (data.status === "processing") {
        setElapsed(0);
        elapsedTimerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
        pollTimerRef.current = setTimeout(poll, 500);
      }
    }

    async function poll() {
      if (cancelled) return;
      try {
        const freshToken = await getToken();
        if (!freshToken || cancelled) return;

        const status = await apiFetch<{ status: string; error_message?: string }>(
          `/api/notes/${id}/status`,
          freshToken
        );

        if (cancelled) return;

        if (status.status === "completed") {
          if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
          const data = await apiFetch<NoteData>(`/api/notes/${id}`, freshToken);
          if (cancelled) return;
          setNote(data);
          setTitle(data.title);
          setLoading(false);
          if (data.content) {
            setPendingContent(data.content);
          }
          // Notify sidebar to refresh note list
          window.dispatchEvent(new Event("note-updated"));
        } else if (status.status === "failed") {
          setNote((prev) => prev ? { ...prev, status: "failed", error_message: status.error_message } : prev);
        } else {
          pollTimerRef.current = setTimeout(poll, 500);
        }
      } catch {
        if (!cancelled) {
          pollTimerRef.current = setTimeout(poll, 1000);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [id, getToken, retryKey]);

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

  function handleEdit() {
    setEditing(true);
    editor?.setEditable(true);
    editor?.commands.focus();
  }

  function handleDoneEditing() {
    // Flush any pending debounced save
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      if (editor) {
        save({ content: editor.getJSON() });
      }
    }
    // Save title if changed
    if (note && title !== note.title) {
      save({ title });
    }
    setEditing(false);
    editor?.setEditable(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this note?")) return;
    const token = await getToken();
    if (!token || !note) return;
    await apiFetch(`/api/notes/${note.id}`, token, { method: "DELETE" });
    navigate("/", { replace: true });
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
        <p className="text-gray-400" style={{ fontSize: "0.8rem" }}>{elapsed}s</p>
      </div>
    );
  }

  async function handleRetry() {
    const token = await getToken();
    if (!token || !id) return;
    await apiFetch(`/api/notes/${id}/retry`, token, { method: "POST" });
    setRetryKey((k) => k + 1);
  }

  if (note.status === "failed") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
        <p style={{ color: "#ef4444" }}>Processing failed</p>
        <p className="text-gray-400" style={{ fontSize: "0.85rem" }}>{note.error_message}</p>
        <button
          onClick={handleRetry}
          style={{
            padding: "8px 20px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: "transparent",
            cursor: "pointer",
            fontSize: "0.85rem",
            color: "inherit",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: isMobile ? "1rem 1rem 3rem" : "2rem 2rem 4rem" }}>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
          {editing
            ? (saving ? "Saving..." : "Saved")
            : new Date(note.created_at).toLocaleString()
          }
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {editing ? (
            <button
              onClick={handleDoneEditing}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#2563eb",
                cursor: "pointer",
                fontSize: "0.8rem",
                color: "white",
              }}
            >
              Done
            </button>
          ) : (
            <button
              onClick={handleEdit}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "transparent",
                cursor: "pointer",
                fontSize: "0.8rem",
                color: "inherit",
              }}
            >
              Edit
            </button>
          )}
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
      </div>

      {/* Title */}
      {editing ? (
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
      ) : (
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem" }}>
          {title || "Untitled"}
        </h1>
      )}

      {/* Content — TipTap handles both view (editable=false) and edit mode */}
      <div className="tiptap-editor">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
