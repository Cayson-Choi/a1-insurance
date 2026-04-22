import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/rbac";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/customers");

  return <div className="mx-auto w-full max-w-screen-2xl">{children}</div>;
}
