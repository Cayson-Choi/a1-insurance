import { notFound } from "next/navigation";
import { requireUserWithPerms } from "@/lib/auth/rbac";
import { getCustomerDetail, getDetailContext } from "@/lib/customers/get-detail";
import { listAgents } from "@/lib/customers/queries";
import { preserveQuery } from "@/lib/customers/preserve-query";
import { DetailDialog } from "@/components/customers/detail-dialog";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toStringMap(sp: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      if (v.length && v[0]) out[k] = v[0];
    } else {
      out[k] = v;
    }
  }
  return out;
}

export default async function CustomerDetailModal({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const user = await requireUserWithPerms();
  const [customer, context, agents] = await Promise.all([
    getCustomerDetail(id, user),
    getDetailContext(id, sp, user),
    user.role === "admin" ? listAgents() : Promise.resolve([]),
  ]);

  if (!customer) notFound();

  const closeHref = `/customers${preserveQuery(sp)}`;
  const preservedParams = toStringMap(sp);

  return (
    <DetailDialog
      customer={customer}
      agents={agents}
      canEdit={user.canEdit}
      canDelete={user.canDelete}
      canEditAgent={user.role === "admin"}
      canRevealRrn={user.role === "admin"}
      prevId={context.prevId}
      nextId={context.nextId}
      preservedParams={preservedParams}
      closeHref={closeHref}
    />
  );
}
