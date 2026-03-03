import { useEffect } from "react";

function isEditableElement(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    element.isContentEditable
  );
}

function isMobileViewport() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
}

export default function MobileKeyboardDismiss() {
  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      if (!isMobileViewport()) {
        return;
      }

      const activeElement = document.activeElement;
      if (!isEditableElement(activeElement)) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && activeElement.contains(target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      activeElement.blur();
    };

    document.addEventListener("touchstart", handleTouchStart, {
      capture: true,
      passive: false,
    });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart, true);
    };
  }, []);

  return null;
}
