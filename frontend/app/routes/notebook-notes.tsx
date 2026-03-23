import { useAuth } from "@clerk/react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { apiFetch } from "~/lib/api";

interface NoteItem {
  id: number;
  title: string;
  status: string;
  created_at: string;
}

interface Notebook {
  id: number;
  name: string;
  is_default: boolean;
}

export default function NotebookNotesPage() {
  const { id } = useParams();
  const { getToken } = useAuth();
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const token = await getToken();
    if (!token || !id) return;

    const [nbList, notesData] = await Promise.all([
      apiFetch<Notebook[]>("/api/notebooks", token),
      apiFetch<{ items: NoteItem[] }>(`/api/notebooks/${id}/notes`, token),
    ]);

    setNotebook(nbList.find((n) => n.id === Number(id)) || null);
    setNotes(notesData.items);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center" }} className="text-gray-400">Loading...</div>;
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>{notebook?.name || "Notebook"}</h1>
        <Link
          to={`/notebooks/${id}/new`}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "#2563eb",
            color: "white",
            textDecoration: "none",
            fontSize: "0.9rem",
          }}
        >
          + New Recording
        </Link>
      </div>

      {notes.length === 0 ? (
        <p className="text-gray-400" style={{ textAlign: "center", padding: "2rem 0" }}>
          No notes yet. Start a recording!
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notes.map((note) => (
            <Link
              key={note.id}
              to={`/notes/${note.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderRadius: 8,
                textDecoration: "none",
                color: "inherit",
                border: "1px solid #e5e7eb",
              }}
              className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-700"
            >
              <span style={{ fontWeight: 500 }}>{note.title}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {note.status !== "completed" && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: note.status === "failed" ? "#fecaca" : "#fef3c7",
                      color: note.status === "failed" ? "#991b1b" : "#92400e",
                    }}
                  >
                    {note.status}
                  </span>
                )}
                <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                  {new Date(note.created_at).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
