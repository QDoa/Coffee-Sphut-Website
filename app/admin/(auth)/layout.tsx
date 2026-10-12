import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Sign In | Coffee Sphut",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4 sm:p-8">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
