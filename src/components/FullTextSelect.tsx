"use client";

import { Children, isValidElement, type ReactNode, type SelectHTMLAttributes } from "react";

// Keep native select semantics and keyboard interaction while allowing the
// selected label to wrap. Native select text itself can only occupy one line.
export function FullTextSelect({ children, className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = Children.toArray(children);
  const selected = options.find((child) => isValidElement<{ value?: string | number }>(child) && String(child.props.value) === String(props.value));
  const text = isValidElement<{ children?: ReactNode }>(selected) ? selected.props.children : "";
  return <span className={`relative inline-grid min-w-0 items-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#6d89a6] ${props.disabled ? "opacity-50" : ""} ${className}`}>
    <span aria-hidden="true" className="pointer-events-none block whitespace-normal pr-6 text-left [overflow-wrap:anywhere]">{text}</span>
    <span aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">⌄</span>
    <select {...props} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" style={{ fontSize: "inherit" }}>{children}</select>
  </span>;
}
