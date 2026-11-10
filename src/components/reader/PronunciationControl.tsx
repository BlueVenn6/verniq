"use client";

import { useEffect, useRef, useState } from "react";
import { useLearningUi } from "@/src/components/LanguageProvider";

export function pronunciationVoice(voices: SpeechSynthesisVoice[], language: string) {
  const normalized = language.toLowerCase().replaceAll("_", "-");
  const prefix = normalized.split("-")[0];
  return voices.find((voice) => voice.lang.toLowerCase().replaceAll("_", "-") === normalized)
    ?? voices.find((voice) => voice.lang.toLowerCase().replaceAll("_", "-").split("-")[0] === prefix);
}

export function PronunciationControl({ text, language, audioUrl, compact = false }: { text: string; language: string; audioUrl?: string; compact?: boolean }) {
  const { t } = useLearningUi();
  const [supported, setSupported] = useState(true);
  const [available, setAvailable] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(() => {
    if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") {
      // This is a browser limitation; installing a voice cannot enable the API.
      queueMicrotask(() => { setSupported(false); setAvailable(false); });
      return;
    }
    // WebView can expose an empty voice list until the first utterance. Let the
    // engine resolve its requested language instead of permanently disabling it.
    const update = () => {
      const voices = speechSynthesis.getVoices();
      setAvailable(!voices.length || Boolean(pronunciationVoice(voices, language)));
    };
    update(); speechSynthesis.addEventListener("voiceschanged", update);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", update);
      if (utterance.current) { utterance.current.onend = null; utterance.current.onerror = null; speechSynthesis.cancel(); utterance.current = null; }
    };
  }, [text, language]);
  const speak = () => {
    setError("");
    if (speaking) { speechSynthesis.cancel(); setSpeaking(false); return; }
    const voice = pronunciationVoice(speechSynthesis.getVoices(), language);
    const next = new SpeechSynthesisUtterance(text);
    if (voice) next.voice = voice;
    next.lang = voice?.lang || (language === "en" ? "en-US" : language === "zh" ? "zh-CN" : language);
    next.rate = 0.85;
    next.onend = () => { setSpeaking(false); utterance.current = null; };
    next.onerror = (event) => {
      setSpeaking(false); utterance.current = null;
      if (event.error === "language-unavailable" || event.error === "voice-unavailable") {
        setAvailable(false); setError("本设备暂无对应语言的语音，请在系统中安装英语或中文语音。");
      } else if (event.error !== "canceled" && event.error !== "interrupted") setError("设备朗读失败，请检查系统语音或使用词典录音。");
    };
    utterance.current = next; setSpeaking(true);
    try { speechSynthesis.speak(next); } catch { setSpeaking(false); setError("设备朗读失败，请检查系统语音或使用词典录音。"); }
  };
  const unavailableMessage = supported
    ? "本设备暂无对应语言的语音，请在系统中安装英语或中文语音。"
    : "当前浏览器不支持设备朗读。请使用支持语音的浏览器或词典录音。";
  return <div className="space-y-2">
    {audioUrl ? <>
      <p className="text-xs font-semibold">{t("词典录音")}</p>
      <audio key={audioUrl} controls preload="none" src={audioUrl} className="w-full" onError={() => setError("词典录音加载失败，可尝试设备朗读。")} />
    </> : !compact ? <p className="text-xs text-stone-500">{t("该词条暂无词典录音。")}</p> : null}
    <button type="button" disabled={!available} title={available ? t("设备合成语音，不是词典录音。") : t(unavailableMessage)} onClick={speak} className="rounded-full border border-stone-300 px-3 py-1 disabled:opacity-40">
      {speaking ? t("停止朗读") : t("朗读（设备语音）")}
    </button>
    {!compact ? <p className="text-xs text-stone-500">{available ? t("设备合成语音，不是词典录音。") : t(unavailableMessage)}</p> : null}
    {compact && !available ? <p className="text-xs text-stone-500">{t(unavailableMessage)}</p> : null}
    <details className="text-xs leading-6 text-stone-600">
      <summary className="w-fit cursor-pointer underline underline-offset-4">{t("语音设置帮助")}</summary>
      <div className="mt-2 space-y-2">
        <p>{t("设备朗读使用系统提供的语音，不需要 API 密钥。")}</p>
        <p>{t("Windows 10 / 11：设置 → 时间和语言 → 语音 → 管理语音 → 添加语音。选择英语或中文，安装后重新打开应用或浏览器。")}</p>
        <p>{t("也可按 Win + Ctrl + N 打开讲述人设置，再进入添加旧版语音和语音设置。其他系统请在辅助功能或语音设置中添加对应语言。")}</p>
        <p>{t("系统列出的语音不一定都向浏览器开放。安装后仍不可用时，可更换浏览器或使用词典录音。")}</p>
        <a href="https://support.microsoft.com/en-us/windows/appendix-a-supported-languages-and-voices-4486e345-7730-53da-fcfe-55cc64300f01" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{t("查看微软语音安装说明")}</a>
      </div>
    </details>
    {error ? <p role="alert" className="text-xs text-rose-700">{t(error)}</p> : null}
  </div>;
}
