import { redirect } from "next/navigation";

export default async function OrganizationIndexPage({
  params,
}: Readonly<{ params: Promise<{ organizationId: string }> }>) {
  const { organizationId } = await params;
  redirect(`/orgs/${organizationId}/overview`);
}
