// ============================================================
//  行业客服 AI · 后端代理（方案 C · 正式上线用）
//  作用：把 API Key 藏在服务器，前端只调这个后端，Key 永不暴露。
//  对应课程第 4 阶段「把 Agent 包装成 API 服务 + 部署上线」。
// ============================================================
//
//  本地运行：
//    1) 装 Node.js（官网下载）
//    2) 在本文件目录，设置环境变量并启动：
//         Mac/Linux:  API_KEY="你的key" node server.js
//         Windows(PowerShell):  $env:API_KEY="你的key"; node server.js
//    3) 后端跑在 http://localhost:8787
//    4) 把前端（后端代理版.html）的 BACKEND_URL 填成 http://localhost:8787/api/chat
//
//  上线部署：把本文件部署到任意 Node 主机（Render / Railway / 自己的服务器），
//    在平台的「环境变量」里设 API_KEY，别写进代码。
//
//  换供应商：改下面 UPSTREAM 和 MODEL 两行即可。
// ============================================================

const http = require("http");
const https = require("https");

const API_KEY  = process.env.API_KEY || "";           // ← 从环境变量读，绝不硬编码
const UPSTREAM = process.env.UPSTREAM ||
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"; // Gemini
const MODEL    = process.env.MODEL || "gemini-2.5-flash-lite";
const PORT     = process.env.PORT || 8787;

// 允许哪个前端域名调用（上线后改成你的 GitHub Pages 域名，更安全）
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "https://givinggetting.github.io";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  if (req.method !== "POST" || !req.url.startsWith("/api/chat")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "not found" }));
  }
  if (!API_KEY) {
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "服务器未配置 API_KEY 环境变量" }));
  }

  let body = "";
  req.on("data", c => { body += c; if (body.length > 1e6) req.destroy(); });
  req.on("end", () => {
    let payload;
    try { payload = JSON.parse(body || "{}"); } catch (e) { payload = {}; }
    // 只透传对话内容，模型由后端决定（前端无法乱改）
    const upstreamBody = JSON.stringify({
      model: MODEL,
      messages: payload.messages || [],
      temperature: 0.5,
      stream: false,
    });

    const u = new URL(UPSTREAM);
    const opt = {
      method: "POST",
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + API_KEY,
        "Content-Length": Buffer.byteLength(upstreamBody),
      },
    };
    const up = https.request(opt, r => {
      let data = "";
      r.on("data", d => data += d);
      r.on("end", () => {
        res.writeHead(r.statusCode || 200, { "Content-Type": "application/json" });
        res.end(data);
      });
    });
    up.on("error", e => {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "上游请求失败: " + e.message }));
    });
    up.write(upstreamBody);
    up.end();
  });
});

server.listen(PORT, () => console.log("客服后端已启动： http://localhost:" + PORT + "/api/chat"));
