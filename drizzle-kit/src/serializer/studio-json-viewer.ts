/**
 * Self-contained JSON viewer page served by the Drizzle Studio server at `/json`.
 *
 * It talks to the same `POST /` endpoint the hosted Studio UI uses (`init` + `proxy`)
 * and renders table rows as collapsible JSON. For PostgreSQL it can also nest
 * related rows (using the relations declared in the Drizzle schema) by
 * generating `json_agg` / `row_to_json` subqueries.
 *
 * NOTE: the page script is embedded in a template literal, so it must not
 * contain backticks or `${`.
 */
export const jsonViewerHtml = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Drizzle Studio JSON</title>
<style>
:root {
	--bg: #f7f8fa;
	--surface: #ffffff;
	--panel: #f1f2f5;
	--border: #e3e5ea;
	--border-strong: #cfd3db;
	--text: #16181d;
	--muted: #646b7a;
	--faint: #9399a6;
	--accent: #3e63dd;
	--accent-text: #ffffff;
	--accent-soft: rgba(62, 99, 221, .1);
	--hover: rgba(22, 24, 29, .045);
	--danger: #c7362f;
	--danger-soft: rgba(199, 54, 47, .08);
	--mark: #ffe58a;
	--mark-text: #16181d;
	--mark-current: #ffb02e;
	--shadow: 0 1px 2px rgba(16, 24, 40, .05), 0 1px 3px rgba(16, 24, 40, .04);
	--j-key: #7a35b0;
	--j-str: #1b7a3a;
	--j-num: #1d5fc4;
	--j-bool: #b4481a;
	--j-null: #8b909b;
	--j-date: #0f7c86;
	--j-rel: #c2410c;
	color-scheme: light;
}
@media (prefers-color-scheme: dark) {
	:root:not([data-theme="light"]) {
		--bg: #111317;
		--surface: #171a1f;
		--panel: #14161b;
		--border: #262a32;
		--border-strong: #343944;
		--text: #e7e9ee;
		--muted: #9aa1b0;
		--faint: #6c7381;
		--accent: #7c9cff;
		--accent-text: #0b1020;
		--accent-soft: rgba(124, 156, 255, .14);
		--hover: rgba(255, 255, 255, .05);
		--danger: #ff8a80;
		--danger-soft: rgba(255, 138, 128, .1);
		--mark: #6b5a12;
		--mark-text: #fff6cc;
		--mark-current: #b7791f;
		--shadow: 0 1px 2px rgba(0, 0, 0, .4);
		--j-key: #d3a4ff;
		--j-str: #86dba0;
		--j-num: #8fb8ff;
		--j-bool: #ffb47f;
		--j-null: #7d8492;
		--j-date: #6fd6dd;
		--j-rel: #ff9f66;
		color-scheme: dark;
	}
}
:root[data-theme="dark"] {
	--bg: #111317;
	--surface: #171a1f;
	--panel: #14161b;
	--border: #262a32;
	--border-strong: #343944;
	--text: #e7e9ee;
	--muted: #9aa1b0;
	--faint: #6c7381;
	--accent: #7c9cff;
	--accent-text: #0b1020;
	--accent-soft: rgba(124, 156, 255, .14);
	--hover: rgba(255, 255, 255, .05);
	--danger: #ff8a80;
	--danger-soft: rgba(255, 138, 128, .1);
	--mark: #6b5a12;
	--mark-text: #fff6cc;
	--mark-current: #b7791f;
	--shadow: 0 1px 2px rgba(0, 0, 0, .4);
	--j-key: #d3a4ff;
	--j-str: #86dba0;
	--j-num: #8fb8ff;
	--j-bool: #ffb47f;
	--j-null: #7d8492;
	--j-date: #6fd6dd;
	--j-rel: #ff9f66;
	color-scheme: dark;
}

* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
	background: var(--bg);
	color: var(--text);
	font: 13.5px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
	display: grid;
	grid-template-columns: 264px minmax(0, 1fr);
	grid-template-rows: 52px minmax(0, 1fr);
	grid-template-areas: "head head" "side main";
	overflow: hidden;
}
.mono, code, kbd, textarea, .json, .raw { font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace; }
svg.i { width: 16px; height: 16px; flex: none; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

/* ---------- header ---------- */
header {
	grid-area: head;
	display: flex; align-items: center; gap: 10px;
	padding: 0 16px;
	border-bottom: 1px solid var(--border);
	background: var(--surface);
	min-width: 0;
}
.brand { display: flex; align-items: center; gap: 8px; font-weight: 650; font-size: 14px; white-space: nowrap; }
.brand .logo {
	width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center;
	background: var(--accent); color: var(--accent-text);
}
.brand .logo svg.i { width: 15px; height: 15px; }
.pill {
	display: inline-flex; align-items: center; gap: 6px;
	padding: 2px 9px; border-radius: 999px; font-size: 12px;
	background: var(--panel); border: 1px solid var(--border); color: var(--muted);
	white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
}
.pill .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--faint); flex: none; }
.pill.ok .dot { background: #22a55b; }
.pill.bad .dot { background: var(--danger); }
.grow { flex: 1; min-width: 0; }
#menuBtn { display: none; }

/* ---------- controls ---------- */
button, input, select, textarea { font: inherit; color: var(--text); }
.btn {
	display: inline-flex; align-items: center; justify-content: center; gap: 6px;
	height: 30px; padding: 0 10px; border-radius: 7px;
	border: 1px solid var(--border); background: var(--surface); cursor: pointer;
	white-space: nowrap; box-shadow: var(--shadow);
}
.btn:hover:not(:disabled) { background: var(--panel); border-color: var(--border-strong); }
.btn:disabled { opacity: .45; cursor: default; }
.btn.icon { width: 30px; padding: 0; }
.btn.primary, .btn.primary:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
.btn.ghost { border-color: transparent; background: transparent; box-shadow: none; }
.btn.ghost:hover:not(:disabled) { background: var(--hover); border-color: transparent; }
.seg {
	display: inline-flex; padding: 2px; gap: 2px; border-radius: 8px;
	background: var(--panel); border: 1px solid var(--border);
}
.seg button {
	height: 24px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent;
	color: var(--muted); cursor: pointer; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;
}
.seg button:hover { color: var(--text); }
.seg button.on { background: var(--surface); color: var(--text); box-shadow: var(--shadow); font-weight: 550; }
.field {
	display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 8px;
	border: 1px solid var(--border); border-radius: 7px; background: var(--surface); min-width: 0;
}
.field:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.field input, .field select { border: 0; outline: 0; background: transparent; min-width: 0; height: 100%; padding: 0; }
.field input { flex: 1; }
.field .lbl { color: var(--faint); font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
.field .i { color: var(--faint); }
kbd {
	font-size: 11px; padding: 0 5px; border-radius: 4px; border: 1px solid var(--border-strong);
	color: var(--muted); background: var(--panel); line-height: 17px;
}
.ctl-label { color: var(--muted); font-size: 12px; }

/* ---------- sidebar ---------- */
aside {
	grid-area: side; min-height: 0;
	display: flex; flex-direction: column;
	background: var(--panel); border-right: 1px solid var(--border);
}
aside .search { padding: 12px; }
#tables { flex: 1; overflow: auto; padding: 0 8px 16px; }
.schema-head {
	display: flex; align-items: center; gap: 6px; width: 100%;
	padding: 10px 8px 4px; border: 0; background: none; cursor: pointer;
	color: var(--faint); font-size: 11px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase;
}
.schema-head svg.i { width: 12px; height: 12px; transition: transform .12s; }
.schema-head.closed svg.i { transform: rotate(-90deg); }
.schema-head .cnt { margin-left: auto; font-weight: 500; letter-spacing: 0; }
.tbl {
	display: flex; align-items: center; gap: 8px; width: 100%;
	padding: 5px 8px; border: 0; border-radius: 6px; background: none; cursor: pointer;
	color: var(--text); text-align: left;
}
.tbl:hover { background: var(--hover); }
.tbl.active, .tbl.active:hover { background: var(--accent-soft); color: var(--accent); font-weight: 550; }
.tbl svg.i { color: var(--faint); width: 15px; height: 15px; }
.tbl.active svg.i { color: var(--accent); }
.tbl .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tbl .count { font-size: 11px; color: var(--faint); font-variant-numeric: tabular-nums; }
.side-empty { color: var(--muted); padding: 16px 8px; font-size: 12.5px; }

/* ---------- main ---------- */
main { grid-area: main; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.section { padding: 12px 20px; border-bottom: 1px solid var(--border); background: var(--surface); }
.titlebar { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.titlebar h2 { margin: 0; font-size: 17px; font-weight: 650; letter-spacing: -.01em; }
.titlebar .schema { color: var(--faint); font-size: 13px; }
.rels { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.rels:empty { display: none; }
.chip {
	display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px;
	border-radius: 6px; border: 1px solid var(--border); background: var(--panel);
	font-size: 12px; color: var(--muted); cursor: pointer;
}
.chip:hover { border-color: var(--border-strong); color: var(--text); }
.chip b { color: var(--j-rel); font-weight: 600; }
.chip svg.i { width: 12px; height: 12px; }
.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; }
#whereField { flex: 1 1 260px; }
#where { font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
.pager { display: inline-flex; align-items: center; gap: 4px; }
.pager .info { color: var(--muted); font-size: 12px; padding: 0 6px; font-variant-numeric: tabular-nums; white-space: nowrap; }
#sqlSection { display: none; }
#sqlSection.show { display: block; }
#sql {
	width: 100%; min-height: 110px; padding: 10px 12px; resize: vertical;
	border: 1px solid var(--border); border-radius: 8px; background: var(--panel); font-size: 12.5px; outline: none;
}
#sql:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); background: var(--surface); }
.sql-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; color: var(--muted); font-size: 12px; }

.resultbar {
	display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
	padding: 8px 20px; border-bottom: 1px solid var(--border); background: var(--surface);
	position: relative;
}
#findField { width: 240px; }
#findCount { color: var(--faint); font-size: 11.5px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.progress { position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; overflow: hidden; opacity: 0; transition: opacity .15s; }
.loading .progress { opacity: 1; }
.progress::after {
	content: ""; position: absolute; top: 0; bottom: 0; width: 35%; background: var(--accent);
	animation: slide 1s ease-in-out infinite;
}
@keyframes slide { from { left: -35%; } to { left: 100%; } }

#out { flex: 1; overflow: auto; padding: 16px 20px 32px; }
.loading #out { opacity: .55; transition: opacity .2s; }
footer {
	display: flex; align-items: center; gap: 12px; padding: 0 20px; height: 30px;
	border-top: 1px solid var(--border); background: var(--surface);
	color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden;
}
footer .err { color: var(--danger); overflow: hidden; text-overflow: ellipsis; }
footer .right { margin-left: auto; }

/* ---------- empty / error ---------- */
.empty { display: grid; place-items: center; text-align: center; padding: 64px 16px; color: var(--muted); }
.empty svg.i { width: 34px; height: 34px; color: var(--faint); stroke-width: 1.4; margin-bottom: 10px; }
.empty h3 { margin: 0 0 4px; font-size: 14px; color: var(--text); font-weight: 600; }
.empty p { margin: 0; font-size: 12.5px; }
.errbox {
	border: 1px solid var(--danger); background: var(--danger-soft); color: var(--danger);
	border-radius: 8px; padding: 12px 14px; white-space: pre-wrap; font-size: 12.5px;
}

/* ---------- row cards ---------- */
.cards { display: flex; flex-direction: column; gap: 10px; max-width: 1100px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow); }
.card-head {
	display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; user-select: none;
	border-radius: 10px; min-width: 0;
}
.card-head:hover { background: var(--hover); }
.card.open .card-head { border-bottom: 1px solid var(--border); border-radius: 10px 10px 0 0; }
.card-head .caret { color: var(--faint); transition: transform .12s; }
.card:not(.open) .card-head .caret { transform: rotate(-90deg); }
.card-head .idx { color: var(--faint); font-size: 12px; font-variant-numeric: tabular-nums; min-width: 28px; }
.card-head .pk { font-size: 12px; padding: 1px 7px; border-radius: 5px; background: var(--accent-soft); color: var(--accent); white-space: nowrap; }
.card-head .label { font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.card-head .badges { margin-left: auto; display: flex; gap: 6px; flex: none; }
.badge {
	display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--muted);
	padding: 1px 7px; border-radius: 5px; border: 1px solid var(--border); background: var(--panel); white-space: nowrap;
}
.badge b { color: var(--j-rel); font-weight: 600; }
.card-body { padding: 8px 6px 10px; }

/* ---------- json tree ---------- */
.json { font-size: 12.5px; line-height: 1.7; }
.line { display: flex; align-items: flex-start; gap: 0; padding: 0 6px; border-radius: 5px; position: relative; min-width: 0; }
.line:hover { background: var(--hover); }
.line .tog { width: 16px; flex: none; color: var(--faint); cursor: pointer; display: inline-flex; align-items: center; height: 21px; }
.line .tog svg.i { width: 12px; height: 12px; transition: transform .12s; }
.branch:not(.open) > .line .tog svg.i { transform: rotate(-90deg); }
.line .pad { width: 16px; flex: none; }
.line .body { min-width: 0; flex: 1; word-break: break-word; white-space: pre-wrap; }
.line .k { color: var(--j-key); }
.line .k.rel { color: var(--j-rel); font-weight: 600; }
.line .colon { color: var(--faint); }
.line .meta { color: var(--faint); }
.line .reltag {
	font-family: ui-sans-serif, system-ui, sans-serif; font-size: 10.5px; padding: 0 5px; margin: 0 4px;
	border-radius: 4px; background: var(--panel); border: 1px solid var(--border); color: var(--muted); vertical-align: 1px;
}
.line .preview { color: var(--faint); }
.s { color: var(--j-str); }
.n { color: var(--j-num); }
.b { color: var(--j-bool); }
.z { color: var(--j-null); font-style: italic; }
.d { color: var(--j-date); }
.more { border: 0; background: none; color: var(--accent); cursor: pointer; padding: 0 4px; font: inherit; font-size: 11.5px; }
.line .copy {
	position: absolute; right: 4px; top: 1px; opacity: 0; height: 19px; width: 22px;
	border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--muted);
	cursor: pointer; display: grid; place-items: center; padding: 0;
}
.line .copy svg.i { width: 12px; height: 12px; }
.line:hover > .copy { opacity: 1; }
.line .copy:hover { color: var(--text); border-color: var(--border-strong); }
.kids { margin-left: 13px; padding-left: 9px; border-left: 1px solid var(--border); }
.branch:not(.open) > .kids { display: none; }
mark { background: var(--mark); color: var(--mark-text); border-radius: 2px; padding: 0 1px; }
mark.current { background: var(--mark-current); outline: 2px solid var(--mark-current); }

