import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import styles from "./dashboard-layout.module.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) redirect("/auth/login");
  if (!["owner", "staff", "rider"].includes(session.user.role)) redirect("/");

  return (
    <div className={styles.dashWrap}>
      <DashboardSidebar
        userRole={session.user.role}
        userName={session.user.name ?? undefined}
      />
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}
