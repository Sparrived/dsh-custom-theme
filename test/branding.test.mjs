/**
 * The branding feature's tests.
 *
 * Two regions can be reworded, re-drawn and styled: the sidebar's brand block and the
 * welcome header. Three of the four routes those choices take are reachable without a
 * page — the sheet is text in a `<style>`, the hero's wording goes through the shell's
 * lookup, the seats are registrations the harness records, and the region hooks are
 * attributes on elements the suite builds itself. What only a live window can show is
 * what the seat occupants look like on screen and whether a rule the user wrote lands
 * on the element they meant.
 *
 * The one piece that cannot be reached by booting the plugin is a React row: this
 * suite's React double has no renderer. So the card's own controls are pinned by the
 * page stylesheet carrying their classes, and everything behind them — the model, the
 * stored round trip, the lookup wrapper and the seats — is driven directly, the way
 * `test/effort.test.mjs` drives the slider's parts.
 */

import assert from "node:assert/strict"
import test from "node:test"

import { BRANDING_KEY, boot, createElement, createLocale, definition, fakeRequire, storage } from "./harness.mjs"

/** The parts of the feature the suite drives directly, off the plugin's own module. */
const internals = definition.factory(fakeRequire).__internals

/** The three seats the shell declares for its own marks, which the choices may fill. */
const SEATS = ["sidebar.brand.mark", "sidebar.brand.name", "conversation.hero.brand.mark"]

/**
 * The shell's own class names for the regions, as the page carries them.
 *
 * They are CSS-module hashes in the shipped build, so the feature matches the author's
 * suffix rather than a hash; the double uses one of those shapes to prove the pattern
 * matches what a build produces.
 */
const BRAND_CLASS = "_2H3hWW_brandIdentity"
const HEADLINE_CLASS = "Hqq-bq_headline"
const BADGE_CLASS = "Hqq-bq_previewBadge"

/** One of the shell's own elements, as the page would have it. */
function shellElement(className) {
  const element = createElement("div")
  element.setAttribute("class", className)
  return element
}

/** The element the conversation reports its phase on. */
function phaseElement(value) {
  const element = createElement("div")
  element.setAttribute("data-phase", value)
  return element
}

/**
 * The hero's headline row with its preview badge inside it, as the shell draws it.
 * @returns The row and the badge.
 */
function heroRow() {
  const headline = shellElement(HEADLINE_CLASS)
  const badge = shellElement(BADGE_CLASS)
  headline.append(badge)
  return { headline, badge }
}

/**
 * A locale service that ships the hero's own two strings, the way the shell's does.
 * @returns The service.
 */
function heroLocale() {
  const locale = createLocale()
  locale.register("conversation", {
    zh: { "hero.headline": "探索未至之境", "hero.preview": "预览版", "hero.chooseWorkspace": "选择工作区" },
  })
  return locale
}

/**
 * The hero's wording controller, over a lookup this suite can watch.
 * @param initial - The choices in force.
 * @returns The controller, the service, and a seat for changing the choices.
 */
function heroWording(initial = { heroHeadline: "你好", heroBadge: "" }) {
  const locale = heroLocale()
  const warnings = []
  let choices = initial
  const wording = internals.createBrandHeroWording({
    locale,
    settings: () => choices,
    warn: (message) => warnings.push(message),
  })
  return {
    locale,
    wording,
    warnings,
    /** The lookup the shell shipped, before anything patched it. */
    shipped: locale.translate,
    set: (next) => { choices = { ...choices, ...next } },
  }
}

/* ─── The shipped state ─── */

test("nothing configured leaves every surface as the shell draws it", () => {
  const booted = boot()
  // No seat is filled in, so the shell's own mark, wordmark and fish keep their seats.
  assert.deepEqual(booted.registrations.filter((entry) => SEATS.includes(entry.options.name)), [])
  // The lookup is untouched: a shell with no wording choice configured reads exactly as
  // it shipped, which is also what keeps this feature out of the way of the label patch.
  assert.equal(booted.locale.translate, booted.originalTranslate)
  // Nothing is stored, and the sheet carries only the rules this plugin's own elements need.
  assert.equal(booted.savedBranding(), null)
  assert.ok(booted.brandingCss().includes(".dct-brand-text {"), "the plugin's own rules are missing")
  assert.ok(!booted.brandingCss().includes("/* dsh-custom-theme /"), "an empty box was written into the sheet")
  booted.dispose()
})

test("the card's controls are styled by the page sheet", () => {
  const booted = boot()
  const css = booted.pageCss()
  assert.ok(css.includes(".dct-field {"), "the card's single-line fields have no frame")
  assert.ok(css.includes(".dct-branding .dct-area {"), "the stylesheet boxes are not set as code")
  booted.dispose()
})

/* ─── The sheet ─── */

