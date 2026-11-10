import { notFound } from "next/navigation";
import { BetaUnavailableNotice } from "@/src/components/layout/BetaUnavailableNotice";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { TopNav } from "@/src/components/layout/TopNav";
import { areaSlugs, type AreaSlug } from "@/src/data/areaPages";
import { homePageData } from "@/src/data/homeMock";

export function generateStaticParams() {
  return areaSlugs.map((slug) => ({ slug }));
}

function isAreaSlug(slug: string): slug is AreaSlug {
  return areaSlugs.includes(slug as AreaSlug);
}

export default async function AreaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!isAreaSlug(slug)) {
    notFound();
  }

  return (
    <>
      <TopNav data={homePageData.topNav} />
      <main>
        <PageContainer className="py-8 sm:py-10 lg:py-12">
          <BetaUnavailableNotice title="领域页暂未开放" />
        </PageContainer>
      </main>
    </>
  );
}
