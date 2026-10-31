const MODULE_ID = "class-sheet-headers";
const CONFIG_TEMPLATE = `modules/${MODULE_ID}/templates/header-config.hbs`;
const ACTOR_TEMPLATE = `modules/${MODULE_ID}/templates/actor-header.hbs`;
const ROW_TEMPLATE = `modules/${MODULE_ID}/templates/header-row.hbs`;
const FOOTER_TEMPLATE = "templates/generic/form-footer.hbs";
const HEADER_VAR = "--dnd5e-character-header-image";
const BACKGROUND_VAR = "--dnd5e-character-background-image";
const HEADER_ASPECT = 1391 / 510;
const MAX_ZOOM = 8;

/* -------------------------------------------- */
/*  Setup                                       */
/* -------------------------------------------- */

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "headers", {
    scope: "world",
    config: false,
    type: Object,
    default: { classes: {}, player: {}, other: {}, campaign: {} },
    onChange: refreshSheets
  });

  game.settings.register(MODULE_ID, "active", {
    scope: "world",
    config: false,
    type: Boolean,
    default: true,
    onChange: refreshSheets
  });

  game.settings.registerMenu(MODULE_ID, "headersMenu", {
    name: "CLASSHEADERS.Menu.Name",
    label: "CLASSHEADERS.Menu.Label",
    hint: "CLASSHEADERS.Menu.Hint",
    icon: "fas fa-image",
    type: HeaderConfig,
    restricted: true
  });

  game.settings.register(MODULE_ID, "multiclass", {
    name: "CLASSHEADERS.Settings.Multiclass.Name",
    hint: "CLASSHEADERS.Settings.Multiclass.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      original: "CLASSHEADERS.Settings.Multiclass.Original",
      highest: "CLASSHEADERS.Settings.Multiclass.Highest"
    },
    default: "original",
    onChange: refreshSheets
  });

  game.settings.register(MODULE_ID, "playerOnly", {
    name: "CLASSHEADERS.Settings.PlayerOnly.Name",
    hint: "CLASSHEADERS.Settings.PlayerOnly.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: refreshSheets
  });

  game.settings.register(MODULE_ID, "allowPlayers", {
    name: "CLASSHEADERS.Settings.AllowPlayers.Name",
    hint: "CLASSHEADERS.Settings.AllowPlayers.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  foundry.applications.handlebars.loadTemplates([CONFIG_TEMPLATE, ACTOR_TEMPLATE, ROW_TEMPLATE]);
});

Hooks.on("renderCharacterActorSheet", (sheet, element) => applyHeader(sheet.actor, element));

Hooks.on("getHeaderControlsCharacterActorSheet", (sheet, controls) => {
  if ( !canConfigure(sheet.actor) ) return;
  sheet.options.actions.cshConfigureHeader ??= function() { ActorHeaderConfig.open(this.actor); };
  controls.push({ icon: "fas fa-image", label: "CLASSHEADERS.ActorConfig.Title", action: "cshConfigureHeader" });
});

/* -------------------------------------------- */
/*  Header resolution                           */
/* -------------------------------------------- */

/**
 * @typedef {object} HeaderEntry
 * @property {string} src     Image path.
 * @property {number} [x]    Crop left, as a fraction of the image width.
 * @property {number} [y]    Crop top, as a fraction of the image height.
 * @property {number} [w]    Crop width, as a fraction of the image width.
 * @property {number} [r]    Image aspect ratio (width / height).
 */

/**
 * @param {Actor5e} actor
 * @param {object} [options]
 * @param {boolean} [options.ignoreActor]  Skip the actor's own image, to show what it would inherit.
 * @returns {(HeaderEntry & { source: string, label?: string })|null}
 */