test("each stylesheet box is injected as written, under its own label", () => {
  const booted = boot({
    branding: {
      cssBrand: "[data-dct-brand] > * { display: flex; }",
      cssHero: "[data-dct-hero] { letter-spacing: 0.2em; }",
      cssGlobal: "@font-face { font-family: dsh; src: url(https://example.test/a.woff2); }",
    },
  })
  const css = booted.brandingCss()
  assert.ok(css.startsWith(".dct-brand-text {"), "the plugin's own rules must come first")
  // The boxes keep the order the card declares them in, and nothing is rewritten on the
  // way in: a rule that reaches past the two regions is the point of the third box.
  const parts = [
    "/* dsh-custom-theme / sidebar brand */",
    "[data-dct-brand] > * { display: flex; }",
    "/* dsh-custom-theme / hero */",
    "[data-dct-hero] { letter-spacing: 0.2em; }",
    "/* dsh-custom-theme / page */",
    "@font-face { font-family: dsh; src: url(https://example.test/a.woff2); }",
  ]
  let at = -1
  for (const part of parts) {
    const found = css.indexOf(part, at + 1)
    assert.ok(found > at, `missing or out of order: ${part}`)
    at = found
  }
  booted.dispose()
})

test("an empty box contributes nothing to the sheet", () => {
  const booted = boot({ branding: { cssHero: "[data-dct-hero] { color: red; }" } })
  const css = booted.brandingCss()
  assert.ok(css.includes("[data-dct-hero] { color: red; }"))
  assert.ok(!css.includes("sidebar brand"), "a label was written for a box that holds nothing")
  assert.ok(!css.includes("/ page */"), "a label was written for a box that holds nothing")
  booted.dispose()
})

/* ─── The model and the store ─── */

test("a stored choice is a string per field, held to its cap, and spaces are kept", () => {
  const normalized = internals.normalizeBranding({
    brandName: " A B ",
    brandMark: 42,
    heroHeadline: "x".repeat(260),
    heroBadge: "   ",
    cssBrand: "a".repeat(20001),
    cssGlobal: undefined,
    stray: "dropped",
  })
  // The card edits these one keystroke at a time, so a value trimmed on the way through
  // would swallow the space between two words as the user types it.
  assert.equal(normalized.brandName, " A B ")
  assert.equal(normalized.brandMark, "", "a non-string was kept")
  assert.equal(normalized.heroHeadline.length, 200)
  assert.equal(normalized.heroBadge, "", "a box holding only spaces is not the empty choice")
  assert.equal(normalized.cssBrand.length, 20000)
  assert.equal(normalized.cssGlobal, "")
  assert.deepEqual(Object.keys(normalized).sort(), Object.keys(internals.BRANDING_DEFAULTS).sort())
})

test("an entry that asks for nothing is removed, and one that asks for something round-trips", () => {
  const { BRANDING_DEFAULTS, normalizeBranding, readSavedBranding, writeSavedBranding } = internals
  writeSavedBranding({ ...BRANDING_DEFAULTS })
  assert.equal(storage.getItem(BRANDING_KEY), null, "an entry holding nothing was left in the store")
  writeSavedBranding({ brandName: "鲸鱼", heroHeadline: "你好" })
  assert.deepEqual(readSavedBranding(), { ...BRANDING_DEFAULTS, brandName: "鲸鱼", heroHeadline: "你好" })
  storage.entries.set(BRANDING_KEY, "{ not json")
  assert.deepEqual(readSavedBranding(), BRANDING_DEFAULTS, "a corrupt entry did not read as the shipped state")
  assert.deepEqual(normalizeBranding("nonsense"), BRANDING_DEFAULTS)
})

/* ─── The hero's wording ─── */

test("a custom headline and badge replace the hero's own wording and nothing else", () => {
  const booted = boot({ locale: heroLocale(), branding: { heroHeadline: "未至之境，已至", heroBadge: "内测" } })
  const hero = booted.locale.bind("conversation")
  assert.equal(hero("hero.headline"), "未至之境，已至")
  assert.equal(hero("hero.preview"), "内测")
  assert.equal(hero("hero.chooseWorkspace"), "选择工作区", "a key beside the two was reworded as well")
  assert.equal(booted.t("chat.deepDiving"), "深度求索中", "the chat namespace was reached")
  assert.equal(booted.locale.bind("dshCustomTheme")("nav"), "主题与背景")
  booted.dispose()
})

test("only the box that was filled is reworded", () => {
  const booted = boot({ locale: heroLocale(), branding: { heroBadge: "内测" } })
  const hero = booted.locale.bind("conversation")
  assert.equal(hero("hero.headline"), "探索未至之境")
  assert.equal(hero("hero.preview"), "内测")
  booted.dispose()
})

