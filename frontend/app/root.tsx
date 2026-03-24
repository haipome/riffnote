import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  useAuth,
  useUser,
  UserButton,
} from "@clerk/react";
import { useEffect, useRef, useState } from "react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { apiFetch } from "~/lib/api";
import { useIsMobile } from "~/lib/use-is-mobile";

interface Notebook {
  id: string;
  name: string;
  is_default: boolean;
  note_count: number;
}

interface NoteItem {
  id: string;
  title: string;
  status: string;
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function UserInfo() {
  const { user } = useUser();

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Account";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <UserButton
        appearance={{
          elements: {
            avatarBox: { width: 32, height: 32 },
            userButtonTrigger: {
              borderRadius: 0,
              "&:focus": { boxShadow: "none" },
              "&::after": {
                content: `"${displayName.replace(/"/g, '\\"')}"`,
                fontSize: "0.85rem",
                color: "#6b7280",
                marginLeft: "10px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              },
            },
          },
        }}
      />
    </div>
  );
}

function SidebarContent({ collapsed, onToggle, isMobile }: { collapsed: boolean; onToggle: () => void; isMobile: boolean }) {
  const { getToken, isSignedIn } = useAuth();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [expandedNbId, setExpandedNbId] = useState<string | null>(null);
  const [nbNotes, setNbNotes] = useState<NoteItem[]>([]);
  const [menuNoteId, setMenuNoteId] = useState<string | null>(null);
  const [menuNbId, setMenuNbId] = useState<string | null>(null);
  const [renameNb, setRenameNb] = useState<Notebook | null>(null);
  const [renameNbName, setRenameNbName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const nbMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Fetch notebooks when signed in
  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      const token = await getToken();
      if (!token) return;
      const data = await apiFetch<Notebook[]>("/api/notebooks", token);
      setNotebooks(data);
    })();
  }, [isSignedIn, location.pathname]);

  // Auto-expand notebook from URL (/notebooks/:id or /notebooks/:id/new)
  useEffect(() => {
    const nbMatch = location.pathname.match(/^\/notebooks\/([^/]+)/);
    if (nbMatch) {
      setExpandedNbId(nbMatch[1]);
    }
  }, [location.pathname]);

  // Listen for note-updated events (fired when processing completes)
  const [noteRefreshKey, setNoteRefreshKey] = useState(0);
  useEffect(() => {
    const handler = () => setNoteRefreshKey((k) => k + 1);
    window.addEventListener("note-updated", handler);
    return () => window.removeEventListener("note-updated", handler);
  }, []);

  // Fetch notes for expanded notebook (refetch on path change, note-updated, or expand)
  useEffect(() => {
    if (!expandedNbId || !isSignedIn) {
      setNbNotes([]);
      return;
    }
    (async () => {
      const token = await getToken();
      if (!token) return;
      const data = await apiFetch<{ items: NoteItem[] }>(`/api/notebooks/${expandedNbId}/notes`, token);
      setNbNotes(data.items);
    })();
  }, [expandedNbId, isSignedIn, location.pathname, noteRefreshKey]);

  // Extract active note id from URL
  const noteMatch = location.pathname.match(/^\/notes\/([^/]+)/);
  const activeNoteId = noteMatch ? noteMatch[1] : null;

  const [showNewNbDialog, setShowNewNbDialog] = useState(false);
  const [newNbName, setNewNbName] = useState("");

  function toggleNotebook(nbId: string) {
    setExpandedNbId(expandedNbId === nbId ? null : nbId);
  }

  async function handleCreateNotebook() {
    const name = newNbName.trim();
    if (!name) return;
    const token = await getToken();
    if (!token) return;
    await apiFetch("/api/notebooks", token, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setNewNbName("");
    setShowNewNbDialog(false);
    const data = await apiFetch<Notebook[]>("/api/notebooks", token);
    setNotebooks(data);
  }

  // Delete notebook dialog state
  const [deleteNb, setDeleteNb] = useState<Notebook | null>(null);
  const [deleteAction, setDeleteAction] = useState<"delete" | "move">("delete");
  const [deleteMoveTarget, setDeleteMoveTarget] = useState<string | null>(null);

  function openDeleteNbDialog(nb: Notebook) {
    setDeleteNb(nb);
    setDeleteAction("delete");
    const otherNbs = notebooks.filter((n) => n.id !== nb.id);
    setDeleteMoveTarget(otherNbs.length > 0 ? otherNbs[0].id : null);
  }

  async function handleDeleteNotebook() {
    if (!deleteNb) return;
    const token = await getToken();
    if (!token) return;

    const nb = deleteNb;
    const noteCount = nb.note_count;
    let query = "";
    if (noteCount > 0) {
      if (deleteAction === "move" && deleteMoveTarget) {
        query = `?action=move_notes&move_to=${deleteMoveTarget}`;
      } else {
        query = "?action=delete_notes";
      }
    }

    await apiFetch(`/api/notebooks/${nb.id}${query}`, token, { method: "DELETE" });
    setDeleteNb(null);
    if (expandedNbId === nb.id) setExpandedNbId(null);

    // Refresh — list_notebooks auto-creates default if all deleted
    const data = await apiFetch<Notebook[]>("/api/notebooks", token);
    setNotebooks(data);

    // Navigate away if on a note/page within the deleted notebook
    if (location.pathname.startsWith(`/notebooks/${nb.id}`)) {
      navigate("/", { replace: true });
    }
  }

  async function handleRenameNotebook() {
    if (!renameNb) return;
    const name = renameNbName.trim();
    if (!name || name === renameNb.name) { setRenameNb(null); return; }
    const token = await getToken();
    if (!token) return;
    await apiFetch(`/api/notebooks/${renameNb.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    setRenameNb(null);
    const data = await apiFetch<Notebook[]>("/api/notebooks", token);
    setNotebooks(data);
  }

  // Close menus on click outside
  useEffect(() => {
    if (!menuNoteId && !menuNbId) return;
    function handleClick(e: MouseEvent) {
      if (menuNoteId && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuNoteId(null);
        setMoveNoteId(null);
      }
      if (menuNbId && nbMenuRef.current && !nbMenuRef.current.contains(e.target as Node)) {
        setMenuNbId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuNoteId, menuNbId]);

  const [moveNoteId, setMoveNoteId] = useState<string | null>(null);

  async function handleMoveNote(noteId: string, targetNbId: string) {
    const token = await getToken();
    if (!token) return;
    await apiFetch(`/api/notes/${noteId}`, token, {
      method: "PATCH",
      body: JSON.stringify({ notebook_id: targetNbId }),
    });
    setMenuNoteId(null);
    setMoveNoteId(null);
    // Remove from current list
    setNbNotes((prev) => prev.filter((n) => n.id !== noteId));
    // Refresh notebooks to update counts
    const data = await apiFetch<Notebook[]>("/api/notebooks", token);
    setNotebooks(data);
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm("Delete this note?")) {
      setMenuNoteId(null);
      return;
    }
    const token = await getToken();
    if (!token) return;
    await apiFetch(`/api/notes/${noteId}`, token, { method: "DELETE" });
    setMenuNoteId(null);
    // Remove from local list immediately
    setNbNotes((prev) => prev.filter((n) => n.id !== noteId));
    // Refresh notebooks to update count
    const data = await apiFetch<Notebook[]>("/api/notebooks", token);
    setNotebooks(data);
    // If viewing the deleted note, navigate away
    if (location.pathname === `/notes/${noteId}`) {
      navigate("/", { replace: true });
    }
  }

  return (
    <>
      {collapsed && (
        <button
          onClick={onToggle}
          className="sidebar-toggle"
          style={{ position: "fixed", top: 12, left: 12, zIndex: 50 }}
          aria-label="Open sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 18H3M21 12H3M21 6H3" />
          </svg>
        </button>
      )}

      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${isMobile ? "mobile" : ""}`}>
        {/* Top: logo + collapse */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
          <Link to="/" onClick={() => { if (isMobile) onToggle(); }} style={{ textDecoration: "none", fontWeight: 700, fontSize: "1.1rem", color: "inherit" }}>
            RiffNote
          </Link>
          <button onClick={onToggle} className="sidebar-toggle" aria-label="Close sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 19l-7-7 7-7M4 12h16" />
            </svg>
          </button>
        </div>

        {/* Notebooks + notes nav */}
        <nav style={{ flex: 1, padding: "8px 12px", overflow: "auto" }}>
          <Show when="signed-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 12px", marginBottom: 4 }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.05em" }}>
                Notebooks
              </span>
              <button
                onClick={() => setShowNewNbDialog(true)}
                className="sidebar-toggle"
                style={{ width: 24, height: 24 }}
                aria-label="Create notebook"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
            {notebooks.map((nb) => (
              <div key={nb.id} style={{ position: "relative" }}>
                <div
                  onClick={() => toggleNotebook(nb.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    background: expandedNbId === nb.id ? "rgba(0,0,0,0.05)" : "transparent",
                  }}
                  className="hover:bg-gray-200 dark:hover:bg-gray-700 group/nb"
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      style={{ flexShrink: 0, transform: expandedNbId === nb.id ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {nb.name}
                    </span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: "0.75rem", color: "#9ca3af", flexShrink: 0 }}>{nb.note_count}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuNbId(menuNbId === nb.id ? null : nb.id); }}
                      className={`sidebar-toggle ${isMobile ? "" : "opacity-0 group-hover/nb:opacity-100"}`}
                      style={{ width: 20, height: 20, flexShrink: 0 }}
                      aria-label="Notebook options"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                      </svg>
                    </button>
                  </span>
                </div>

                {/* Notebook menu */}
                {menuNbId === nb.id && (
                  <div
                    ref={nbMenuRef}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: 36,
                      zIndex: 50,
                      minWidth: 130,
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      overflow: "hidden",
                    }}
                    className="bg-white dark:bg-gray-800 dark:border-gray-700"
                  >
                    <button
                      onClick={() => { setMenuNbId(null); setRenameNb(nb); setRenameNbName(nb.name); }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "8px 14px",
                        fontSize: "0.83rem",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        color: "inherit",
                      }}
                      className="hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => { setMenuNbId(null); openDeleteNbDialog(nb); }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "8px 14px",
                        fontSize: "0.83rem",
                        border: "none",
                        background: "transparent",
                        color: "#ef4444",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      className="hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Delete
                    </button>
                  </div>
                )}

                {expandedNbId === nb.id && (
                  <div style={{ paddingLeft: 24, paddingTop: 2, paddingBottom: 4, maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
                    <Link
                      to={`/notebooks/${nb.id}/new`}
                      onClick={() => { if (isMobile) onToggle(); }}
                      style={{
                        display: "block",
                        padding: "5px 12px",
                        borderRadius: 6,
                        textDecoration: "none",
                        color: "#2563eb",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                      }}
                      className="hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      + New Recording
                    </Link>
                    {nbNotes.map((note) => (
                      <div
                        key={note.id}
                        style={{
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          borderRadius: 6,
                          background: activeNoteId === note.id ? "rgba(59,130,246,0.1)" : "transparent",
                        }}
                        className="hover:bg-gray-200 dark:hover:bg-gray-700 group"
                      >
                        <Link
                          to={`/notes/${note.id}`}
                          onClick={() => { if (isMobile) onToggle(); }}
                          style={{
                            flex: 1,
                            padding: "5px 12px",
                            textDecoration: "none",
                            color: note.status === "failed" ? "#ef4444" : "inherit",
                            fontSize: "0.83rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "block",
                          }}
                        >
                          {note.status === "processing" ? "Processing..." : note.title || "Untitled"}
                        </Link>
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuNoteId(menuNoteId === note.id ? null : note.id); }}
                          className={`sidebar-toggle ${isMobile ? "" : "opacity-0 group-hover:opacity-100"}`}
                          style={{ width: 24, height: 24, flexShrink: 0, marginRight: 4 }}
                          aria-label="Note options"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                          </svg>
                        </button>
                        {menuNoteId === note.id && (
                          <div
                            ref={menuRef}
                            style={{
                              position: "absolute",
                              right: 0,
                              top: "100%",
                              zIndex: 50,
                              minWidth: 140,
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                              overflow: "hidden",
                            }}
                            className="bg-white dark:bg-gray-800 dark:border-gray-700"
                          >
                            {moveNoteId === note.id ? (
                              /* Move to — notebook list */
                              <>
                                <div style={{ padding: "6px 14px", fontSize: "0.75rem", color: "#9ca3af", fontWeight: 600 }}>
                                  Move
                                </div>
                                {notebooks
                                  .filter((nb) => nb.id !== expandedNbId)
                                  .map((nb) => (
                                    <button
                                      key={nb.id}
                                      onClick={() => handleMoveNote(note.id, nb.id)}
                                      style={{
                                        display: "block",
                                        width: "100%",
                                        padding: "8px 14px",
                                        fontSize: "0.83rem",
                                        border: "none",
                                        background: "transparent",
                                        cursor: "pointer",
                                        textAlign: "left",
                                        color: "inherit",
                                      }}
                                      className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                      {nb.name}
                                    </button>
                                  ))
                                }
                              </>
                            ) : (
                              /* Default menu */
                              <>
                                {note.status !== "processing" && (
                                  <Link
                                    to={`/notes/${note.id}?edit=1`}
                                    onClick={() => setMenuNoteId(null)}
                                    style={{
                                      display: "block",
                                      padding: "8px 14px",
                                      fontSize: "0.83rem",
                                      textDecoration: "none",
                                      color: "inherit",
                                    }}
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    Edit
                                  </Link>
                                )}
                                {note.status !== "processing" && notebooks.length > 1 && (
                                  <button
                                    onClick={() => setMoveNoteId(note.id)}
                                    style={{
                                      display: "block",
                                      width: "100%",
                                      padding: "8px 14px",
                                      fontSize: "0.83rem",
                                      border: "none",
                                      background: "transparent",
                                      cursor: "pointer",
                                      textAlign: "left",
                                      color: "inherit",
                                    }}
                                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                  >
                                    Move
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteNote(note.id)}
                                  style={{
                                    display: "block",
                                    width: "100%",
                                    padding: "8px 14px",
                                    fontSize: "0.83rem",
                                    border: "none",
                                    background: "transparent",
                                    color: "#ef4444",
                                    cursor: "pointer",
                                    textAlign: "left",
                                  }}
                                  className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {nbNotes.length === 0 && (
                      <div style={{ padding: "5px 12px", fontSize: "0.8rem", color: "#9ca3af" }}>
                        No notes yet
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </Show>
        </nav>

        {/* Bottom: auth */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--color-border)" }} className="dark:border-[var(--color-border-dark)]">
          <Show when="signed-in">
            <UserInfo />
          </Show>
          <Show when="signed-out">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SignInButton>
                <button
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    color: "inherit",
                  }}
                >
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton>
                <button
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: "#2563eb",
                    color: "white",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  Sign Up
                </button>
              </SignUpButton>
            </div>
          </Show>
        </div>
      </aside>

      {/* Create Notebook Dialog */}
      {showNewNbDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
          }}
          onClick={() => setShowNewNbDialog(false)}
        >
          <div
            style={{
              padding: 24,
              borderRadius: 12,
              width: "90%",
              maxWidth: 340,
              boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
            }}
            className="bg-white dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>New Notebook</h3>
            <input
              autoFocus
              value={newNbName}
              onChange={(e) => setNewNbName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNotebook(); }}
              placeholder="Notebook name"
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: "0.9rem",
                outline: "none",
                background: "transparent",
                color: "inherit",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => { setShowNewNbDialog(false); setNewNbName(""); }}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  color: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNotebook}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Notebook Dialog */}
      {renameNb && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
          }}
          onClick={() => setRenameNb(null)}
        >
          <div
            style={{
              padding: 24,
              borderRadius: 12,
              width: "90%",
              maxWidth: 340,
              boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
            }}
            className="bg-white dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Rename Notebook</h3>
            <input
              autoFocus
              value={renameNbName}
              onChange={(e) => setRenameNbName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRenameNotebook(); }}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: "0.9rem",
                outline: "none",
                background: "transparent",
                color: "inherit",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setRenameNb(null)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  color: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRenameNotebook}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Notebook Dialog */}
      {deleteNb && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
          }}
          onClick={() => setDeleteNb(null)}
        >
          <div
            style={{
              padding: 24,
              borderRadius: 12,
              width: "90%",
              maxWidth: 380,
              boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
            }}
            className="bg-white dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8 }}>
              Delete "{deleteNb.name}"?
            </h3>

            {deleteNb.note_count > 0 ? (
              <>
                <p style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: 16 }}>
                  This notebook has {deleteNb.note_count} note{deleteNb.note_count > 1 ? "s" : ""}. What would you like to do?
                </p>

                {notebooks.filter((n) => n.id !== deleteNb.id).length > 0 && (
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 0",
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="deleteAction"
                      checked={deleteAction === "move"}
                      onChange={() => setDeleteAction("move")}
                    />
                    <span>Move notes to</span>
                    <select
                      value={deleteMoveTarget ?? ""}
                      onChange={(e) => { setDeleteMoveTarget(e.target.value); setDeleteAction("move"); }}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        fontSize: "0.85rem",
                        background: "transparent",
                        color: "inherit",
                      }}
                    >
                      {notebooks
                        .filter((n) => n.id !== deleteNb.id)
                        .map((n) => (
                          <option key={n.id} value={n.id}>{n.name}</option>
                        ))
                      }
                    </select>
                  </label>
                )}

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 0",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    color: "#ef4444",
                  }}
                >
                  <input
                    type="radio"
                    name="deleteAction"
                    checked={deleteAction === "delete"}
                    onChange={() => setDeleteAction("delete")}
                  />
                  Delete all notes
                </label>
              </>
            ) : (
              <p style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: 16 }}>
                This notebook is empty and will be deleted.
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setDeleteNb(null)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  color: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteNotebook}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#ef4444",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AppContent() {
  const { isSignedIn, isLoaded } = useAuth();
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile);

  // Auto-collapse on mobile, auto-expand on desktop
  useEffect(() => {
    setSidebarCollapsed(isMobile);
  }, [isMobile]);

  if (!isLoaded) {
    return <div style={{ display: "flex", height: "100dvh", alignItems: "center", justifyContent: "center" }} className="text-gray-400">Loading...</div>;
  }

  if (!isSignedIn) {
    return (
      <main style={{ height: "100dvh", overflow: "auto" }}>
        <Outlet />
      </main>
    );
  }

  return (
    <div style={{ display: "flex", height: "100dvh" }}>
      <SidebarContent collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} isMobile={isMobile} />
      <main style={{ flex: 1, overflow: "auto", paddingTop: isMobile && sidebarCollapsed ? 48 : 0 }}>
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
      <AppContent />
    </ClerkProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
