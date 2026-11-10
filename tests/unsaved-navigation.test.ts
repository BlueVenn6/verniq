import { beforeEach, expect, it, vi } from "vitest";
import { installUnsavedChangesGuard } from "@/src/lib/useUnsavedChangesGuard";

class TestElement extends EventTarget { closest() { return this; } }
class TestAnchor extends TestElement {
  href = "http://localhost/settings";
  target = "";
  hasAttribute() { return false; }
}
let documentTarget: EventTarget;
let windowTarget: EventTarget;
const confirm = vi.fn(() => false);
beforeEach(() => {
  documentTarget = new EventTarget(); windowTarget = new EventTarget(); confirm.mockReset().mockReturnValue(false);
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: documentTarget },
    window: { configurable: true, value: Object.assign(windowTarget, { location: { href: "http://localhost/publish" }, confirm }) },
    Element: { configurable: true, value: TestElement },
    HTMLAnchorElement: { configurable: true, value: TestAnchor },
  });
});
function clickLink() {
  const event = new Event("click", { cancelable: true });
  Object.defineProperties(event, { button: { value: 0 }, target: { value: new TestAnchor() } });
  documentTarget.dispatchEvent(event);
  return event;
}

it("blocks link navigation when the user keeps editing, and allows an explicit leave", () => {
  const dispose = installUnsavedChangesGuard("Unsaved draft");
  expect(clickLink().defaultPrevented).toBe(true);
  expect(confirm).toHaveBeenCalledWith("Unsaved draft");
  confirm.mockReturnValue(true);
  expect(clickLink().defaultPrevented).toBe(false);
  dispose();
  confirm.mockClear(); clickLink();
  expect(confirm).not.toHaveBeenCalled();
});

it("requests an unload warning and removes it after the editor is clean", () => {
  const dispose = installUnsavedChangesGuard("Unsaved draft");
  const event = new Event("beforeunload", { cancelable: true });
  Object.defineProperty(event, "returnValue", { writable: true, value: "" });
  windowTarget.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  dispose();
  const clean = new Event("beforeunload", { cancelable: true });
  windowTarget.dispatchEvent(clean);
  expect(clean.defaultPrevented).toBe(false);
});
