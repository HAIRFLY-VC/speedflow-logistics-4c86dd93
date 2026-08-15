import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ctes")({
  component: CtesLayout,
});

function CtesLayout() {
  return <Outlet />;
}