test("disposing the plugin puts the hero's wording back", () => {
  const booted = boot({ locale: heroLocale(), branding: { heroHeadline: "甲" } })
  assert.equal(booted.locale.bind("conversation")("hero.headline"), "甲")
  booted.dispose()
  assert.equal(booted.locale.bind("conversation")("hero.headline"), "探索未至之境")
  assert.equal(booted.locale.translate, booted.originalTranslate, "the lookup was not put back")
})

test("the hero's wording and the running label share one lookup", () => {
  const booted = boot({ working: { texts: ["甲"], interval: 1200 }, branding: { heroHeadline: "你好" } })
  assert.equal(booted.t("chat.deepDiving"), "甲")
  assert.equal(booted.locale.bind("conversation")("hero.headline"), "你好")
  booted.dispose()
  assert.equal(booted.locale.translate, booted.originalTranslate, "the two patches did not unwind in order")
  assert.equal(booted.t("chat.deepDiving"), "深度求索中")
})

test("a wrapper another patch dropped is installed again over that patch", () => {
  const { locale, wording, shipped } = heroWording()
  wording.arm()
  const hero = locale.bind("conversation")
  assert.equal(hero("hero.headline"), "你好")
  // What the running-label effect does when its row is edited: it installs over whatever
  // holds the lookup, and withdrawing restores the value *it* captured. When this wrapper
  // was installed after that patch, the value it captured is the shipped lookup — so the
  // withdrawal takes this wrapper out of the chain with it.
  locale.translate = shipped
  assert.equal(hero("hero.headline"), "探索未至之境", "the wrapper was not actually out of the chain")
  wording.arm()
  assert.equal(hero("hero.headline"), "你好", "the wording was not installed again")
})

test("the choice in force is answered by the wrapper already installed", () => {
  const { locale, wording, set, shipped } = heroWording({ heroHeadline: "甲" })
  wording.arm()
  const installed = locale.translate
  const hero = locale.bind("conversation")
  set({ heroHeadline: "乙" })
  wording.arm()
  assert.equal(locale.translate, installed, "a second wrapper was stacked over the first")
  assert.equal(hero("hero.headline"), "乙")
  set({ heroHeadline: "", heroBadge: "" })
  wording.arm()
  assert.equal(locale.translate, shipped, "the wrapper stayed in the chain with nothing to say")
  assert.equal(hero("hero.headline"), "探索未至之境")
})

test("withdrawing leaves a patch installed later in place", () => {
  const { locale, wording } = heroWording()
  wording.arm()
  const wrapped = locale.translate
  // A patch installed after this one, holding this wrapper the way the label patch holds
  // whatever it found. Cutting it out of the chain would take that patch down with it.
  const foreign = function (ns, key, params) { return wrapped.call(this, ns, key, params) }
  locale.translate = foreign
  wording.dispose()
  assert.equal(locale.translate, foreign, "a patch installed later was cut out of the chain")
  assert.equal(locale.bind("conversation")("hero.headline"), "探索未至之境", "the withdrawn wrapper still answered with the choice")
})

test("a withdrawn wrapper drops itself once it is outermost again", () => {
  const { locale, wording, shipped } = heroWording()
  wording.arm()
  const wrapped = locale.translate
  const foreign = function (ns, key, params) { return wrapped.call(this, ns, key, params) }
  locale.translate = foreign
  wording.dispose()
  // The later patch withdraws and restores what it captured: this wrapper, now dead.
  locale.translate = wrapped
  assert.equal(locale.bind("conversation")("hero.headline"), "探索未至之境")
  assert.equal(locale.translate, shipped, "a dead wrapper was left holding the lookup")
})

test("a service that refuses the patch is reported and the wording stays as shipped", () => {
  const booted = boot({ locale: Object.freeze(heroLocale()), branding: { heroHeadline: "你好" } })
  assert.equal(booted.locale.bind("conversation")("hero.headline"), "探索未至之境")
  assert.ok(
    booted.warnings.some((line) => line.includes("refuses a locale lookup patch")),
    `the refusal was not reported: ${JSON.stringify(booted.warnings)}`,
  )
  booted.dispose()
})

/* ─── The seats ─── */

