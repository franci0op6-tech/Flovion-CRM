import assert from "node:assert/strict";
import { registerHooks, syncBuiltinESMExports } from "node:module";
import { mock, test } from "node:test";
import net from "node:net";
import tls from "node:tls";
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import dgram from "node:dgram";
import childProcess from "node:child_process";
import { z } from "zod";

// This test file runs in its own Node test process. Never inspect inherited
// connection settings or tokens. All module imports see synthetic settings.
const nodeTestContext = process.env.NODE_TEST_CONTEXT;
process.env = { ...(nodeTestContext === undefined ? {} : { NODE_TEST_CONTEXT: nodeTestContext }) };
const forbidden = () => { throw new Error("External IO forbidden in offline WhatsApp test"); };
for (const [module, names] of [
  [net, ["connect", "createConnection", "createServer"]],
  [tls, ["connect", "createServer"]],
  [http, ["request", "get", "createServer"]],
  [https, ["request", "get", "createServer"]],
  [dns, ["lookup", "resolve", "resolve4", "resolve6"]],
  [dns.promises, ["lookup", "resolve", "resolve4", "resolve6"]],
  [dgram, ["createSocket"]],
  [childProcess, ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]],
]) {
  for (const name of names) mock.method(module, name, forbidden);
}
syncBuiltinESMExports();
globalThis.fetch = forbidden;

let fixture;
const permissionMock = {
  requireCurrentUser: async () => ({ id: 10, ruolo: "ADMIN", aziendaId: 1 }),
  leadAccessWhere: (_actor, id) => ({ id }),
  canAssignTaskToUser: async (_actor, _lead, id) => fixture.users.some(user => user.id === id),
};
const prismaFacade = {
  get lead() { return fixture.db.lead; },
  $transaction: work => fixture.transaction(work),
  get notificaTask() { return fixture.db.notificaTask; },
};
globalThis.whatsappLegacyOffline = {
  prisma: prismaFacade, permissions: permissionMock, z,
  unavailable: forbidden,
};
const local = new Map([
  ["@/lib/utils", "../lib/utils.ts"],
  ["@/lib/lead-access-transactions", "../lib/lead-access-transactions.ts"],
  ["./lead-authorization", "../lib/lead-authorization.ts"],
  ["./lead-access-policy", "../lib/lead-access-policy.ts"],
  ["./task-notifications", "../lib/task-notifications.ts"],
  ["@/lib/task-notifications", "../lib/task-notifications.ts"],
  ["@/lib/whatsapp", "../lib/whatsapp.ts"],
]);
const dataModule = source => ({ url: "data:text/javascript," + encodeURIComponent(source), shortCircuit: true });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === './session-security') return next(new URL('../lib/session-security.ts', import.meta.url).href,context);
  if (specifier === './session-security-postgresql') return dataModule('export const requireOperationalSessionClaims=async()=>({id:"10",ruolo:"ADMIN",aziendaId:1,sessionVersion:"1",sessionEpoch:"00000000-0000-4000-8000-000000000001"})');
  if (specifier === "./auth") return dataModule('export const auth=async()=>({user:{id:"10"}})');
  if (specifier === "server-only") return dataModule("");
  if (["@/lib/prisma", "./prisma"].includes(specifier)) return dataModule("export const prisma=globalThis.whatsappLegacyOffline.prisma");
  if (specifier === "@/lib/permissions") return dataModule(
    "export const {requireCurrentUser,leadAccessWhere,canAssignTaskToUser}=globalThis.whatsappLegacyOffline.permissions;export const withSessionMutation=globalThis.whatsappLegacyOffline.unavailable");
  if (specifier === "@prisma/client") return dataModule(
    'export const Prisma={}; export const TipoNotificaTask={ASSEGNAZIONE:"ASSEGNAZIONE",GIORNO_SCADENZA:"GIORNO_SCADENZA",QUINDICI_MINUTI_PRIMA:"QUINDICI_MINUTI_PRIMA"}');
  if (specifier === "next/cache") return dataModule("export function revalidatePath(){}");
  if (specifier === "zod") return dataModule("export const z=globalThis.whatsappLegacyOffline.z");
  if (specifier === "@/lib/r2") return dataModule(
    "export const r2=new Proxy({},{get(){return globalThis.whatsappLegacyOffline.unavailable}}); export const r2BucketName='synthetic'");
  if (specifier === "@aws-sdk/client-s3") return dataModule(
    "export const PutObjectCommand=globalThis.whatsappLegacyOffline.unavailable; export const DeleteObjectCommand=PutObjectCommand");
  if (specifier === "file-type") return dataModule("export const fileTypeFromBuffer=globalThis.whatsappLegacyOffline.unavailable");
  if (specifier === "node:fs/promises") return dataModule("export const unlink=globalThis.whatsappLegacyOffline.unavailable");
  if (local.has(specifier)) return { url: new URL(local.get(specifier), import.meta.url).href, shortCircuit: true };
  if (["node:path"].includes(specifier)) return next(specifier, context);
  if (specifier.startsWith("../")) return next(specifier, context);
  throw new Error("Unapproved import in offline test");
} });
let createTask, editTask, completeTask, dispatch, planNotifications;
try {
  ({ createTask } = await import("../app/actions/tasks.ts"));
  ({ editTask, completeTask } = await import("../app/actions/leads.ts"));
  ({ eseguiDispatcherWhatsApp: dispatch } = await import("../lib/whatsapp-dispatcher.ts"));
  ({ pianificaNotificheTask: planNotifications } = await import("../lib/task-notifications.ts"));
} catch (error) { hooks.deregister(); throw error; }
test.after(() => hooks.deregister());

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return value.some(clause => matches(row, clause));
    const actual = row[key];
    if (value !== null && typeof value === "object" && !(value instanceof Date)) {
      if (Object.hasOwn(value, "is")) return matches(actual, value.is);
      if (Object.hasOwn(value, "in")) return value.in.includes(actual);
      if (Object.hasOwn(value, "lte")) return actual !== null && actual <= value.lte;
      throw new Error("Unsupported mock filter");
    }
    return actual === value;
  });
}

