"use client";

import Link from "next/link";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { TopNav } from "@/src/components/layout/TopNav";
import { homePageData } from "@/src/data/homeMock";
import { PUBLISH_PACKAGE_MIGRATION_NOTICE } from "@/src/lib/publishStudio";
import { useLearningUi } from "@/src/components/LanguageProvider";

export default function PublishPackagesPage() {
  const { t } = useLearningUi();
  return (
    <>
      <TopNav data={homePageData.topNav} />
      <main>
        <PageContainer className="py-8 sm:py-10 lg:py-12">
          <section className="rounded-[1.5rem] border border-stone-200 bg-[#fffaf0] px-6 py-8 shadow-sm shadow-stone-200/70 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a77b49]">
              Publish Packages
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-stone-950">
              {t("旧发布包页面已迁移")}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-stone-600">
              {t(PUBLISH_PACKAGE_MIGRATION_NOTICE)}
            </p>
            <Link href="/publish" className="brand-primary-button mt-6 inline-flex px-5 py-3 text-sm">
              {t("打开发布工作台")}
            </Link>
          </section>
        </PageContainer>
      </main>
    </>
  );
}
