/* Portfolio · interacciones y animaciones de scroll (GSAP + ScrollTrigger + Lenis). */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  const animated = hasGsap && !reduceMotion;
  let wordTween = null;

  /* ---------------- Idioma ---------------- */
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* sin almacenamiento: no pasa nada */ } }
  };

  const nodes = [...document.querySelectorAll("[data-i18n]")];
  const spanish = new Map(nodes.map(n => [n, n.textContent]));
  let lang = store.get("lang") || ((navigator.language || "es").toLowerCase().startsWith("es") ? "es" : "en");

  function applyLanguage(next) {
    lang = next;
    root.lang = next;
    for (const n of nodes) {
      const key = n.dataset.i18n;
      const text = next === "en" ? (window.I18N_EN || {})[key] : spanish.get(n);
      if (text) n.textContent = text;
    }
    document.querySelectorAll(".lang [data-lang]").forEach(s => s.classList.toggle("is-on", s.dataset.lang === next));
    splitWords();
    store.set("lang", next);
    if (animated) {
      buildWordReveal();
      ScrollTrigger.refresh();
    }
  }

  document.querySelector(".lang").addEventListener("click", () => applyLanguage(lang === "es" ? "en" : "es"));

  /* Separa el texto en palabras para iluminarlas de a una con el scroll. */
  function splitWords() {
    document.querySelectorAll(".reveal-words").forEach(el => {
      const words = el.textContent.trim().split(/\s+/);
      el.innerHTML = words.map(w => `<span class="word">${w}</span>`).join(" ");
    });
  }

  /* ---------------- Sin animaciones: todo visible ---------------- */
  if (!animated) {
    root.classList.add("no-motion");
    applyLanguage(lang);
    document.querySelectorAll(".count").forEach(c => { c.textContent = c.dataset.to; });
    activateStep(0);
    bindAnchors(null);
    bindNav();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------------- Scroll suave ---------------- */
  let lenis = null;
  if (typeof window.Lenis !== "undefined") {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();   // hasta que termine la pantalla de carga
  }

  bindAnchors(lenis);
  bindNav();
  applyLanguage(lang);

  /* ---------------- Pantalla de carga e intro ---------------- */
  const counter = { v: 0 };
  const loaderCount = document.getElementById("loader-count");
  gsap.set(".hero__title .line > *", { yPercent: 115 });
  gsap.set([".hero .eyebrow", ".hero__sub", ".hero__cta", ".scroll-cue"], { autoAlpha: 0, y: 24 });
  gsap.set(".stack__layer", { autoAlpha: 0, y: -60 });

  const intro = gsap.timeline({ paused: true })
    .to(".loader", { yPercent: -100, duration: .9, ease: "expo.inOut" })
    .to(".hero__title .line > *", { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: .09 }, "-=.35")
    .to(".stack__layer", { autoAlpha: 1, y: 0, duration: 1, ease: "back.out(1.4)", stagger: { each: .14, from: "end" } }, "<.1")
    .to([".hero .eyebrow", ".hero__sub", ".hero__cta", ".scroll-cue"], { autoAlpha: 1, y: 0, duration: .8, ease: "power3.out", stagger: .08 }, "<.2")
    .add(() => { root.classList.add("is-loaded"); lenis && lenis.start(); });

  gsap.to(counter, {
    v: 100, duration: 1.3, ease: "power2.inOut",
    onUpdate: () => { loaderCount.textContent = Math.round(counter.v); },
    onComplete: () => intro.play()
  });

  /* ---------------- Animaciones por tamaño de pantalla ---------------- */
  const mm = gsap.matchMedia();

  mm.add("(min-width: 1081px)", () => {
    // Hero fijado: las tres capas se separan y aparecen sus nombres.
    const tl = gsap.timeline({
      scrollTrigger: { trigger: ".hero", start: "top top", end: "+=110%", scrub: 1, pin: ".hero__pin", anticipatePin: 1 }
    });
    tl.to(".stack__layer--3", { y: -95, ease: "none" }, 0)
      .to(".stack__layer--1", { y: 95, ease: "none" }, 0)
      .to(".stack__shadow", { attr: { ry: 22 }, opacity: .6, ease: "none" }, 0)
      .fromTo(".stack__label", { autoAlpha: 0, x: 24 }, { autoAlpha: 1, x: 0, stagger: .12, ease: "power2.out" }, .15)
      .to(".hero__copy", { y: -60, autoAlpha: .25, ease: "none" }, .55)
      .to(".scroll-cue", { autoAlpha: 0, ease: "none" }, 0);

    // Proyecto fijado: cada tramo del scroll muestra una pantalla de la app.
    const steps = 4;
    ScrollTrigger.create({
      trigger: ".project", start: "top top", end: `+=${steps * 80}%`, pin: ".project__pin", scrub: true,
      onUpdate: self => activateStep(Math.min(steps - 1, Math.floor(self.progress * steps)))
    });
    gsap.fromTo(".app", { rotateX: 10, rotateY: -12, scale: .94 }, {
      rotateX: 0, rotateY: 0, scale: 1, ease: "none", transformPerspective: 1400,
      scrollTrigger: { trigger: ".project", start: "top bottom", end: "top top", scrub: true }
    });

    // Clic en un paso: salta a esa parte del recorrido.
    document.querySelectorAll(".step").forEach(step => {
      step.style.cursor = "pointer";
      step.addEventListener("click", () => {
        const st = ScrollTrigger.getAll().find(t => t.pin && t.trigger === document.querySelector(".project"));
        if (!st) return;
        const i = Number(step.dataset.step);
        const y = st.start + (st.end - st.start) * ((i + .5) / steps);
        lenis ? lenis.scrollTo(y, { duration: 1.2 }) : window.scrollTo({ top: y, behavior: "smooth" });
      });
    });
  });

  mm.add("(max-width: 1080px)", () => {
    // En pantallas chicas no se fija nada: las capas se separan un poco y la app rota sola.
    gsap.to(".stack__label", { autoAlpha: 1, duration: .6, stagger: .12, delay: 2.4 });
    gsap.to(".stack__layer--3", { y: -40, scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    gsap.to(".stack__layer--1", { y: 40, scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    document.querySelectorAll(".step").forEach(s => s.classList.add("is-active"));

    let i = 0, timer = null;
    const cycle = () => { activateStep(i = (i + 1) % 4, true); };
    ScrollTrigger.create({
      trigger: ".app", start: "top 85%", end: "bottom 15%",
      onToggle: self => { clearInterval(timer); if (self.isActive) timer = setInterval(cycle, 2600); }
    });
    return () => clearInterval(timer);
  });

  /* ---------------- Cinta infinita (acelera con el scroll) ---------------- */
  const marquee = gsap.to(".marquee__track", { xPercent: -50, duration: 38, ease: "none", repeat: -1 });
  ScrollTrigger.create({
    trigger: ".marquee", start: "top bottom", end: "bottom top",
    onUpdate: self => {
      const speed = 1 + Math.min(4, Math.abs(self.getVelocity()) / 600);
      gsap.to(marquee, { timeScale: self.direction < 0 ? -speed : speed, duration: .3, overwrite: true });
      gsap.to(marquee, { timeScale: self.direction < 0 ? -1 : 1, duration: 1.2, delay: .3 });
    }
  });

  /* ---------------- Apariciones genéricas ---------------- */
  ScrollTrigger.batch(".reveal", {
    start: "top 88%",
    onEnter: batch => gsap.to(batch, { opacity: 1, y: 0, duration: 1, ease: "power3.out", stagger: .1, overwrite: true })
  });

  gsap.utils.toArray(".index").forEach(el =>
    gsap.from(el, { opacity: 0, x: -20, duration: .9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%" } }));

  gsap.utils.toArray(".h2").forEach(el =>
    gsap.from(el, { opacity: 0, y: 40, duration: 1.1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%" } }));

  gsap.from(".contact__title .line > *", {
    yPercent: 110, duration: 1.3, ease: "expo.out",
    scrollTrigger: { trigger: ".contact", start: "top 70%" }
  });

  // Números que cuentan hasta su valor la primera vez que aparecen.
  document.querySelectorAll(".count").forEach(el => {
    const to = Number(el.dataset.to);
    const from = Number(el.dataset.from || 0);
    const obj = { v: from };
    el.textContent = from;
    gsap.to(obj, {
      v: to, duration: 1.8, ease: "power3.out",
      onUpdate: () => { el.textContent = Math.round(obj.v); },
      scrollTrigger: { trigger: el, start: "top 90%", once: true }
    });
  });

  // Fuentes cargadas = medidas definitivas.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());

  /* ---------------- Funciones auxiliares ---------------- */
  function buildWordReveal() {
    if (wordTween) { wordTween.scrollTrigger && wordTween.scrollTrigger.kill(); wordTween.kill(); }
    const words = document.querySelectorAll(".reveal-words .word");
    if (!words.length) return;
    wordTween = gsap.to(words, {
      opacity: 1, ease: "none", stagger: .08,
      scrollTrigger: { trigger: ".profile__statement", start: "top 82%", end: "bottom 45%", scrub: true }
    });
  }

  function activateStep(index) {
    document.querySelectorAll(".step").forEach((s, i) => {
      if (window.matchMedia("(min-width: 1081px)").matches || root.classList.contains("no-motion")) s.classList.toggle("is-active", i === index);
    });
    document.querySelectorAll(".screen").forEach((s, i) => s.classList.toggle("is-active", i === index));
    const side = document.querySelectorAll(".app__side b");
    side.forEach((b, i) => b.classList.toggle("is-on", i === [0, 4, 6, 1][index]));
  }

  function bindAnchors(smooth) {
    document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      if (smooth) smooth.scrollTo(target, { offset: a.getAttribute("href") === "#top" ? 0 : -10, duration: 1.4 });
      else target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    }));
  }

  function bindNav() {
    const nav = document.querySelector(".nav");
    const bar = document.querySelector(".nav__progress span");
    const links = [...document.querySelectorAll(".nav__links a")];
    const sections = links.map(l => document.querySelector(l.getAttribute("href")));

    const onScroll = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      nav.classList.toggle("is-scrolled", y > 40);
      bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      let current = -1;
      sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < window.innerHeight * .4) current = i; });
      links.forEach((l, i) => l.classList.toggle("is-current", i === current));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
})();
