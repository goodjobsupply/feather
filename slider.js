(function () {
  "use strict";

  const SLIDER_SELECTOR = '[data-slider="slider"]';
  const COMPONENT_SELECTOR = '[data-slider="component"]';
  const SWIPER_WAIT_MS = 50;
  const SWIPER_WAIT_ATTEMPTS = 100;
  const requestFrame = window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : function (callback) {
        return window.setTimeout(callback, 0);
      };
  const cancelFrame = window.cancelAnimationFrame
    ? window.cancelAnimationFrame.bind(window)
    : window.clearTimeout.bind(window);
  let hasResizeListener = false;

  function initializeSwipers() {
    const swiperElements = document.querySelectorAll(SLIDER_SELECTOR);

    // Gracefully exit if no sliders found
    if (swiperElements.length === 0) {
      return;
    }

    // Initialize each swiper instance
    swiperElements.forEach((element, index) => {
      initializeSwiper(element, index);
    });
  }

  function whenReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function whenSwiperReady(callback, attempt) {
    attempt = attempt || 0;

    if (typeof window.Swiper !== "undefined") {
      callback();
      return;
    }

    if (attempt >= SWIPER_WAIT_ATTEMPTS) {
      return;
    }

    setTimeout(() => {
      whenSwiperReady(callback, attempt + 1);
    }, SWIPER_WAIT_MS);
  }

  function start() {
    initializeSwipers();

    if (!hasResizeListener) {
      window.addEventListener("resize", handleResize);
      hasResizeListener = true;
    }
  }

  // Handle viewport resize with debouncing - only for width changes
  let resizeTimeout;
  let lastWidth = window.innerWidth;

  function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const currentWidth = window.innerWidth;

      // Only reinitialize if width changed (ignore iOS Safari chrome height changes)
      if (currentWidth !== lastWidth) {
        lastWidth = currentWidth;

        if (window.AttributesSwiper && window.AttributesSwiper.reinitialize) {
          window.AttributesSwiper.reinitialize();
        }
      }
    }, 250); // 250ms debounce delay
  }

  function initializeSwiper(element, index) {
    try {
      if (element.swiperInstance && !element.swiperInstance.destroyed) {
        element.swiperInstance.update();
        return;
      }

      // Process Webflow CMS collection lists before initialization
      processWebflowCMSLists(element);

      // Get configuration from data attributes
      const config = getSwiperConfig(element);

      // Initialize Swiper
      const swiper = new window.Swiper(element, config);

      // Store reference for potential future access
      element.swiperInstance = swiper;

      // Add height calculation and update mechanism
      setupHeightCalculation(element, swiper);
    } catch (error) {
      // Silently handle errors in production
      if (typeof console !== "undefined" && console.error) {
        console.error("Swiper initialization failed:", error);
      }
    }
  }

  function setupHeightCalculation(element, swiper) {
    let animationFrame;
    let resizeObserver;
    const images = Array.from(element.querySelectorAll("img"));

    // Function to calculate and set the proper height
    function updateSliderHeight() {
      const slides = element.querySelectorAll(".swiper-slide");
      if (slides.length === 0) return;

      let maxHeight = 0;

      // Calculate the maximum height among visible slides
      slides.forEach((slide) => {
        // Reset any inline height styles to get natural height
        slide.style.height = "auto";
        const slideHeight = slide.offsetHeight;
        if (slideHeight > maxHeight) {
          maxHeight = slideHeight;
        }
      });

      // Set the calculated height to the swiper container
      if (maxHeight > 0) {
        element.style.height = maxHeight + "px";
      }
    }

    function requestHeightUpdate() {
      cancelFrame(animationFrame);
      animationFrame = requestFrame(updateSliderHeight);
    }

    // Initial height calculation
    requestHeightUpdate();

    // Update height on slide change (both drag and navigation)
    swiper.on("slideChange", requestHeightUpdate);
    swiper.on("slideChangeTransitionEnd", requestHeightUpdate);

    // Update height on touch end (when dragging stops)
    swiper.on("touchEnd", requestHeightUpdate);

    // Update height on resize
    swiper.on("resize", requestHeightUpdate);

    images.forEach((image) => {
      if (!image.complete) {
        image.addEventListener("load", requestHeightUpdate, { once: true });
        image.addEventListener("error", requestHeightUpdate, { once: true });
      }
    });

    if (typeof window.ResizeObserver !== "undefined") {
      resizeObserver = new window.ResizeObserver(requestHeightUpdate);
      element.querySelectorAll(".swiper-slide").forEach((slide) => {
        resizeObserver.observe(slide);
      });
    }

    swiper.on("beforeDestroy", () => {
      cancelFrame(animationFrame);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    });
  }

  function processWebflowCMSLists(element) {
    // Find and process Webflow CMS collection list elements
    const webflowSelectors = [".w-dyn-list", ".w-dyn-items", ".w-dyn-item"];

    webflowSelectors.forEach((selector) => {
      const webflowElements = element.querySelectorAll(selector);

      webflowElements.forEach((webflowElement) => {
        // Keep the core Swiper structure intact if Webflow classes live on it.
        if (
          webflowElement.classList.contains("swiper-wrapper") ||
          webflowElement.classList.contains("swiper-slide")
        ) {
          return;
        }

        // Get all child nodes (including text nodes and elements)
        const children = Array.from(webflowElement.childNodes);

        // Insert children before the webflow element
        children.forEach((child) => {
          webflowElement.parentNode.insertBefore(child, webflowElement);
        });

        // Remove the now-empty webflow wrapper element
        webflowElement.remove();
      });
    });
  }

  function getSwiperConfig(element) {
    // Get computed styles to read CSS variables for proper slide calculation
    const computedStyle = getComputedStyle(element);
    const xs = getCSSNumber(computedStyle, "--xs", 1);
    const sm = getCSSNumber(computedStyle, "--sm", 1);
    const md = getCSSNumber(computedStyle, "--md", 2);
    const lg = getCSSNumber(computedStyle, "--lg", 3);
    const spaceBetween = getCSSNumber(computedStyle, "--gap", 24);

    // Base configuration - sync with CSS-controlled layout
    const config = {
      // Use breakpoints that match our CSS exactly
      breakpoints: {
        0: { slidesPerView: xs, spaceBetween: spaceBetween },
        480: { slidesPerView: sm, spaceBetween: spaceBetween },
        768: { slidesPerView: md, spaceBetween: spaceBetween },
        992: { slidesPerView: lg, spaceBetween: spaceBetween },
      },
      watchSlidesProgress: true,
      simulateTouch: true,
      allowTouchMove: true,
      keyboard: { enabled: true, onlyInViewport: true },
      a11y: { enabled: true },
      // Better handling for decimal slidesPerView values
      watchOverflow: true,
      normalizeSlideIndex: false,
      roundLengths: false,
    };

    // Configure grab cursor (default: true, can be disabled for clickable content)
    const grabCursor = element.dataset.grabCursor;
    if (grabCursor === "false") {
      config.grabCursor = false;
    } else {
      config.grabCursor = true;
    }

    // Find the parent component wrapper
    const componentWrapper =
      element.closest(COMPONENT_SELECTOR) ||
      (element.parentElement !== document.body ? element.parentElement : null);

    if (componentWrapper) {
      // Configure navigation if elements exist
      const nextEl = componentWrapper.querySelector('[data-slider="next"]');
      const prevEl = componentWrapper.querySelector(
        '[data-slider="previous"]'
      );

      if (nextEl && prevEl) {
        config.navigation = { nextEl, prevEl };
      }

      // Configure pagination if element exists
      const paginationEl = componentWrapper.querySelector(
        '[data-slider="pagination"]'
      );

      if (paginationEl) {
        config.pagination = {
          el: paginationEl,
          clickable: true,
          bulletElement: "button",
          bulletClass: "slider-pagination_button",
          bulletActiveClass: "cc-active",
        };
      }
    }

    // Configure loop if requested
    if (element.dataset.loop === "true") {
      config.loop = true;
      config.loopAddBlankSlides = true;
      config.loopFillGroupWithBlank = true;

      // Configure loopAdditionalSlides if specified
      const loopAdditionalSlides = element.dataset.loopAdditionalSlides;
      const loopAdditionalSlidesValue = getNumber(loopAdditionalSlides);
      if (loopAdditionalSlidesValue !== null) {
        config.loopAdditionalSlides = loopAdditionalSlidesValue;
      }
    }

    // Configure autoplay if requested
    const autoplayDelay = element.dataset.autoplay;
    const autoplayDelayValue = getNumber(autoplayDelay);
    if (autoplayDelay !== "false" && autoplayDelayValue !== null) {
      config.autoplay = {
        delay: autoplayDelayValue,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
      };
    }

    // Configure centered slides if requested
    if (element.dataset.centered === "true") {
      config.centeredSlides = true;
      config.centeredSlidesBounds = true;
    }

    // Configure fade effect if specified
    if (element.dataset.effect === "fade") {
      config.effect = "fade";
      config.fadeEffect = { crossFade: true };
    }

    // Configure speed if specified
    const speed = element.dataset.speed;
    const speedValue = getNumber(speed);
    if (speedValue !== null) {
      config.speed = speedValue;
    }

    return config;
  }

  function getCSSNumber(computedStyle, propertyName, fallback) {
    const value = computedStyle.getPropertyValue(propertyName).trim();
    const number = parseFloat(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function getNumber(value) {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    const number = parseInt(value, 10);
    return Number.isFinite(number) ? number : null;
  }

  // Utility functions for external use
  window.AttributesSwiper = {
    // Initialize all swipers
    init: function () {
      whenReady(() => {
        whenSwiperReady(start);
      });
    },

    // Reinitialize all swipers (useful for dynamic content)
    reinitialize: function () {
      if (typeof window.Swiper === "undefined") return;

      const swiperElements = document.querySelectorAll(SLIDER_SELECTOR);
      swiperElements.forEach((element) => {
        if (element.swiperInstance && !element.swiperInstance.destroyed) {
          element.swiperInstance.destroy(true, true);
          delete element.swiperInstance;
        }
      });

      setTimeout(() => {
        swiperElements.forEach((element, index) => {
          initializeSwiper(element, index);
        });
      }, 50);
    },

    // Get a specific swiper instance
    getInstance: function (index) {
      const swiperElements = document.querySelectorAll(SLIDER_SELECTOR);
      if (swiperElements[index] && swiperElements[index].swiperInstance) {
        return swiperElements[index].swiperInstance;
      }
      return null;
    },
  };

  // Initialize when DOM and Swiper are both ready
  whenReady(() => {
    whenSwiperReady(start);
  });
})();
