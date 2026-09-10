import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createCanvas, joinSession } from "@github/copilot-sdk/extension";

const execFileAsync = promisify(execFile);
const servers = new Map();

function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function parseRepository(remote) {
    const match = remote.trim().match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i);
    if (!match) throw new Error("The current workspace does not have a GitHub origin remote.");
    return { owner: match[1], repo: match[2] };
}

async function getRepository(workspacePath) {
    const { stdout } = await execFileAsync("git", ["-C", workspacePath, "config", "--get", "remote.origin.url"]);
    return parseRepository(stdout);
}

function scoreIssue(issue) {
    const labels = issue.labels.map((label) => label.name.toLowerCase());
    let score = 0;
    if (labels.some((label) => /critical|blocker|urgent|priority: ?high|p0|p1/.test(label))) score += 100;
    if (labels.some((label) => /bug|security|regression|broken/.test(label))) score += 35;
    if (labels.some((label) => /enhancement|feature/.test(label))) score += 10;
    score += Math.min(Math.max((Date.now() - Date.parse(issue.created_at)) / 86_400_000, 0), 30);
    return score + Math.min(issue.comments, 20);
}

function triageIssues(issues) {
    const ranked = [...issues].sort((left, right) => scoreIssue(right) - scoreIssue(left) || left.number - right.number).map((issue, index) => ({
        ...issue,
        reason: index < 3 ? "Its labels, age, and discussion activity suggest it needs an early decision." : "",
    }));
    return { priority: ranked.slice(0, 3), remainder: ranked.slice(3) };
}

async function fetchIssues(repository) {
    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/issues?state=open&per_page=50`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "kanban-triage-board" },
    });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status} while loading issues.`);
    return (await response.json()).filter((issue) => !issue.pull_request);
}

