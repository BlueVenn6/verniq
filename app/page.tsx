import { HomeWorkspaceHub } from "@/src/components/home/HomeWorkspaceHub";
import { HeroSection } from "@/src/components/home/HeroSection";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { TopNav } from "@/src/components/layout/TopNav";
import { homePageData } from "@/src/data/homeMock";

export default function Home() {
  return (
    <>
      <TopNav data={homePageData.topNav} />
      <main>
        <PageContainer className="space-y-6 py-5 sm:py-6 lg:py-8">
          <HeroSection data={homePageData.hero} />
          <HomeWorkspaceHub />
        </PageContainer>
      </main>
    </>
  );
}
