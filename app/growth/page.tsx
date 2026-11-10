import { GrowthLocalRecords } from "@/src/components/growth/GrowthLocalRecords";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { TopNav } from "@/src/components/layout/TopNav";
import { homePageData } from "@/src/data/homeMock";

export default function GrowthPage() {
  return (
    <>
      <TopNav data={homePageData.topNav} />
      <main>
        <PageContainer className="space-y-8 py-8 sm:py-10 lg:py-12">
          <GrowthLocalRecords />
        </PageContainer>
      </main>
    </>
  );
}
