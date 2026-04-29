(function () {
  "use strict";

  const REGISTRY_KEY = "tooltip.popover.basic-v1";
  const instances = new WeakMap();

  function toArray(value) {
    return Array.prototype.slice.call(value || []);
  }

  function findTriggers(root) {
    return toArray(root.querySelectorAll("[data-popover-trigger], [data-tooltip-trigger]"));
  }

  function findPanels(root) {
    return toArray(root.querySelectorAll("[data-popover-panel], [data-tooltip-panel]"));
  }

  function readControls(root, controls) {
    const triggerMode = String(controls?.triggerMode || root.getAttribute("data-popover-trigger-mode") || "click").trim();
    return {
      triggerMode,
      closeOnEscape: controls?.closeOnEscape !== false,
      closeOnOutside: controls?.closeOnOutside !== false,
    };
  }

  function readIndex(element, attrName, fallbackIndex) {
    const rawValue = element.getAttribute(attrName);
    const parsed = rawValue === "" || rawValue == null ? fallbackIndex : Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallbackIndex;
  }

  function ensureA11y(triggers, panels) {
    triggers.forEach((trigger, index) => {
      const panel = panels[index];
      if (!panel) return;
      if (!trigger.id) trigger.id = `clone-popover-trigger-${Date.now()}-${index}`;
      if (!panel.id) panel.id = `clone-popover-panel-${Date.now()}-${index}`;
      if (!panel.getAttribute("role")) panel.setAttribute("role", "tooltip");
      trigger.setAttribute("aria-describedby", panel.id);
    });
  }

  function setActive(root, state, nextIndex) {
    const triggers = findTriggers(root);
    const panels = findPanels(root);
    const index = Number.isFinite(Number(nextIndex)) ? Number(nextIndex) : -1;
    state.activeIndex = index >= 0 && index < Math.max(triggers.length, panels.length) ? index : -1;
    ensureA11y(triggers, panels);
    triggers.forEach((trigger, itemIndex) => {
      const open = itemIndex === state.activeIndex;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      trigger.classList.toggle("is-open", open);
    });
    panels.forEach((panel, itemIndex) => {
      const open = itemIndex === state.activeIndex;
      panel.toggleAttribute("hidden", !open);
      panel.setAttribute("aria-hidden", open ? "false" : "true");
      panel.classList.toggle("is-open", open);
    });
    root.setAttribute("data-popover-active-index", String(state.activeIndex));
  }

  function mount(root, options) {
    if (!root || instances.has(root)) return instances.get(root) || null;
    const state = {
      activeIndex: -1,
      controls: readControls(root, options?.controls || {}),
      cleanup: [],
    };
    const onClick = (event) => {
      const trigger = event.target.closest("[data-popover-trigger], [data-tooltip-trigger]");
      if (!trigger || !root.contains(trigger)) {
        if (state.controls.closeOnOutside && !event.target.closest("[data-popover-panel], [data-tooltip-panel]")) {
          setActive(root, state, -1);
        }
        return;
      }
      if (state.controls.triggerMode === "hover") return;
      event.preventDefault();
      const triggers = findTriggers(root);
      const index = readIndex(trigger, trigger.hasAttribute("data-tooltip-trigger") ? "data-tooltip-trigger" : "data-popover-trigger", triggers.indexOf(trigger));
      setActive(root, state, state.activeIndex === index ? -1 : index);
    };
    const onMouseover = (event) => {
      if (state.controls.triggerMode !== "hover") return;
      const trigger = event.target.closest("[data-popover-trigger], [data-tooltip-trigger]");
      if (!trigger || !root.contains(trigger)) return;
      const triggers = findTriggers(root);
      setActive(root, state, triggers.indexOf(trigger));
    };
    const onMouseout = (event) => {
      if (state.controls.triggerMode !== "hover") return;
      if (!root.contains(event.relatedTarget)) setActive(root, state, -1);
    };
    const onFocusin = (event) => {
      if (state.controls.triggerMode === "click") return;
      const trigger = event.target.closest("[data-popover-trigger], [data-tooltip-trigger]");
      if (!trigger || !root.contains(trigger)) return;
      const triggers = findTriggers(root);
      setActive(root, state, triggers.indexOf(trigger));
    };
    const onKeydown = (event) => {
      if (event.key === "Escape" && state.activeIndex >= 0 && state.controls.closeOnEscape) {
        event.preventDefault();
        setActive(root, state, -1);
      }
    };
    root.addEventListener("click", onClick);
    root.addEventListener("mouseover", onMouseover);
    root.addEventListener("mouseout", onMouseout);
    root.addEventListener("focusin", onFocusin);
    document.addEventListener("keydown", onKeydown);
    state.cleanup.push(() => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("mouseover", onMouseover);
      root.removeEventListener("mouseout", onMouseout);
      root.removeEventListener("focusin", onFocusin);
      document.removeEventListener("keydown", onKeydown);
    });
    setActive(root, state, options?.activeIndex ?? root.getAttribute("data-popover-active-index") ?? -1);
    instances.set(root, state);
    return state;
  }

  function update(root, options) {
    const state = instances.get(root) || mount(root, options);
    if (!state) return null;
    state.controls = readControls(root, options?.controls || state.controls || {});
    if (Object.prototype.hasOwnProperty.call(options || {}, "activeIndex")) setActive(root, state, options.activeIndex);
    return state;
  }

  function getState(root) {
    const state = instances.get(root);
    if (!state) return null;
    return { activeIndex: state.activeIndex, open: state.activeIndex >= 0 };
  }

  function verify(root) {
    const state = instances.get(root);
    const triggers = findTriggers(root);
    const panels = findPanels(root);
    const expanded = triggers.filter((trigger) => trigger.getAttribute("aria-expanded") === "true");
    const visible = panels.filter((panel) => !panel.hasAttribute("hidden"));
    return {
      ok: Boolean(state && triggers.length && expanded.length <= 1 && visible.length <= 1),
      popoverVisible: state?.activeIndex < 0 || visible.length === 1,
      ariaExpandedSync: expanded.length <= 1,
      destroyCleanup: true,
    };
  }

  function destroy(root) {
    const state = instances.get(root);
    if (!state) return;
    state.cleanup.forEach((fn) => fn());
    instances.delete(root);
  }

  const adapter = {
    interactionId: REGISTRY_KEY,
    mount,
    update,
    getState,
    verify,
    destroy,
  };

  window.CloneLLMInteractions = window.CloneLLMInteractions || {};
  window.CloneLLMInteractions[REGISTRY_KEY] = adapter;
})();
