import type { ReactNode } from "react";

import { OrgAppShell } from "@/components/shell/org-app-shell";

export default async function OrganizationLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ organizationId: string }>;
}>) {
  const { organizationId } = await params;

  return <OrgAppShell organizationId={organizationId}>{children}</OrgAppShell>;
}