.raw { margin: 0; font-size: 12.5px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; tab-size: 2; }
.raw .k { color: var(--j-key); }

.toast {
	position: fixed; left: 50%; bottom: 44px; transform: translate(-50%, 8px); opacity: 0;
	padding: 7px 14px; border-radius: 8px; background: var(--text); color: var(--bg); font-size: 12.5px;
	pointer-events: none; transition: opacity .15s, transform .15s; z-index: 10;
}
.toast.show { opacity: 1; transform: translate(-50%, 0); }

@media (max-width: 820px) {
	body { grid-template-columns: minmax(0, 1fr); grid-template-areas: "head" "main"; }
	aside {
		position: fixed; z-index: 5; top: 52px; left: 0; bottom: 0; width: min(300px, 86vw);
		transform: translateX(-100%); transition: transform .18s; box-shadow: 0 10px 30px rgba(0,0,0,.25);
	}
	body.side-open aside { transform: none; }
	#menuBtn { display: inline-flex; }
	#dbPill, .brand .txt-extra { display: none; }
	.section, .resultbar, footer { padding-left: 16px; padding-right: 16px; }
	#out { padding: 12px 16px 24px; }
	#findField { width: 100%; order: 10; }
	.card-head .badges { display: none; }
}
</style>
</head>
<body>
<header>
	<button class="btn icon ghost" id="menuBtn" type="button" title="Tables" aria-label="Show tables"><svg class="i" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
	<div class="brand">
		<span class="logo"><svg class="i" viewBox="0 0 24 24"><path d="M8 4c-2 0-3 1-3 3v2c0 1.5-1 3-2 3 1 0 2 1.5 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.5 1 3 2 3-1 0-2 1.5-2 3v2c0 2-1 3-3 3"/></svg></span>
		<span>JSON Viewer<span class="txt-extra" style="color:var(--faint);font-weight:500"> · Drizzle Studio</span></span>
	</div>
	<span class="pill" id="dbPill"><span class="dot"></span><span id="dbmeta">connecting…</span></span>
	<span class="grow"></span>
	<div class="seg" role="tablist" aria-label="Mode">
		<button id="tabTable" class="on" type="button" role="tab"><svg class="i" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/></svg>Tables</button>
		<button id="tabSql" type="button" role="tab"><svg class="i" viewBox="0 0 24 24"><path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13.5 6l-3 12"/></svg>SQL</button>
	</div>
	<button class="btn icon ghost" id="themeBtn" type="button" title="Toggle theme" aria-label="Toggle theme"></button>
</header>

<aside>
	<div class="search">
		<label class="field">
			<svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
			<input id="filter" type="search" placeholder="Search tables" autocomplete="off">
			<kbd>/</kbd>
		</label>
	</div>
	<div id="tables"></div>
</aside>

<main id="main">
	<div class="section" id="tableSection">
		<div class="titlebar">
			<h2 id="tableTitle">No table selected</h2>
			<span class="schema" id="tableSchema"></span>
		</div>
		<div class="rels" id="rels"></div>
		<div class="controls">
			<label class="field" id="whereField">
				<span class="lbl">Where</span>
				<input id="where" placeholder="e.g. email like '%@gmail.com'  — press Enter" autocomplete="off" spellcheck="false">
			</label>
			<label class="field" title="Rows per page">
				<span class="lbl">Rows</span>
				<select id="limit"><option>10</option><option>25</option><option>50</option><option>100</option><option>250</option><option>500</option></select>
			</label>
			<span id="depthWrap" style="display:inline-flex;align-items:center;gap:6px" title="Nest related rows using the relations in your Drizzle schema">
				<span class="ctl-label">Relations</span>
				<span class="seg" id="depth">
					<button type="button" data-v="0">Off</button><button type="button" data-v="1">1</button><button type="button" data-v="2">2</button><button type="button" data-v="3">3</button>
				</span>
			</span>
			<span class="grow"></span>
			<span class="pager">
				<button class="btn icon" id="prev" type="button" title="Previous page" disabled><svg class="i" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
				<span class="info" id="page">–</span>
				<button class="btn icon" id="next" type="button" title="Next page" disabled><svg class="i" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
				<button class="btn icon" id="reload" type="button" title="Reload" disabled><svg class="i" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg></button>
			</span>
		</div>
	</div>

	<div class="section" id="sqlSection">
		<textarea id="sql" spellcheck="false" placeholder="select * from users limit 10"></textarea>
		<div class="sql-actions">
			<button class="btn primary" id="runSql" type="button"><svg class="i" viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>Run query</button>
			<span><kbd>Ctrl</kbd> + <kbd>Enter</kbd></span>
			<span class="grow"></span>
			<span>Queries run against your database as-is — be careful with writes.</span>
		</div>
	</div>

	<div class="resultbar" id="resultbar">
		<div class="seg">
			<button id="viewTree" class="on" type="button"><svg class="i" viewBox="0 0 24 24"><path d="M5 4v14a2 2 0 0 0 2 2h3M5 9h5M14 9h6M14 20h6"/></svg>Tree</button>
			<button id="viewRaw" type="button"><svg class="i" viewBox="0 0 24 24"><path d="M8 4c-2 0-3 1-3 3v2c0 1.5-1 3-2 3 1 0 2 1.5 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.5 1 3 2 3-1 0-2 1.5-2 3v2c0 2-1 3-3 3"/></svg>Raw</button>
		</div>
		<label class="field" id="findField">
			<svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
			<input id="find" type="search" placeholder="Find in results" autocomplete="off" spellcheck="false">
			<span id="findCount"></span>
		</label>
		<button class="btn ghost" id="expandAll" type="button" title="Expand all"><svg class="i" viewBox="0 0 24 24"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>Expand</button>
		<button class="btn ghost" id="collapseAll" type="button" title="Collapse all"><svg class="i" viewBox="0 0 24 24"><path d="M7 20l5-5 5 5M7 4l5 5 5-5"/></svg>Collapse</button>
		<span class="grow"></span>
		<button class="btn" id="copy" type="button" disabled><svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>Copy</button>
		<button class="btn" id="download" type="button" disabled><svg class="i" viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Download</button>
		<div class="progress"></div>
	</div>

	<div id="out"></div>
	<footer>
		<span id="status">Connecting…</span>
		<span class="right" id="footRight"></span>
	</footer>
</main>
<div class="toast" id="toast"></div>