function apply(row, data) {
  for (const [key, value] of Object.entries(data)) {
    row[key] = value && typeof value === "object" && Object.hasOwn(value, "increment")
      ? row[key] + value.increment : value;
  }
}

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
}

function setup(t, { mode = "AZIENDA", now = "2026-01-15T05:00:00Z" } = {}) {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(now) });
  process.env = {
    ...(nodeTestContext === undefined ? {} : { NODE_TEST_CONTEXT: nodeTestContext }),
    WHATSAPP_INVIO_ABILITATO: "true", WHATSAPP_TOKEN: "synthetic-token",
    WHATSAPP_PHONE_NUMBER_ID: "100000", WHATSAPP_GRAPH_VERSION: "v26.0",
    WHATSAPP_TEMPLATE_LINGUA: "it", WHATSAPP_TEMPLATE_ASSEGNAZIONE: "folavion_assegnazione",
    WHATSAPP_TEMPLATE_GIORNO: "synthetic_day", WHATSAPP_TEMPLATE_15_MINUTI: "synthetic_15",
  };
  const state = { tasks: [], notifications: [], shares: [], history: [] };
  const company = { whatsappNumero: "+390000000001", whatsappModalitaPromemoria: mode, whatsappOraPromemoria: "07:00" };
  const lead = { id: 100, aziendaId: 1, utenteId: 10, nome: "Synthetic client", azienda: company };
  const users = [
    { id: 20, aziendaId: 1, ruolo: "USER", whatsappNumero: "+390000000002" },
    { id: 30, aziendaId: 1, ruolo: "USER", whatsappNumero: "+390000000003" },
    { id: 10, aziendaId: 1, ruolo: "ADMIN" },
  ];
  const trace = [];
  const hydrated = row => ({ ...structuredClone(row), lead: structuredClone(lead),
    assegnatoA: structuredClone(users.find(user => user.id === row.assegnatoAId) ?? null) });
  const db = {
    async $queryRaw(strings, ...values) {
      const sql = strings.join("?"); assert.match(sql, /FOR NO KEY UPDATE/);
      if (sql.includes('"public"."Lead"')) { trace.push(["lock.lead"]); return structuredClone([lead].filter(l=>l.id===values[0])); }
      if (sql.includes('"public"."Utente"')) { trace.push(["lock.users"]); assert.deepEqual(values,[...values].sort((a,b)=>a-b)); return structuredClone(users.filter(u=>values.includes(u.id)).map(u=>({...u,accountEnabled:true,sessionVersion:BigInt(1),sessionEpoch:'00000000-0000-4000-8000-000000000001'}))); }
      if (sql.includes('"public"."Task"')) { trace.push(["lock.task"]); return structuredClone(state.tasks.filter(t=>t.id===values[0]&&t.leadId===values[1])); }
      assert.match(sql,/"public"\."NotificaTask"/); return structuredClone(state.notifications.filter(q=>q.taskId===values[0]));
    },
    lead: { async findFirst({ where }) { return matches(lead, where) ? structuredClone(lead) : null; }, async findUnique({where}) { return matches(lead,where) ? structuredClone(lead) : null; } },
    utente: { async findFirst({ where }) { return structuredClone(users.find(row => matches(row, where)) ?? null); }, async findUnique({where}) { return structuredClone(users.find(row=>matches(row,where)) ?? null); } },
    task: {
      async create({ data }) { const row = { id: 200 + state.tasks.length, ...data }; state.tasks.push(row); return hydrated(row); },
      async findUnique({ where }) { const row = state.tasks.find(task => task.id === where.id); return row ? hydrated(row) : null; },
      async findFirst({ where }) {
        const row = await this.findUnique({ where });
        return row && matches(row, where) ? row : null;
      },
      async update({ where, data }) { const row = state.tasks.find(task => task.id === where.id); assert.ok(row); apply(row, data); return hydrated(row); },
      async updateMany({ where, data }) { const rows = state.tasks.filter(row => matches(hydrated(row), where)); rows.forEach(row => apply(row, data)); return { count: rows.length }; },
    },
    accessoLead: { async findUnique({where:{leadId_utenteId:k}}) { return structuredClone(state.shares.find(s=>s.leadId===k.leadId&&s.utenteId===k.utenteId)??null); }, async upsert({ where, create, update }) {
      const pair = where.leadId_utenteId;
      const existing = state.shares.find(row => row.leadId === pair.leadId && row.utenteId === pair.utenteId);
      if (existing) apply(existing, update); else state.shares.push(structuredClone(create));
    } },
    eventoAccessoLead: { async create() {} },
    storicoAssegnazione: { async create({ data }) { state.history.push(structuredClone(data)); } },
    notificaTask: {
      async createMany({ data, skipDuplicates }) {
        assert.equal(skipDuplicates, true);
        let count = 0;
        for (const row of data) {
          if (state.notifications.some(saved => saved.chiaveIdempotenza === row.chiaveIdempotenza)) continue;
          state.notifications.push({ id: 300 + state.notifications.length, stato: "IN_ATTESA", tentativi: 0,
            prossimoTentativo: null, bloccataFinoAl: null, ...structuredClone(row) });
          count++;
        }
        return { count };
      },
      async findMany({ where, take }) {
        const candidates = state.notifications.filter(row => matches(row, where))
          .sort((a, b) => a.programmataPer - b.programmataPer || a.id - b.id).slice(0, take).map(row => ({ id: row.id }));
        trace.push(["candidates", ...candidates.map(row => row.id)]);
        return candidates;
      },
      async findUnique({ where }) {
        const row = state.notifications.find(notification => notification.id === where.id);
        if (!row) return null;
        trace.push(["read", row.id]);
        if (fixture.beforeRead) await fixture.beforeRead(row);
        return { ...structuredClone(row), task: hydrated(state.tasks.find(task => task.id === row.taskId)) };
      },
      async updateMany({ where, data }) {
        const rows = state.notifications.filter(row => matches(row, where));
        // Synchronous mutation models an indivisible conditional UPDATE.
        rows.forEach(row => apply(row, data));
        return { count: rows.length };
      },
    },
  };
  let queue = Promise.resolve();
  fixture = { state, db, users, company, trace, calls: [], outcomes: [],
    async transaction(work) {
      const before = queue;
      let release;
      queue = new Promise(resolve => { release = resolve; });
      await before;
      const backup = structuredClone(state);
      try { return await work(db); }
      catch (error) { Object.assign(state, backup); throw error; }
      finally { release(); }
    },
  };
  const f = fixture;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://graph.facebook.com/v26.0/100000/messages");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer synthetic-token");
    assert.ok(options.signal instanceof AbortSignal);
    const body = JSON.parse(options.body);
    assert.equal(body.messaging_product, "whatsapp");
    f.calls.push(body);
    const outcome = f.outcomes.shift() ?? { status: 200, body: { messages: [{ id: "synthetic-message-" + f.calls.length }] } };
    if (outcome.error) throw outcome.error;
    return new Response(outcome.raw ?? JSON.stringify(outcome.body ?? { error: { code: 999 } }), { status: outcome.status });
  };
  t.after(() => { globalThis.fetch = forbidden; });
  f.create = async (values = {}) => {
    const result = await createTask({ ok: false }, form({ leadId: 100, descrizione: "Synthetic task",
      data_scadenza: "2026-01-15T10:00", assegnatoAId: 20, ...values }));
    assert.equal(result.ok, true, result.error);
    return result.taskId;
  };
  f.edit = values => editTask(form({ id: state.tasks[0].id, descrizione: "Synthetic task",
    data_scadenza: "2026-01-15T10:00", ...values }));
  f.advance = iso => t.mock.timers.setTime(Date.parse(iso));
  return f;
}

