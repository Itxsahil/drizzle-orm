/**
 * Self-contained JSON viewer page served by the Drizzle Studio server at `/json`.
 *
 * It talks to the same `POST /` endpoint the hosted Studio UI uses (`init` + `proxy`)
 * and renders table rows as a collapsible JSON tree. For PostgreSQL it can also
 * nest related rows (using the relations declared in the Drizzle schema) by
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
	--bg: #ffffff;
	--panel: #f6f7f9;
	--border: #e2e4e9;
	--text: #1d1f24;
	--muted: #6b7180;
	--accent: #3b6df0;
	--accent-text: #ffffff;
	--hover: #eceef2;
	--danger: #c62f2f;
	--j-key: #8a3ab9;
	--j-str: #1f7a3d;
	--j-num: #1f5fc6;
	--j-bool: #b0491c;
	--j-null: #8b8f99;
	color-scheme: light;
}
@media (prefers-color-scheme: dark) {
	:root {
		--bg: #15171c;
		--panel: #1c1f26;
		--border: #2c3039;
		--text: #e6e8ec;
		--muted: #969cab;
		--accent: #6b93ff;
		--accent-text: #0d1020;
		--hover: #252932;
		--danger: #ff7a7a;
		--j-key: #d19cff;
		--j-str: #7fd69a;
		--j-num: #82b1ff;
		--j-bool: #ffb47a;
		--j-null: #858b99;
		color-scheme: dark;
	}
}
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
	background: var(--bg);
	color: var(--text);
	font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
	display: grid;
	grid-template-columns: 260px minmax(0, 1fr);
	grid-template-rows: auto 1fr;
	grid-template-areas: "head head" "side main";
}
header {
	grid-area: head;
	display: flex; align-items: center; gap: 12px;
	padding: 10px 16px;
	border-bottom: 1px solid var(--border);
	background: var(--panel);
}
header h1 { font-size: 15px; margin: 0; font-weight: 600; }
header .meta { color: var(--muted); font-size: 12px; }
header .spacer { flex: 1; }
aside {
	grid-area: side;
	border-right: 1px solid var(--border);
	display: flex; flex-direction: column;
	min-height: 0;
	background: var(--panel);
}
aside .search { padding: 10px; border-bottom: 1px solid var(--border); }
#tables { overflow: auto; flex: 1; padding: 4px 0; }
.schema-label {
	padding: 8px 14px 4px; font-size: 11px; text-transform: uppercase;
	letter-spacing: .04em; color: var(--muted);
}
.table-btn {
	display: block; width: 100%; text-align: left;
	padding: 5px 14px 5px 20px; border: 0; background: none; color: inherit;
	font: inherit; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.table-btn:hover { background: var(--hover); }
.table-btn.active, .table-btn.active:hover:not(:disabled) { background: var(--accent); color: var(--accent-text); }
main { grid-area: main; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.toolbar {
	display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
	padding: 10px 16px; border-bottom: 1px solid var(--border);
}
.toolbar .title { font-weight: 600; margin-right: 8px; }
.toolbar label { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); }
input, select, textarea, button {
	font: inherit; color: var(--text); background: var(--bg);
	border: 1px solid var(--border); border-radius: 6px;
}
input, select { padding: 4px 8px; }
input[type="search"] { width: 100%; }
#where { min-width: 220px; flex: 1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
button { padding: 4px 10px; cursor: pointer; }
button:hover:not(:disabled) { background: var(--hover); }
button:disabled { opacity: .5; cursor: default; }
button.primary, button.primary:hover:not(:disabled) { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
.tabs { display: inline-flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.tabs button { border: 0; border-radius: 0; }
.tabs button.on, .tabs button.on:hover:not(:disabled) { background: var(--accent); color: var(--accent-text); }
#sqlbox { display: none; padding: 10px 16px; border-bottom: 1px solid var(--border); gap: 8px; flex-direction: column; }
#sqlbox.show { display: flex; }
#sql { width: 100%; min-height: 90px; padding: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; resize: vertical; }
#status { padding: 6px 16px; color: var(--muted); font-size: 12px; border-bottom: 1px solid var(--border); min-height: 29px; }
#status.error { color: var(--danger); white-space: pre-wrap; }
#out { flex: 1; overflow: auto; padding: 12px 16px 40px; }
#out pre { margin: 0; }
.json { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
.json details { margin-left: 0; }
.json details > .children { margin-left: 18px; border-left: 1px dashed var(--border); padding-left: 8px; }
.json summary { cursor: pointer; list-style: none; user-select: none; }
.json summary::-webkit-details-marker { display: none; }
.json summary::before { content: "\25B8"; display: inline-block; width: 14px; color: var(--muted); }
.json details[open] > summary::before { content: "\25BE"; }
.json .leaf { padding-left: 14px; white-space: pre-wrap; word-break: break-word; }
.json .k { color: var(--j-key); }
.json .s { color: var(--j-str); }
.json .n { color: var(--j-num); }
.json .b { color: var(--j-bool); }
.json .z { color: var(--j-null); font-style: italic; }
.json .hint { color: var(--muted); }
.empty { color: var(--muted); padding: 24px 0; }
@media (max-width: 760px) {
	body { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 200px 1fr; grid-template-areas: "head" "side" "main"; }
	aside { border-right: 0; border-bottom: 1px solid var(--border); }
	header .meta { display: none; }
	#where { min-width: 0; flex-basis: 100%; }
}
</style>
</head>
<body>
<header>
	<h1>Drizzle Studio · JSON</h1>
	<span class="meta" id="dbmeta">connecting…</span>
	<span class="spacer"></span>
	<div class="tabs" role="tablist">
		<button id="tabTable" class="on" type="button">Table</button>
		<button id="tabSql" type="button">SQL</button>
	</div>
</header>
<aside>
	<div class="search"><input id="filter" type="search" placeholder="Filter tables…" autocomplete="off"></div>
	<div id="tables"></div>
</aside>
<main>
	<div class="toolbar" id="tableToolbar">
		<span class="title" id="tableTitle">Pick a table</span>
		<input id="where" placeholder="WHERE …  (optional SQL condition)" autocomplete="off" spellcheck="false">
		<label>Limit
			<select id="limit">
				<option>10</option><option selected>50</option><option>100</option><option>250</option><option>500</option>
			</select>
		</label>
		<label id="depthWrap" title="Nest related rows using the relations defined in your Drizzle schema">Relations
			<select id="depth">
				<option value="0">off</option><option value="1" selected>1 level</option><option value="2">2 levels</option><option value="3">3 levels</option>
			</select>
		</label>
		<button id="prev" type="button" disabled>&larr; Prev</button>
		<span id="page" class="meta"></span>
		<button id="next" type="button" disabled>Next &rarr;</button>
		<button id="reload" type="button" disabled>Reload</button>
	</div>
	<div id="sqlbox">
		<textarea id="sql" spellcheck="false" placeholder="select * from users limit 10"></textarea>
		<div><button class="primary" id="runSql" type="button">Run (Ctrl+Enter)</button></div>
	</div>
	<div class="toolbar">
		<div class="tabs">
			<button id="viewTree" class="on" type="button">Tree</button>
			<button id="viewRaw" type="button">Raw</button>
		</div>
		<button id="expandAll" type="button">Expand all</button>
		<button id="collapseAll" type="button">Collapse all</button>
		<span class="spacer" style="flex:1"></span>
		<button id="copy" type="button" disabled>Copy JSON</button>
		<button id="download" type="button" disabled>Download .json</button>
	</div>
	<div id="status"></div>
	<div id="out"><div class="empty">Select a table on the left, or switch to SQL to run a query.</div></div>
</main>
<script>
(function () {
	'use strict';

	var $ = function (id) { return document.getElementById(id); };
	var state = {
		dialect: null,
		relations: [],
		tables: [],          // [{ schema, name, type }]
		columns: {},         // "schema.table" -> [col]
		pks: {},             // "schema.table" -> [col]
		current: null,       // { schema, name }
		offset: 0,
		total: null,
		data: null,
		label: 'data',
		view: 'tree',
		mode: 'table'
	};

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
	function query(sql, mode) {
		return post({ type: 'proxy', data: { sql: sql, params: [], method: 'all', mode: mode || 'object' } });
	}

	// ---------- SQL helpers ----------
	function qi(name) {
		if (state.dialect === 'mysql' || state.dialect === 'singlestore') return '\x60' + String(name).replace(/\x60/g, '\x60\x60') + '\x60';
		return '"' + String(name).replace(/"/g, '""') + '"';
	}
	function tableRef(schema, name) {
		if (state.dialect === 'sqlite' || state.dialect === 'turso' || !schema) return qi(name);
		return qi(schema) + '.' + qi(name);
	}
	function key(schema, name) { return (schema || '') + '.' + name; }
	function isPg() { return state.dialect === 'postgresql'; }
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
		} else if (state.dialect === 'mysql' || state.dialect === 'singlestore') {
			sql = "select table_schema as " + qi('schema') + ", table_name as name, table_type as type from information_schema.tables " +
				"where table_schema = database() order by 1, 2";
		} else {
			sql = "select '' as schema, name, type from sqlite_master where type in ('table','view') and name not like 'sqlite_%' order by 2";
		}
		return query(sql).then(function (rows) {
			state.tables = rows.map(function (r) { return { schema: r.schema, name: r.name, type: r.type }; });
			if (!isPg()) return;
			var colSql = "select table_schema as s, table_name as t, column_name as c from information_schema.columns " +
				"where table_schema not in ('pg_catalog','information_schema') order by table_schema, table_name, ordinal_position";
			var pkSql = "select kcu.table_schema as s, kcu.table_name as t, kcu.column_name as c " +
				"from information_schema.table_constraints tc join information_schema.key_column_usage kcu " +
				"on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema and tc.table_name = kcu.table_name " +
				"where tc.constraint_type = 'PRIMARY KEY' order by kcu.table_schema, kcu.table_name, kcu.ordinal_position";
			return Promise.all([query(colSql), query(pkSql)]).then(function (res) {
				res[0].forEach(function (r) { (state.columns[key(r.s, r.t)] = state.columns[key(r.s, r.t)] || []).push(r.c); });
				res[1].forEach(function (r) { (state.pks[key(r.s, r.t)] = state.pks[key(r.s, r.t)] || []).push(r.c); });
			});
		});
	}

	function renderTableList() {
		var f = $('filter').value.trim().toLowerCase();
		var box = $('tables');
		box.textContent = '';
		var lastSchema = null;
		var shown = 0;
		state.tables.forEach(function (t) {
			if (f && (t.schema + '.' + t.name).toLowerCase().indexOf(f) === -1) return;
			if (t.schema !== lastSchema && t.schema) {
				var lbl = document.createElement('div');
				lbl.className = 'schema-label';
				lbl.textContent = t.schema;
				box.appendChild(lbl);
				lastSchema = t.schema;
			}
			var b = document.createElement('button');
			b.type = 'button';
			b.className = 'table-btn';
			if (state.current && state.current.schema === t.schema && state.current.name === t.name) b.className += ' active';
			b.textContent = t.name + (/view/i.test(t.type) ? '  (view)' : '');
			b.title = t.schema ? t.schema + '.' + t.name : t.name;
			b.onclick = function () { selectTable(t); };
			box.appendChild(b);
			shown++;
		});
		if (!shown) {
			var e = document.createElement('div');
			e.className = 'empty';
			e.style.padding = '12px 14px';
			e.textContent = state.tables.length ? 'No matches' : 'No tables found';
			box.appendChild(e);
		}
	}

	// ---------- relation-aware query building (PostgreSQL) ----------
	function relationsFor(schema, table) {
		return state.relations.filter(function (r) { return r.table === table && (r.schema || 'public') === (schema || 'public'); });
	}
	function relationSelects(schema, table, alias, depth, level) {
		if (depth <= 0) return '';
		var cols = state.columns[key(schema, table)] || [];
		var out = '';
		relationsFor(schema, table).forEach(function (rel) {
			if (cols.indexOf(rel.name) !== -1) return; // would collide with a real column
			if (!rel.columns.length || rel.columns.length !== rel.refColumns.length) return;
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

	// ---------- actions ----------
	function setStatus(msg, isError) {
		var s = $('status');
		s.textContent = msg || '';
		s.className = isError ? 'error' : '';
	}

	function selectTable(t) {
		state.current = t;
		state.offset = 0;
		state.total = null;
		renderTableList();
		loadRows();
	}

	function loadRows() {
		var t = state.current;
		if (!t) return;
		var limit = parseInt($('limit').value, 10);
		var depth = isPg() ? parseInt($('depth').value, 10) : 0;
		var where = $('where').value.trim();
		var q = buildTableQuery(t, limit, state.offset, depth, where);
		$('tableTitle').textContent = t.schema ? t.schema + '.' + t.name : t.name;
		setStatus('Loading…');
		var started = performance.now();
		var countP = query(q.count).then(function (rows) { return Number(firstValue(rows)); }).catch(function () { return null; });
		var rowsP = query(q.rows).then(function (rows) {
			return q.json ? parseMaybeJson(firstValue(rows)) || [] : rows;
		});
		Promise.all([rowsP, countP]).then(function (res) {
			var rows = res[0];
			state.total = res[1];
			state.label = t.name;
			var ms = Math.round(performance.now() - started);
			var from = rows.length ? state.offset + 1 : 0;
			var to = state.offset + rows.length;
			$('page').textContent = from + '–' + to + (state.total != null ? ' of ' + state.total : '');
			$('prev').disabled = state.offset === 0;
			$('next').disabled = state.total != null ? to >= state.total : rows.length < limit;
			$('reload').disabled = false;
			var rels = depth > 0 ? relationsFor(t.schema, t.name).map(function (r) { return r.name; }) : [];
			setStatus(rows.length + ' row(s) in ' + ms + ' ms' + (rels.length ? ' · nested: ' + rels.join(', ') : ''));
			show(rows);
		}).catch(function (e) {
			setStatus(String(e && e.message || e), true);
		});
	}

	function runSql() {
		var sql = $('sql').value.trim();
		if (!sql) return;
		setStatus('Running…');
		var started = performance.now();
		query(sql).then(function (rows) {
			state.label = 'query';
			var data = Array.isArray(rows) ? rows : [rows];
			setStatus((Array.isArray(rows) ? rows.length + ' row(s)' : 'done') + ' in ' + Math.round(performance.now() - started) + ' ms');
			show(data);
		}).catch(function (e) { setStatus(String(e && e.message || e), true); });
	}

	// ---------- rendering ----------
	function show(data) {
		state.data = data;
		$('copy').disabled = false;
		$('download').disabled = false;
		render();
	}

	function render() {
		var out = $('out');
		out.textContent = '';
		if (state.data == null) return;
		if (state.view === 'raw') {
			var pre = document.createElement('pre');
			pre.className = 'json';
			pre.textContent = JSON.stringify(state.data, null, 2);
			out.appendChild(pre);
			return;
		}
		var root = document.createElement('div');
		root.className = 'json';
		root.appendChild(node(null, state.data, 0));
		out.appendChild(root);
	}

	function span(cls, text) {
		var s = document.createElement('span');
		if (cls) s.className = cls;
		s.textContent = text;
		return s;
	}

	function node(name, value, level) {
		var isArr = Array.isArray(value);
		if (value !== null && typeof value === 'object') {
			var keys = isArr ? null : Object.keys(value);
			var size = isArr ? value.length : keys.length;
			var d = document.createElement('details');
			if (level < 2) d.open = true;
			var sum = document.createElement('summary');
			if (name !== null) { sum.appendChild(span('k', name)); sum.appendChild(span('', ': ')); }
			sum.appendChild(span('hint', isArr ? '[' + size + ']' : '{' + size + '}'));
			if (!isArr && level > 0 && d.open === false) {
				var preview = keys.slice(0, 3).map(function (k) { return k; }).join(', ');
				if (preview) sum.appendChild(span('hint', '  ' + preview + (keys.length > 3 ? ', …' : '')));
			}
			d.appendChild(sum);
			// Children are built lazily on first open to keep large results fast.
			var built = false;
			var build = function () {
				if (built) return;
				built = true;
				var c = document.createElement('div');
				c.className = 'children';
				if (isArr) value.forEach(function (v, i) { c.appendChild(node(String(i), v, level + 1)); });
				else keys.forEach(function (k) { c.appendChild(node(k, value[k], level + 1)); });
				if (!size) c.appendChild(span('hint', isArr ? 'empty array' : 'empty object'));
				d.appendChild(c);
			};
			d._build = build;
			if (d.open) build();
			d.addEventListener('toggle', function () { if (d.open) build(); });
			return d;
		}
		var leaf = document.createElement('div');
		leaf.className = 'leaf';
		if (name !== null) { leaf.appendChild(span('k', name)); leaf.appendChild(span('', ': ')); }
		if (value === null || value === undefined) leaf.appendChild(span('z', 'null'));
		else if (typeof value === 'string') leaf.appendChild(span('s', JSON.stringify(value)));
		else if (typeof value === 'number') leaf.appendChild(span('n', String(value)));
		else if (typeof value === 'boolean') leaf.appendChild(span('b', String(value)));
		else leaf.appendChild(span('', String(value)));
		return leaf;
	}

	function setAll(open) {
		var out = $('out');
		if (open) {
			// Build level by level so newly created children are opened too (bounded to avoid freezing).
			var guard = 0;
			var pending = out.querySelectorAll('details:not([open])');
			while (pending.length && guard < 20) {
				pending.forEach(function (d) { if (d._build) d._build(); d.open = true; });
				pending = out.querySelectorAll('details:not([open])');
				guard++;
			}
		} else {
			out.querySelectorAll('details').forEach(function (d, i) { if (i > 0) d.open = false; });
		}
	}

	// ---------- wiring ----------
	function setMode(mode) {
		state.mode = mode;
		$('tabTable').className = mode === 'table' ? 'on' : '';
		$('tabSql').className = mode === 'sql' ? 'on' : '';
		$('tableToolbar').style.display = mode === 'table' ? '' : 'none';
		$('sqlbox').className = mode === 'sql' ? 'show' : '';
		if (mode === 'sql') $('sql').focus();
	}
	function setView(view) {
		state.view = view;
		$('viewTree').className = view === 'tree' ? 'on' : '';
		$('viewRaw').className = view === 'raw' ? 'on' : '';
		$('expandAll').disabled = view === 'raw';
		$('collapseAll').disabled = view === 'raw';
		render();
	}

	$('filter').addEventListener('input', renderTableList);
	$('limit').addEventListener('change', function () { state.offset = 0; loadRows(); });
	$('depth').addEventListener('change', loadRows);
	$('where').addEventListener('keydown', function (e) { if (e.key === 'Enter') { state.offset = 0; loadRows(); } });
	$('prev').onclick = function () { state.offset = Math.max(0, state.offset - parseInt($('limit').value, 10)); loadRows(); };
	$('next').onclick = function () { state.offset += parseInt($('limit').value, 10); loadRows(); };
	$('reload').onclick = loadRows;
	$('tabTable').onclick = function () { setMode('table'); };
	$('tabSql').onclick = function () { setMode('sql'); };
	$('viewTree').onclick = function () { setView('tree'); };
	$('viewRaw').onclick = function () { setView('raw'); };
	$('expandAll').onclick = function () { setAll(true); };
	$('collapseAll').onclick = function () { setAll(false); };
	$('runSql').onclick = runSql;
	$('sql').addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runSql(); });
	$('copy').onclick = function () {
		var text = JSON.stringify(state.data, null, 2);
		var done = function () { setStatus('Copied ' + text.length + ' characters to clipboard'); };
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
		} else { fallbackCopy(text); done(); }
	};
	function fallbackCopy(text) {
		var ta = document.createElement('textarea');
		ta.value = text;
		document.body.appendChild(ta);
		ta.select();
		try { document.execCommand('copy'); } catch (e) {}
		document.body.removeChild(ta);
	}
	$('download').onclick = function () {
		var blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
		var a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = (state.label || 'data') + '.json';
		document.body.appendChild(a);
		a.click();
		setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
	};

	post({ type: 'init' }).then(function (info) {
		state.dialect = info.dialect;
		state.relations = info.relations || [];
		$('dbmeta').textContent = info.dialect + (info.databaseName ? ' · ' + info.databaseName : '') +
			(state.relations.length ? ' · ' + state.relations.length + ' relation(s) from schema' : '');
		if (!isPg()) $('depthWrap').style.display = 'none';
		return loadTables();
	}).then(function () {
		renderTableList();
		setStatus(state.tables.length + ' table(s)');
	}).catch(function (e) {
		$('dbmeta').textContent = 'connection failed';
		setStatus(String(e && e.message || e), true);
	});
})();
</script>
</body>
</html>
`;
