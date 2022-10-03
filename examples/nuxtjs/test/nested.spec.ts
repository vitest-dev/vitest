import { mount } from "@vue/test-utils";
import { describe, it, expect } from "vitest";
import NestedParent from "~/components/nested/Parent.vue";
import NestedChild from "~/components/nested/Child.vue";

describe("components > nested > Parent", async () => {
  it("Component should contain child", () => {
    const wrapper = mount(NestedParent, {});

    expect(wrapper.findComponent(NestedChild).exists()).toBe(true);
  });
});