test("network sockets and child processes are explicitly forbidden", () => {
  assert.throws(() => net.connect(443, "example.invalid"), /External IO forbidden/);
  assert.throws(() => https.get("https://example.invalid"), /External IO forbidden/);
  assert.throws(() => childProcess.spawn("psql"), /External IO forbidden/);
});

test("real create action plans three notifications and sends assignment only to the collaborator", async t => {
  const f = setup(t);
  await f.create();
  assert.deepEqual(f.state.notifications.map(row => [row.tipo, row.programmataPer.toISOString()]), [
    ["ASSEGNAZIONE", "2026-01-15T05:00:00.000Z"],
    ["GIORNO_SCADENZA", "2026-01-15T06:00:00.000Z"],
    ["QUINDICI_MINUTI_PRIMA", "2026-01-15T08:45:00.000Z"],
  ]);
  const result = await dispatch();
  assert.equal(result.accettate, 1);
  assert.equal(f.calls[0].to, "390000000002");
  assert.equal(f.calls[0].template.name, "folavion_assegnazione");
  assert.equal(f.state.notifications[0].stato, "INVIATA");
  assert.equal(f.state.notifications[0].messaggioProviderId, "synthetic-message-1");
  assert.equal(f.state.notifications[0].consegnataIl, undefined);
  assert.equal(f.state.notifications[1].stato, "IN_ATTESA");
});