<script>
(function () {
	'use strict';

	var $ = function (id) { return document.getElementById(id); };
	var ICON = {
		table: '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/></svg>',
		view: '<svg class="i" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
		chevron: '<svg class="i" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
		copy: '<svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>',
		arrow: '<svg class="i" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
		sun: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
		moon: '<svg class="i" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
		pick: '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/></svg>',
		none: '<svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8 11h6"/></svg>'
	};
	var LABEL_KEYS = ['name', 'title', 'label', 'display_name', 'displayName', 'full_name', 'fullName', 'username', 'email', 'slug', 'subject'];
	var CARD_OPEN_LIMIT = 25;
	var LONG_STRING = 240;
	var DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?(Z|[+-]\d{2}(:?\d{2})?)?$/;

	// ---------- persisted preferences ----------
	var prefs = { limit: '50', depth: '1', view: 'tree', theme: null, table: null };
	try { var saved = JSON.parse(localStorage.getItem('drizzle-json-viewer') || '{}'); for (var pk in saved) prefs[pk] = saved[pk]; } catch (e) {}
	function savePrefs() { try { localStorage.setItem('drizzle-json-viewer', JSON.stringify(prefs)); } catch (e) {} }

	var state = {
		dialect: null, relations: [], tables: [], columns: {}, pks: {}, estimates: {},
		collapsedSchemas: {}, current: null, offset: 0, total: null,
		data: null, ctx: null, label: 'data', indexBase: 0, view: prefs.view, mode: 'table',
		req: 0, find: '', matches: [], matchIdx: -1
	};

	// ---------- small helpers ----------
	function el(tag, cls, text) {
		var e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		return e;
	}
	function icon(name) { var s = el('span'); s.style.display = 'contents'; s.innerHTML = ICON[name]; return s; }
	function fmtCount(n) {
		if (n == null || isNaN(n)) return '';
		if (n < 1000) return String(n);
		if (n < 1e6) return (n / 1000).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, '') + 'k';
		return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
	}
	var toastTimer;
	function toast(msg) {
		var t = $('toast');
		t.textContent = msg;
		t.className = 'toast show';
		clearTimeout(toastTimer);
		toastTimer = setTimeout(function () { t.className = 'toast'; }, 1500);
	}
	function copyText(text, msg) {
		var done = function () { toast(msg || 'Copied'); };
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
		} else { fallbackCopy(text); done(); }
	}
	function fallbackCopy(text) {
		var ta = el('textarea');
		ta.value = text;
		document.body.appendChild(ta);
		ta.select();
		try { document.execCommand('copy'); } catch (e) {}
		document.body.removeChild(ta);
	}
	function childPath(parent, k, isIndex) {
		if (isIndex) return parent + '[' + k + ']';
		return /^[A-Za-z_$][\w$]*$/.test(k) ? parent + '.' + k : parent + '[' + JSON.stringify(k) + ']';
	}

	// ---------- server communication ----------
	function post(body) {
		return fetch('/', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}).then(function (r) { return r.json(); }).then(function (res) {
			if (res && !Array.isArray(res) && res.status === 'error') throw new Error(res.error);
			return res;
		});
	}
	function query(sql) {
		return post({ type: 'proxy', data: { sql: sql, params: [], method: 'all', mode: 'object' } });
	}

	// ---------- SQL helpers ----------
	function isPg() { return state.dialect === 'postgresql'; }
	function isMy() { return state.dialect === 'mysql' || state.dialect === 'singlestore'; }
	function qi(name) {
		if (isMy()) return '\x60' + String(name).replace(/\x60/g, '\x60\x60') + '\x60';
		return '"' + String(name).replace(/"/g, '""') + '"';
	}
	function tableRef(schema, name) {
		if (!schema || !(isPg() || isMy())) return qi(name);
		return qi(schema) + '.' + qi(name);
	}
	function key(schema, name) { return (schema || '') + '.' + name; }
	function firstValue(rows) {
		if (!rows || !rows.length) return null;
		var r = rows[0];
		if (Array.isArray(r)) return r[0];
		for (var k in r) return r[k];
		return null;
	}
	function parseMaybeJson(v) {
		if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return v; } }
		return v;
	}

	// ---------- metadata ----------
	function loadTables() {
		var sql;
		if (isPg()) {
			sql = "select table_schema as schema, table_name as name, table_type as type from information_schema.tables " +
				"where table_schema not in ('pg_catalog','information_schema') and table_schema not like 'pg_toast%' order by 1, 2";
		} else if (isMy()) {
			sql = 'select table_schema as ' + qi('schema') + ", table_name as name, table_type as type from information_schema.tables " +
				'where table_schema = database() order by 1, 2';
		} else {
			sql = "select '' as schema, name, type from sqlite_master where type in ('table','view') and name not like 'sqlite_%' order by 2";
		}
		return query(sql).then(function (rows) {
			state.tables = rows.map(function (r) { return { schema: r.schema, name: r.name, type: r.type }; });
			if (!isPg()) return;
			var colSql = "select table_schema as s, table_name as t, column_name as c from information_schema.columns " +
				"where table_schema not in ('pg_catalog','information_schema') order by table_schema, table_name, ordinal_position";
			var pkSql = 'select kcu.table_schema as s, kcu.table_name as t, kcu.column_name as c ' +
				'from information_schema.table_constraints tc join information_schema.key_column_usage kcu ' +
				'on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema and tc.table_name = kcu.table_name ' +
				"where tc.constraint_type = 'PRIMARY KEY' order by kcu.table_schema, kcu.table_name, kcu.ordinal_position";
			var estSql = "select n.nspname as s, c.relname as t, c.reltuples::bigint as n from pg_class c " +
				"join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('r','p') and c.reltuples >= 0";
			return Promise.all([query(colSql), query(pkSql), query(estSql).catch(function () { return []; })]).then(function (res) {
				res[0].forEach(function (r) { (state.columns[key(r.s, r.t)] = state.columns[key(r.s, r.t)] || []).push(r.c); });
				res[1].forEach(function (r) { (state.pks[key(r.s, r.t)] = state.pks[key(r.s, r.t)] || []).push(r.c); });
				res[2].forEach(function (r) { state.estimates[key(r.s, r.t)] = { n: Number(r.n), exact: false }; });
			});
		});
	}

	function renderTableList() {
		var f = $('filter').value.trim().toLowerCase();
		var box = $('tables');
		box.textContent = '';
		var groups = [];
		var bySchema = {};
		state.tables.forEach(function (t) {
			if (f && (t.schema + '.' + t.name).toLowerCase().indexOf(f) === -1) return;
			if (!bySchema[t.schema]) { bySchema[t.schema] = []; groups.push(t.schema); }
			bySchema[t.schema].push(t);
		});
		groups.forEach(function (schema) {
			var list = bySchema[schema];
			var closed = !f && state.collapsedSchemas[schema];
			if (schema) {
				var h = el('button', 'schema-head' + (closed ? ' closed' : ''));
				h.type = 'button';
				h.appendChild(icon('chevron'));
				h.appendChild(el('span', '', schema));
				h.appendChild(el('span', 'cnt', String(list.length)));
				h.onclick = function () { state.collapsedSchemas[schema] = !state.collapsedSchemas[schema]; renderTableList(); };
				box.appendChild(h);
			}
			if (closed) return;
			list.forEach(function (t) {
				var b = el('button', 'tbl');
				b.type = 'button';
				if (state.current && state.current.schema === t.schema && state.current.name === t.name) b.className += ' active';
				var isView = /view/i.test(t.type);
				b.appendChild(icon(isView ? 'view' : 'table'));
				b.appendChild(el('span', 'name', t.name));
				var est = state.estimates[key(t.schema, t.name)];
				if (est) {
					var c = el('span', 'count', (est.exact ? '' : '~') + fmtCount(est.n));
					c.title = est.exact ? est.n + ' rows' : 'about ' + est.n + ' rows (estimate)';
					b.appendChild(c);
				}
				b.title = (t.schema ? t.schema + '.' : '') + t.name + (isView ? ' (view)' : '');
				b.onclick = function () { selectTable(t); document.body.classList.remove('side-open'); };
				box.appendChild(b);
			});
		});
		if (!groups.length) box.appendChild(el('div', 'side-empty', state.tables.length ? 'No tables match "' + f + '"' : 'No tables found'));
	}

	// ---------- relation-aware query building (PostgreSQL) ----------
	function relationsFor(schema, table) {
		return state.relations.filter(function (r) { return r.table === table && (r.schema || 'public') === (schema || 'public'); });
	}
	function usableRelations(schema, table) {
		var cols = state.columns[key(schema, table)] || [];
		return relationsFor(schema, table).filter(function (rel) {
			return cols.indexOf(rel.name) === -1 && rel.columns.length && rel.columns.length === rel.refColumns.length;
		});
	}
	function relationSelects(schema, table, alias, depth, level) {
		if (depth <= 0) return '';
		var out = '';
		usableRelations(schema, table).forEach(function (rel) {
			var a = 't' + (level + 1);
			var cond = rel.columns.map(function (c, i) {
				return a + '.' + qi(rel.refColumns[i]) + ' = ' + alias + '.' + qi(c);
			}).join(' and ');
			var inner = 'select ' + a + '.*' + relationSelects(rel.refSchema, rel.refTable, a, depth - 1, level + 1) +
				' from ' + tableRef(rel.refSchema, rel.refTable) + ' ' + a + ' where ' + cond;
			var r = 'r' + (level + 1);
			if (rel.type === 'one') {
				out += ', (select row_to_json(' + r + ') from (' + inner + ' limit 1) ' + r + ') as ' + qi(rel.name);
			} else {
				out += ', (select coalesce(json_agg(' + r + "), '[]'::json) from (" + inner + ') ' + r + ') as ' + qi(rel.name);
			}
		});
		return out;
	}
	function buildTableQuery(t, limit, offset, depth, where) {
		var ref = tableRef(t.schema, t.name);
		var whereSql = where ? ' where ' + where : '';
		if (isPg()) {
			var pk = state.pks[key(t.schema, t.name)] || [];
			var order = pk.length ? ' order by ' + pk.map(function (c) { return 't0.' + qi(c); }).join(', ') : '';
			var inner = 'select t0.*' + relationSelects(t.schema, t.name, 't0', depth, 0) + ' from ' + ref + ' t0' +
				whereSql + order + ' limit ' + limit + ' offset ' + offset;
			return {
				rows: "select coalesce(json_agg(r0), '[]'::json)::text as data from (" + inner + ') r0',
				count: 'select count(*)::int as n from ' + ref + ' t0' + whereSql,
				json: true
			};
		}
		return {
			rows: 'select * from ' + ref + whereSql + ' limit ' + limit + ' offset ' + offset,
			count: 'select count(*) as n from ' + ref + whereSql,
			json: false
		};
	}

	// ---------- status / loading ----------
	function setStatus(msg, isError) {
		var s = $('status');
		s.textContent = msg || '';
		s.className = isError ? 'err' : '';
	}
	function setLoading(on) { $('main').classList.toggle('loading', !!on); }
	function showEmpty(iconName, title, text) {
		var out = $('out');
		out.textContent = '';
		var box = el('div', 'empty');
		var inner = el('div');
		inner.appendChild(icon(iconName));
		inner.appendChild(el('h3', '', title));
		if (text) inner.appendChild(el('p', '', text));
		box.appendChild(inner);
		out.appendChild(box);
	}
	function showError(msg) {
		var out = $('out');
		out.textContent = '';
		out.appendChild(el('div', 'errbox', msg));
		setStatus(msg.split('\n')[0], true);
	}

	// ---------- actions ----------
	function selectTable(t) {
		state.current = t;
		state.offset = 0;
		state.total = null;
		prefs.table = key(t.schema, t.name);
		savePrefs();
		renderTableList();
		renderTableHeader();
		loadRows();
	}

	function renderTableHeader() {
		var t = state.current;
		$('tableTitle').textContent = t ? t.name : 'No table selected';
		$('tableSchema').textContent = t && t.schema ? t.schema : '';
		var rels = $('rels');
		rels.textContent = '';
		if (!t || !isPg()) return;
		usableRelations(t.schema, t.name).forEach(function (rel) {
			var c = el('button', 'chip');
			c.type = 'button';
			c.appendChild(el('b', '', rel.name));
			c.appendChild(el('span', '', rel.type === 'many' ? 'many' : 'one'));
			c.appendChild(icon('arrow'));
			c.appendChild(el('span', '', rel.refTable));
			c.title = 'Open ' + rel.refSchema + '.' + rel.refTable;
			c.onclick = function () {
				var target = state.tables.filter(function (x) { return x.name === rel.refTable && (x.schema || 'public') === rel.refSchema; })[0];
				if (target) selectTable(target);
			};
			rels.appendChild(c);
		});
	}

	function currentDepth() { return isPg() ? parseInt(prefs.depth, 10) : 0; }

	function loadRows() {
		var t = state.current;
		if (!t) return;
		var limit = parseInt(prefs.limit, 10);
		var depth = currentDepth();
		var where = $('where').value.trim();
		var q = buildTableQuery(t, limit, state.offset, depth, where);
		var reqId = ++state.req;
		setLoading(true);
		setStatus('Loading ' + t.name + '…');
		var started = performance.now();
		var countP = query(q.count).then(function (rows) { return Number(firstValue(rows)); }).catch(function () { return null; });
		var rowsP = query(q.rows).then(function (rows) { return q.json ? parseMaybeJson(firstValue(rows)) || [] : rows; });
		Promise.all([rowsP, countP]).then(function (res) {
			if (reqId !== state.req) return;
			var rows = res[0];
			state.total = res[1];
			if (state.total != null && !where) {
				state.estimates[key(t.schema, t.name)] = { n: state.total, exact: true };
				renderTableList();
			}
			var ms = Math.round(performance.now() - started);
			var from = rows.length ? state.offset + 1 : 0;
			var to = state.offset + rows.length;
			var pages = state.total != null ? Math.max(1, Math.ceil(state.total / limit)) : null;
			$('page').textContent = from + '–' + to + (state.total != null ? ' of ' + state.total.toLocaleString() : '');
			$('page').title = pages ? 'Page ' + (Math.floor(state.offset / limit) + 1) + ' of ' + pages : '';
			$('prev').disabled = state.offset === 0;
			$('next').disabled = state.total != null ? to >= state.total : rows.length < limit;
			$('reload').disabled = false;
			var nested = depth > 0 ? usableRelations(t.schema, t.name).map(function (r) { return r.name; }) : [];
			setStatus(rows.length + ' row' + (rows.length === 1 ? '' : 's') + ' · ' + ms + ' ms' +
				(nested.length ? ' · nested ' + nested.join(', ') + (depth > 1 ? ' (' + depth + ' levels)' : '') : ''));
			state.label = t.name;
			state.indexBase = state.offset;
			state.ctx = { schema: t.schema || 'public', table: t.name, rels: depth > 0 };
			if (!rows.length) {
				state.data = rows;
				enableExport(true);
				showEmpty('none', where ? 'No rows match this filter' : 'This table is empty', where ? 'Try a different WHERE condition.' : '');
				$('footRight').textContent = '';
				return;
			}
			show(rows);
		}).catch(function (e) {
			if (reqId !== state.req) return;
			showError(String(e && e.message || e));
		}).then(function () { if (reqId === state.req) setLoading(false); });
	}

	function runSql() {
		var sql = $('sql').value.trim();
		if (!sql) return;
		var reqId = ++state.req;
		setLoading(true);
		setStatus('Running…');
		var started = performance.now();
		query(sql).then(function (rows) {
			if (reqId !== state.req) return;
			state.label = 'query';
			state.indexBase = 0;
			state.ctx = null;
			var data = Array.isArray(rows) ? rows : [rows];
			setStatus((Array.isArray(rows) ? rows.length + ' row' + (rows.length === 1 ? '' : 's') : 'Done') + ' · ' + Math.round(performance.now() - started) + ' ms');
			if (!data.length) { state.data = data; enableExport(true); showEmpty('none', 'Query returned no rows', ''); return; }
			show(data);
		}).catch(function (e) {
			if (reqId !== state.req) return;
			showError(String(e && e.message || e));
		}).then(function () { if (reqId === state.req) setLoading(false); });
	}

	// ---------- rendering ----------
	function enableExport(on) { $('copy').disabled = !on; $('download').disabled = !on; }

	function show(data) {
		state.data = data;
		enableExport(true);
		render();
	}

	function render() {
		var out = $('out');
		out.textContent = '';
		if (state.data == null) return;
		var size = JSON.stringify(state.data).length;
		$('footRight').textContent = (size < 1024 ? size + ' B' : (size / 1024).toFixed(1) + ' KB') + ' JSON';
		if (state.view === 'raw') { renderRaw(out); return; }
		var open = computeFind();
		if (Array.isArray(state.data) && state.data.length && state.data.every(function (r) { return r && typeof r === 'object' && !Array.isArray(r); })) {
			renderCards(out, state.data, open);
		} else {
			var root = el('div', 'json');
			root.appendChild(node(null, state.data, '$', 0, null, open, null));
			out.appendChild(root);
		}
		collectMatches();
	}

	// --- raw view with lightweight syntax highlighting ---
	function renderRaw(out) {
		var text = JSON.stringify(state.data, null, 2);
		var pre = el('pre', 'raw');
		if (text.length > 1500000) { pre.textContent = text; out.appendChild(pre); return; }
		var re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
		var last = 0;
		var frag = document.createDocumentFragment();
		var m;
		while ((m = re.exec(text))) {
			if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
			var cls;
			if (m[1]) cls = m[2] ? 'k' : 's';
			else if (m[3]) cls = 'b';
			else if (m[0] === 'null') cls = 'z';
			else cls = 'n';
			if (m[1] && m[2]) {
				frag.appendChild(el('span', 'k', m[1]));
				frag.appendChild(document.createTextNode(m[2]));
			} else {
				frag.appendChild(el('span', cls, m[0]));
			}
			last = re.lastIndex;
		}
		if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
		pre.appendChild(frag);
		out.appendChild(pre);
	}

	// --- find in results ---
	function computeFind() {
		var q = state.find.toLowerCase();
		var open = {};
		state.findHits = 0;
		if (!q || state.view !== 'tree') return open;
		var hits = 0;
		var walk = function (v, path, ancestors) {
			if (hits > 5000) return;
			if (v !== null && typeof v === 'object') {
				var isArr = Array.isArray(v);
				var keys = isArr ? null : Object.keys(v);
				var n = isArr ? v.length : keys.length;
				for (var i = 0; i < n; i++) {
					var k = isArr ? i : keys[i];
					var p = childPath(path, k, isArr);
					var chain = ancestors.concat([path]);
					if (!isArr && String(k).toLowerCase().indexOf(q) !== -1) { hits++; chain.forEach(function (a) { open[a] = true; }); }
					walk(v[k], p, chain);
				}
			} else if (String(v).toLowerCase().indexOf(q) !== -1) {
				hits++;
				ancestors.forEach(function (a) { open[a] = true; });
			}
		};
		walk(state.data, '$', []);
		return open;
	}
	function hl(parent, text, cls) {
		var span = el('span', cls);
		var q = state.find;
		if (!q || state.view !== 'tree') { span.textContent = text; parent.appendChild(span); return span; }
		var lower = text.toLowerCase();
		var ql = q.toLowerCase();
		var i = 0;
		var j;
		while ((j = lower.indexOf(ql, i)) !== -1) {
			if (j > i) span.appendChild(document.createTextNode(text.slice(i, j)));
			span.appendChild(el('mark', '', text.slice(j, j + q.length)));
			i = j + q.length;
		}
		if (i < text.length) span.appendChild(document.createTextNode(text.slice(i)));
		parent.appendChild(span);
		return span;
	}
	function collectMatches() {
		state.matches = Array.prototype.slice.call($('out').querySelectorAll('mark'));
		state.matchIdx = state.matches.length ? 0 : -1;
		updateFindCount();
		focusMatch(false);
	}
	function updateFindCount() {
		var c = $('findCount');
		if (!state.find || state.view !== 'tree') { c.textContent = ''; return; }
		c.textContent = state.matches.length ? (state.matchIdx + 1) + '/' + state.matches.length : 'no matches';
	}
	function focusMatch(scroll) {
		state.matches.forEach(function (m, i) { m.className = i === state.matchIdx ? 'current' : ''; });
		var cur = state.matches[state.matchIdx];
		if (cur && scroll !== false) cur.scrollIntoView({ block: 'center' });
		else if (cur) cur.scrollIntoView({ block: 'nearest' });
	}
	function stepMatch(dir) {
		if (!state.matches.length) return;
		state.matchIdx = (state.matchIdx + dir + state.matches.length) % state.matches.length;
		updateFindCount();
		focusMatch(true);
	}

	// --- row cards ---
	function rowLabel(row) {
		for (var i = 0; i < LABEL_KEYS.length; i++) {
			var v = row[LABEL_KEYS[i]];
			if (typeof v === 'string' && v) return v;
		}
		for (var k in row) if (typeof row[k] === 'string' && row[k] && !DATE_RE.test(row[k]) && row[k].length < 120) return row[k];
		return '';
	}
	function relMap(ctx) {
		var map = {};
		if (!ctx || !ctx.rels) return map;
		usableRelations(ctx.schema, ctx.table).forEach(function (r) { map[r.name] = r; });
		return map;
	}
	function renderCards(out, rows, open) {
		var ctx = state.ctx;
		var rels = relMap(ctx);
		var pkCols = ctx ? state.pks[key(ctx.schema, ctx.table)] || [] : [];
		if (!pkCols.length && rows[0] && 'id' in rows[0]) pkCols = ['id'];
		var wrap = el('div', 'cards');
		rows.forEach(function (row, i) {
			var path = '$[' + i + ']';
			var card = el('div', 'card');
			var head = el('div', 'card-head');
			var caret = icon('chevron');
			caret.firstChild.classList.add('caret');
			head.appendChild(caret);
			head.appendChild(el('span', 'idx', '#' + (state.indexBase + i + 1)));
			if (pkCols.length) {
				head.appendChild(el('span', 'pk mono', pkCols.map(function (c) { return c + ' ' + (row[c] == null ? 'null' : String(row[c])); }).join(' · ')));
			}
			var label = rowLabel(row);
			if (label) hl(head, label, 'label');
			var badges = el('span', 'badges');
			Object.keys(rels).forEach(function (name) {
				if (!(name in row)) return;
				var v = row[name];
				var b = el('span', 'badge');
				b.appendChild(el('b', '', name));
				if (Array.isArray(v)) b.appendChild(el('span', '', String(v.length)));
				else b.appendChild(el('span', '', v == null ? 'none' : '1'));
				badges.appendChild(b);
			});
			head.appendChild(badges);
			card.appendChild(head);
			var body = null;
			var build = function () {
				if (body) return;
				body = el('div', 'card-body json');
				Object.keys(row).forEach(function (k) {
					body.appendChild(node(k, row[k], childPath(path, k, false), 1, rels[k] ? { rel: rels[k] } : null, open, null));
				});
				card.appendChild(body);
			};
			var setOpen = function (on) { card.classList.toggle('open', on); if (on) build(); };
			card._setOpen = setOpen;
			head.onclick = function () { setOpen(!card.classList.contains('open')); };
			setOpen(i < CARD_OPEN_LIMIT || !!open[path]);
			wrap.appendChild(card);
		});
		out.appendChild(wrap);
	}

	// --- generic tree node ---
	function addCopy(line, value) {
		var b = el('button', 'copy');
		b.type = 'button';
		b.title = 'Copy value';
		b.innerHTML = ICON.copy;
		b.onclick = function (e) {
			e.stopPropagation();
			copyText(typeof value === 'string' ? value : JSON.stringify(value, null, 2), 'Value copied');
		};
		line.appendChild(b);
	}
	function addKey(body, name, relInfo) {
		if (name === null) return;
		hl(body, name, 'k' + (relInfo ? ' rel' : ''));
		body.appendChild(el('span', 'colon', ': '));
	}
	function addRelTag(body, relInfo) {
		if (!relInfo) return;
		var t = el('span', 'reltag', '\u2192 ' + relInfo.rel.refTable + (relInfo.rel.type === 'many' ? '[]' : ''));
		t.title = (relInfo.rel.type === 'many' ? 'many' : 'one') + ' relation to ' + relInfo.rel.refSchema + '.' + relInfo.rel.refTable;
		body.appendChild(t);
	}
	// relInfo: set when this key is a relation of the parent row ({ rel }).
	// rowCtx: set when this value is a row of a known table (element of a "many" relation).
	function node(name, value, path, level, relInfo, open, rowCtx) {
		if (value !== null && typeof value === 'object') {
			var isArr = Array.isArray(value);
			var keys = isArr ? null : Object.keys(value);
			var size = isArr ? value.length : keys.length;
			var refCtx = relInfo ? { schema: relInfo.rel.refSchema, table: relInfo.rel.refTable, rels: true } : null;
			var ownCtx = isArr ? null : (rowCtx || (relInfo && relInfo.rel.type === 'one' ? refCtx : null));
			var itemCtx = isArr && relInfo && relInfo.rel.type === 'many' ? refCtx : null;
			var branch = el('div', 'branch');
			var line = el('div', 'line');
			line.title = path;
			var tog = el('span', 'tog');
			tog.innerHTML = ICON.chevron;
			line.appendChild(tog);
			var body = el('span', 'body');
			addKey(body, name, relInfo);
			body.appendChild(el('span', 'meta', isArr ? '[' + size + ']' : '{' + size + '}'));
			addRelTag(body, relInfo);
			var preview = el('span', 'preview');
			if (!isArr && size) preview.textContent = '  ' + keys.slice(0, 4).join(', ') + (size > 4 ? ', …' : '');
			else if (isArr && size && value[0] !== null && typeof value[0] !== 'object') {
				preview.textContent = '  ' + value.slice(0, 5).map(function (v) { return JSON.stringify(v); }).join(', ') + (size > 5 ? ', …' : '');
			}
			body.appendChild(preview);
			line.appendChild(body);
			addCopy(line, value);
			branch.appendChild(line);
			var kids = null;
			var build = function () {
				if (kids) return;
				kids = el('div', 'kids');
				if (!size) kids.appendChild(el('div', 'line preview', isArr ? 'empty array' : 'empty object'));
				if (isArr) {
					value.forEach(function (v, i) {
						kids.appendChild(node(String(i), v, childPath(path, i, true), level + 1, null, open, itemCtx));
					});
				} else {
					var rm = relMap(ownCtx);
					keys.forEach(function (k) {
						kids.appendChild(node(k, value[k], childPath(path, k, false), level + 1, rm[k] ? { rel: rm[k] } : null, open, null));
					});
				}
				branch.appendChild(kids);
			};
			var setOpen = function (on) {
				branch.classList.toggle('open', on);
				preview.style.display = on ? 'none' : '';
				if (on) build();
			};
			branch._setOpen = setOpen;
			line.onclick = function (e) {
				if (e.target.closest && e.target.closest('button')) return;
				if (window.getSelection && String(window.getSelection())) return;
				setOpen(!branch.classList.contains('open'));
			};
			setOpen(level < 2 || !!open[path]);
			return branch;
		}
		var leaf = el('div', 'line');
		leaf.title = path;
		leaf.appendChild(el('span', 'pad'));
		var lb = el('span', 'body');
		addKey(lb, name, relInfo);
		if (value === null || value === undefined) lb.appendChild(el('span', 'z', 'null'));
		else if (typeof value === 'string') {
			var isDate = DATE_RE.test(value);
			if (value.length > LONG_STRING && !(state.find && value.toLowerCase().indexOf(state.find.toLowerCase()) !== -1)) {
				var short = hl(lb, JSON.stringify(value.slice(0, LONG_STRING)).slice(0, -1) + '…"', 's');
				var more = el('button', 'more', 'show ' + (value.length - LONG_STRING).toLocaleString() + ' more chars');
				more.type = 'button';
				more.onclick = function (e) {
					e.stopPropagation();
					lb.replaceChild(el('span', 's', JSON.stringify(value)), short);
					more.remove();
				};
				lb.appendChild(more);
			} else {
				var s = hl(lb, JSON.stringify(value), isDate ? 'd' : 's');
				if (isDate) {
					var dt = new Date(value.replace(' ', 'T'));
					if (!isNaN(dt.getTime())) s.title = dt.toLocaleString();
				}
			}
		} else if (typeof value === 'number') hl(lb, String(value), 'n');
		else if (typeof value === 'boolean') hl(lb, String(value), 'b');
		else lb.appendChild(el('span', '', String(value)));
		addRelTag(lb, relInfo);
		leaf.appendChild(lb);
		addCopy(leaf, value);
		return leaf;
	}

	function setAll(open) {
		var out = $('out');
		if (open) {
			out.querySelectorAll('.card').forEach(function (c) { c._setOpen(true); });
			var guard = 0;
			var pending = out.querySelectorAll('.branch:not(.open)');
			while (pending.length && guard < 12) {
				pending.forEach(function (b) { b._setOpen(true); });
				pending = out.querySelectorAll('.branch:not(.open)');
				guard++;
			}
		} else {
			var cards = out.querySelectorAll('.card');
			if (cards.length) cards.forEach(function (c) { c._setOpen(false); });
			else out.querySelectorAll('.branch').forEach(function (b, i) { if (i > 0) b._setOpen(false); });
		}
	}

	// ---------- mode / view / theme ----------
	function setMode(mode) {
		state.mode = mode;
		$('tabTable').className = mode === 'table' ? 'on' : '';
		$('tabSql').className = mode === 'sql' ? 'on' : '';
		$('tableSection').style.display = mode === 'table' ? '' : 'none';
		$('sqlSection').className = 'section' + (mode === 'sql' ? ' show' : '');
		if (mode === 'sql') {
			$('sql').focus();
			if (!$('sql').value && state.current) $('sql').value = 'select * from ' + tableRef(state.current.schema, state.current.name) + ' limit 10';
		}
	}
	function setView(view) {
		state.view = view;
		prefs.view = view;
		savePrefs();
		$('viewTree').className = view === 'tree' ? 'on' : '';
		$('viewRaw').className = view === 'raw' ? 'on' : '';
		$('expandAll').style.display = view === 'raw' ? 'none' : '';
		$('collapseAll').style.display = view === 'raw' ? 'none' : '';
		$('findField').style.display = view === 'raw' ? 'none' : '';
		if (state.data && state.data.length !== 0) render();
	}
	function setDepth(v) {
		prefs.depth = String(v);
		savePrefs();
		$('depth').querySelectorAll('button').forEach(function (b) { b.className = b.getAttribute('data-v') === prefs.depth ? 'on' : ''; });
	}
	function applyTheme() {
		var root = document.documentElement;
		if (prefs.theme) root.setAttribute('data-theme', prefs.theme);
		else root.removeAttribute('data-theme');
		var dark = prefs.theme ? prefs.theme === 'dark' : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
		$('themeBtn').innerHTML = dark ? ICON.sun : ICON.moon;
		$('themeBtn').title = dark ? 'Switch to light theme' : 'Switch to dark theme';
	}

	// ---------- wiring ----------
	$('filter').addEventListener('input', renderTableList);
	$('filter').addEventListener('keydown', function (e) {
		if (e.key === 'Enter') { var first = $('tables').querySelector('.tbl'); if (first) first.click(); }
	});
	$('limit').value = prefs.limit;
	$('limit').addEventListener('change', function () { prefs.limit = $('limit').value; savePrefs(); state.offset = 0; loadRows(); });
	$('depth').addEventListener('click', function (e) {
		var b = e.target.closest('button');
		if (!b) return;
		setDepth(b.getAttribute('data-v'));
		loadRows();
	});
	$('where').addEventListener('keydown', function (e) { if (e.key === 'Enter') { state.offset = 0; loadRows(); } });
	$('prev').onclick = function () { state.offset = Math.max(0, state.offset - parseInt(prefs.limit, 10)); loadRows(); };
	$('next').onclick = function () { state.offset += parseInt(prefs.limit, 10); loadRows(); };
	$('reload').onclick = loadRows;
	$('tabTable').onclick = function () { setMode('table'); };
	$('tabSql').onclick = function () { setMode('sql'); };
	$('viewTree').onclick = function () { setView('tree'); };
	$('viewRaw').onclick = function () { setView('raw'); };
	$('expandAll').onclick = function () { setAll(true); collectMatches(); };
	$('collapseAll').onclick = function () { setAll(false); };
	$('runSql').onclick = runSql;
	$('sql').addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runSql(); } });
	$('menuBtn').onclick = function () { document.body.classList.toggle('side-open'); };
	$('themeBtn').onclick = function () {
		var dark = prefs.theme ? prefs.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
		prefs.theme = dark ? 'light' : 'dark';
		savePrefs();
		applyTheme();
	};
	var findTimer;
	$('find').addEventListener('input', function () {
		clearTimeout(findTimer);
		findTimer = setTimeout(function () {
			state.find = $('find').value.trim();
			if (state.data && state.data.length !== 0) render();
			else updateFindCount();
		}, 160);
	});
	$('find').addEventListener('keydown', function (e) {
		if (e.key === 'Enter') { e.preventDefault(); stepMatch(e.shiftKey ? -1 : 1); }
		if (e.key === 'Escape') { $('find').value = ''; state.find = ''; if (state.data && state.data.length) render(); }
	});
	$('copy').onclick = function () {
		var text = JSON.stringify(state.data, null, 2);
		copyText(text, 'Copied ' + (Array.isArray(state.data) ? state.data.length + ' rows' : 'JSON'));
	};
	$('download').onclick = function () {
		var blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
		var a = el('a');
		a.href = URL.createObjectURL(blob);
		a.download = (state.label || 'data') + '.json';
		document.body.appendChild(a);
		a.click();
		setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
	};
	document.addEventListener('keydown', function (e) {
		var tag = (e.target && e.target.tagName) || '';
		var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
		if (e.key === '/' && !typing) { e.preventDefault(); $('filter').focus(); $('filter').select(); }
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && state.view === 'tree' && state.data) { e.preventDefault(); $('find').focus(); $('find').select(); }
		if (e.key === 'Escape' && document.body.classList.contains('side-open')) document.body.classList.remove('side-open');
	});
	if (window.matchMedia) {
		var mq = window.matchMedia('(prefers-color-scheme: dark)');
		if (mq.addEventListener) mq.addEventListener('change', applyTheme);
	}

	// ---------- boot ----------
	applyTheme();
	setDepth(prefs.depth);
	setView(state.view);
	showEmpty('pick', 'Pick a table', 'Choose a table on the left, or switch to SQL to run your own query.');
	post({ type: 'init' }).then(function (info) {
		state.dialect = info.dialect;
		state.relations = info.relations || [];
		$('dbmeta').textContent = info.dialect + (info.databaseName ? ' · ' + info.databaseName : '');
		$('dbPill').className = 'pill ok';
		if (!isPg()) $('depthWrap').style.display = 'none';
		return loadTables();
	}).then(function () {
		renderTableList();
		var rels = state.relations.length;
		setStatus(state.tables.length + ' tables' + (rels ? ' · ' + rels + ' relations from your schema' : ''));
		if (prefs.table) {
			var t = state.tables.filter(function (x) { return key(x.schema, x.name) === prefs.table; })[0];
			if (t) selectTable(t);
		}
	}).catch(function (e) {
		$('dbmeta').textContent = 'connection failed';
		$('dbPill').className = 'pill bad';
		showError(String(e && e.message || e));
	});
})();
</script>
</body>
</html>
`;
