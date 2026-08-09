import { describe, it, expect, vi } from "vitest";
import * as pageNavigator from "../src/js/pageNavigator.js";

describe("pageNavigator", () => {
  it("advances and retreats the current page within bounds", () => {
    pageNavigator.init(3);
    expect(pageNavigator.getCurrentPage()).toBe(1);

    pageNavigator.next();
    expect(pageNavigator.getCurrentPage()).toBe(2);

    pageNavigator.next();
    expect(pageNavigator.getCurrentPage()).toBe(3);

    pageNavigator.prev();
    expect(pageNavigator.getCurrentPage()).toBe(2);
  });

  it("does not move past the first page", () => {
    pageNavigator.init(3);
    pageNavigator.prev();
    expect(pageNavigator.getCurrentPage()).toBe(1);
  });

  it("does not move past the last page", () => {
    pageNavigator.init(2);
    pageNavigator.next();
    pageNavigator.next();
    expect(pageNavigator.getCurrentPage()).toBe(2);
  });

  it("notifies the change callback only when the page actually changes", () => {
    const onChange = vi.fn();
    pageNavigator.init(2, onChange);

    pageNavigator.prev();
    expect(onChange).not.toHaveBeenCalled();

    pageNavigator.next();
    expect(onChange).toHaveBeenCalledWith(2);

    onChange.mockClear();
    pageNavigator.next();
    expect(onChange).not.toHaveBeenCalled();
  });
});
