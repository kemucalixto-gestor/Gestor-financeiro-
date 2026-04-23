import { BottomNav } from "@/components/BottomNav";
import { requireUser } from "@/lib/session";
import { generatePendingTransactions } from "@/lib/recurring";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // Lazy run: garante que recorrências fiquem em dia sempre que o usuário abre o app.
  await generatePendingTransactions(user.id).catch(() => undefined);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col pb-20">
      {children}
      <BottomNav />
    </div>
  );
}
