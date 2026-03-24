import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("notebooks/:id/new", "routes/new-note.tsx"),
  route("notes/:id", "routes/note-detail.tsx"),
] satisfies RouteConfig;
