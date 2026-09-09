import type { AnchorHTMLAttributes, ReactNode } from "react";

// GitHub Pages link adapter; never include it in the server-rendered Worker bundle.

const BASE_PATH = "/data-dashboard/";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string; query?: Record<string, string> };
  children?: ReactNode;
};

function resolveHref(href: LinkProps["href"]) {
  if (typeof href === "string") {
    if (href.startsWith("/dashboard/")) return `${BASE_PATH}#${href}`;
    return href;
  }

  const pathname = href.pathname ?? "/";
  const query = href.query
    ? `?${new URLSearchParams(href.query).toString()}`
    : "";
  return pathname.startsWith("/dashboard/")
    ? `${BASE_PATH}#${pathname}${query}`
    : `${pathname}${query}`;
}

export default function Link({ href, children, ...props }: LinkProps) {
  return (
    <a href={resolveHref(href)} {...props}>
      {children}
    </a>
  );
}
