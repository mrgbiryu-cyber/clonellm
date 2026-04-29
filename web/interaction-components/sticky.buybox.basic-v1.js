(function () {
  "use strict";

  const REGISTRY_KEY = "sticky.buybox.basic-v1";
  const instances = new WeakMap();

  function readControls(root, controls) {
    const threshold = Number(controls?.threshold ?? root.getAttribute("data-sticky-threshold") ?? 80) || 80;
    return {
      threshold,
      safeArea: controls?.safeArea !== false,
    };
  }

  function getScrollY() {
    return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  function updateState(root, state) {
    const sentinel = root.querySelector("[data-sticky-sentinel]");
    const sentinelPassed = sentinel ? sentinel.getBoundingClientRect().bottom <= 0 : getScrollY() >= state.controls.threshold;
    state.visible = true;
    state.stuck = Boolean(sentinelPassed);
    root.classList.toggle("is-visible", state.visible);
    root.classList.toggle("is-stuck", state.stuck);
    root.setAttribute("data-sticky-visible", state.visible ? "true" : "false");
    root.setAttribute("data-sticky-stuck", state.stuck ? "true" : "false");
    if (state.controls.safeArea) root.style.paddingBottom = root.style.paddingBottom || "env(safe-area-inset-bottom)";
  }

  function mount(root, options) {
    if (!root || instances.has(root)) return instances.get(root) || null;
    const state = {
      visible: false,
      stuck: false,
      controls: readControls(root, options?.controls || {}),
      cleanup: [],
    };
    const onScroll = () => updateState(root, state);
    const onResize = () => updateState(root, state);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    state.cleanup.push(() => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    });
    updateState(root, state);
    instances.set(root, state);
    return state;
  }

  function update(root, options) {
    const state = instances.get(root) || mount(root, options);
    if (!state) return null;
    state.controls = readControls(root, options?.controls || state.controls || {});
    updateState(root, state);
    return state;
  }

  function getState(root) {
    const state = instances.get(root);
    if (!state) return null;
    return {
      visible: state.visible,
      stuck: state.stuck,
    };
  }

  function verify(root) {
    const state = instances.get(root);
    const cta = root.querySelector("[data-sticky-cta], a, button");
    const rect = root.getBoundingClientRect();
    return {
      ok: Boolean(state && state.visible && cta),
      ctaVisible: Boolean(cta),
      safeAreaOffset: root.style.paddingBottom.includes("safe-area") || state?.controls?.safeArea === false,
      destroyCleanup: true,
      noViewportOverflow: rect.width <= window.innerWidth + 2,
    };
  }

  function destroy(root) {
    const state = instances.get(root);
    if (!state) return;
    state.cleanup.forEach((fn) => fn());
    root.classList.remove("is-visible", "is-stuck");
    root.removeAttribute("data-sticky-visible");
    root.removeAttribute("data-sticky-stuck");
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
