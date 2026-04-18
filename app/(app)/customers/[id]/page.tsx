import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/rbac";
import { getCustomerDetail, getDetailContext } from "@/lib/customers/get-detail";
import { listAgents } from "@/lib/customers/queries";
import { preserveQuery } from "@/lib/customers/preserve-query";
import { DetailForm } from "@/components/customers/detail-form";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `고객 #${id.slice(0, 8)}` };
}

export default async function CustomerDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const user = await requireUser();
  const [customer, context, agents] = await Promise.all([
    getCustomerDetail(id, user),
    getDetailContext(id, sp, user),
    user.role === "admin" ? listAgents() : Promise.resolve([]),
  ]);

  if (!customer) notFound();

  const qs = preserveQuery(sp);
  const closeHref = `/customers${qs}`;
  const prevHref = context.prevId ? `/customers/${context.prevId}${qs}` : null;
  const nextHref = context.nextId ? `/customers/${context.nextId}${qs}` : null;

  return (
    <div className="mx-auto w-full max-w-5xl rounded-xl border bg-card shadow-sm overflow-hidden">
      <DetailForm
        customer={customer}
        agents={agents}
        canEditAgent={user.role === "admin"}
        prevHref={prevHref}
        nextHref={nextHref}
        closeHref={closeHref}
        variant="page"
      />
    </div>
  );
}
