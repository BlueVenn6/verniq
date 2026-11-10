"use client";

import Link from "next/link";
import { useLearningUi } from "@/src/components/LanguageProvider";

type BetaUnavailableNoticeProps = {
  title: string;
  description?: string;
};

export function BetaUnavailableNotice({
  title,
  description,
}: BetaUnavailableNoticeProps) {
  const { t } = useLearningUi();
  return (
    <section className="rounded-[1.5rem] border border-stone-200 bg-white p-6 shadow-sm shadow-stone-200/60 sm:p-8">
      <p className="text-sm font-semibold text-stone-500">{t("当前 Beta 未开放")}</p>
      <h1 className="mt-2 text-3xl font-semibold text-stone-950">{t(title)}</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-600">
        {t(description ??
          "此功能暂未开放。当前可用路径是：导入英语材料、打开阅读器、保存词汇或表达、进入复习，并在积累页查看学习记录。")}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/inbox"
          className="inline-flex rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white"
        >
          {t("导入英语材料")}
        </Link>
        <Link
          href="/reader"
          className="inline-flex rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700"
        >
          {t("打开阅读器")}
        </Link>
      </div>
    </section>
  );
}
