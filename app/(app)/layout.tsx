import { requireUser } from "@/lib/auth/rbac";
import { AppHeader } from "@/components/brand/app-header";
import { AppFooter } from "@/components/brand/app-footer";
import { IdleTimeout } from "@/components/auth/idle-timeout";

export default async function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader user={user} />
      <main className="flex-1 mx-auto w-full max-w-screen-2xl px-3 md:px-6 py-4 md:py-6">
        {children}
      </main>
      <AppFooter />
      <IdleTimeout />
      {modal}
    </div>
  );
}