function resolveHeader(actor, { ignoreActor=false }={}) {
  if ( !game.settings.get(MODULE_ID, "active") ) return null;
  const headers = game.settings.get(MODULE_ID, "headers");
  const campaign = headers.campaign?.src ? { ...headers.campaign, source: "campaign" } : null;
  if ( campaign?.force ) return campaign;

  const own = actor.getFlag(MODULE_ID, "header");
  if ( !ignoreActor && own?.src ) return { ...own, source: "actor" };

  const isPlayer = actor.hasPlayerOwner;
  if ( isPlayer || !game.settings.get(MODULE_ID, "playerOnly") ) {
    const cls = getMainClass(actor);
    const entry = cls && headers.classes?.[cls.identifier];
    if ( entry?.src ) return { ...entry, source: "class", label: cls.name };
  }

  const fallback = isPlayer ? headers.player : headers.other;
  if ( fallback?.src ) return { ...fallback, source: isPlayer ? "player" : "other" };
  return campaign;
}

/**
 * @param {Actor5e} actor
 * @returns {Item5e|null}
 */
function getMainClass(actor) {
  const classes = Object.values(actor.classes ?? {});
  if ( !classes.length ) return null;
  if ( game.settings.get(MODULE_ID, "multiclass") === "original" ) {
    const original = actor.items.get(actor.system.details?.originalClass);
    if ( original ) return original;
  }
  return classes.reduce((a, b) => (b.system.levels > a.system.levels ? b : a));
}

function applyHeader(actor, element) {
  const header = element?.querySelector(".sheet-header");
  if ( !header ) return;
  const content = element.querySelector(".window-content");
  const entry = resolveHeader(actor);
  let layer = header.querySelector(":scope > .csh-header-image");
  let background = content?.querySelector(":scope > .csh-background");
  if ( !entry ) {
    if ( layer ) {
      layer.remove();
      header.style.removeProperty(HEADER_VAR);
    }
    if ( background ) {
      background.remove();
      content.style.removeProperty(BACKGROUND_VAR);
    }
    return;
  }

  layer ??= header.insertAdjacentElement("afterbegin", createFrame("csh-header-image"));
  header.style.setProperty(HEADER_VAR, "none");
  updateFrame(layer, entry);

  if ( !content ) return;
  const backgroundContent = getComputedStyle(content).getPropertyValue("--dnd5e-character-background-content").trim();
  if ( backgroundContent && (backgroundContent !== "none") ) {
    background ??= content.insertAdjacentElement("afterbegin", createBackground());
    content.style.setProperty(BACKGROUND_VAR, "none");
    updateFrame(background.firstElementChild, entry);
  }
  else background?.remove();
}

function createFrame(className) {
  const frame = document.createElement("div");
  frame.className = `${className} csh-frame`;
  frame.append(document.createElement("img"));
  return frame;
}

function createBackground() {
  const background = document.createElement("div");
  background.className = "csh-background";
  background.append(createFrame("csh-background-frame"));
  return background;
}

function updateFrame(frame, entry) {
  const img = frame.firstElementChild;
  if ( img.getAttribute("src") !== entry.src ) img.src = entry.src;
  img.setAttribute("style", getFrameStyle(entry));
}

function refreshSheets() {
  const Sheet = dnd5e.applications.actor.CharacterActorSheet;
  for ( const app of foundry.applications.instances.values() ) {
    if ( (app instanceof Sheet) && app.rendered ) applyHeader(app.actor, app.element);
  }
}

function canConfigure(actor) {
  return game.user.isGM || (actor.isOwner && game.settings.get(MODULE_ID, "allowPlayers"));
}

/* -------------------------------------------- */
/*  Crop                                        */
/* -------------------------------------------- */

/**
 * @param {Partial<HeaderEntry>} entry
 * @returns {string}
 */
function getFrameStyle(entry) {
  if ( !entry?.w || !entry?.r ) return "inset: 0; width: 100%; height: 100%; object-fit: cover;";
  const { x, y, w, r } = entry;
  return [
    `width: calc(100cqw / ${w})`,
    `left: calc(-100cqw * ${x / w})`,
    `top: calc(50cqh - 100cqw / ${2 * HEADER_ASPECT} - 100cqw * ${y / (w * r)})`
  ].join("; ");
}

/** @param {number} r  Image aspect ratio. */
function getMaxWidth(r) {
  return Math.min(1, HEADER_ASPECT / r);
}

function getDefaultCrop(r) {
  const w = getMaxWidth(r);
  return { r, w, x: (1 - w) / 2, y: (1 - (w * r / HEADER_ASPECT)) / 2 };
}

