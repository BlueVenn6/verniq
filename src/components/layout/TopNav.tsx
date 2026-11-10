"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { WorkspaceFileControls } from "@/src/components/layout/WorkspaceFileControls";
import type { TopNavData } from "@/src/lib/types";
import { useLearningUi } from "@/src/components/LanguageProvider";
import { FullTextSelect } from "@/src/components/FullTextSelect";

type TopNavProps = {
  data: TopNavData;
};

export function TopNav({ data }: TopNavProps) {
  const { targetLanguage, t, switchMode } = useLearningUi();
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);

    updateHash();
    window.addEventListener("hashchange", updateHash);

    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  const isActive = (href: string) => {
    const item = data.items.find((entry) => entry.href === href);

    if (!item) return pathname === href;
    if (href === "/") return pathname === "/" && hash !== "#life-map";
    if (pathname === href) return true;

    return (
      item.matchPrefixes?.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      ) ?? false
    );
  };

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-[#f8f3ed]/85 backdrop-blur">
      <div className="mx-auto grid min-h-16 w-full max-w-7xl grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-5 py-2 sm:min-h-[4.5rem] sm:px-8 md:grid-cols-[auto_minmax(0,1fr)_auto] lg:px-10">
        <Link href="/" className="flex shrink-0 items-center" aria-label={t("Verniq 首页")}>
          <Image
            src="/brand/verniq-mark-transparent.png"
            alt={data.productName}
            width={332}
            height={295}
            className="h-11 w-auto sm:h-12"
            priority
          />
        </Link>

        <nav className="hidden min-w-0 w-fit flex-wrap items-center justify-center justify-self-center gap-1 rounded-[var(--radius-control)] border border-stone-200 bg-white/70 p-1 text-sm font-medium text-stone-700 shadow-sm shadow-stone-200/40 md:flex">
          {data.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-[calc(var(--radius-control)-0.25rem)] px-3 py-2 transition hover:bg-stone-100 hover:text-stone-950 ${
                isActive(item.href) ? "bg-stone-900 text-[#fffaf0] hover:bg-stone-900 hover:text-[#fffaf0]" : ""
              }`}
            >
              {t(item.label)}
            </Link>
          ))}
        </nav>

        <label className="justify-self-end text-xs text-stone-600">
          <span className="sr-only">{t("学习模式")}</span>
          <FullTextSelect aria-label={t("学习模式")} value={targetLanguage}
            onChange={(event) => switchMode(event.target.value as "en" | "zh")}
            className="w-max max-w-[calc(100vw-110px)] rounded-lg border border-stone-300 bg-white px-3 py-2">
            <option value="en">{t("中文 → 学英语")}</option>
            <option value="zh">{t("English → 中文")}</option>
          </FullTextSelect>
        </label>
      </div>
      <nav className="flex flex-wrap gap-2 border-t border-stone-200/70 bg-white/70 px-5 py-2 text-sm font-medium text-stone-700 md:hidden">
        {data.items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-[calc(var(--radius-control)-0.25rem)] px-4 py-2 transition hover:bg-stone-100 hover:text-stone-950 ${
              isActive(item.href) ? "bg-stone-900 text-[#fffaf0] hover:bg-stone-900 hover:text-[#fffaf0]" : ""
            }`}
          >
            {t(item.label)}
          </Link>
        ))}
      </nav>
      <WorkspaceFileControls />
    </header>
  );
}