for (const mode of ["AZIENDA", "COLLABORATORE"]) {
  test(`assigned reminders reach only the collaborator in ${mode} mode`, async t => {
    const f = setup(t, { mode });
    await f.create();
    await dispatch();
    f.advance("2026-01-15T06:00:00Z");
    await dispatch();
    f.advance("2026-01-15T08:45:00Z");
    await dispatch();
    assert.equal(f.calls.length, 3);
    assert.equal(f.calls[1].to, "390000000002");
    assert.equal(f.calls[1].template.components, undefined);
    assert.equal(f.calls[2].to, f.calls[1].to);
    assert.deepEqual(f.calls[2].template.components, [
      { type: "body", parameters: [{ type: "text", text: "Synthetic client" },
        { type: "text", text: "Synthetic task" }, { type: "text", text: "10:00" }] },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "200" }] },
    ]);
    await dispatch();
    assert.equal(f.calls.length, 3);
  });
}

for (const mode of ["AZIENDA", "COLLABORATORE"]) {
  test(`unassigned creation and both reminders use the company in ${mode} mode`, async t => {
    const f = setup(t, { mode });
    await f.create({ assegnatoAId: "" });
    assert.deepEqual(f.state.notifications.map(row => row.chiaveIdempotenza), [
      "task:200:v1:ASSEGNAZIONE:AZIENDA",
      "task:200:v1:GIORNO_SCADENZA:AZIENDA",
      "task:200:v1:QUINDICI_MINUTI_PRIMA:AZIENDA",
    ]);
    assert.equal(await f.transaction(tx => planNotifications({
      tx, taskId: 200, versionePromemoria: 1, dataScadenza: f.state.tasks[0].data_scadenza,
      assegnatoAId: null, oraPromemoria: "07:00", nuovaAssegnazione: false, nuovaTask: true,
    })), 0);
    assert.equal((await dispatch()).accettate, 1);
    assert.equal(f.calls[0].template.name, "folavion_assegnazione");
    assert.equal(f.calls[0].template.components, undefined);
    f.advance("2026-01-15T06:00:00Z");
    await dispatch();
    f.advance("2026-01-15T08:45:00Z");
    await dispatch();
    assert.deepEqual(f.calls.map(call => [call.to, call.template.name]), [
      ["390000000001", "folavion_assegnazione"],
      ["390000000001", "synthetic_day"],
      ["390000000001", "synthetic_15"],
    ]);
  });
}

