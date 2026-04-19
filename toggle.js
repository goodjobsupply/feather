(function () {
  "use strict";

  const COMPONENT_SELECTOR = '[data-toggle="component"]';
  const TRIGGER_SELECTOR =
    '[data-toggle="trigger"], [data-toggle="switch"], [data-toggle="button"]';
  const INPUT_SELECTOR = '[data-toggle="input"]';
  const IMAGE_A_SELECTOR = '[data-toggle="image-a"], [data-toggle="a"]';
  const IMAGE_B_SELECTOR = '[data-toggle="image-b"], [data-toggle="b"]';
  const TRACK_SELECTOR = '[data-toggle="track"]';
  const KNOB_SELECTOR = '[data-toggle="knob"]';
  const STATUS_SELECTOR = '[data-toggle="status"]';
  const DEFAULT_DURATION = 350;
  const DEFAULT_EASING = "ease";
  const INIT_RETRY_DELAY = 100;
  const INIT_RETRY_ATTEMPTS = 20;
  const requestFrame = window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : function (callback) {
        return window.setTimeout(callback, 0);
      };
  const cancelFrame = window.cancelAnimationFrame
    ? window.cancelAnimationFrame.bind(window)
    : window.clearTimeout.bind(window);

  function whenReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function scheduleInitialize(attempt) {
    const currentAttempt = attempt || 0;

    whenReady(() => {
      requestFrame(() => {
        const initializedCount = initializeToggles();

        if (initializedCount === 0 && currentAttempt < INIT_RETRY_ATTEMPTS) {
          window.setTimeout(() => {
            scheduleInitialize(currentAttempt + 1);
          }, INIT_RETRY_DELAY);
        }
      });
    });
  }

  function initializeToggles() {
    const components = getToggleComponents();
    let initializedCount = 0;

    if (components.length === 0) {
      return initializedCount;
    }

    components.forEach((component, index) => {
      if (initializeToggle(component, index)) {
        initializedCount += 1;
      }
    });

    return initializedCount;
  }

  function initializeToggle(component, index) {
    try {
      if (component.toggleInstance) {
        component.toggleInstance.refresh();
        return true;
      }

      const trigger = findToggleElement(component, TRIGGER_SELECTOR);
      const input =
        findToggleElement(component, INPUT_SELECTOR) ||
        (isToggleInput(trigger) ? trigger : null);
      const imageA = findToggleElement(component, IMAGE_A_SELECTOR);
      const imageB = findToggleElement(component, IMAGE_B_SELECTOR);

      if (!trigger && !input) {
        return false;
      }

      if (!imageA || !imageB) {
        return false;
      }

      const instance = createToggleInstance({
        component,
        trigger,
        input,
        imageA,
        imageB,
        index,
      });

      component.toggleInstance = instance;
      instance.init();
      return true;
    } catch (error) {
      if (typeof console !== "undefined" && console.error) {
        console.error("Toggle initialization failed:", error);
      }

      return false;
    }
  }

  function createToggleInstance(options) {
    const component = options.component;
    const trigger = options.trigger;
    const input = options.input;
    const imageA = options.imageA;
    const imageB = options.imageB;
    const track = findToggleElement(component, TRACK_SELECTOR);
    const knob = findToggleElement(component, KNOB_SELECTOR);
    const status = findToggleElement(component, STATUS_SELECTOR);
    const config = getToggleConfig(component);
    let activeState = getInitialState(component, input);
    let frame;

    function init() {
      prepareImages();
      prepareControls();
      bindEvents();
      render(false);
    }

    function refresh() {
      config.duration = getCSSNumber(
        component,
        "--toggle-duration",
        config.duration,
      );
      config.easing = getCSSValue(component, "--toggle-ease", config.easing);
      render(false);
    }

    function destroy() {
      cancelFrame(frame);

      if (trigger && trigger !== input) {
        trigger.removeEventListener("click", handleClick);
        trigger.removeEventListener("keydown", handleKeydown);
      }

      if (input) {
        input.removeEventListener("change", handleInputChange);
      }

      delete component.toggleInstance;
    }

    function bindEvents() {
      if (trigger && trigger !== input) {
        trigger.addEventListener("click", handleClick);
        trigger.addEventListener("keydown", handleKeydown);
      }

      if (input) {
        input.addEventListener("change", handleInputChange);
      }
    }

    function handleClick(event) {
      if (input && event.target === input) {
        return;
      }

      event.preventDefault();
      setState(activeState === "a" ? "b" : "a");
    }

    function handleKeydown(event) {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      setState(activeState === "a" ? "b" : "a");
    }

    function handleInputChange() {
      setState(input.checked ? "b" : "a");
    }

    function setState(state) {
      const nextState = normalizeState(state);

      if (nextState === activeState) {
        render(true);
        return;
      }

      activeState = nextState;
      render(true);
    }

    function render(animate) {
      cancelFrame(frame);
      frame = requestFrame(() => {
        const isB = activeState === "b";

        component.dataset.toggleState = activeState;

        if (input) {
          input.checked = isB;
        }

        setTransition(imageA, animate);
        setTransition(imageB, animate);
        setLayerState(imageA, !isB);
        setLayerState(imageB, isB);

        renderControlState(isB, animate);
      });
    }

    function renderControlState(isB, animate) {
      const label = isB ? config.labelB : config.labelA;

      if (trigger) {
        if (!isToggleInput(trigger)) {
          trigger.setAttribute("role", getRole(trigger));
          trigger.setAttribute("tabindex", getTabIndex(trigger));
          trigger.setAttribute("aria-pressed", String(isB));
        }

        trigger.setAttribute("aria-label", label);
      }

      if (status) {
        status.textContent = label;
      }

      if (track) {
        setTransition(track, animate, "background-color, border-color");
        track.style.backgroundColor = isB
          ? config.trackActiveColor
          : config.trackInactiveColor;
        track.style.borderColor = isB
          ? config.trackActiveBorderColor
          : config.trackInactiveBorderColor;
      }

      if (knob) {
        setTransition(knob, animate, "transform, background-color");
        knob.style.transform = isB
          ? "translateX(" + config.knobOffset + ")"
          : "translateX(0)";
        knob.style.backgroundColor = isB
          ? config.knobActiveColor
          : config.knobInactiveColor;
      }
    }

    function prepareImages() {
      [imageA, imageB].forEach((image) => {
        image.style.transitionProperty = "opacity";
        image.style.transitionTimingFunction = config.easing;
        image.style.transitionDuration = config.duration + "ms";
        image.style.willChange = "opacity";
      });
    }

    function prepareControls() {
      if (!trigger || isToggleInput(trigger)) {
        return;
      }

      if (!trigger.hasAttribute("role")) {
        trigger.setAttribute("role", "button");
      }

      if (!trigger.hasAttribute("tabindex")) {
        trigger.setAttribute("tabindex", "0");
      }
    }

    function setLayerState(element, isActive) {
      element.style.opacity = isActive ? "1" : "0";
      element.style.pointerEvents = isActive ? "" : "none";
      element.setAttribute("aria-hidden", String(!isActive));
    }

    function setTransition(element, animate, properties) {
      element.style.transitionProperty = properties || "opacity";
      element.style.transitionTimingFunction = config.easing;
      element.style.transitionDuration = animate
        ? config.duration + "ms"
        : "0ms";
    }

    return {
      component,
      index: options.index,
      init,
      refresh,
      destroy,
      setState,
      getState: function () {
        return activeState;
      },
      toggle: function () {
        setState(activeState === "a" ? "b" : "a");
      },
    };
  }

  function getToggleConfig(component) {
    return {
      duration: getCSSNumber(component, "--toggle-duration", DEFAULT_DURATION),
      easing: getCSSValue(component, "--toggle-ease", DEFAULT_EASING),
      knobOffset: getCSSValue(component, "--toggle-knob-offset", "32px"),
      labelA: component.dataset.labelA || "Show image A",
      labelB: component.dataset.labelB || "Show image B",
      trackActiveColor: getCSSValue(component, "--toggle-track-active", ""),
      trackInactiveColor: getCSSValue(component, "--toggle-track-inactive", ""),
      trackActiveBorderColor: getCSSValue(
        component,
        "--toggle-track-active-border",
        "",
      ),
      trackInactiveBorderColor: getCSSValue(
        component,
        "--toggle-track-inactive-border",
        "",
      ),
      knobActiveColor: getCSSValue(component, "--toggle-knob-active", ""),
      knobInactiveColor: getCSSValue(component, "--toggle-knob-inactive", ""),
    };
  }

  function getToggleComponents() {
    const components = Array.from(
      document.querySelectorAll(COMPONENT_SELECTOR),
    );
    const looseElements = document.querySelectorAll(
      [
        TRIGGER_SELECTOR,
        INPUT_SELECTOR,
        IMAGE_A_SELECTOR,
        IMAGE_B_SELECTOR,
      ].join(", "),
    );

    looseElements.forEach((element) => {
      const component = getClosestComponent(element) || inferComponent(element);

      if (component && components.indexOf(component) === -1) {
        components.push(component);
      }
    });

    return components;
  }

  function getToggleStatus(component, index) {
    const trigger = findToggleElement(component, TRIGGER_SELECTOR);
    const input = findToggleElement(component, INPUT_SELECTOR);
    const imageA = findToggleElement(component, IMAGE_A_SELECTOR);
    const imageB = findToggleElement(component, IMAGE_B_SELECTOR);
    let reason = "Ready";

    if (!component.toggleInstance) {
      if (!trigger && !input) {
        reason =
          'Missing data-toggle="switch", "trigger", "button", or "input".';
      } else if (!imageA || !imageB) {
        reason = 'Missing data-toggle="image-a" or data-toggle="image-b".';
      } else {
        reason =
          "Found required elements but not initialized yet. Run window.AttributesToggle.reinitialize().";
      }
    }

    return {
      index,
      component,
      initialized: Boolean(component.toggleInstance),
      reason,
      trigger,
      input,
      imageA,
      imageB,
    };
  }

  function getClosestComponent(element) {
    return element.closest ? element.closest(COMPONENT_SELECTOR) : null;
  }

  function inferComponent(element) {
    let parent = element.parentElement;

    while (parent && parent !== document.body) {
      const hasControl =
        findToggleElement(parent, TRIGGER_SELECTOR) ||
        findToggleElement(parent, INPUT_SELECTOR);
      const hasImageA = findToggleElement(parent, IMAGE_A_SELECTOR);
      const hasImageB = findToggleElement(parent, IMAGE_B_SELECTOR);

      if (hasControl && hasImageA && hasImageB) {
        return parent;
      }

      parent = parent.parentElement;
    }

    return null;
  }

  function findToggleElement(component, selector) {
    if (component.matches && component.matches(selector)) {
      return component;
    }

    return component.querySelector(selector);
  }

  function getInitialState(component, input) {
    if (input) {
      return input.checked ? "b" : "a";
    }

    return normalizeState(
      component.dataset.toggleState || component.dataset.initial,
    );
  }

  function normalizeState(value) {
    const normalizedValue = String(value || "").toLowerCase();

    if (
      normalizedValue === "b" ||
      normalizedValue === "true" ||
      normalizedValue === "on" ||
      normalizedValue === "active"
    ) {
      return "b";
    }

    return "a";
  }

  function getRole(element) {
    return element.getAttribute("role") || "button";
  }

  function getTabIndex(element) {
    return element.getAttribute("tabindex") || "0";
  }

  function isToggleInput(element) {
    return (
      element &&
      element.tagName === "INPUT" &&
      String(element.type).toLowerCase() === "checkbox"
    );
  }

  function getCSSNumber(element, propertyName, fallback) {
    const value = getCSSValue(element, propertyName, "");
    const number = parseFloat(value);

    return Number.isFinite(number) ? number : fallback;
  }

  function getCSSValue(element, propertyName, fallback) {
    const value = getComputedStyle(element)
      .getPropertyValue(propertyName)
      .trim();

    return value || fallback;
  }

  window.AttributesToggle = {
    init: function () {
      scheduleInitialize();
    },

    reinitialize: function () {
      const components = getToggleComponents();

      components.forEach((component) => {
        if (component.toggleInstance) {
          component.toggleInstance.destroy();
        }
      });

      initializeToggles();
    },

    getInstance: function (index) {
      const components = getToggleComponents();
      const component = components[index];

      return component && component.toggleInstance
        ? component.toggleInstance
        : null;
    },

    debug: function () {
      initializeToggles();

      const components = getToggleComponents();

      return components.map((component, index) => {
        return getToggleStatus(component, index);
      });
    },
  };

  scheduleInitialize();

  if (window.Webflow && window.Webflow.push) {
    window.Webflow.push(function () {
      scheduleInitialize();
    });
  }
})();
