import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if user is authenticated
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  // Check if user is admin
  const adminStatus = await isAdmin();

  if (!adminStatus) {
    // Redirect non-admin users to home page
    redirect("/");
  }

  return <>{children}</>;
}
