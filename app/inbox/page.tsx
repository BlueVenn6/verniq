import { InboxPersistedWorkspace } from "@/src/components/InboxPersistedWorkspace";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { TopNav } from "@/src/components/layout/TopNav";
import { homePageData } from "@/src/data/homeMock";

export default function InboxPage() {
  return (
    <>
      <TopNav data={homePageData.topNav} />
      <main>
        <PageContainer className="py-4 sm:py-5">
          <InboxPersistedWorkspace />
        </PageContainer>
      </main>
    </>
  );
}