test("a custom name and marks fill the shell's own seats, below its occupant", () => {
  const booted = boot({
    branding: {
      brandName: "大肥鱼",
      brandMark: "https://example.test/whale.svg",
      heroMark: "data:image/svg+xml;base64,PHN2Zy8+",
    },
  })
  const filled = new Map(
    booted.registrations
      .filter((entry) => SEATS.includes(entry.options.name))
      .map((entry) => [entry.options.name, entry]),
  )
  assert.deepEqual([...filled.keys()].sort(), [...SEATS].sort())
  for (const entry of filled.values()) {
    // A `single` seat renders its lowest-priority entry, and the shell's own brand sits
    // at the default 0: an override at that priority would throw instead of rendering.
    assert.equal(entry.options.priority, -10, `${entry.options.name} was claimed at a priority the shell's own occupant wins`)
  }

  const name = filled.get("sidebar.brand.name").component({})
  assert.equal(name.type, "span")
  assert.equal(name.props.className, "dct-brand-text")
  assert.equal(name.props["data-dct-brand-name"], "")
  assert.deepEqual(name.children, ["大肥鱼"])

  const markSeat = filled.get("sidebar.brand.mark")
  const mark = markSeat.component({ size: 24 })
  assert.equal(mark.type, "img")
  assert.equal(mark.props.src, "https://example.test/whale.svg")
  assert.equal(mark.props.width, 24)
  assert.equal(mark.props["data-dct-brand-mark"], "")
  // The seat decides the size; a seat that passes none gets the sidebar's own.
  assert.equal(markSeat.component({}).props.width, 24)

  const hero = filled.get("conversation.hero.brand.mark")
  assert.equal(hero.component({ size: 34 }).props.width, 34)
  assert.equal(hero.component({}).props.width, 34)
  assert.equal(hero.component({}).props.src, "data:image/svg+xml;base64,PHN2Zy8+")
  booted.dispose()
})

test("each seat is filled only while its box holds something", () => {
  const booted = boot({ branding: { brandName: "大肥鱼" } })
  const filled = booted.registrations
    .filter((entry) => SEATS.includes(entry.options.name))
    .map((entry) => entry.options.name)
  // The official art cannot be re-drawn by a plugin that may not import the shell's own
  // components, so an empty box must leave the seat to the shell rather than render
  // nothing into it.
  assert.deepEqual(filled, ["sidebar.brand.name"])
  booted.dispose()
})

/* ─── The region hooks ─── */

test("the sidebar brand is marked as soon as the shell draws it", () => {
  const booted = boot()
  const brand = shellElement(BRAND_CLASS)
  booted.document.body.append(brand)
  booted.triggerMutation()
  assert.equal(brand.getAttribute("data-dct-brand"), "")
  booted.dispose()
})

test("the hero's two hooks wait for the hero", () => {
  const booted = boot()
  const phase = phaseElement("active")
  const { headline, badge } = heroRow()
  booted.document.body.append(phase, headline)
  booted.triggerMutation()
  // While a session is on screen there is no hero to mark, and the pass must not go
  // looking for one on every mutation a streaming reply makes.
  assert.equal(headline.getAttribute("data-dct-hero"), null)
  assert.equal(badge.getAttribute("data-dct-hero-badge"), null)
  phase.setAttribute("data-phase", "hero")
  booted.triggerMutation()
  assert.equal(headline.getAttribute("data-dct-hero"), "")
  assert.equal(badge.getAttribute("data-dct-hero-badge"), "")
  booted.dispose()
})

test("the hero's row is reached from its badge, not from the name two rows share", () => {
  const booted = boot()
  // The context meter's popup carries a `_headline` class of its own, and it can be open
  // while the hero is: a rule that matched it would dress an element the user never
  // meant. The badge is inside the hero's row unconditionally, so the walk starts there.
  const meterHeadline = shellElement("_2WTFBq_headline")
  const { headline, badge } = heroRow()
  booted.document.body.append(phaseElement("hero"), meterHeadline, headline)
  booted.triggerMutation()
  assert.equal(meterHeadline.getAttribute("data-dct-hero"), null, "the context meter's popup was dressed as the hero")
  assert.equal(headline.getAttribute("data-dct-hero"), "")
  assert.equal(badge.getAttribute("data-dct-hero-badge"), "")
  booted.dispose()
})

test("a region the shell replaced is marked again where it now is", () => {
  const booted = boot()
  const first = shellElement(BRAND_CLASS)
  booted.document.body.append(first)
  booted.triggerMutation()
  assert.equal(first.getAttribute("data-dct-brand"), "")
  // The shell rebuilds its header: the marked element leaves the document and a new one
  // takes its place. The hook has to follow the region, not the element it was put on.
  first.remove()
  const second = shellElement(BRAND_CLASS)
  booted.document.body.append(second)
  booted.triggerMutation()
  assert.equal(second.getAttribute("data-dct-brand"), "")
  booted.dispose()
})

test("the hooks come off with the plugin, and nothing is marked afterwards", () => {
  const booted = boot()
  const brand = shellElement(BRAND_CLASS)
  booted.document.body.append(brand)
  booted.triggerMutation()
  assert.equal(brand.getAttribute("data-dct-brand"), "")
  booted.dispose()
  assert.equal(brand.getAttribute("data-dct-brand"), null, "the hook outlived the plugin")
  const later = shellElement(BRAND_CLASS)
  booted.document.body.append(later)
  booted.triggerMutation()
  assert.equal(later.getAttribute("data-dct-brand"), null, "the pass kept running after the plugin was disposed")
})
