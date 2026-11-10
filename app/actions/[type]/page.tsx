import { notFound } from "next/navigation";
import {
  actionTypes,
  type ActionType,
} from "@/src/data/actionPages";
import { BetaUnavailableNotice } from "@/src/components/layout/BetaUnavailableNotice";
import { PageContainer } from "@/src/components/layout/PageContainer";
import { TopNav } from "@/src/components/layout/TopNav";
import { homePageData } from "@/src/data/homeMock";

export function generateStaticParams() {
  return actionTypes.map((type) => ({ type }));
}

function isActionType(type: string): type is ActionType {
  return actionTypes.includes(type as ActionType);
}

export default async function ActionPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;

  if (!isActionType(type)) {
    notFound();
  }

  return (
    <>
      <TopNav data={homePageData.topNav} />
      <main>
        <PageContainer className="py-8 sm:py-10 lg:py-12">
          <BetaUnavailableNotice title="快速动作暂未开放" />
        </PageContainer>
      </main>
    </>
  );
}
