import { requireModuleAccess } from "@/lib/auth-server";
import type { ModuleKey } from "@/lib/types";

import { ResortDashboard } from "./resort-dashboard";

export async function AuthorizedDashboardPage({
  module,
}: {
  module: ModuleKey;
}) {
  await requireModuleAccess(module);

  return <ResortDashboard key={module} initialModule={module} />;
}

