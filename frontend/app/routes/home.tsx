import { Show, useAuth } from "@clerk/react";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "RiffNote" },
    { name: "description", content: "Voice to structured notes" },
  ];
}

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate("/notebooks", { replace: true });
    }
  }, [isLoaded, isSignedIn]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "2rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem" }}>Welcome to RiffNote</h1>
      <Show when="signed-out">
        <p className="text-gray-500">Please sign in to get started.</p>
      </Show>
    </div>
  );
}
