"use client";

import { useLayoutEffect, useRef } from "react";

type AutoFitTextProps = {
  text: string;
  className?: string;
  minFontPx?: number;
};

const SHRINK_STEP_PX = 0.5;
const DEFAULT_MIN_FONT_PX = 9;

export function AutoFitText({ text, className, minFontPx = DEFAULT_MIN_FONT_PX }: AutoFitTextProps) {
  const textRef = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) {
      return;
    }

    let rafId = 0;

    const fitText = () => {
      const node = textRef.current;
      if (!node) {
        return;
      }

      const computed = window.getComputedStyle(node);
      const configuredFontPx = Number.parseFloat(computed.fontSize);
      const maxFontPx = Number.isFinite(configuredFontPx) ? configuredFontPx : 16;
      let currentFontPx = maxFontPx;

      node.style.fontSize = `${maxFontPx}px`;
      node.style.whiteSpace = "nowrap";

      if (node.clientWidth <= 0) {
        return;
      }

      while (node.scrollWidth > node.clientWidth + 0.5 && currentFontPx > minFontPx) {
        currentFontPx = Math.max(minFontPx, currentFontPx - SHRINK_STEP_PX);
        node.style.fontSize = `${currentFontPx}px`;
      }
    };

    const scheduleFit = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(fitText);
    };

    const observer = new ResizeObserver(scheduleFit);
    observer.observe(element);
    if (element.parentElement) {
      observer.observe(element.parentElement);
    }

    scheduleFit();

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [text, minFontPx]);

  return (
    <span ref={textRef} className={className} title={text}>
      {text}
    </span>
  );
}
