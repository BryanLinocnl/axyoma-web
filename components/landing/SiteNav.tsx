"use client";

import Link from "next/link";
import { useState } from "react";
import { AxiomaLogo } from "@/components/AxiomaLogo";
import {
  Navbar,
  NavBody,
  NavItems,
  MobileNav,
  NavbarLogo,
  NavbarButton,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "@/components/ui/resizable-navbar";

const NAV_ITEMS = [
  { name: "Recursos", link: "/recursos" },
  { name: "Planos", link: "#planos" },
  { name: "FAQ", link: "#faq" },
  { name: "Sobre", link: "/contato" },
  { name: "Docs", link: "/docs" },
];

export function SiteNav(): React.JSX.Element {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <Navbar>
      {/* Desktop Navigation */}
      <NavBody>
        <NavbarLogo>
          <AxiomaLogo id="nav" className="h-7 w-7" />
          <span className="font-brand text-lg tracking-tight text-white">Axyoma</span>
        </NavbarLogo>

        <NavItems items={NAV_ITEMS} />

        <div className="flex items-center gap-3">
          <NavbarButton variant="secondary" href="/login">
            Entrar
          </NavbarButton>
          <NavbarButton variant="gradient" href="/download">
            Baixar grátis
          </NavbarButton>
        </div>
      </NavBody>

      {/* Mobile Navigation */}
      <MobileNav>
        <MobileNavHeader>
          <NavbarLogo>
            <AxiomaLogo id="nav-mobile" className="h-7 w-7" />
            <span className="font-brand text-lg tracking-tight text-white">Axyoma</span>
          </NavbarLogo>
          <MobileNavToggle
            isOpen={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />
        </MobileNavHeader>

        <MobileNavMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        >
          {NAV_ITEMS.map((item, idx) => (
            <a
              key={`mobile-link-${idx}`}
              href={item.link}
              onClick={() => setIsMobileMenuOpen(false)}
              className="relative block px-2 py-1 text-white/70 transition-colors hover:text-white"
            >
              {item.name}
            </a>
          ))}
          <div className="flex w-full flex-col gap-3 pt-2">
            <NavbarButton
              href="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              variant="secondary"
              className="w-full"
            >
              Entrar
            </NavbarButton>
            <NavbarButton
              href="/download"
              onClick={() => setIsMobileMenuOpen(false)}
              variant="gradient"
              className="w-full"
            >
              Baixar grátis
            </NavbarButton>
          </div>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
}
