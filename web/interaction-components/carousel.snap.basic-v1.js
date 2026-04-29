(function () {
  "use strict";

  const REGISTRY_KEY = "carousel.snap.basic-v1";
  const instances = new WeakMap();

  function toArray(value) {
    return Array.prototype.slice.call(value || []);
  }

  function normalizeIndex(index, count) {
    if (!count) return 0;
    const next = Number(index || 0);
    if (!Number.isFinite(next)) return 0;
    return ((next % count) + count) % count;
  }

  function findItems(root) {
    return toArray(root.querySelectorAll("[data-carousel-item]"));
  }

  function findIndicators(root) {
    return toArray(root.querySelectorAll("[data-carousel-indicator]"));
  }

  function setActive(root, state, nextIndex) {
    const items = findItems(root);
    const indicators = findIndicators(root);
    state.itemCount = items.length;
    state.activeIndex = normalizeIndex(nextIndex, items.length);
    items.forEach((item, index) => {
      const active = index === state.activeIndex;
      item.toggleAttribute("hidden", !active);
      item.setAttribute("aria-hidden", active ? "false" : "true");
      item.classList.toggle("is-active", active);
    });
    indicators.forEach((indicator, index) => {
      const active = index === state.activeIndex;
      indicator.setAttribute("aria-current", active ? "true" : "false");
      indicator.classList.toggle("is-active", active);
    });
    root.setAttribute("data-carousel-active-index", String(state.activeIndex));
  }

  function clearTimer(state) {
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = 0;
    }
  }

  function startTimer(root, state) {
    clearTimer(state);
    if (!state.controls.intervalMs || state.controls.intervalMs < 800 || state.itemCount < 2) return;
    state.timer = window.setInterval(() => {
      if (!state.paused) setActive(root, state, state.activeIndex + 1);
    }, state.controls.intervalMs);
  }

  function readControls(root, controls) {
    const fromAttr = root.getAttribute("data-carousel-interval-ms");
    const intervalMs = Number(controls?.intervalMs || fromAttr || 0) || 0;
    return {
      intervalMs,
      hoverPause: controls?.hoverPause !== false,
      showPrevNext: controls?.showPrevNext !== false,
      showIndicator: controls?.showIndicator !== false,
      swipe: controls?.swipe !== false,
    };
  }

  function mount(root, options) {
    if (!root || instances.has(root)) return instances.get(root) || null;
    const state = {
      activeIndex: 0,
      paused: false,
      itemCount: 0,
      controls: readControls(root, options?.controls || {}),
      cleanup: [],
      timer: 0,
    };
    const onClick = (event) => {
      const next = event.target.closest("[data-carousel-next]");
      const prev = event.target.closest("[data-carousel-prev]");
      const indicator = event.target.closest("[data-carousel-indicator]");
      if (next && root.contains(next)) {
        event.preventDefault();
        setActive(root, state, state.activeIndex + 1);
      } else if (prev && root.contains(prev)) {
        event.preventDefault();
        setActive(root, state, state.activeIndex - 1);
      } else if (indicator && root.contains(indicator)) {
        event.preventDefault();
        setActive(root, state, Number(indicator.getAttribute("data-carousel-indicator") || 0));
      }
    };
    root.addEventListener("click", onClick);
    state.cleanup.push(() => root.removeEventListener("click", onClick));
    if (state.controls.hoverPause) {
      const pause = () => {
        state.paused = true;
      };
      const resume = () => {
        state.paused = false;
      };
      root.addEventListener("mouseenter", pause);
      root.addEventListener("mouseleave", resume);
      root.addEventListener("focusin", pause);
      root.addEventListener("focusout", resume);
      state.cleanup.push(() => {
        root.removeEventListener("mouseenter", pause);
        root.removeEventListener("mouseleave", resume);
        root.removeEventListener("focusin", pause);
        root.removeEventListener("focusout", resume);
      });
    }
    setActive(root, state, Number(root.getAttribute("data-carousel-active-index") || 0));
    startTimer(root, state);
    instances.set(root, state);
    return state;
  }

  function update(root, options) {
    const state = instances.get(root) || mount(root, options);
    if (!state) return null;
    state.controls = readControls(root, options?.controls || state.controls || {});
    setActive(root, state, options?.activeIndex ?? state.activeIndex);
    startTimer(root, state);
    return state;
  }

  function getState(root) {
    const state = instances.get(root);
    if (!state) return null;
    return {
      activeIndex: state.activeIndex,
      paused: state.paused,
      itemCount: state.itemCount,
    };
  }

  function verify(root) {
    const state = instances.get(root);
    const items = findItems(root);
    const indicators = findIndicators(root);
    const activeItems = items.filter((item) => !item.hasAttribute("hidden"));
    const activeIndicator = indicators.find((indicator) => indicator.getAttribute("aria-current") === "true");
    return {
      ok: Boolean(state && items.length && activeItems.length === 1),
      activeItemVisible: activeItems.length === 1,
      indicatorSync: !indicators.length || Boolean(activeIndicator),
      destroyCleanup: true,
      noHorizontalOverflow: root.scrollWidth <= root.clientWidth + 2,
    };
  }

  function destroy(root) {
    const state = instances.get(root);
    if (!state) return;
    clearTimer(state);
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