function clampCrop({ x, y, w, r }) {
  const max = getMaxWidth(r);
  w = Math.clamp(w, max / MAX_ZOOM, max);
  const h = w * r / HEADER_ASPECT;
  return { r, w, x: Math.clamp(x, 0, 1 - w), y: Math.clamp(y, 0, 1 - h) };
}

/**
 * @param {string} name     Form field prefix.
 * @param {HeaderEntry} [entry]
 */
function rowContext(name, entry) {
  return {
    name,
    src: entry?.src ?? "",
    x: entry?.x ?? "",
    y: entry?.y ?? "",
    w: entry?.w ?? "",
    r: entry?.r ?? "",
    frameStyle: getFrameStyle(entry),
    maxZoom: MAX_ZOOM
  };
}

/** @returns {HeaderEntry|{}} */
function cleanEntry(entry) {
  if ( !entry?.src ) return {};
  const crop = ["x", "y", "w", "r"].map(k => Number(entry[k]));
  if ( (entry.w === "") || !crop.every(Number.isFinite) || !(crop[3] > 0) ) return { src: entry.src };
  const [x, y, w, r] = crop;
  return { src: entry.src, ...clampCrop({ x, y, w, r }) };
}

function bindEditors(root) {
  for ( const row of root.querySelectorAll(".csh-row") ) {
    const picker = row.querySelector("file-picker");
    const canvas = row.querySelector(".csh-canvas");
    const source = canvas.querySelector("img");
    const box = canvas.querySelector(".csh-crop");
    const result = row.querySelector(".csh-result img");
    const zoom = row.querySelector(".csh-zoom-range");
    const fields = Object.fromEntries(["x", "y", "w", "r"].map(k => [k, row.querySelector(`input[name$=".${k}"]`)]));
    let crop = null;
    let reset = false;

    const write = next => {
      crop = clampCrop(next);
      for ( const [k, input] of Object.entries(fields) ) input.value = crop[k];
      Object.assign(box.style, {
        left: `${crop.x * 100}%`,
        top: `${crop.y * 100}%`,
        width: `${crop.w * 100}%`,
        height: `${crop.w * crop.r / HEADER_ASPECT * 100}%`
      });
      zoom.value = getMaxWidth(crop.r) / crop.w;
      result.setAttribute("style", getFrameStyle(crop));
    };
    const zoomTo = w => {
      const h = crop.w * crop.r / HEADER_ASPECT;
      const cx = crop.x + (crop.w / 2);
      const cy = crop.y + (h / 2);
      write({ r: crop.r, w, x: cx - (w / 2), y: cy - (w * crop.r / HEADER_ASPECT / 2) });
    };

    const onLoad = () => {
      if ( !source.naturalWidth ) return;
      const r = source.naturalWidth / source.naturalHeight;
      const stored = { x: Number(fields.x.value), y: Number(fields.y.value), w: Number(fields.w.value), r };
      const valid = !reset && (fields.w.value !== "") && [stored.x, stored.y, stored.w].every(Number.isFinite);
      reset = false;
      write(valid ? stored : getDefaultCrop(r));
    };
    source.addEventListener("load", onLoad);
    if ( source.complete ) onLoad();

    picker.addEventListener("change", () => {
      row.classList.toggle("csh-has-image", !!picker.value);
      if ( !picker.value ) return;
      reset = true;
      source.src = result.src = picker.value;
    });
    zoom.addEventListener("input", () => crop && zoomTo(getMaxWidth(crop.r) / Number(zoom.value)));
    row.querySelector("[data-csh-reset]")?.addEventListener("click", () => crop && write(getDefaultCrop(crop.r)));

    canvas.addEventListener("wheel", event => {
      if ( !crop ) return;
      event.preventDefault();
      zoomTo(crop.w * Math.exp(event.deltaY * 0.001));
    }, { passive: false });

    canvas.addEventListener("pointerdown", event => {
      if ( !crop || (event.button !== 0) ) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      const start = { ...crop, px: event.clientX, py: event.clientY };
      const { width, height } = canvas.getBoundingClientRect();
      const move = e => write({
        ...start,
        x: start.x + ((e.clientX - start.px) / width),
        y: start.y + ((e.clientY - start.py) / height)
      });
      const stop = () => {
        canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", stop);
        canvas.removeEventListener("pointercancel", stop);
      };
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", stop);
      canvas.addEventListener("pointercancel", stop);
    });
  }
}

