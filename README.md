# Dify 风格嵌入式聊天（iframe / 浮层）

界面贴近 Dify 官方嵌入式：**蓝顶栏、气泡+头像、底部圆角输入框（回形针+发送）、POWERED BY Dify**。  
**没有「新建会话」**；顶栏 **刷新图标 = 清空消息并重新开始**（会丢弃当前 `conversation_id`）。

## 文件说明

| 文件 | 作用 |
|------|------|
| `embed-chat.html` | 聊天 UI（被 iframe 引用，或浮层里加载） |
| `dify-embed.js` | 右下角气泡 + 浮窗（与官方体验类似） |
| `embed-snippet.html` | **可直接复制**的嵌入代码模板 |
| `host-example.html` | 本地演示（iframe 代码预览 + 浮层） |

## 本地预览

```bash
cd /Users/mac/difyWebui
python3 -m http.server 5500
```

打开 `http://localhost:5500/host-example.html`，改脚本里的 `apiBase` / `apiKey`。

---

## 复制即用：浮层（推荐，像 Dify）

把下面整段放到你站点 **`</body>` 前**，把 `YOUR_*` 换成实际地址（`embed-chat.html` 与 `dify-embed.js` 建议同目录部署）。

```html
<script>
  window.difyEmbedConfig = {
    embedPage: "https://YOUR_DOMAIN/static/embed-chat.html",
    apiBase: "https://YOUR_API_HOST",
    apiKey: "xai-YOUR_KEY",
    agentId: 3,
    title: "测试",
    // 聊天记录里相对图片地址前缀（与线上控制台域名一致）
    assetsBase: "https://ai.pandawm.com"
    // embedKeyInUrl: true  // 仅调试：把 key 写进 iframe URL（不推荐）
    // lazyMount: true       // 默认 true：点击气泡后才创建 iframe（推荐）
    // prewarmOnIdle: true   // 可选：页面空闲时预热 iframe，打开更快
  };
</script>
<script src="https://YOUR_DOMAIN/static/dify-embed.js" defer></script>
```

**密钥不再出现在 iframe 的 URL 里**（避免地址栏、历史记录、分享链接泄露）：`dify-embed.js` 默认会给 iframe 加上 `keyViaPost=1` + `parentOrigin=...`，加载后通过 **`postMessage`** 把 `apiKey` 发给子页面；子页面只接受 **`parentOrigin` 与父页 `event.origin` 一致** 的消息。

可选：`openOnLoad: true` 进入页面就展开聊天窗。  
可选：`lazyMount: true`（默认）点击气泡才创建 iframe，减少 WP 首屏压力。  
可选：`prewarmOnIdle: true` 空闲时预热 iframe，兼顾首屏与打开速度。  
可选：`user: "固定用户id"`，不传则脚本会用 `localStorage` 生成稳定匿名 id。

---

## 复制即用：仅 iframe

```html
<iframe
  src="https://YOUR_DOMAIN/static/embed-chat.html?base=https%3A%2F%2FYOUR_API&key=xai-KEY&agentId=3&user=USER_ID&title=%E6%B5%8B%E8%AF%95"
  style="width:400px;height:560px;border:0;border-radius:16px;box-shadow:0 12px 48px rgba(21,94,239,.2)"
  allow="fullscreen"
  title="测试"
></iframe>
```

### URL 参数

| 参数 | 说明 |
|------|------|
| `base` | 你的后端根地址 |
| `key` | `Authorization: Bearer` 的 Key（**不推荐**写在公开 URL；推荐 `dify-embed.js` 或自行 `postMessage`） |
| `keyViaPost` | 为 `1` 时表示 **不写 `key`**，由父页面 `postMessage` 下发（需同时带 `parentOrigin`） |
| `parentOrigin` | `encodeURIComponent(父页面 origin)`，与 `keyViaPost=1` 配合，用于校验消息来源 |
| `agentId` | 数字 |
| `user` | 访客唯一 id（建议固定） |
| `title` | 顶栏标题与占位「和 xxx 聊天」 |
| `conversationId` | 可选，续聊某会话 |
| `assetsBase` | 可选，默认 `https://ai.pandawm.com`；历史/回复里相对图片路径会拼在该域名后 |
| `userAvatar` | 可选：用户头像（文本/emoji 或图片地址 `http(s)://` / `/files/...`） |
| `botAvatar` | 可选：客服/AI 头像（文本/emoji 或图片地址 `http(s)://` / `/files/...`） |
| `persistSession` | 默认开启：`user` 与 `conversation_id` 会写入 **localStorage**（按 `base`+`agentId` 分区），下次打开同一浏览器继续同一会话；`persistSession=0` 关闭 |
| `debug` | `debug=1` 时在控制台打印流式请求的完整 JSON body（含 `files`） |
| `omitResponseMode` | `omitResponseMode=1` 时不传 `responseMode` 字段 |
| `autoGenerateName` | `autoGenerateName=1` / `0` 对应 body 里的 `autoGenerateName`（与 session 版 `streamChat` 一致） |
| `legacySnakeBody` | 仅兼容旧网关：`legacySnakeBody=1` 时额外带上 `conversation_id`、`response_mode`（正常不要开） |

**会话记忆**：未传 `user` 时会在本机生成并记住 `anon_xxx`；顶栏「刷新」只清空当前对话并 **删除已保存的 conversation_id**，`user` 不变。换浏览器或清站点数据才是「新访客」。

---

## 图片与 `files` 字段

流式发消息时，每个已上传图片会作为数组元素传入（与 Dify 一致）：

```json
"files": [
  {
    "type": "image",
    "transfer_method": "local_file",
    "upload_file_id": "上传接口返回的 id（如 data.payload.id）"
  }
]
```

上传接口若返回 `{ code, data: { payload: { id, source_url, ... } } }`，前端会解析 `id` 填入 `upload_file_id`。  
嵌入页**仅允许选择图片**（`image/*`）；待发送列表支持 **× 删除**（未发送前可撤销）。

---

## 调用的接口

- `POST /api/dify/chat-messages/stream`（body 中带 `files` 数组，见上）
- `POST /api/dify/chat-messages/{taskId}/stop`（刷新时若仍在生成会尝试停止）
- `POST /api/dify/files/upload`（回形针）
- `GET /api/dify/messages`（仅当 URL 带了 `conversationId` 时拉历史）

---

## 安全与域名

- Key 的 `allowedDomains` 需包含**父页面域名**。
- 跨域需配置 CORS。
- **URL 里不再默认带 key** 只能减少「复制链接 / Referer / 日志」泄露；父页面里的 `apiKey` 仍会被「查看网页源代码」的人看到。**真正不暴露长期密钥**的做法是：由 **你自己的后端** 代理调用 API，或使用 **短期/一次性 embed token**（后端签发、子页面只带 token）。
- 仅本地调试可在 `difyEmbedConfig` 里设 `embedKeyInUrl: true`，恢复旧行为（key 出现在 iframe 地址栏）。
