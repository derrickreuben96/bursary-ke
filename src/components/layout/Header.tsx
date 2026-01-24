import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, GraduationCap, Shield, Building2, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/bursaries", label: "Browse Bursaries" },
  { href: "/apply/secondary", label: "Apply (Secondary)" },
  { href: "/apply/university", label: "Apply (University)" },
  { href: "/track", label: "Track Application" },
  { href: "/faq", label: "FAQ" },
];

const portalLinks = [
  { href: "/admin/login", label: "Admin", icon: Shield },
  { href: "/treasury/login", label: "Treasury", icon: Building2 },
  { href: "/commissioner/login", label: "Commissioner", icon: UserCheck },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-foreground">Bursary-KE</span>
            <span className="text-xs text-muted-foreground">Empowering Education</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 hover:scale-105",
                location.pathname === link.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {link.label}
            </Link>
          ))}
          
          {/* Portal Access Buttons */}
          <div className="flex items-center gap-1 ml-2 border-l border-border pl-2">
            {portalLinks.map((portal) => {
              const Icon = portal.icon;
              const isActive = location.pathname.startsWith(portal.href.replace("/login", ""));
              return (
                <Link
                  key={portal.href}
                  to={portal.href}
                  className={cn(
                    "px-3 py-2 text-xs font-medium rounded-lg transition-all duration-300 hover:scale-105 flex items-center gap-1.5 border",
                    isActive
                      ? "bg-accent text-accent-foreground border-accent"
                      : "text-muted-foreground hover:text-accent hover:bg-accent/10 border-transparent hover:border-accent/30"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {portal.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border animate-slide-up">
          <nav className="container py-4 flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                  location.pathname === link.href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {link.label}
              </Link>
            ))}
            {/* Portal Access Buttons (Mobile) */}
            <div className="border-t border-border pt-2 mt-2">
              <p className="px-4 py-1 text-xs font-semibold text-muted-foreground uppercase">Portals</p>
              {portalLinks.map((portal) => {
                const Icon = portal.icon;
                const isActive = location.pathname.startsWith(portal.href.replace("/login", ""));
                return (
                  <Link
                    key={portal.href}
                    to={portal.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "px-4 py-3 text-sm font-medium rounded-lg transition-colors flex items-center gap-2",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {portal.label} Portal
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
