import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireStaff } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Admin Dashboard | Coffee Sphut",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const staff = await requireStaff("editor");
  const isStaging = Boolean(
    process.env.SUPABASE_URL?.includes("dev") ||
    process.env.SUPABASE_URL?.includes("staging") ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === "preview",
  );

  return (
    <AdminShell email={staff.email} role={staff.role} isStaging={isStaging}>
      {children}
    </AdminShell>
  );
}