test("missing assignment template sends no immediate company notification", async t => {
  const f = setup(t);
  delete process.env.WHATSAPP_TEMPLATE_ASSEGNAZIONE;
  await f.create({ assegnatoAId: "" });
  assert.equal((await dispatch()).fallite, 1);
  assert.deepEqual(f.calls, []);
  assert.equal(f.state.notifications[0].stato, "FALLITA");
  f.advance("2026-01-15T06:00:00Z");
  assert.equal((await dispatch()).accettate, 1);
  assert.equal(f.calls[0].template.name, "synthetic_day");
});

test("real due-date edit cancels old pending versions and plans new ones", async t => {
  const f = setup(t);
  await f.create();
  await f.edit({ data_scadenza: "2026-01-15T11:00" });
  assert.equal(f.state.tasks[0].versionePromemoria, 2);
  assert.ok(f.state.notifications.slice(0, 3).every(row => row.stato === "ANNULLATA"));
  f.advance("2026-01-15T09:45:00Z");
  await dispatch();
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].template.components[0].parameters[2].text, "11:00");
});

test("reassignment sends the assignment and due reminder only to the new assignee", async t => {
  const f = setup(t, { mode: "AZIENDA" });
  await f.create();
  await f.edit({ assegnatoAId: 30 });
  await dispatch();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].to, "390000000003");
  f.advance("2026-01-15T06:00:00Z");
  await dispatch();
  assert.deepEqual(f.calls.map(call => call.to), ["390000000003", "390000000003"]);
  await completeTask(form({ id: 200 }));
  f.advance("2026-01-15T08:45:00Z");
  await dispatch();
  assert.equal(f.calls.length, 2);
  assert.ok(f.state.notifications.every(row => ["ANNULLATA", "INVIATA"].includes(row.stato)));
});

