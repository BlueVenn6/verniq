import { BetaUnavailableNotice } from "@/src/components/layout/BetaUnavailableNotice";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { TopNav } from "@/src/components/layout/TopNav";
import { homePageData } from "@/src/data/homeMock";

export default function StudioPage() {
  return (
    <>
      <TopNav data={homePageData.topNav} />
      <main>
        <PageContainer className="py-8 sm:py-10 lg:py-12">
          <BetaUnavailableNotice title="Studio 工作台暂未开放" />
        </PageContainer>
      </main>
    </>
  );
}
