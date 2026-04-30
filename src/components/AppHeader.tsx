"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const navItems = [
    { href: "/", label: "Library" },
    { href: "/new", label: "Add notes" },
    { href: "/profile", label: "Profile" },
  ];

  return (
    <header className="border-b border-slate-200 bg-white/60 backdrop-blur sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 flex items-center justify-between h-14">
        <Link href="/" className="font-serif text-xl">
          Med<span className="text-[var(--accent)]">Quiz</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-4">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-2 sm:px-3 py-1.5 text-sm rounded-md transition-colors ${
                  active
                    ? "text-[var(--accent)] font-medium"
                    : "text-[var(--muted)] hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={logout}
            className="text-sm text-[var(--muted)] hover:text-slate-900 px-2 sm:px-3 py-1.5"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