test("description-only edit preserves version and the dispatcher reads the new description", async t => {
  const f = setup(t);
  await f.create();
  await f.edit({ descrizione: "Updated synthetic" });
  assert.equal(f.state.tasks[0].versionePromemoria, 1);
  f.advance("2026-01-15T08:45:00Z");
  await dispatch();
  assert.equal(f.calls.at(-1).template.components[0].parameters[1].text, "Updated synthetic");
});

test("two dispatcher invocations compete for one pending row in the simulated atomic store", async t => {
  const f = setup(t);
  await f.create();
  const results = await Promise.all([dispatch(), dispatch()]);
  assert.equal(results.reduce((sum, result) => sum + result.accettate, 0), 1);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.trace.filter(row => row[0] === "candidates"), [["candidates", 300], ["candidates", 300]]);
});

test("replanning the same task version cannot duplicate its queue entries", async t => {
  const f = setup(t);
  await f.create();
  const count = await f.transaction(tx => planNotifications({
    tx, taskId: 200, versionePromemoria: 1, dataScadenza: f.state.tasks[0].data_scadenza,
    assegnatoAId: 20, oraPromemoria: "07:00", nuovaAssegnazione: true, riferimento: new Date(),
  }));
  assert.equal(count, 0);
  assert.equal(f.state.notifications.length, 3);
});

test("removing the assignee cancels personal rows and plans only company reminders", async t => {
  const f = setup(t, { mode: "COLLABORATORE" });
  await f.create();
  await f.edit({ assegnatoAId: "" });
  assert.equal(f.state.tasks[0].assegnatoAId, null);
  assert.equal(f.state.notifications.length, 5);
  assert.ok(f.state.notifications.slice(0, 3).every(row => row.stato === "ANNULLATA"));
  f.advance("2026-01-15T08:45:00Z");
  await dispatch();
  assert.deepEqual(f.calls.map(call => call.to), ["390000000001", "390000000001"]);
});

test("invalid planning settings roll back task creation in the simulated transaction", async t => {
  const f = setup(t);
  f.company.whatsappOraPromemoria = "25:00";
  const result = await createTask({ ok: false }, form({ leadId: 100, descrizione: "Synthetic",
    data_scadenza: "2026-01-15T10:00", assegnatoAId: 20 }));
  assert.equal(result.ok, false);
  assert.deepEqual(f.state, { tasks: [], notifications: [], shares: [], history: [] });
});

test("a missing personal number fails without falling back to the company", async t => {
  const f = setup(t);
  f.users[0].whatsappNumero = null;
  await f.create();
  await dispatch();
  assert.equal(f.state.notifications[0].stato, "FALLITA");
  f.advance("2026-01-15T08:45:00Z");
  await dispatch();
  assert.ok(f.state.notifications.every(row => row.stato === "FALLITA"));
  assert.deepEqual(f.calls, []);
});

test("a 429 retries at 5 and 15 minutes and stops after the third attempt", async t => {
  const f = setup(t);
  await f.create();
  for (const when of ["2026-01-15T05:00:00Z", "2026-01-15T05:05:00Z", "2026-01-15T05:20:00Z"]) {
    f.advance(when);
    f.outcomes.push({ status: 429 });
    await dispatch();
  }
  assert.equal(f.state.notifications[0].tentativi, 3);
  assert.equal(f.state.notifications[0].stato, "FALLITA");
  await dispatch();
  assert.equal(f.calls.length, 3);
});

