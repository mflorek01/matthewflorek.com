import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedAdmin } from "@/lib/auth";
import "./admin.css";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const isLoginRoute =
    requestHeaders.get("x-portfolio-admin-login-route") === "1";
  if (!isLoginRoute && !(await getAuthenticatedAdmin()))
    redirect("/admin/login");
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link href="/admin" className="admin-brand">
          Portfolio CMS
        </Link>
        {!isLoginRoute ? (
          <nav className="admin-nav">
            <Link href="/admin">Pages/Home</Link>
            <Link href="/admin/ai">AI assistant</Link>
            <Link href="/admin/integrations/metamorphysis">Integrations</Link>
            <Link href="/admin/analytics">Analytics</Link>
            <Link href="/admin/help">Help</Link>
            <form action="/api/auth/logout" method="post">
              <button className="admin-button admin-button-muted" type="submit">
                Sign out
              </button>
            </form>
          </nav>
        ) : null}
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
