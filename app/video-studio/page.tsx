import { BetaUnavailableNotice } from "@/src/components/layout/BetaUnavailableNotice";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { TopNav } from "@/src/components/layout/TopNav";
import { homePageData } from "@/src/data/homeMock";

export default function VideoStudioPage() {
  return (
    <>
      <TopNav data={homePageData.topNav} />
      <main>
        <PageContainer className="space-y-8 py-8 sm:py-10 lg:space-y-10 lg:py-12">
          <BetaUnavailableNotice title="此功能暂未开放" />
        </PageContainer>
      </main>
    </>
  );
}
