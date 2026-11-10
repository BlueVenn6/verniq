import { ConfigCenterWorkspacePersisted } from "@/src/components/ConfigCenterWorkspacePersisted";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { TopNav } from "@/src/components/layout/TopNav";
import { WorkspaceFileControls } from "@/src/components/layout/WorkspaceFileControls";
import { homePageData } from "@/src/data/homeMock";

export default function ConfigCenterPage() {
  return (
    <>
      <TopNav data={homePageData.topNav} />
      <main>
        <PageContainer className="space-y-8 py-8 sm:py-10 lg:space-y-10 lg:py-12">
          <ConfigCenterWorkspacePersisted />
          <WorkspaceFileControls manage />
        </PageContainer>
      </main>
    </>
  );
}
