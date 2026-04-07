import { Link, useLocation } from "wouter";
import { Map, Cpu, Activity, BookOpen } from "lucide-react";

const navItems = [
  { href: "/", label: "Harita", icon: Map },
  { href: "/devices", label: "Cihazlar", icon: Cpu },
  { href: "/esp32-guide", label: "ESP32 Rehber", icon: BookOpen },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 flex flex-col items-center py-4 border-r border-border bg-card gap-2 z-10">
        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
          <Activity className="w-5 h-5 text-primary" />
        </div>

        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link key={href} href={href}>
              <div
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                title={label}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer group relative ${
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="absolute left-full ml-2 px-2 py-1 rounded text-xs font-medium bg-card border border-border text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                  {label}
                </span>
              </div>
            </Link>
          );
        })}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
