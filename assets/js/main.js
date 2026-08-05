(function () {
  "use strict";

  // Sanfte Überblendung vor internen Seitenwechseln, damit kein harter
  // Farbschnitt (weißer/roter "Blitzer") zwischen zwei Seiten sichtbar wird.
  //
  // Wichtig: Wir blenden NICHT die ganze Seite (html/body) ein oder aus —
  // das zwingt den dauerhaft laufenden WebGL-Silk-Hintergrund auf der
  // Startseite bei jedem Opacity-Schritt neu ins Compositing, was zu einem
  // GPU-Blitzer führen kann (beobachtet: Blitzer eher gegen Ende der
  // Animation). Stattdessen legt sich ein eigenständiger, undurchsichtiger
  // "Vorhang" darüber — der Rest der Seite bleibt dabei unangetastet.
  var prefersReducedMotionForNav = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var CURTAIN_ID = "pt-curtain";
  var CURTAIN_MS = 200;

  function getOrCreateCurtain() {
    var el = document.getElementById(CURTAIN_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = CURTAIN_ID;
      el.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;background:#260606;" +
        "pointer-events:none;opacity:0;" +
        (prefersReducedMotionForNav ? "" : "transition:opacity " + CURTAIN_MS + "ms ease;");
      (document.body || document.documentElement).appendChild(el);
    }
    return el;
  }

  // Vorhang der Zielseite: existiert er schon (vom Inline-Skript im <head>,
  // synchron vor dem ersten Paint gesetzt), blenden wir ihn erst weg,
  // nachdem der Silk-Hintergrund (falls vorhanden) Zeit hatte, seinen
  // ersten echten Frame zu zeichnen.
  var existingCurtain = document.getElementById(CURTAIN_ID);
  if (existingCurtain) {
    var revealPage = function () {
      existingCurtain.style.opacity = "0";
      window.setTimeout(
        function () {
          if (existingCurtain && existingCurtain.parentNode) {
            existingCurtain.parentNode.removeChild(existingCurtain);
          }
        },
        prefersReducedMotionForNav ? 0 : CURTAIN_MS + 40
      );
    };
    if (prefersReducedMotionForNav) {
      revealPage();
    } else {
      window.setTimeout(revealPage, 60);
    }
  }

  if (!prefersReducedMotionForNav) {
    var NAV_FADE_MS = 180;

    // Nur die zuletzt geklickte Navigation darf tatsächlich feuern. Ohne das
    // konkurrierten bei schnell aufeinanderfolgenden Klicks mehrere geplante
    // window.location-Wechsel miteinander.
    var pendingNavTimer = null;

    document.addEventListener("click", function (event) {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      var link = event.target.closest("a[href]");
      if (!link || link.hasAttribute("download")) {
        return;
      }
      if (link.target && link.target !== "_self") {
        return;
      }

      var href = link.getAttribute("href");
      if (!href || href.charAt(0) === "#") {
        return;
      }

      var url;
      try {
        url = new URL(href, window.location.href);
      } catch (e) {
        return;
      }

      if (url.origin !== window.location.origin) {
        return;
      }
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        // Klick auf den Menüpunkt der bereits aktiven Seite: ein Neuladen
        // bringt nichts und würde — da wir hier nichts abfangen — als harter,
        // ungeschützter Reload ohne Vorhang laufen (roter/weißer Blitzer).
        // Einfach nichts tun statt die Seite sinnlos neu zu laden.
        event.preventDefault();
        return;
      }

      event.preventDefault();
      try {
        sessionStorage.setItem("pt-nav", "1");
      } catch (e) {
        /* Storage kann in seltenen Fällen blockiert sein (privater Modus) — dann eben ohne Überblendung auf der Zielseite. */
      }

      var curtain = getOrCreateCurtain();
      // Reflow erzwingen, damit der Übergang vom aktuellen (0) zum neuen
      // Opacity-Wert tatsächlich animiert statt sofort zu springen.
      void curtain.offsetWidth;
      curtain.style.opacity = "1";

      if (pendingNavTimer !== null) {
        window.clearTimeout(pendingNavTimer);
      }
      pendingNavTimer = window.setTimeout(function () {
        pendingNavTimer = null;
        window.location.href = url.href;
      }, NAV_FADE_MS);
    });
  }

  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var revealTargets = document.querySelectorAll(".reveal");

  if (revealTargets.length > 0) {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealTargets.forEach(function (el) {
        el.classList.add("is-visible");
      });
    } else {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2, rootMargin: "0px 0px -40px 0px" }
      );

      revealTargets.forEach(function (el, index) {
        el.style.transitionDelay = Math.min(index * 80, 320) + "ms";
        observer.observe(el);
      });
    }
  }

  var timelineTrack = document.querySelector(".timeline__track");
  var timelineProgress = document.querySelector(".timeline__progress");

  if (timelineTrack && timelineProgress) {
    var ticking = false;

    var updateTimelineProgress = function () {
      var rect = timelineTrack.getBoundingClientRect();
      var anchor = window.innerHeight * 0.6;
      var pct = ((anchor - rect.top) / rect.height) * 100;
      pct = Math.min(Math.max(pct, 0), 100);
      timelineProgress.style.height = pct + "%";
      ticking = false;
    };

    updateTimelineProgress();

    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          window.requestAnimationFrame(updateTimelineProgress);
          ticking = true;
        }
      },
      { passive: true }
    );

    window.addEventListener("resize", updateTimelineProgress);
  }

  var snapSections = document.querySelectorAll(".book-section");

  if (snapSections.length > 0) {
    var counters = document.querySelectorAll(".section-counter__current");
    var currentSectionIndex = 0;

    if ("IntersectionObserver" in window) {
      var sectionObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) {
              return;
            }

            currentSectionIndex = Array.prototype.indexOf.call(
              snapSections,
              entry.target
            );

            if (counters.length > 0) {
              var value = entry.target.getAttribute("data-section-index");
              counters.forEach(function (el) {
                el.textContent = value;
              });
            }
          });
        },
        { threshold: 0.6 }
      );

      snapSections.forEach(function (section) {
        sectionObserver.observe(section);
      });
    }

    // Automatischer Wechsel der Buchkarten alle 3 Sekunden, wirkt wie eine
    // endlose Rotation: Beim Rücksprung von der letzten zur ersten Sektion
    // wird kurzzeitig ein Klon der ersten Sektion ans Ende gehängt, dorthin
    // weitergescrollt und danach unsichtbar zur echten ersten Sektion
    // gesprungen. Der Klon existiert dabei nur für die Dauer dieser einen
    // Übergangsanimation und wird sofort danach wieder entfernt — anders als
    // zuvor bleibt also nie dauerhaft eine doppelte Sektion im DOM stehen,
    // die man beim manuellen Scrollen sehen könnte.
    if (snapSections.length > 1 && !prefersReducedMotion) {
      var AUTOPLAY_DELAY = 3000;
      var AUTOPLAY_SCROLL_DURATION = 900;
      var autoplayTimer = null;
      var activeAnimation = null;
      var activeClone = null;

      var easeInOutCubic = function (t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };

      var cleanupClone = function () {
        if (activeClone) {
          if (activeClone.parentNode) {
            activeClone.parentNode.removeChild(activeClone);
          }
          activeClone = null;
        }
      };

      var animateScrollTo = function (targetY, duration, onComplete) {
        if (activeAnimation) {
          activeAnimation.cancelled = true;
        }
        var anim = { cancelled: false };
        activeAnimation = anim;

        var startY = window.pageYOffset;
        var distance = targetY - startY;
        var startTime = null;

        var step = function (timestamp) {
          if (anim.cancelled) {
            return;
          }
          if (startTime === null) {
            startTime = timestamp;
          }
          var progress = Math.min((timestamp - startTime) / duration, 1);
          // behavior:"instant" erzwingen: html hat global scroll-behavior:
          // smooth gesetzt, das sonst jeden dieser Aufrufe zusätzlich selbst
          // weich animiert und mit der eigenen Easing-Kurve hier kollidiert
          // (sichtbar als Ruckeln/"Schnappen" gegen Ende der Animation).
          window.scrollTo({
            top: startY + distance * easeInOutCubic(progress),
            left: 0,
            behavior: "instant",
          });
          if (progress < 1) {
            window.requestAnimationFrame(step);
          } else if (onComplete) {
            onComplete();
          }
        };

        window.requestAnimationFrame(step);
      };

      var scheduleAutoplay = function () {
        clearTimeout(autoplayTimer);
        autoplayTimer = setTimeout(function () {
          var isLastSection = currentSectionIndex === snapSections.length - 1;

          if (!isLastSection) {
            var nextIndex = currentSectionIndex + 1;
            animateScrollTo(snapSections[nextIndex].offsetTop, AUTOPLAY_SCROLL_DURATION);
          } else {
            var clone = snapSections[0].cloneNode(true);
            clone.setAttribute("aria-hidden", "true");
            clone.setAttribute("inert", "");
            clone.querySelectorAll("[id]").forEach(function (el) {
              el.removeAttribute("id");
            });
            snapSections[snapSections.length - 1].insertAdjacentElement(
              "afterend",
              clone
            );
            activeClone = clone;

            animateScrollTo(clone.offsetTop, AUTOPLAY_SCROLL_DURATION, function () {
              window.scrollTo({ top: snapSections[0].offsetTop, behavior: "instant" });
              cleanupClone();
              currentSectionIndex = 0;
              if (counters.length > 0) {
                counters.forEach(function (el) {
                  el.textContent = "01";
                });
              }
            });
          }

          scheduleAutoplay();
        }, AUTOPLAY_DELAY);
      };

      var navKeys = [
        "ArrowDown",
        "ArrowUp",
        "PageDown",
        "PageUp",
        " ",
        "Home",
        "End",
      ];

      var handleUserActivity = function (event) {
        if (event.type === "keydown" && navKeys.indexOf(event.key) === -1) {
          return;
        }
        // Eine laufende Klon-Übergangsanimation sofort sauber beenden, damit
        // manuelles Scrollen niemals auf den (nur kurzzeitig existierenden)
        // Klon treffen kann.
        if (activeClone) {
          if (activeAnimation) {
            activeAnimation.cancelled = true;
          }
          window.scrollTo({ top: snapSections[0].offsetTop, behavior: "instant" });
          cleanupClone();
          currentSectionIndex = 0;
        }
        scheduleAutoplay();
      };

      window.addEventListener("wheel", handleUserActivity, { passive: true });
      window.addEventListener("touchstart", handleUserActivity, {
        passive: true,
      });
      window.addEventListener("keydown", handleUserActivity);

      scheduleAutoplay();
    }
  }
})();
