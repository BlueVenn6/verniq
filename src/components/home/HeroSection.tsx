"use client";

import Image from "next/image";
import { useLearningUi } from "@/src/components/LanguageProvider";
import type { HeroData } from "@/src/lib/types";

type HeroSectionProps = {
  data: HeroData;
};

export function HeroSection({ data }: HeroSectionProps) {
  const { t } = useLearningUi();
  return (
    <section
      id="today"
      className="brand-hero relative overflow-hidden px-2 py-5 sm:px-4 sm:py-6 lg:px-6 lg:py-7"
    >
      <div className="relative">
        <div className="mx-auto flex max-w-3xl justify-center">
          <Image
            src="/brand/verniq-logo-lockup-transparent.png"
            alt="Verniq - Interest-led language learning"
            width={1137}
            height={332}
            className="h-auto w-full max-w-[42rem]"
            priority
          />
        </div>

        <div className="mx-auto mt-5 max-w-3xl text-center">
          <h1 className="whitespace-pre-line text-[2rem] font-semibold leading-tight text-stone-950 sm:text-[2.35rem] lg:text-[2.65rem]">
            {t(data.title)}
          </h1>
          <p className="mx-auto mt-3 text-[15px] font-normal leading-7 text-stone-500">
            {t(data.greeting)}
          </p>
          <p className="mx-auto mt-4 max-w-[44rem] text-[17px] font-normal leading-[1.7] text-stone-600">
            {t(data.subtitle)}
          </p>
          <p className="brand-status-pill mt-4 inline-flex px-4 py-2 text-sm text-stone-600">
            {t(data.statusLine)}
          </p>
        </div>

      </div>
    </section>
  );
}
