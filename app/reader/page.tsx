"use client";

import { PageContainer } from "@/src/components/layout/PageContainer";
import { TopNav } from "@/src/components/layout/TopNav";
import { ReaderWorkspace } from "@/src/components/reader/ReaderWorkspace";
import { homePageData } from "@/src/data/homeMock";

export default function ReaderPage() {
  return (
    <>
      <TopNav data={homePageData.topNav} />
      <main>
        <PageContainer className="py-4 sm:py-5">
          <ReaderWorkspace />
        </PageContainer>
      </main>
    </>
  );
}
