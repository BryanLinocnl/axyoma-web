"use client";
import { cn } from "@/lib/utils";
import { IconMenu2, IconX } from "@tabler/icons-react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "motion/react";
import Link from "next/link";
import React, { useRef, useState } from "react";

interface NavbarProps {
  children: React.ReactNode;
  className?: string;
}

interface NavBodyProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface NavItemsProps {
  items: { name: string; link: string }[];
  className?: string;
  onItemClick?: () => void;
}

interface MobileNavProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface MobileNavHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface MobileNavMenuProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const Navbar = ({ children, className }: NavbarProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState<boolean>(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setVisible(latest > 80);
  });

  return (
    <motion.div
      ref={ref}
      className={cn("fixed inset-x-0 top-0 z-50 w-full", className)}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(
              child as React.ReactElement<{ visible?: boolean }>,
              { visible },
            )
          : child,
      )}
    </motion.div>
  );
};

export const NavBody = ({ children, className, visible }: NavBodyProps) => {
  return (
    <motion.div
      animate={{
        width: visible ? "40%" : "100%",
        y: visible ? 20 : 0,
        backgroundColor: visible
          ? "rgba(10, 10, 10, 0.76)"
          : "rgba(10, 10, 10, 0)",
        backdropFilter: visible ? "blur(14px) saturate(150%)" : "blur(0px)",
        boxShadow: visible
          ? "0 0 0 1px rgba(255, 255, 255, 0.09), 0 20px 40px -12px rgba(0, 0, 0, 0.45)"
          : "0 0 0 0px rgba(255, 255, 255, 0)",
      }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 50,
      }}
      style={{
        minWidth: "800px",
      }}
      className={cn(
        "relative z-[60] mx-auto hidden h-16 max-w-7xl flex-row items-center justify-between rounded-none bg-transparent px-4 py-2 lg:flex",
        visible && "rounded-full",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <motion.div
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "absolute inset-0 hidden flex-1 flex-row items-center justify-center gap-2 text-sm font-medium text-zinc-600 lg:flex",
        className,
      )}
    >
      {items.map((item, idx) => (
        <a
          onMouseEnter={() => setHovered(idx)}
          onClick={onItemClick}
          className="relative px-4 py-2 text-white/70 transition-colors hover:text-white"
          key={`link-${idx}`}
          href={item.link}
        >
          {hovered === idx && (
            <motion.div
              layoutId="nav-item-hover"
              className="absolute inset-0 h-full w-full rounded-full bg-white/10"
            />
          )}
          <span className="relative z-20">{item.name}</span>
        </a>
      ))}
    </motion.div>
  );
};

export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
  return (
    <motion.div
      animate={{
        width: visible ? "90%" : "100%",
        paddingRight: visible ? "12px" : "0px",
        paddingLeft: visible ? "12px" : "0px",
        borderRadius: visible ? "1.5rem" : "0rem",
        y: visible ? 20 : 0,
        backgroundColor: visible
          ? "rgba(10, 10, 10, 0.80)"
          : "rgba(10, 10, 10, 0)",
        backdropFilter: visible ? "blur(14px) saturate(150%)" : "blur(0px)",
        boxShadow: visible
          ? "0 0 0 1px rgba(255, 255, 255, 0.09), 0 20px 40px -12px rgba(0, 0, 0, 0.45)"
          : "0 0 0 0px rgba(255, 255, 255, 0)",
      }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 50,
      }}
      className={cn(
        "relative z-50 mx-auto flex w-full max-w-[calc(100vw-2rem)] flex-col items-center justify-between bg-transparent px-0 py-3 lg:hidden",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export const MobileNavHeader = ({
  children,
  className,
}: MobileNavHeaderProps) => {
  return (
    <div
      className={cn(
        "flex w-full flex-row items-center justify-between px-4",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const MobileNavMenu = ({
  children,
  className,
  isOpen,
  onClose,
}: MobileNavMenuProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          className={cn(
            "absolute inset-x-4 top-[calc(100%+0.75rem)] z-50 flex w-auto flex-col items-start justify-start gap-3 rounded-3xl border border-white/10 bg-neutral-950/95 p-4 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white transition-colors hover:bg-white/10"
      aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
    >
      {isOpen ? (
        <IconX className="h-5 w-5" />
      ) : (
        <IconMenu2 className="h-5 w-5" />
      )}
    </button>
  );
};

export const NavbarLogo = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  return (
    <Link
      href="/"
      className={cn(
        "relative z-20 mr-4 flex items-center space-x-2 px-2 py-1",
        className,
      )}
    >
      {children}
    </Link>
  );
};

export const NavbarButton = ({
  href,
  as: Tag = "a",
  children,
  className,
  variant = "primary",
  ...props
}: {
  href?: string;
  as?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "dark" | "gradient";
} & (
  | React.ComponentPropsWithoutRef<"a">
  | React.ComponentPropsWithoutRef<"button">
)) => {
  const baseStyles =
    "px-4 py-2 rounded-full text-sm font-semibold relative cursor-pointer transition duration-200 inline-flex items-center justify-center gap-2 text-center whitespace-nowrap";

  const variantStyles = {
    primary:
      "bg-white text-neutral-950 hover:bg-white/90 shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset]",
    secondary:
      "bg-transparent text-white/80 hover:text-white hover:bg-white/5 shadow-none",
    dark:
      "bg-black text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset] hover:bg-white/5",
    gradient:
      "brand-gradient text-neutral-950 shadow-none hover:opacity-90",
  };

  return (
    <Tag
      href={href || undefined}
      className={cn(baseStyles, variantStyles[variant], className)}
      {...props}
    >
      {children}
    </Tag>
  );
};
