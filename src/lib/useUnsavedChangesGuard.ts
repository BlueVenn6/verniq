"use client";

import { useEffect } from "react";

type UnsavedChangesGuardOptions = {
  enabled: boolean;
  message: string;
};

/** Protects editor drafts on browser unload and same-origin link navigation. */
export function useUnsavedChangesGuard({ enabled, message }: UnsavedChangesGuardOptions) {
  useEffect(() => {
    if (!enabled) return;
    return installUnsavedChangesGuard(message);
  }, [enabled, message]);
}

export function installUnsavedChangesGuard(message: string) {
  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = message;
  };

  const handleClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(target instanceof HTMLAnchorElement) || target.target === "_blank" || target.hasAttribute("download")) {
      return;
    }

    const destination = new URL(target.href, window.location.href);
    const current = new URL(window.location.href);
    if (destination.origin === current.origin && destination.href === current.href) return;

    if (!window.confirm(message)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  document.addEventListener("click", handleClick, { capture: true });

  return () => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
    document.removeEventListener("click", handleClick, { capture: true });
  };
}
