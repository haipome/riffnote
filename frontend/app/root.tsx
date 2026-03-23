import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  useAuth,
  UserButton,
} from "@clerk/react";
import { useEffect, useState } from "react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { apiFetch } from "~/lib/api";

interface Notebook {
  id: number;
  name: string;
  is_default: boolean;
  note_count: number;
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

function SidebarContent({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { getToken, isSignedIn } = useAuth();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const location = useLocation();

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      const token = await getToken();
      if (!token) return;
      const data = await apiFetch<Notebook[]>("/api/notebooks", token);
      setNotebooks(data);
    })();
  }, [isSignedIn, location.pathname]);

  // Extract active notebook id from URL
  const nbMatch = location.pathname.match(/^\/notebooks\/(\d+)/);
  const activeNbId = nbMatch ? Number(nbMatch[1]) : null;

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

      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        {/* Top: logo + collapse */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
          <Link to="/notebooks" style={{ textDecoration: "none", fontWeight: 700, fontSize: "1.1rem", color: "inherit" }}>
            RiffNote
          </Link>
          <button onClick={onToggle} className="sidebar-toggle" aria-label="Close sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 19l-7-7 7-7M4 12h16" />
            </svg>
          </button>
        </div>

        {/* Notebooks nav */}
        <nav style={{ flex: 1, padding: "8px 12px", overflow: "auto" }}>
          <Show when="signed-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 12px", marginBottom: 4 }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.05em" }}>
                Notebooks
              </span>
              <Link to="/notebooks" className="sidebar-toggle" style={{ width: 24, height: 24 }} aria-label="Manage notebooks">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                </svg>
              </Link>
            </div>
            {notebooks.map((nb) => (
              <Link
                key={nb.id}
                to={`/notebooks/${nb.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 6,
                  textDecoration: "none",
                  color: "inherit",
                  fontSize: "0.9rem",
                  background: activeNbId === nb.id ? "rgba(0,0,0,0.05)" : "transparent",
                }}
                className="hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {nb.name}
                </span>
                <span style={{ fontSize: "0.75rem", color: "#9ca3af", flexShrink: 0 }}>{nb.note_count}</span>
              </Link>
            ))}
          </Show>
        </nav>

        {/* Bottom: auth */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--color-border)" }} className="dark:border-[var(--color-border-dark)]">
          <Show when="signed-in">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <UserButton
                appearance={{
                  elements: { avatarBox: { width: 32, height: 32 } },
                }}
              />
              <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Account</span>
            </div>
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
    </>
  );
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
      <div style={{ display: "flex", height: "100vh" }}>
        <SidebarContent collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main style={{ flex: 1, overflow: "auto" }}>
          <Outlet />
        </main>
      </div>
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
