import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, Stethoscope } from "lucide-react";
import { useOrganizationDetails } from "@/lib/organization";

const NAV = [
  { label: "Courses", to: "/courses" },
  { label: "About", to: "/about" },
  { label: "Faculty", to: "/faculty" },
  { label: "Results", to: "/placements" },
  { label: "Blog", to: "/blog" },
  { label: "Contact", to: "/contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const organization = useOrganizationDetails();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 z-50 w-full transition-all duration-300 ${
        open ? "bg-navy" : "bg-navy/95 backdrop-blur-md"
      } border-b border-navy-800 shadow-lg`}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-5 lg:px-8">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-gold transition-transform">
            <img src='../../logo.jpeg' className="h-full w-full" />
          </span>
          <span className="font-display text-[17px] font-extrabold tracking-tight text-white">
            {organization.name}
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeProps={{ className: "text-gold bg-white/10" }}
              className="rounded-full px-4 py-2 text-sm font-medium text-white/90 hover:text-gold hover:bg-white/10 transition-colors"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm font-medium text-white/90 hover:text-gold transition-colors"
          >
            Login
          </Link>
          <Link
            to="/enroll"
            className="group inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:bg-gold/90 transition-colors"
          >
            Enroll Now
            <span className="grid h-5 w-5 place-items-center rounded-full bg-navy text-gold text-[10px] font-bold group-hover:rotate-45 transition-transform">
              →
            </span>
          </Link>
        </div>

        <button
          aria-label="menu"
          onClick={() => setOpen(true)}
          className="lg:hidden grid h-10 w-10 place-items-center rounded-full text-white"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-navy/90 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[85%] max-w-sm bg-navy p-6 flex flex-col">
            <div className="flex justify-between items-center">
              <span className="font-display font-extrabold text-gold">
                Menu
              </span>
              <button
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>
            <nav className="mt-8 flex flex-col gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-base font-semibold text-white hover:bg-white/10"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-2">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-white/10"
              >
                Login
              </Link>
              <Link
                to="/enroll"
                onClick={() => setOpen(false)}
                className="rounded-full bg-gold px-5 py-3 text-center text-sm font-bold text-navy hover:bg-gold/90"
              >
                Enroll Now
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
