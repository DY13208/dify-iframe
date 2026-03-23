/**
 * Dify 风格网页浮层：右下角气泡 + iframe 聊天窗
 * 依赖：同域或 CDN 上可访问的 embed-chat.html
 *
 * 使用前设置 window.difyEmbedConfig（见 README 复制片段）
 */
(function () {
  var C = window.difyEmbedConfig;
  if (!C || !C.apiKey || !C.agentId) {
    console.warn("[dify-embed] 请在脚本前设置 window.difyEmbedConfig（apiKey、agentId）");
    return;
  }

  var title = C.title || "助手";
  var apiBase = String(C.apiBase || window.location.origin + "/xai").replace(/\/+$/, "");
  // 默认点击后再加载 iframe，减少 WP 首屏负担；可通过 lazyMount: false 恢复立即加载
  var lazyMount = C.lazyMount !== false;
  // 可选：页面空闲时后台预热 iframe，点击打开更快
  var prewarmOnIdle = C.prewarmOnIdle === true;
  var debugTiming = C.debugTiming === true;
  var debugT0 = Date.now();
  function logTiming(label, extra) {
    if (!debugTiming) return;
    var dt = Date.now() - debugT0;
    try {
      if (typeof extra === "undefined") {
        console.log("[dify-embed][" + dt + "ms] " + label);
      } else {
        console.log("[dify-embed][" + dt + "ms] " + label, extra);
      }
    } catch (e) {}
  }

  var scripts = document.getElementsByTagName("script");
  var thisScript = scripts[scripts.length - 1];
  var scriptDir = "";
  if (thisScript && thisScript.src) {
    scriptDir = thisScript.src.replace(/\/[^/]+$/, "");
  }
  var embedPage = C.embedPage || (scriptDir ? scriptDir + "/embed-chat.html" : "embed-chat.html");

  var user =
    C.user ||
    (function () {
      try {
        var k = "dify_embed_uid";
        var v = localStorage.getItem(k);
        if (!v) {
          v = "anon_" + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
          localStorage.setItem(k, v);
        }
        return v;
      } catch (e) {
        return "anon_guest";
      }
    })();

  /** 默认不把 key 放进 iframe URL（避免地址栏/历史记录/Referer 泄露）；改由 postMessage 下发 */
  var embedKeyInUrl = C.embedKeyInUrl === true;
  var params = new URLSearchParams({
    base: apiBase,
    agentId: String(C.agentId),
    user: user,
    title: title
  });
  if (embedKeyInUrl) {
    params.set("key", C.apiKey);
  } else {
    params.set("keyViaPost", "1");
    // URLSearchParams 会自动编码，这里不要手动 encodeURIComponent，避免双重编码
    params.set("parentOrigin", window.location.origin);
  }
  // 父页面持久化 conversationId：即使 iframe 的存储被浏览器隔离，刷新/重开仍能读取历史
  var CONV_LS_KEY = "dify_embed_conv_" + apiBase + "_" + String(C.agentId) + "_" + user;
  var storedConversationId = null;
  try {
    storedConversationId = localStorage.getItem(CONV_LS_KEY);
  } catch (e) {}
  if (C.conversationId) {
    params.set("conversationId", C.conversationId);
  } else if (storedConversationId) {
    params.set("conversationId", storedConversationId);
  }
  if (C.assetsBase) params.set("assetsBase", String(C.assetsBase).replace(/\/+$/, ""));
  if (C.theme) params.set("theme", String(C.theme).toLowerCase() === "dark" ? "dark" : "light");
  if (C.userAvatar) params.set("userAvatar", String(C.userAvatar));
  if (C.botAvatar) params.set("botAvatar", String(C.botAvatar));

  var iframeSrc = embedPage + (embedPage.indexOf("?") >= 0 ? "&" : "?") + params.toString();

  var embedOrigin = "";
  try {
    embedOrigin = new URL(embedPage, window.location.href).origin;
  } catch (e0) {
    embedOrigin = "";
  }

  var css =
    "@keyframes difyEmbedSpin{to{transform:rotate(360deg)}}" +
    "#dify-embed-panel.dify-embed-expanded{top:12px!important;right:12px!important;bottom:12px!important;left:12px!important;width:auto!important;height:auto!important;max-height:none!important}" +
    "#dify-embed-panel{position:fixed;right:24px;bottom:96px;width:min(400px,calc(100vw - 32px));height:min(560px,calc(100vh - 120px));max-height:560px;border:none;border-radius:16px;box-shadow:0 12px 48px rgba(21,94,239,.2);background:#eef3ff;z-index:2147483000;display:none;overflow:hidden}" +
    "#dify-embed-panel.dify-embed-open{display:block}" +
    "#dify-embed-panel iframe{width:100%;height:100%;border:0;display:block;position:relative;z-index:0}" +
    "#dify-embed-panel .dify-embed-panel-boot{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#eef3ff;transition:opacity .25s ease,visibility .25s ease}" +
    "#dify-embed-panel .dify-embed-panel-boot.dify-embed-panel-boot-done{opacity:0;visibility:hidden;pointer-events:none}" +
    "#dify-embed-panel .dify-embed-panel-boot .dify-embed-spinner{width:32px;height:32px;margin:0 auto 10px;border-radius:50%;border:3px solid rgba(21,94,239,.22);border-top-color:#155eef;animation:difyEmbedSpin .75s linear infinite}" +
    "#dify-embed-panel .dify-embed-panel-boot p{margin:0;font-size:12px;color:#64748b;font-family:system-ui,-apple-system,sans-serif}" +
    "#dify-embed-launcher{position:fixed;right:24px;bottom:24px;width:56px;height:56px;border-radius:50%;border:none;background:#155eef;color:#fff;cursor:pointer;z-index:2147483001;box-shadow:0 8px 24px rgba(21,94,239,.35);display:flex;align-items:center;justify-content:center;padding:0}" +
    "#dify-embed-launcher:hover{filter:brightness(1.06)}" +
    "#dify-embed-launcher svg{width:26px;height:26px}";

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var panel = document.createElement("div");
  panel.id = "dify-embed-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", title);

  var iframe = null;
  var iframeMounted = false;
  var panelBoot = document.createElement("div");
  panelBoot.className = "dify-embed-panel-boot";
  panelBoot.setAttribute("aria-busy", "true");
  panelBoot.innerHTML =
    '<div class="dify-embed-spinner" aria-hidden="true"></div><p>加载中…</p>';
  panel.appendChild(panelBoot);
  var iframeLoaded = false;
  var iframeReady = false;
  var panelBootFallbackTimer = null;
  var panelBootSoftFallbackTimer = null;

  function hidePanelBoot() {
    if (!panelBoot.parentNode) return;
    if (panelBootFallbackTimer) {
      clearTimeout(panelBootFallbackTimer);
      panelBootFallbackTimer = null;
    }
    if (panelBootSoftFallbackTimer) {
      clearTimeout(panelBootSoftFallbackTimer);
      panelBootSoftFallbackTimer = null;
    }
    panelBoot.classList.add("dify-embed-panel-boot-done");
    logTiming("hide panel boot");
    window.setTimeout(function () {
      try {
        panelBoot.remove();
      } catch (e) {
        panelBoot.style.display = "none";
      }
    }, 280);
  }
  function tryHidePanelBoot() {
    logTiming("tryHidePanelBoot", { iframeLoaded: iframeLoaded, iframeReady: iframeReady });
    if (iframeLoaded && iframeReady) hidePanelBoot();
  }
  function postCredentialsToIframe(replyOrigin) {
    if (embedKeyInUrl || !embedOrigin) return;
    try {
      if (!iframe) return;
      if (!iframe.contentWindow) return;
      var targetOrigin = replyOrigin || embedOrigin;
      iframe.contentWindow.postMessage(
        {
          source: "dify-webui-embed",
          type: "dify-embed-credentials",
          apiKey: C.apiKey
        },
        targetOrigin
      );
      logTiming("post credentials to iframe", { targetOrigin: targetOrigin });
    } catch (e) {}
  }
  function ensureIframeMounted() {
    if (iframeMounted) return;
    iframeMounted = true;
    iframeLoaded = false;
    iframeReady = false;
    try {
      panelBoot.classList.remove("dify-embed-panel-boot-done");
      panelBoot.style.display = "";
      var p0 = panelBoot.querySelector("p");
      if (p0) p0.textContent = "加载中…";
    } catch (e) {}
    iframe = document.createElement("iframe");
    iframe.title = title;
    iframe.src = iframeSrc;
    iframe.setAttribute("allow", "fullscreen");
    panel.insertBefore(iframe, panel.firstChild);
    logTiming("iframe src set", iframeSrc);
    iframe.addEventListener("load", function () {
      iframeLoaded = true;
      logTiming("iframe load");
      // 关键：iframe 文档已到达时不应长期被父层遮罩挡住；ready 丢失时也在短时间后放行 UI
      panelBootSoftFallbackTimer = window.setTimeout(function () {
        logTiming("soft fallback hide trigger");
        hidePanelBoot();
      }, 1500);
      try {
        var p = panelBoot.querySelector("p");
        if (p) p.textContent = "正在初始化…";
      } catch (e) {}
      tryHidePanelBoot();
    });
    panelBootFallbackTimer = window.setTimeout(function () {
      logTiming("hard fallback hide trigger");
      hidePanelBoot();
    }, 4000);
    window.setTimeout(function () {
      try {
        if (!iframe) return;
        var doc = iframe.contentDocument;
        if (doc && doc.readyState === "complete") {
          iframeLoaded = true;
          tryHidePanelBoot();
        }
      } catch (e) {
        /* 跨域无法读 document，仅依赖 load */
      }
    }, 0);
  }

  var launcher = document.createElement("button");
  launcher.id = "dify-embed-launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "打开聊天");

  function iconChat() {
    launcher.innerHTML =
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
  }
  function iconClose() {
    launcher.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  }

  var open = false;
  function setOpen(v) {
    open = v;
    if (v) ensureIframeMounted();
    panel.classList.toggle("dify-embed-open", v);
    if (v) {
      iconClose();
      launcher.setAttribute("aria-label", "关闭聊天");
    } else {
      iconChat();
      launcher.setAttribute("aria-label", "打开聊天");
      panel.classList.remove("dify-embed-expanded");
    }
  }

  iconChat();
  launcher.addEventListener("click", function () {
    setOpen(!open);
  });

  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || d.source !== "dify-webui-embed") return;
    logTiming("message received", { type: d.type, origin: e.origin });
    if (d.type === "dify-embed-request-credentials") {
      if (embedOrigin && e.origin !== embedOrigin) return;
      postCredentialsToIframe(e.origin);
      return;
    }
    if (d.type === "dify-embed-ready") {
      iframeReady = true;
      logTiming("iframe ready");
      tryHidePanelBoot();
      return;
    }
    if (d.type === "dify-embed-toggle-expand") {
      panel.classList.toggle("dify-embed-expanded");
    }
    if (d.type === "dify-embed-conversation-id" && d.conversationId) {
      try {
        localStorage.setItem(CONV_LS_KEY, String(d.conversationId));
      } catch (e2) {}
    }
    if (d.type === "dify-embed-conversation-cleared") {
      try {
        localStorage.removeItem(CONV_LS_KEY);
      } catch (e2) {}
    }
  });

  document.body.appendChild(panel);
  document.body.appendChild(launcher);
  logTiming("panel mounted");

  if (!lazyMount) {
    ensureIframeMounted();
  } else if (prewarmOnIdle) {
    var prewarm = function () {
      if (!open) ensureIframeMounted();
    };
    if (window.requestIdleCallback) {
      window.requestIdleCallback(prewarm, { timeout: 3000 });
    } else {
      window.setTimeout(prewarm, 1200);
    }
  }
  if (C.openOnLoad) setOpen(true);
})();
