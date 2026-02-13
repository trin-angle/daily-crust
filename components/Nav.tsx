"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav() {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/weekly", label: "Weekly" },
  ];

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-surface-card">
      <span className="text-lg font-bold tracking-tight text-text-primary">
        daily-crust
      </span>
      <div className="flex gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              pathname === link.href
                ? "bg-brand-green text-surface-base"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-card"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
