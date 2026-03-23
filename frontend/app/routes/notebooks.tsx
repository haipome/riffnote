import { useAuth } from "@clerk/react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiFetch } from "~/lib/api";

interface Notebook {
  id: number;
  name: string;
  is_default: boolean;
  note_count: number;
  created_at: string;
}

export default function NotebooksPage() {
  const { getToken } = useAuth();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const token = await getToken();
    if (!token) return;
    const data = await apiFetch<Notebook[]>("/api/notebooks", token);
    setNotebooks(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const token = await getToken();
    if (!token) return;
    await apiFetch("/api/notebooks", token, {
      method: "POST",
      body: JSON.stringify({ name: newName.trim() }),
    });
    setNewName("");
    load();
  }

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center" }} className="text-gray-400">Loading...</div>;
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1.5rem" }}>Notebooks</h1>

      <form onSubmit={handleCreate} style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New notebook name..."
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            fontSize: "0.9rem",
            background: "transparent",
            color: "inherit",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "#2563eb",
            color: "white",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          Create
        </button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {notebooks.map((nb) => (
          <Link
            key={nb.id}
            to={`/notebooks/${nb.id}`}
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
            <div>
              <span style={{ fontWeight: 500 }}>{nb.name}</span>
              {nb.is_default && (
                <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "#9ca3af" }}>default</span>
              )}
            </div>
            <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
              {nb.note_count} notes
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
