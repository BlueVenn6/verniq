import { PageContainer } from "@/src/components/layout/PageContainer";
import { TopNav } from "@/src/components/layout/TopNav";
import { PublishStudio } from "@/src/components/publish/PublishStudio";
import { homePageData } from "@/src/data/homeMock";

export default function PublishPage() {
  return (
    <>
      <TopNav data={homePageData.topNav} />
      <main>
        <PageContainer className="py-4 sm:py-5">
          <PublishStudio />
        </PageContainer>
      </main>
    </>
  );
}
