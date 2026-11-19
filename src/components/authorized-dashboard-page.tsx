import { requireModuleAccess } from "@/lib/auth-server";
import type { ModuleKey } from "@/lib/types";

import { ResortDashboard } from "./resort-dashboard";

export async function AuthorizedDashboardPage({
  module,
}: {
  module: ModuleKey;
}) {
  const { access } = await requireModuleAccess(module);

  return (
    <ResortDashboard
      key={module}
      initialModule={module}
      access={access}
      canInviteUsers={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
    />
  );
}