for (const [name, outcome] of [
  ["5xx", { status: 503 }],
  ["timeout", { error: new DOMException("Synthetic timeout", "TimeoutError") }],
  ["missing message ID", { status: 200, body: { messages: [{}] } }],
  ["invalid JSON", { status: 200, raw: "synthetic invalid JSON" }],
]) {
  test(`${name} remains uncertain and is never retried automatically`, async t => {
    const f = setup(t);
    await f.create();
    f.outcomes.push(outcome);
    assert.equal((await dispatch()).incerte, 1);
    assert.equal(f.state.notifications[0].stato, "ESITO_INCERTO");
    assert.equal(f.state.notifications[0].prossimoTentativo, null);
    await dispatch();
    assert.equal(f.calls.length, 1);
  });
}

test("a 4xx refusal is final and a missing template fails without calling Meta", async t => {
  const f = setup(t);
  await f.create();
  f.outcomes.push({ status: 400 });
  await dispatch();
  assert.equal(f.state.notifications[0].stato, "FALLITA");
  await f.edit({ assegnatoAId: 30 });
  delete process.env.WHATSAPP_TEMPLATE_ASSEGNAZIONE;
  await dispatch();
  assert.equal(f.calls.length, 1);
  assert.equal(f.state.notifications.find(row => row.versionePromemoria === 2 && row.tipo === "ASSEGNAZIONE").stato, "FALLITA");
});

test("disabled dispatcher leaves the queue untouched", async t => {
  const f = setup(t);
  await f.create();
  process.env.WHATSAPP_INVIO_ABILITATO = "false";
  const before = structuredClone(f.state);
  assert.equal((await dispatch()).attivo, false);
  assert.deepEqual(f.state, before);
  assert.deepEqual(f.calls, []);
});

test("an expired in-progress notification becomes uncertain, not pending", async t => {
  const f = setup(t);
  await f.create();
  Object.assign(f.state.notifications[0], { stato: "IN_LAVORAZIONE", bloccataFinoAl: new Date("2026-01-15T04:59:00Z") });
  assert.equal((await dispatch()).bloccateRecuperate, 1);
  assert.equal(f.state.notifications[0].stato, "ESITO_INCERTO");
  assert.deepEqual(f.calls, []);
});

test("completion between the two dispatcher reads cancels the claimed notification", async t => {
  const f = setup(t);
  await f.create();
  let reads = 0;
  f.beforeRead = async () => { if (++reads === 2) await completeTask(form({ id: 200 })); };
  await dispatch();
  assert.equal(f.state.notifications[0].stato, "ANNULLATA");
  assert.deepEqual(f.calls, []);
});

for (const [local, now, dueUTC, dayUTC] of [
  ["2026-03-29T10:00", "2026-03-28T05:00:00Z", "2026-03-29T08:00:00.000Z", "2026-03-29T05:00:00.000Z"],
  ["2026-10-25T10:00", "2026-10-24T04:00:00Z", "2026-10-25T09:00:00.000Z", "2026-10-25T06:00:00.000Z"],
]) {
  test(`Europe/Rome plans correct UTC instants across DST for ${local}`, async t => {
    const f = setup(t, { now });
    await f.create({ data_scadenza: local });
    assert.equal(f.state.tasks[0].data_scadenza.toISOString(), dueUTC);
    assert.equal(f.state.notifications[1].programmataPer.toISOString(), dayUTC);
    f.advance(new Date(Date.parse(dueUTC) - 15 * 60_000).toISOString());
    await dispatch();
    assert.equal(f.calls.at(-1).template.components[0].parameters[2].text, "10:00");
  });
}

test("nonexistent Rome time is rejected and repeated autumn time selects its first occurrence", async t => {
  const f = setup(t, { now: "2026-03-28T05:00:00Z" });
  const rejected = await createTask({ ok: false }, form({ leadId: 100, descrizione: "Synthetic",
    data_scadenza: "2026-03-29T02:30", assegnatoAId: 20 }));
  assert.equal(rejected.ok, false);
  assert.deepEqual(f.state.tasks, []);
  await f.create({ data_scadenza: "2026-10-25T02:30" });
  assert.equal(f.state.tasks[0].data_scadenza.toISOString(), "2026-10-25T00:30:00.000Z");
});