function renderHtml(instanceId) {
    return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Issue triage</title>
<style>
:root{color-scheme:light dark;--bg:var(--background-color-default,#fff);--text:var(--text-color-default,#1f2328);--muted:var(--text-color-muted,#656d76);--border:var(--border-color-default,#d0d7de);--blue:var(--true-color-blue,#0969da);--blue-muted:var(--true-color-blue-muted,#ddf4ff)}
*{box-sizing:border-box}body{margin:0;padding:24px;background:var(--bg);color:var(--text);font-family:var(--font-sans,system-ui,sans-serif);line-height:1.45}h1{margin:0 0 4px;font-size:24px}h2{margin:28px 0 12px;font-size:16px}.subtitle,.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}.card{border:1px solid var(--border);border-radius:10px;padding:16px;min-width:0}.card-header{display:flex;justify-content:space-between;color:var(--muted);font-size:12px}.number{color:var(--blue);font-weight:700}h3{margin:8px 0;font-size:16px}.description{white-space:pre-wrap;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:5;overflow:hidden;min-height:72px}.labels{display:flex;flex-wrap:wrap;gap:5px;margin:12px 0}.label{background:var(--blue-muted);border-radius:999px;padding:2px 8px;font-size:11px}.reason{border-left:3px solid var(--blue);padding-left:10px;color:var(--muted);font-size:13px}button{border:0;border-radius:6px;padding:8px 12px;background:var(--blue);color:#fff;cursor:pointer;font-weight:600}button:disabled{opacity:.65;cursor:wait}#status{min-height:20px;color:var(--muted)}.error{color:#cf222e}.empty{border:1px dashed var(--border);padding:16px;color:var(--muted)}
</style></head><body data-instance-id="${escapeHtml(instanceId)}">
<h1>Issue triage</h1><p class="subtitle">The three issues most likely to need attention now, followed by the rest of the open backlog.</p>
<div id="status" role="status" aria-live="polite">Loading open issues…</div>
<section><h2>Needs attention now</h2><div id="priority" class="grid"></div></section>
<section><h2>Remaining open issues</h2><div id="remainder" class="grid"></div></section>
<script>
const escapeText=(value)=>String(value??"").replace(/[&<>"]/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[character]));
const card=(issue,priority)=>{const labels=issue.labels.map((label)=>'<span class="label">'+escapeText(label.name)+'</span>').join("");return '<article class="card"><div class="card-header"><span class="number">#'+issue.number+'</span><span class="date">'+escapeText(new Date(issue.created_at).toLocaleDateString())+'</span></div><h3>'+escapeText(issue.title)+'</h3><p class="description">'+escapeText(issue.body||"No description provided.")+'</p><div class="labels">'+(labels||'<span class="muted">No labels</span>')+'</div>'+(priority?'<p class="reason"><strong>Why now:</strong> '+escapeText(issue.reason)+'</p>':'')+'<button data-issue-number="'+issue.number+'">Add to current context</button></article>'};
const render=(issues,element,priority)=>{element.innerHTML=issues.length?issues.map((issue)=>card(issue,priority)).join(""):'<div class="empty">No issues in this section.</div>'};
const status=document.querySelector("#status");
fetch("/api/issues").then((response)=>response.ok?response.json():response.json().then((body)=>Promise.reject(new Error(body.error)))).then((data)=>{render(data.priority,document.querySelector("#priority"),true);render(data.remainder,document.querySelector("#remainder"),false);status.textContent=data.repository}).catch((error)=>{status.textContent=error.message;status.className="error"});
document.addEventListener("click",async(event)=>{const button=event.target.closest("button[data-issue-number]");if(!button)return;button.disabled=true;button.textContent="Adding…";try{const response=await fetch("/api/add",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({number:Number(button.dataset.issueNumber)})});const body=await response.json();if(!response.ok)throw new Error(body.error);button.textContent="Added to context"}catch(error){button.disabled=false;button.textContent=error.message}});
</script></body></html>`;
}

async function readJson(request) {
    let body = "";
    for await (const chunk of request) body += chunk;
    return JSON.parse(body || "{}");
}

async function startServer(instanceId, workspacePath, session) {
    const repository = await getRepository(workspacePath);
    const server = createServer((request, response) => {
        const sendJson = (status, payload) => {
            response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
            response.end(JSON.stringify(payload));
        };
        if (request.method === "GET" && request.url === "/favicon.ico") {
            response.writeHead(204);
            response.end();
        } else if (request.method === "GET" && request.url === "/") {
            response.setHeader("Content-Type", "text/html; charset=utf-8");
            response.end(renderHtml(instanceId));
        } else if (request.method === "GET" && request.url === "/api/issues") {
            fetchIssues(repository).then((issues) => sendJson(200, { ...triageIssues(issues), repository: `${repository.owner}/${repository.repo}` })).catch((error) => sendJson(500, { error: error.message }));
        } else if (request.method === "POST" && request.url === "/api/add") {
            readJson(request).then(async ({ number }) => {
                const issue = (await fetchIssues(repository)).find((candidate) => candidate.number === number);
                if (!issue) throw new Error(`Open issue #${number} was not found.`);
                await session.send({ prompt: `Add this GitHub issue to the current work context and help me start on it:\n\n${repository.owner}/${repository.repo}#${issue.number}: ${issue.title}\n\n${issue.body || "No description provided."}\n\nURL: ${issue.html_url}` });
                await session.log(`Added ${repository.owner}/${repository.repo}#${issue.number} to the current context.`, { ephemeral: true });
                sendJson(200, { ok: true });
            }).catch((error) => sendJson(400, { error: error.message }));
        } else {
            response.writeHead(404);
            response.end();
        }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    return { server, repository, url: `http://127.0.0.1:${address.port}/` };
}

const session = await joinSession({
    canvases: [createCanvas({
        id: "kanban-triage-board",
        displayName: "Issue triage",
        description: "A Kanban board that prioritizes open GitHub issues and adds selected issues to the current session context.",
        actions: [{
            name: "add_issue_to_context",
            description: "Add an open GitHub issue to the current session context.",
            inputSchema: { type: "object", properties: { number: { type: "integer", minimum: 1 } }, required: ["number"], additionalProperties: false },
            handler: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (!entry) throw new Error("The triage board is not open.");
                const issue = (await fetchIssues(entry.repository)).find((candidate) => candidate.number === ctx.input.number);
                if (!issue) throw new Error(`Open issue #${ctx.input.number} was not found.`);
                await session.send({ prompt: `Add ${entry.repository.owner}/${entry.repository.repo}#${issue.number} to the current work context:\n\n${issue.title}\n\n${issue.body || "No description provided."}\n\nURL: ${issue.html_url}` });
                return { ok: true, number: issue.number };
            },
        }],
        open: async (ctx) => {
            let entry = servers.get(ctx.instanceId);
            if (!entry) {
                entry = await startServer(ctx.instanceId, process.cwd(), session);
                servers.set(ctx.instanceId, entry);
            }
            return { title: "Issue triage", url: entry.url };
        },
        onClose: async (ctx) => {
            const entry = servers.get(ctx.instanceId);
            if (entry) {
                servers.delete(ctx.instanceId);
                await new Promise((resolve) => entry.server.close(resolve));
            }
        },
    })],
});
