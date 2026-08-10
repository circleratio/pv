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

  it("reports the total page count set by init()", () => {
    pageNavigator.init(5);
    expect(pageNavigator.getTotalPages()).toBe(5);
  });

  it("goTo() jumps directly to the given page and notifies the change callback", () => {
    const onChange = vi.fn();
    pageNavigator.init(5, onChange);

    pageNavigator.goTo(4);

    expect(pageNavigator.getCurrentPage()).toBe(4);
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("goTo() clamps out-of-range page numbers to [1, totalPages]", () => {
    pageNavigator.init(5);

    pageNavigator.goTo(99);
    expect(pageNavigator.getCurrentPage()).toBe(5);

    pageNavigator.goTo(-3);
    expect(pageNavigator.getCurrentPage()).toBe(1);
  });

  it("goTo() does not notify the change callback when the page does not change", () => {
    const onChange = vi.fn();
    pageNavigator.init(5, onChange);

    pageNavigator.goTo(1);

    expect(onChange).not.toHaveBeenCalled();
  });
});