/* -------------------------------------------- */
/*  Classes                                     */
/* -------------------------------------------- */

/**
 * @returns {Promise<{ identifier: string, name: string, img: string }[]>}
 */
async function getClassIndex() {
  const byId = new Map();
  const add = (identifier, name, img) => {
    if ( identifier && !byId.has(identifier) ) byId.set(identifier, { identifier, name, img });
  };
  for ( const item of game.items ) if ( item.type === "class" ) add(item.identifier, item.name, item.img);
  for ( const actor of game.actors ) {
    for ( const item of Object.values(actor.classes ?? {}) ) add(item.identifier, item.name, item.img);
  }
  const packs = game.packs.filter(p => (p.documentName === "Item") && p.visible)
    .sort((a, b) => (a.metadata.packageType === "system") - (b.metadata.packageType === "system"));
  for ( const pack of packs ) {
    for ( const entry of await pack.getIndex({ fields: ["system.identifier"] }) ) {
      if ( entry.type !== "class" ) continue;
      add(entry.system?.identifier || entry.name.slugify({ strict: true }), entry.name, entry.img);
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
}

/* -------------------------------------------- */
/*  Applications                                */
/* -------------------------------------------- */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class HeaderConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-config`,
    tag: "form",
    classes: ["csh-config"],
    window: { title: "CLASSHEADERS.Config.Title", icon: "fas fa-image", resizable: true },
    position: { width: 600, height: 760 },
    form: { handler: HeaderConfig.#onSubmit, closeOnSubmit: true },
    actions: { toggleActive: HeaderConfig.#onToggleActive }
  };

  static PARTS = {
    body: { template: CONFIG_TEMPLATE, scrollable: [".csh-body"] },
    footer: { template: FOOTER_TEMPLATE }
  };

  async _prepareContext(options) {
    const headers = game.settings.get(MODULE_ID, "headers");
    const classes = await getClassIndex();
    for ( const identifier of Object.keys(headers.classes ?? {}) ) {
      if ( !classes.some(c => c.identifier === identifier) ) classes.push({ identifier, name: identifier });
    }
    const i18n = game.i18n;
    const active = game.settings.get(MODULE_ID, "active");
    return {
      active,
      campaign: {
        label: i18n.localize("CLASSHEADERS.Config.Campaign"),
        hint: i18n.localize("CLASSHEADERS.Config.CampaignHint"),
        forceable: true,
        force: !!headers.campaign?.force,
        ...rowContext("campaign", headers.campaign)
      },
      fallbacks: [
        { label: i18n.localize("CLASSHEADERS.Config.Player"), hint: i18n.localize("CLASSHEADERS.Config.PlayerHint"),
          ...rowContext("player", headers.player) },
        { label: i18n.localize("CLASSHEADERS.Config.Other"), hint: i18n.localize("CLASSHEADERS.Config.OtherHint"),
          ...rowContext("other", headers.other) }
      ],
      classes: classes.map(c => ({
        label: c.name,
        hint: c.identifier,
        img: c.img,
        search: `${c.name} ${c.identifier}`.toLowerCase(),
        ...rowContext(`classes.${c.identifier}`, headers.classes?.[c.identifier])
      })),
      buttons: [
        { type: "button", action: "toggleActive", ...HeaderConfig.#toggleButton(active) },
        { type: "submit", icon: "fas fa-save", label: "SETTINGS.Save" }
      ]
    };
  }

  static #toggleButton(active) {
    return active
      ? { icon: "fas fa-power-off", label: "CLASSHEADERS.Config.Disable" }
      : { icon: "fas fa-rotate-left", label: "CLASSHEADERS.Config.Enable" };
  }

  static async #onToggleActive(event, target) {
    const active = !game.settings.get(MODULE_ID, "active");
    await game.settings.set(MODULE_ID, "active", active);
    const { icon, label } = HeaderConfig.#toggleButton(active);
    target.innerHTML = `<i class="${icon}" inert></i><span>${game.i18n.localize(label)}</span>`;
    this.element.querySelector(".csh-disabled-notice").hidden = active;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    bindEditors(this.element);
    const input = this.element.querySelector(".csh-search");
    input?.addEventListener("keydown", event => {
      if ( event.key === "Enter" ) event.preventDefault();
    });
    input?.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();
      for ( const row of this.element.querySelectorAll(".csh-classes .csh-row") ) {
        row.hidden = !!query && !row.dataset.search.includes(query);
      }
    });
  }

  static async #onSubmit(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const classes = {};
    for ( const [identifier, entry] of Object.entries(data.classes ?? {}) ) {
      if ( entry.src ) classes[identifier] = cleanEntry(entry);
    }
    const campaign = cleanEntry(data.campaign);
    if ( campaign.src ) campaign.force = !!data.campaign.force;
    await game.settings.set(MODULE_ID, "headers", {
      classes, player: cleanEntry(data.player), other: cleanEntry(data.other), campaign
    });
  }
}

class ActorHeaderConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, options={}) {
    super({ ...options, id: ActorHeaderConfig.#getId(actor) });
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["csh-config", "csh-actor-config"],
    window: { icon: "fas fa-image" },
    position: { width: 520 },
    form: { handler: ActorHeaderConfig.#onSubmit, closeOnSubmit: true },
    actions: { reset: ActorHeaderConfig.#onReset }
  };

  static PARTS = {
    body: { template: ACTOR_TEMPLATE },
    footer: { template: FOOTER_TEMPLATE }
  };

  static #getId(actor) {
    return `${MODULE_ID}-actor-${actor.uuid.replaceAll(".", "-")}`;
  }

  /**
   * @param {Actor5e} actor
   */
  static open(actor) {
    const existing = foundry.applications.instances.get(this.#getId(actor));
    return (existing ?? new this(actor)).render({ force: true });
  }

  get title() {
    return `${game.i18n.localize("CLASSHEADERS.ActorConfig.Title")}: ${this.actor.name}`;
  }

  async _prepareContext(options) {
    const inherited = resolveHeader(this.actor, { ignoreActor: true });
    const i18n = game.i18n;
    const inheritedLabel = {
      class: () => i18n.format("CLASSHEADERS.Source.Class", { class: inherited.label }),
      player: () => i18n.localize("CLASSHEADERS.Source.Player"),
      other: () => i18n.localize("CLASSHEADERS.Source.Other"),
      campaign: () => i18n.localize("CLASSHEADERS.Source.Campaign")
    }[inherited?.source]?.() ?? i18n.localize("CLASSHEADERS.Source.System");
    let notice = null;
    if ( !game.settings.get(MODULE_ID, "active") ) notice = i18n.localize("CLASSHEADERS.ActorConfig.Disabled");
    else if ( inherited?.source === "campaign" && inherited.force ) {
      notice = i18n.localize("CLASSHEADERS.ActorConfig.Forced");
    }
    return {
      notice,
      entry: {
        label: i18n.localize("CLASSHEADERS.ActorConfig.Own"),
        ...rowContext("header", this.actor.getFlag(MODULE_ID, "header"))
      },
      inheritedLabel,
      inherited: inherited ? { src: inherited.src, frameStyle: getFrameStyle(inherited) } : null,
      buttons: [
        { type: "button", action: "reset", icon: "fas fa-arrow-rotate-left", label: "CLASSHEADERS.ActorConfig.Reset" },
        { type: "submit", icon: "fas fa-save", label: "SETTINGS.Save" }
      ]
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    bindEditors(this.element);
  }

  static async #onSubmit(event, form, formData) {
    const entry = cleanEntry(foundry.utils.expandObject(formData.object).header);
    if ( entry.src ) await this.actor.setFlag(MODULE_ID, "header", entry);
    else await this.actor.unsetFlag(MODULE_ID, "header");
  }

  static async #onReset() {
    await this.actor.unsetFlag(MODULE_ID, "header");
    await this.close();
  }
}
