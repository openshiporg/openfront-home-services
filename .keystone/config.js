"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all2) => {
  for (var name in all2)
    __defProp(target, name, { get: all2[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// features/keystone/access.ts
var permissionNames, approvalPermissions, isSignedIn, hasPermission, permissions, anyOf, sys, rules;
var init_access = __esm({
  "features/keystone/access.ts"() {
    "use strict";
    permissionNames = [
      // Starter and fleet-mandatory
      "canSeeOtherPeople",
      "canEditOtherPeople",
      "canManagePeople",
      "canManageRoles",
      "canAccessDashboard",
      "canManageOnboarding",
      "canManagePayments",
      "canIssueRefunds",
      "canReadAudit",
      // Company, integrations, policies and operations
      "canManageCompany",
      "canManageIntegrations",
      "canManagePolicies",
      "canApprovePolicies",
      // CRM
      "canManageCustomers",
      "canMergeCustomers",
      "canApproveMerges",
      "canRevealAccessSecret",
      "canReadCustomerPII",
      // Demand
      "canManageLeads",
      "canManageCampaigns",
      // Booking and dispatch
      "canBook",
      "canOverbook",
      "canApproveOverbook",
      "canDispatch",
      "canViewBoard",
      // Field (staff tech app)
      "canWorkVisits",
      "canPresentEstimates",
      "canSellEstimates",
      // Price book and discounts
      "canManagePriceBook",
      "canApprovePriceBook",
      "canApproveDiscounts",
      // Billing
      "canManageInvoices",
      "canTakePayments",
      "canPostInvoices",
      "canApproveWriteOff",
      "canApproveCredits",
      "canApproveRefunds",
      // Financing and memberships
      "canOfferFinancing",
      "canManageMemberships",
      "canSellMemberships",
      // Equipment and warranty
      "canManageEquipment",
      "canSubmitWarrantyClaims",
      "canApproveWarrantyWriteOff",
      // Inventory and purchasing
      "canManageInventory",
      "canPurchase",
      "canReceive",
      "canApprovePurchases",
      "canApproveStockVariance",
      // Compliance
      "canManagePermits",
      "canManageRefrigerant",
      // Labour and pay
      "canApproveTimesheets",
      "canManagePayPlans",
      "canRunPayroll",
      "canApprovePayPlans",
      "canApprovePayPeriods",
      "canReadPay",
      // Accounting
      "canManageAccounting",
      "canCloseAr",
      "canApproveArClose",
      // Communications
      "canSendMessages",
      "canManageTemplates",
      "canRunCampaigns",
      "canApproveCampaigns",
      // Agents
      "canManageAgents",
      "canApproveAgentGrants",
      // Raw status override. Never seeded on a default role; every use is audited.
      "canBreakGlass"
    ];
    approvalPermissions = permissionNames.filter((name) => name.startsWith("canApprove") || name === "canBreakGlass");
    isSignedIn = ({ session }) => {
      if (!session) return false;
      const expires = session.data?.accessExpiresAt;
      return !expires || Date.parse(expires) > Date.now();
    };
    hasPermission = (session, permission) => isSignedIn({ session }) && session?.data.role?.[permission] === true;
    permissions = Object.fromEntries(
      permissionNames.map((name) => [name, ({ session }) => hasPermission(session, name)])
    );
    anyOf = (...names) => ({ session }) => names.some((name) => hasPermission(session, name));
    sys = () => false;
    rules = {
      canReadPeople: ({ session }) => !isSignedIn({ session }) ? false : session.data.role?.canSeeOtherPeople || session.data.role?.canManagePeople ? true : { id: { equals: session.itemId } },
      canUpdatePeople: ({ session }) => !isSignedIn({ session }) ? false : session.data.role?.canEditOtherPeople || session.data.role?.canManagePeople ? true : { id: { equals: session.itemId } }
    };
  }
});

// features/keystone/lib/errors.ts
var DomainError, isDomainError, Codes;
var init_errors = __esm({
  "features/keystone/lib/errors.ts"() {
    "use strict";
    DomainError = class extends Error {
      constructor(code, message, details = {}) {
        super(message);
        this.name = "DomainError";
        this.code = code;
        this.details = details;
      }
    };
    isDomainError = (error) => error instanceof DomainError;
    Codes = {
      NOT_AUTHORIZED: "NOT_AUTHORIZED",
      NOT_FOUND: "NOT_FOUND",
      INVALID_INPUT: "INVALID_INPUT",
      INVALID_TRANSITION: "INVALID_TRANSITION",
      STALE_STATE: "STALE_STATE",
      GUARD_FAILED: "GUARD_FAILED",
      IDEMPOTENCY_KEY_REQUIRED: "IDEMPOTENCY_KEY_REQUIRED",
      IDEMPOTENCY_KEY_REUSED: "IDEMPOTENCY_KEY_REUSED",
      IN_PROGRESS: "IN_PROGRESS",
      APPROVAL_REQUIRED: "APPROVAL_REQUIRED",
      SELF_APPROVAL: "SELF_APPROVAL",
      AGENT_CANNOT_APPROVE: "AGENT_CANNOT_APPROVE",
      APPROVAL_MISMATCH: "APPROVAL_MISMATCH",
      LEASE_LOST: "LEASE_LOST",
      STALE_FENCING_TOKEN: "STALE_FENCING_TOKEN",
      AUDIT_CHAIN_BROKEN: "AUDIT_CHAIN_BROKEN",
      POLICY_MISSING: "POLICY_MISSING",
      POLICY_AMBIGUOUS: "POLICY_AMBIGUOUS",
      POLICY_INVALID: "POLICY_INVALID",
      SCOPE_DENIED: "SCOPE_DENIED",
      AGENT_DISABLED: "AGENT_DISABLED",
      CAPACITY_FULL: "CAPACITY_FULL",
      HOLD_EXPIRED: "HOLD_EXPIRED",
      OUT_OF_AREA: "OUT_OF_AREA",
      NOT_ELIGIBLE: "NOT_ELIGIBLE",
      SCHEDULE_CONFLICT: "SCHEDULE_CONFLICT"
    };
  }
});

// features/keystone/lib/actor.ts
function actorFromSession(session) {
  if (!session || !isSignedIn({ session })) throw new DomainError(Codes.NOT_AUTHORIZED, "Sign in to continue.");
  const role = session.data.role;
  const granted = new Set(role ? permissionNames.filter((name) => role[name] === true) : []);
  return { kind: "user", userId: session.itemId, name: session.data.name, permissions: granted };
}
function can(actor, permission) {
  return actor.kind === "user" && actor.permissions.has(permission);
}
function requirePermission(actor, ...anyOf2) {
  if (actor.kind === "system") return;
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "Agents act only through their tool grants.");
  if (!anyOf2.some((permission) => actor.permissions.has(permission))) {
    throw new DomainError(Codes.NOT_AUTHORIZED, `This needs the ${anyOf2.join(" or ")} permission.`);
  }
}
var principalKey, actorUserId, actorAgentId;
var init_actor = __esm({
  "features/keystone/lib/actor.ts"() {
    "use strict";
    init_access();
    init_errors();
    principalKey = (actor) => actor.kind === "user" ? `user:${actor.userId}` : actor.kind === "agent" ? `agent:${actor.agentId}` : `system:${actor.name}`;
    actorUserId = (actor) => actor.kind === "user" ? actor.userId : null;
    actorAgentId = (actor) => actor.kind === "agent" ? actor.agentId : null;
  }
});

// features/keystone/lib/decimal.ts
function dec(value) {
  if (value instanceof Decimal) return value;
  if (typeof value === "bigint") return new Decimal(value.toString());
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error(`Refusing float ${value}: pass the exact decimal as a string`);
    return new Decimal(value);
  }
  const text20 = String(value).trim();
  if (!DECIMAL_TEXT.test(text20)) throw new Error(`Not a decimal number: ${JSON.stringify(text20).slice(0, 40)}`);
  return new Decimal(text20);
}
function toScale(value, scale, rounding = Decimal.ROUND_HALF_UP) {
  const places = typeof scale === "number" ? scale : Scale[scale];
  return dec(value).toDecimalPlaces(places, rounding).toFixed(places);
}
var import_decimal, Decimal, Scale, DECIMAL_TEXT, plain, ZERO, ONE, BPS, decSum;
var init_decimal = __esm({
  "features/keystone/lib/decimal.ts"() {
    "use strict";
    import_decimal = __toESM(require("decimal.js"));
    Decimal = import_decimal.default.clone({
      precision: 60,
      rounding: import_decimal.default.ROUND_HALF_UP,
      toExpNeg: -40,
      toExpPos: 60
    });
    Scale = { qty: 4, rate: 6, geo: 6 };
    DECIMAL_TEXT = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
    plain = (value) => dec(value).toFixed();
    ZERO = new Decimal(0);
    ONE = new Decimal(1);
    BPS = new Decimal(1e4);
    decSum = (values) => values.map(dec).reduce((a, b) => a.plus(b), ZERO);
  }
});

// features/keystone/lib/canonical.ts
function canonicalize(value) {
  if (value === null || value === void 0) return null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON cannot hold a non-finite number");
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const decimalLike = value;
    if (typeof decimalLike.isFinite === "function" && typeof decimalLike.isNaN === "function") return plain(decimalLike.toString());
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== void 0).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key2, entry]) => [key2, canonicalize(entry)])
    );
  }
  throw new Error(`Canonical JSON cannot hold a ${typeof value}`);
}
function keyedPayloadHash(value, purpose = "cost-bound-hash") {
  const secret2 = process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : DEVELOPMENT_SECRET2);
  if (secret2.length < 16) throw new Error("SESSION_SECRET must be set to hash priced content");
  const key2 = (0, import_node_crypto2.createHmac)("sha256", secret2).update(`hs-keyed-hash\0${purpose}`, "utf8").digest();
  return (0, import_node_crypto2.createHmac)("sha256", key2).update(canonicalJson(value), "utf8").digest("hex");
}
var import_node_crypto2, canonicalJson, sha256, payloadHash, toJsonValue, DEVELOPMENT_SECRET2;
var init_canonical = __esm({
  "features/keystone/lib/canonical.ts"() {
    "use strict";
    import_node_crypto2 = require("node:crypto");
    init_decimal();
    canonicalJson = (value) => JSON.stringify(canonicalize(value));
    sha256 = (text20) => (0, import_node_crypto2.createHash)("sha256").update(text20).digest("hex");
    payloadHash = (value) => sha256(canonicalJson(value));
    toJsonValue = (value) => canonicalize(value);
    DEVELOPMENT_SECRET2 = "this secret should only be used in testing";
  }
});

// features/keystone/lib/db.ts
async function advisoryLock(tx, key2) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key2}, 0))`;
}
function tableName(model) {
  if (!MODEL_NAME.test(model)) throw new Error(`Invalid model name: ${model.slice(0, 40)}`);
  return `"${model}"`;
}
function delegateOf(tx, model) {
  tableName(model);
  const delegate = tx[model[0].toLowerCase() + model.slice(1)];
  if (!delegate) throw new Error(`Unknown model: ${model}`);
  return delegate;
}
var MODEL_NAME, TRANSACTION_OPTIONS;
var init_db = __esm({
  "features/keystone/lib/db.ts"() {
    "use strict";
    MODEL_NAME = /^[A-Z][A-Za-z0-9]*$/;
    TRANSACTION_OPTIONS = {
      get maxWait() {
        return Number.parseInt(process.env.HS_TX_MAX_WAIT_MS ?? "", 10) || 15e3;
      },
      timeout: 6e4
    };
  }
});

// features/keystone/lib/cas.ts
async function lockRow(tx, model, id) {
  const rows = await tx.$queryRawUnsafe(`SELECT id FROM ${tableName(model)} WHERE id = $1 FOR UPDATE`, id);
  if (!rows.length) throw new DomainError(Codes.NOT_FOUND, `${model} not found.`, { model, id });
  const row = await delegateOf(tx, model).findUnique({ where: { id } });
  return row;
}
async function transition(uow, spec) {
  const statusField = spec.statusField ?? "status";
  if (!COLUMN.test(statusField)) throw new Error("Invalid status field");
  const row = await lockRow(uow.tx, spec.model, spec.id);
  const currentStatus = String(row[statusField]);
  const currentVersion = Number(row.version);
  if (spec.expectedVersion !== void 0 && spec.expectedVersion !== null && spec.expectedVersion !== currentVersion) {
    throw new DomainError(Codes.STALE_STATE, `${spec.model} changed since you loaded it. Reload and try again.`, { currentStatus, currentVersion });
  }
  if (!spec.from.includes(currentStatus)) {
    throw new DomainError(Codes.INVALID_TRANSITION, `${spec.model} can't move from ${currentStatus} to ${spec.to}.`, { currentStatus, currentVersion, to: spec.to });
  }
  if (spec.guard) await spec.guard(row);
  const extra = typeof spec.data === "function" ? await spec.data(row) : spec.data ?? {};
  const result = await delegateOf(uow.tx, spec.model).updateMany({
    where: { id: spec.id, version: currentVersion, [statusField]: { in: [...spec.from] } },
    data: { ...extra, [statusField]: spec.to, version: { increment: 1 } }
  });
  if (result.count !== 1) {
    throw new DomainError(Codes.STALE_STATE, `${spec.model} changed since you loaded it. Reload and try again.`, { currentStatus, currentVersion });
  }
  uow.audit({
    eventType: spec.eventType,
    entityType: spec.model,
    entityId: spec.id,
    actorUserId: actorUserId(spec.actor),
    actorAgentId: actorAgentId(spec.actor),
    approverId: spec.approverId ?? null,
    reason: spec.reason ?? null,
    before: { [statusField]: currentStatus, version: currentVersion },
    after: { [statusField]: spec.to, version: currentVersion + 1, ...extra },
    metadata: { ...spec.metadata ?? {}, ...spec.actor.kind === "system" ? { system: spec.actor.name } : {} }
  });
  return await delegateOf(uow.tx, spec.model).findUnique({ where: { id: spec.id } });
}
async function casUpdate(uow, spec) {
  const statusField = spec.statusField ?? "status";
  if (!COLUMN.test(statusField)) throw new Error("Invalid status field");
  const result = await delegateOf(uow.tx, spec.model).updateMany({
    where: { id: spec.id, version: spec.version, [statusField]: { in: [...spec.from] } },
    data: { ...spec.data ?? {}, [statusField]: spec.to, version: { increment: 1 } }
  });
  if (result.count !== 1) throw new DomainError(Codes.STALE_STATE, `${spec.model} changed since you loaded it. Reload and try again.`, { currentVersion: spec.version, to: spec.to });
  uow.audit({
    eventType: spec.eventType,
    entityType: spec.model,
    entityId: spec.id,
    actorUserId: actorUserId(spec.actor),
    actorAgentId: actorAgentId(spec.actor),
    approverId: spec.approverId ?? null,
    reason: spec.reason ?? null,
    before: { [statusField]: spec.from.length === 1 ? spec.from[0] : spec.from, version: spec.version },
    after: { [statusField]: spec.to, version: spec.version + 1, ...spec.audit ?? spec.data ?? {} },
    metadata: { ...spec.metadata ?? {}, ...spec.actor.kind === "system" ? { system: spec.actor.name } : {} }
  });
  return spec.version + 1;
}
function auditCreate(uow, actor, model, id, eventType, after, extra = {}) {
  uow.audit({
    eventType,
    entityType: model,
    entityId: id,
    actorUserId: actorUserId(actor),
    actorAgentId: actorAgentId(actor),
    reason: extra.reason ?? null,
    after,
    metadata: { ...extra.metadata ?? {}, ...actor.kind === "system" ? { system: actor.name } : {} }
  });
}
var COLUMN;
var init_cas = __esm({
  "features/keystone/lib/cas.ts"() {
    "use strict";
    init_db();
    init_errors();
    init_actor();
    COLUMN = /^[a-z][A-Za-z0-9]*$/;
  }
});

// features/keystone/lib/separationOfDuties.ts
function assertCanDecide(actor, requesterUserId, requesterAgentOwnerId, strictAgentOwner = true) {
  if (actor.kind !== "user") throw new DomainError(Codes.AGENT_CANNOT_APPROVE, AGENT_APPROVAL_MESSAGE);
  if (requesterUserId && requesterUserId === actor.userId) throw new DomainError(Codes.SELF_APPROVAL, SELF_APPROVAL_MESSAGE);
  if (strictAgentOwner && requesterAgentOwnerId && requesterAgentOwnerId === actor.userId) throw new DomainError(Codes.SELF_APPROVAL, "You can't approve a proposal made by your own agent.");
}
var SELF_APPROVAL_MESSAGE, AGENT_APPROVAL_MESSAGE;
var init_separationOfDuties = __esm({
  "features/keystone/lib/separationOfDuties.ts"() {
    "use strict";
    init_errors();
    SELF_APPROVAL_MESSAGE = "You can't approve your own request.";
    AGENT_APPROVAL_MESSAGE = "An agent can propose but never approve.";
  }
});

// features/keystone/lib/approval.ts
var approval_exports = {};
__export(approval_exports, {
  consumeApproval: () => consumeApproval,
  decideApproval: () => decideApproval,
  requestApproval: () => requestApproval
});
async function requestApproval(uow, actor, input) {
  const policy = await uow.tx.approvalPolicy.findUnique({ where: { action: input.action } });
  const requiredPermission = policy?.requiredPermission ?? input.requiredPermission;
  const minutes = input.expiresInMinutes ?? policy?.expiresAfterMinutes ?? 1440;
  const created = await uow.tx.approvalRequest.create({
    data: {
      action: input.action,
      summary: input.summary ?? "",
      targetList: input.targetList,
      targetId: input.targetId,
      payload: toJsonValue(input.payload),
      payloadHash: payloadHash(input.payload),
      requiredPermission,
      requestedById: actorUserId(actor),
      requestedByAgentId: actorAgentId(actor),
      status: "pending",
      expiresAt: new Date(uow.now.getTime() + minutes * 6e4)
    }
  });
  uow.audit({ eventType: "approval.requested", entityType: "ApprovalRequest", entityId: created.id, actorUserId: actorUserId(actor), actorAgentId: actorAgentId(actor), after: { action: input.action, targetList: input.targetList, targetId: input.targetId, payloadHash: created.payloadHash, requiredPermission } });
  return created;
}
async function decideApproval(uow, actor, input) {
  const request = await lockRow(uow.tx, "ApprovalRequest", input.requestId);
  let agentOwnerId = null;
  if (request.requestedByAgentId) {
    const agent = await uow.tx.agentIdentity.findUnique({ where: { id: request.requestedByAgentId }, select: { ownerId: true } });
    agentOwnerId = agent?.ownerId ?? null;
  }
  assertCanDecide(actor, request.requestedById, agentOwnerId, input.strictAgentOwner ?? true);
  if (actor.kind !== "user" || !actor.permissions.has(request.requiredPermission)) {
    throw new DomainError(Codes.NOT_AUTHORIZED, `Deciding this needs the ${request.requiredPermission} permission.`);
  }
  if (request.expiresAt && new Date(request.expiresAt).getTime() <= uow.now.getTime()) {
    await transition(uow, { model: "ApprovalRequest", id: input.requestId, from: ["pending"], to: "expired", actor, eventType: "approval.expired" });
    throw new DomainError(Codes.GUARD_FAILED, "This approval request has expired.");
  }
  const to = input.decision === "approve" ? "approved" : "rejected";
  const updated = await transition(uow, {
    model: "ApprovalRequest",
    id: input.requestId,
    from: ["pending"],
    to,
    expectedVersion: input.expectedVersion,
    actor,
    eventType: `approval.${to}`,
    reason: input.reason ?? null,
    approverId: actor.userId
  });
  await uow.tx.approvalDecision.create({ data: { requestId: input.requestId, decidedById: actor.userId, decision: input.decision, reason: input.reason ?? "", at: uow.now } });
  return updated;
}
async function consumeApproval(uow, input) {
  const request = await lockRow(uow.tx, "ApprovalRequest", input.requestId);
  if (request.status !== "approved") throw new DomainError(Codes.APPROVAL_REQUIRED, "This action needs an approved request.");
  if (request.consumedAt) throw new DomainError(Codes.APPROVAL_MISMATCH, "This approval was already used.");
  if (request.action !== input.action || request.targetList !== input.targetList || request.targetId !== input.targetId || request.payloadHash !== payloadHash(input.payload)) {
    throw new DomainError(Codes.APPROVAL_MISMATCH, "The approval was given for a different action or payload.");
  }
  if (request.expiresAt && new Date(request.expiresAt).getTime() <= uow.now.getTime()) throw new DomainError(Codes.GUARD_FAILED, "The approval has expired.");
  const decision = await uow.tx.approvalDecision.findFirst({ where: { requestId: input.requestId, decision: "approve" }, orderBy: { at: "desc" } });
  await uow.tx.approvalRequest.update({ where: { id: input.requestId }, data: { consumedAt: uow.now, version: { increment: 1 } } });
  uow.audit({ eventType: "approval.consumed", entityType: "ApprovalRequest", entityId: input.requestId, approverId: decision?.decidedById ?? null, after: { action: input.action, targetId: input.targetId } });
  return { approverId: decision?.decidedById ?? null };
}
var init_approval = __esm({
  "features/keystone/lib/approval.ts"() {
    "use strict";
    init_canonical();
    init_actor();
    init_errors();
    init_separationOfDuties();
    init_cas();
  }
});

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core21 = require("@keystone-6/core");
var import_config = require("dotenv/config");

// features/keystone/models/User.ts
var import_core = require("@keystone-6/core");
var import_access = require("@keystone-6/core/access");
var import_fields2 = require("@keystone-6/core/fields");

// features/keystone/models/trackingFields.ts
var import_fields = require("@keystone-6/core/fields");
var trackingFields = {
  createdAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  }),
  updatedAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    db: { updatedAt: true },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  })
};

// features/keystone/models/User.ts
init_access();
var User = (0, import_core.list)({
  access: {
    operation: {
      ...(0, import_access.allOperations)(isSignedIn),
      create: (args) => {
        if (process.env.PUBLIC_SIGNUPS_ALLOWED === "true") {
          return true;
        }
        return permissions.canManagePeople(args);
      },
      delete: permissions.canManagePeople
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManagePeople(args),
    hideDelete: (args) => !permissions.canManagePeople(args),
    listView: {
      initialColumns: ["name", "email", "title", "role", "kind"]
    },
    itemView: {
      defaultFieldMode: ({ session, item }) => {
        if (session?.data.role?.canEditOtherPeople) return "edit";
        if (session?.itemId === item?.id) return "edit";
        return "read";
      }
    }
  },
  fields: {
    name: (0, import_fields2.text)({
      validation: {
        isRequired: true
      }
    }),
    email: (0, import_fields2.text)({
      isFilterable: false,
      isOrderable: false,
      isIndexed: "unique",
      validation: {
        isRequired: true
      }
    }),
    password: (0, import_fields2.password)({
      access: {
        read: import_access.denyAll,
        update: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id
      },
      validation: { isRequired: true }
    }),
    role: (0, import_fields2.relationship)({
      ref: "Role.assignedTo",
      access: {
        create: permissions.canManagePeople,
        update: permissions.canManagePeople
      },
      ui: {
        itemView: {
          fieldMode: (args) => permissions.canManagePeople(args) ? "edit" : "read"
        }
      }
    }),
    kind: (0, import_fields2.select)({
      type: "enum",
      options: ["staff", "customer", "payer_contact", "agent_owner"].map((value) => ({ label: value.replaceAll("_", " "), value })),
      defaultValue: "staff",
      access: { create: permissions.canManagePeople, update: permissions.canManagePeople }
    }),
    title: (0, import_fields2.text)(),
    phone: (0, import_fields2.text)({ ui: { description: "E.164, used for on-call pages and approvals by text." } }),
    mfaEnrolled: (0, import_fields2.checkbox)({ defaultValue: false, access: { create: () => false, update: () => false } }),
    accessExpiresAt: (0, import_fields2.timestamp)({
      access: { create: permissions.canManagePeople, update: permissions.canManagePeople },
      ui: { description: "Time-boxed access for outside accountants, auditors and temporary staff." }
    }),
    onboardingStatus: (0, import_fields2.select)({
      options: ["not_started", "in_progress", "completed", "dismissed"].map((value) => ({ label: value.replaceAll("_", " "), value })),
      defaultValue: "not_started"
    }),
    ...trackingFields
  }
});

// features/keystone/models/Role.ts
var import_core2 = require("@keystone-6/core");
var import_access3 = require("@keystone-6/core/access");
var import_fields3 = require("@keystone-6/core/fields");
init_access();
var Role = (0, import_core2.list)({
  access: {
    operation: {
      ...(0, import_access3.allOperations)(permissions.canManageRoles),
      query: isSignedIn
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManageRoles(args),
    hideDelete: (args) => !permissions.canManageRoles(args),
    listView: {
      initialColumns: ["name", "assignedTo"]
    },
    itemView: {
      defaultFieldMode: (args) => permissions.canManageRoles(args) ? "edit" : "read"
    }
  },
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    description: (0, import_fields3.text)({ ui: { displayMode: "textarea" } }),
    ...Object.fromEntries(permissionNames.map((name) => [name, (0, import_fields3.checkbox)({ defaultValue: false })])),
    ...trackingFields,
    limits: (0, import_fields3.relationship)({ ref: "RoleLimit.role", many: true }),
    assignedTo: (0, import_fields3.relationship)({
      ref: "User.role",
      many: true,
      ui: {
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// features/keystone/models/OAuthApp.ts
var import_core3 = require("@keystone-6/core");
var import_fields4 = require("@keystone-6/core/fields");
init_access();

// features/keystone/mcp-oauth/core.ts
var import_node_crypto = __toESM(require("node:crypto"));
var MCP_SCOPES = ["mcp:read", "mcp:write"];
var MCP_ACCESS_PREFIX = "mcp_at_";
var ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
var REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
var AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1e3;
var CONSENT_TICKET_TTL_MS = 10 * 60 * 1e3;
var DEVELOPMENT_SECRET = "this secret should only be used in testing";
function secret() {
  return process.env.SESSION_SECRET || DEVELOPMENT_SECRET;
}
function randomToken(prefix, bytes = 32) {
  return `${prefix}${import_node_crypto.default.randomBytes(bytes).toString("base64url")}`;
}
function digestToken(token, purpose = "mcp-oauth-token") {
  return import_node_crypto.default.createHmac("sha256", secret()).update(`${purpose}\0${token}`, "utf8").digest("hex");
}
function bearerToken(header) {
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== "string") return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(value);
  return match ? match[1] : null;
}
function isMcpAccessToken(token) {
  return typeof token === "string" && token.startsWith(MCP_ACCESS_PREFIX) && token.length > MCP_ACCESS_PREFIX.length;
}
function storedScopes(value) {
  return Array.isArray(value) ? MCP_SCOPES.filter((scope) => value.includes(scope)) : [];
}

// features/keystone/models/OAuthApp.ts
var OAuthApp = (0, import_core3.list)({
  access: {
    operation: {
      query: permissions.canManagePeople,
      create: permissions.canManagePeople,
      update: permissions.canManagePeople,
      delete: permissions.canManagePeople
    }
  },
  fields: {
    name: (0, import_fields4.text)({
      validation: {
        isRequired: true
      }
    }),
    clientId: (0, import_fields4.text)({
      isIndexed: "unique",
      hooks: {
        resolveInput: ({ operation, resolvedData }) => {
          if (operation === "create" && !resolvedData.clientId) {
            return randomToken("mcp_cl_", 18);
          }
          return resolvedData.clientId;
        }
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        description: "Auto-generated unique identifier for your application."
      }
    }),
    clientSecret: (0, import_fields4.text)({
      access: {
        read: () => false
      },
      hooks: {
        resolveInput: ({ resolvedData }) => {
          if (resolvedData.clientSecret) {
            return digestToken(resolvedData.clientSecret, "oauth-client-secret");
          }
          return void 0;
        }
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        description: "Stored only as a digest. Public MCP clients have no secret."
      }
    }),
    tokenEndpointAuthMethod: (0, import_fields4.select)({
      options: [
        { label: "Client secret (POST)", value: "client_secret_post" },
        { label: "Client secret (Basic)", value: "client_secret_basic" },
        { label: "None (public PKCE client)", value: "none" }
      ],
      defaultValue: "client_secret_post",
      ui: {
        description: "How the app authenticates at the token endpoint. MCP clients are public (none)."
      }
    }),
    redirectUris: (0, import_fields4.json)({
      defaultValue: [],
      ui: {
        description: "Array of allowed redirect URIs for OAuth callbacks"
      }
    }),
    scopes: (0, import_fields4.json)({
      defaultValue: [...MCP_SCOPES],
      ui: {
        description: "Array of allowed OAuth scopes. MCP scopes only narrow the signed-in user's own access."
      }
    }),
    webhookUrl: (0, import_fields4.text)({
      ui: {
        description: "URL to receive webhook notifications"
      }
    }),
    status: (0, import_fields4.select)({
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Pending", value: "pending" }
      ],
      defaultValue: "active"
    }),
    installUrl: (0, import_fields4.text)({
      ui: {
        description: "URL where users can install this app"
      }
    }),
    uninstallUrl: (0, import_fields4.text)({
      ui: {
        description: "URL to handle app uninstallation"
      }
    }),
    description: (0, import_fields4.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    metadata: (0, import_fields4.json)({
      defaultValue: {},
      ui: {
        description: "Additional app-specific configuration and settings"
      }
    }),
    developerEmail: (0, import_fields4.text)(),
    privacyPolicyUrl: (0, import_fields4.text)(),
    termsOfServiceUrl: (0, import_fields4.text)(),
    supportUrl: (0, import_fields4.text)(),
    ...trackingFields
  },
  ui: {
    labelField: "name",
    listView: {
      initialColumns: ["name", "clientId", "status", "createdAt"]
    }
  }
});

// features/keystone/models/OAuthToken.ts
var import_core5 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
init_access();
var digestTokenInput = {
  resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] ? digestToken(resolvedData[fieldKey]) : resolvedData[fieldKey]
};
var OAuthToken = (0, import_core5.list)({
  access: {
    operation: {
      query: permissions.canManagePeople,
      create: permissions.canManagePeople,
      update: permissions.canManagePeople,
      delete: permissions.canManagePeople
    }
  },
  fields: {
    tokenType: (0, import_fields5.select)({
      options: [
        { label: "Authorization Code", value: "authorization_code" },
        { label: "Access Token", value: "access_token" },
        { label: "Refresh Token", value: "refresh_token" }
      ],
      validation: {
        isRequired: true
      }
    }),
    token: (0, import_fields5.text)({
      access: { read: () => false },
      validation: {
        isRequired: true
      },
      isIndexed: "unique",
      hooks: digestTokenInput
    }),
    clientId: (0, import_fields5.text)({
      validation: {
        isRequired: true
      },
      isIndexed: true
    }),
    user: (0, import_fields5.relationship)({
      ref: "User",
      ui: {
        description: "The user who authorized this token"
      }
    }),
    scopes: (0, import_fields5.json)({
      defaultValue: [],
      ui: {
        description: "Array of granted scopes"
      }
    }),
    redirectUri: (0, import_fields5.text)({
      ui: {
        description: "The redirect URI used during authorization"
      }
    }),
    agentId: (0, import_fields5.text)({
      access: { create: () => false, update: () => false },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
        description: "The AI agent this token acts as (set when issued to an app bound to an agent; empty for a person's own connection). A token with an agent never acts as the person who approved it."
      }
    }),
    resource: (0, import_fields5.text)({
      ui: {
        description: "The MCP endpoint (RFC 8707 resource) this grant is for"
      }
    }),
    expiresAt: (0, import_fields5.timestamp)({
      ui: {
        description: "When this token expires"
      }
    }),
    isRevoked: (0, import_fields5.select)({
      options: [
        { label: "Active", value: "false" },
        { label: "Revoked", value: "true" }
      ],
      defaultValue: "false"
    }),
    authorizationCode: (0, import_fields5.text)({
      access: { read: () => false },
      hooks: digestTokenInput,
      ui: {
        description: "The authorization code that was exchanged for this token (for access tokens)"
      }
    }),
    refreshToken: (0, import_fields5.text)({
      access: { read: () => false },
      hooks: digestTokenInput,
      ui: {
        description: "Associated refresh token (for access tokens)"
      }
    }),
    accessToken: (0, import_fields5.text)({
      access: { read: () => false },
      hooks: digestTokenInput,
      ui: {
        description: "Associated access token (for refresh tokens)"
      }
    }),
    state: (0, import_fields5.text)({
      ui: {
        description: "OAuth state parameter for CSRF protection"
      }
    }),
    codeChallenge: (0, import_fields5.text)({
      ui: {
        description: "PKCE code challenge"
      }
    }),
    codeChallengeMethod: (0, import_fields5.select)({
      options: [
        { label: "Plain", value: "plain" },
        { label: "SHA256", value: "S256" }
      ],
      ui: {
        description: "PKCE code challenge method"
      }
    }),
    ...trackingFields
  },
  ui: {
    labelField: "clientId",
    listView: {
      initialColumns: ["tokenType", "clientId", "user", "scopes", "expiresAt", "isRevoked"]
    }
  }
});

// features/keystone/models/company.ts
var company_exports = {};
__export(company_exports, {
  Branch: () => Branch,
  Brand: () => Brand,
  BusinessUnit: () => BusinessUnit,
  CompanySettings: () => CompanySettings,
  ContractorLicense: () => ContractorLicense,
  DEFAULT_FEATURES: () => DEFAULT_FEATURES,
  IntegrationConnection: () => IntegrationConnection,
  RoleLimit: () => RoleLimit,
  ServiceArea: () => ServiceArea,
  TRADES: () => TRADES
});
var import_core7 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");
init_access();

// features/keystone/models/domainFields.ts
var import_fields6 = require("@keystone-6/core/fields");
var minor = (options = {}) => (0, import_fields6.bigInt)({
  ...options.access ? { access: options.access } : {},
  ...options.isFilterable ? { isFilterable: options.isFilterable } : {},
  ...options.isOrderable ? { isOrderable: options.isOrderable } : {},
  ...options.defaultValue !== void 0 ? { defaultValue: options.defaultValue } : {},
  validation: { isRequired: options.required ?? options.defaultValue !== void 0 },
  ...options.description ? { ui: { description: options.description } } : {}
});
var ccy = () => (0, import_fields6.text)({ defaultValue: "USD", validation: { isRequired: true, match: { regex: /^[A-Z]{3}$/, explanation: "ISO 4217 currency code required" } } });
var exact = (precision, scale) => (options = {}) => (0, import_fields6.decimal)({
  precision,
  scale,
  validation: { isRequired: options.required ?? false },
  ...options.access ? { access: options.access } : {},
  ...options.ui || options.description ? { ui: { ...options.ui ?? {}, ...options.description ? { description: options.description } : {} } } : {}
});
var qty = exact(18, 4);
var rate = exact(12, 6);
var geo = exact(9, 6);
var bps = (defaultValue) => (0, import_fields6.integer)({ ...defaultValue !== void 0 ? { defaultValue } : {}, validation: { isRequired: defaultValue !== void 0 } });
var option = (value) => ({ label: value ? value.replaceAll("_", " ").replaceAll(".", " \xB7 ") : "none", value });
var lifecycle = (values, initial = values[0]) => (0, import_fields6.select)({
  type: "string",
  options: values.map(option),
  defaultValue: initial,
  validation: { isRequired: true },
  access: { create: () => false, update: () => false },
  ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
});
var choice = (values, initial = values[0]) => (0, import_fields6.select)({
  type: "string",
  options: values.map(option),
  ...initial !== null ? { defaultValue: initial } : {},
  validation: { isRequired: initial !== null }
});
var versionField = () => (0, import_fields6.integer)({
  defaultValue: 0,
  validation: { isRequired: true },
  access: { create: () => false, update: () => false },
  ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
});
var systemText = (options = {}) => (0, import_fields6.text)({
  ...options.indexed ? { isIndexed: options.indexed } : {},
  validation: { isRequired: options.required ?? false },
  access: { create: () => false, update: () => false },
  ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
});
var readOnly = { access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } };
var fixedChoice = (values, initial) => (0, import_fields6.select)({
  type: "string",
  options: values.map(option),
  ...initial !== void 0 ? { defaultValue: initial } : values[0] === "" ? { defaultValue: "" } : {},
  validation: { isRequired: true },
  access: { create: () => false, update: () => false },
  ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
});

// features/keystone/models/listAccess.ts
init_access();
var rule = (permission) => permission === "signedIn" ? isSignedIn : Array.isArray(permission) ? anyOf(...permission) : permissions[permission];
var governed = (read) => ({
  operation: { query: rule(read), create: sys, update: sys, delete: sys }
});
var managed = (read, write) => ({
  operation: { query: rule(read), create: rule(write), update: rule(write), delete: sys }
});
var immutable = governed;
var serverOnly = {
  operation: { query: sys, create: sys, update: sys, delete: sys }
};

// features/keystone/models/company.ts
var DEFAULT_FEATURES = {
  memberships: true,
  inventory: true,
  commercial: true,
  permits: true,
  financing: true,
  homeWarranty: true,
  payroll: true,
  aiVoice: false,
  dispatchRecommendations: true
};
var CompanySettings = (0, import_core7.list)({
  isSingleton: true,
  graphql: { plural: "CompanySettingsItems" },
  access: { operation: { query: permissions.canAccessDashboard, create: () => false, update: permissions.canManageCompany, delete: () => false } },
  ui: { labelField: "displayName" },
  fields: {
    singletonKey: (0, import_fields7.text)({ isIndexed: "unique", defaultValue: "company", validation: { isRequired: true }, access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "hidden" } } }),
    legalName: (0, import_fields7.text)({ validation: { isRequired: true }, defaultValue: "Openfront Home Services" }),
    displayName: (0, import_fields7.text)({ validation: { isRequired: true }, defaultValue: "Openfront Home Services" }),
    homeTimeZone: (0, import_fields7.text)({ defaultValue: "America/Chicago", validation: { isRequired: true } }),
    currencyCode: ccy(),
    defaultCountry: (0, import_fields7.text)({ defaultValue: "US", validation: { isRequired: true, match: { regex: /^[A-Z]{2}$/, explanation: "ISO 3166 country code" } } }),
    allowNegativeTruckStock: (0, import_fields7.checkbox)({ defaultValue: true }),
    estimateValidityDays: (0, import_fields7.integer)({ defaultValue: 30, validation: { isRequired: true, min: 1, max: 365 } }),
    recallWindowDays: (0, import_fields7.integer)({ defaultValue: 30, validation: { isRequired: true, min: 0, max: 365 } }),
    discountApprovalThresholdBps: bps(1e3),
    refundApprovalThresholdMinor: minor({ defaultValue: 50000n }),
    poApprovalThresholdMinor: minor({ defaultValue: 250000n }),
    arPeriodCloseDay: (0, import_fields7.integer)({ defaultValue: 5, validation: { isRequired: true, min: 1, max: 28 } }),
    features: (0, import_fields7.json)({ defaultValue: DEFAULT_FEATURES, ui: { description: "Modules this shop uses. Turning one off hides its screens; data is kept." } }),
    onboardingStatus: (0, import_fields7.select)({
      type: "string",
      options: ["not_started", "in_progress", "completed", "dismissed"].map((value) => ({ label: value.replaceAll("_", " "), value })),
      defaultValue: "not_started",
      validation: { isRequired: true }
    }),
    version: versionField(),
    ...trackingFields
  }
});
var TRADES = ["hvac", "plumbing", "electrical"];
var ContractorLicense = (0, import_core7.list)({
  access: managed("canAccessDashboard", "canManageCompany"),
  ui: { labelField: "licenseNumber", listView: { initialColumns: ["trade", "issuer", "licenseNumber", "licenseClass", "jurisdictionCode", "expiresOn"] } },
  fields: {
    trade: choice([...TRADES, "general", "other"], "hvac"),
    jurisdictionCode: (0, import_fields7.text)({ validation: { isRequired: true, match: { regex: /^[A-Z]{2}(-[A-Z0-9]{2,})*$/, explanation: "Like US-TX or US-TX-AUSTIN" } } }),
    issuer: (0, import_fields7.text)({ ui: { description: "TDLR, TSBPE, \u2026" } }),
    licenseNumber: (0, import_fields7.text)({ validation: { isRequired: true } }),
    licenseClass: (0, import_fields7.text)(),
    endorsements: (0, import_fields7.json)({ defaultValue: [] }),
    responsibleName: (0, import_fields7.text)({ ui: { description: "The licence holder of record (Texas responsible master plumber, ACR licence holder). Links to the Employee record once Phase 1 adds it." } }),
    insuranceDocument: (0, import_fields7.relationship)({ ref: "Document" }),
    expiresOn: (0, import_fields7.calendarDay)(),
    displayOnDocuments: (0, import_fields7.checkbox)({ defaultValue: true }),
    brands: (0, import_fields7.relationship)({ ref: "Brand.licenses", many: true }),
    ...trackingFields
  }
});
var Brand = (0, import_core7.list)({
  access: managed("canAccessDashboard", "canManageCompany"),
  ui: { labelField: "name" },
  fields: {
    name: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    logo: (0, import_fields7.relationship)({ ref: "Document" }),
    phone: (0, import_fields7.text)(),
    email: (0, import_fields7.text)(),
    website: (0, import_fields7.text)(),
    licenses: (0, import_fields7.relationship)({ ref: "ContractorLicense.brands", many: true }),
    businessUnits: (0, import_fields7.relationship)({ ref: "BusinessUnit.brand", many: true }),
    ...trackingFields
  }
});
var Branch = (0, import_core7.list)({
  access: managed("canAccessDashboard", "canManageCompany"),
  ui: { labelField: "name", listView: { initialColumns: ["name", "code", "timeZone", "city", "region"] } },
  fields: {
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    code: (0, import_fields7.text)({ isIndexed: "unique", validation: { isRequired: true, match: { regex: /^[A-Z0-9-]{2,20}$/, explanation: "Capital letters, digits and dashes" } } }),
    timeZone: (0, import_fields7.text)({ validation: { isRequired: true }, defaultValue: "America/Chicago", ui: { description: "IANA zone. Business dates for this branch are in this zone (I-O2)." } }),
    line1: (0, import_fields7.text)(),
    line2: (0, import_fields7.text)(),
    city: (0, import_fields7.text)(),
    region: (0, import_fields7.text)({ ui: { description: "State or province code, e.g. TX" } }),
    postalCode: (0, import_fields7.text)(),
    country: (0, import_fields7.text)({ defaultValue: "US" }),
    lat: geo(),
    lng: geo(),
    calendar: (0, import_fields7.relationship)({ ref: "BusinessCalendar" }),
    businessUnits: (0, import_fields7.relationship)({ ref: "BusinessUnit.branch", many: true }),
    serviceAreas: (0, import_fields7.relationship)({ ref: "ServiceArea.branch", many: true }),
    policyBindings: (0, import_fields7.relationship)({ ref: "PolicyBinding.branch", many: true }),
    ...trackingFields
  }
});
var BusinessUnit = (0, import_core7.list)({
  access: managed("canAccessDashboard", "canManageCompany"),
  ui: { labelField: "name", listView: { initialColumns: ["name", "code", "trade", "kind", "branch", "active"] } },
  fields: {
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    code: (0, import_fields7.text)({ isIndexed: "unique", validation: { isRequired: true, match: { regex: /^[A-Z0-9-]{2,24}$/, explanation: "Capital letters, digits and dashes" } } }),
    trade: choice(TRADES, "hvac"),
    kind: choice(["service", "install", "commercial", "maintenance"], "service"),
    brand: (0, import_fields7.relationship)({ ref: "Brand.businessUnits" }),
    branch: (0, import_fields7.relationship)({ ref: "Branch.businessUnits" }),
    serviceAreas: (0, import_fields7.relationship)({ ref: "ServiceArea.businessUnits", many: true }),
    capacityEnabled: (0, import_fields7.checkbox)({ defaultValue: true }),
    revenueAccountCode: (0, import_fields7.text)(),
    active: (0, import_fields7.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var ServiceArea = (0, import_core7.list)({
  access: managed("canAccessDashboard", "canManageCompany"),
  ui: { labelField: "name" },
  fields: {
    name: (0, import_fields7.text)({ validation: { isRequired: true } }),
    branch: (0, import_fields7.relationship)({ ref: "Branch.serviceAreas" }),
    kind: choice(["zip_list", "polygon"], "zip_list"),
    zips: (0, import_fields7.json)({ defaultValue: [], ui: { description: 'Five-digit ZIP codes served, e.g. ["78701","78702"].' } }),
    polygon: (0, import_fields7.json)({ ui: { description: "GeoJSON Polygon or MultiPolygon." } }),
    businessUnits: (0, import_fields7.relationship)({ ref: "BusinessUnit.serviceAreas", many: true }),
    travelZone: choice(["standard", "extended"], "standard"),
    ...trackingFields
  }
});
var RoleLimit = (0, import_core7.list)({
  access: managed("canAccessDashboard", "canManageRoles"),
  ui: { labelField: "kind", listView: { initialColumns: ["role", "kind", "limit"] } },
  fields: {
    role: (0, import_fields7.relationship)({ ref: "Role.limits" }),
    kind: choice(["discount_bps", "refund_minor", "credit_minor", "po_minor", "overbook_pct"], "discount_bps"),
    limit: minor({ required: true, description: "Basis points, minor units or percent, per the kind." }),
    ...trackingFields
  }
});
var IntegrationConnection = (0, import_core7.list)({
  access: { operation: { query: permissions.canManageIntegrations, create: () => false, update: () => false, delete: () => false } },
  ui: { labelField: "providerKey", listView: { initialColumns: ["area", "providerKey", "mode", "status", "updatedAt"] } },
  fields: {
    area: choice(["payments", "financing", "messaging", "voice", "maps", "tax", "accounting", "payroll", "suppliers", "warranty", "home_warranty", "permits", "lead_sources", "storage", "email"], "payments"),
    providerKey: systemText({ required: true }),
    mode: choice(["manual", "test", "live"], "manual"),
    status: (0, import_fields7.select)({ type: "string", options: ["disconnected", "connected", "degraded", "disabled"].map((value) => ({ label: value, value })), defaultValue: "disconnected", validation: { isRequired: true }, access: { create: () => false, update: () => false } }),
    secretRef: systemText({}),
    config: (0, import_fields7.json)({ access: { create: () => false, update: () => false } }),
    capabilityProfile: (0, import_fields7.json)({ access: { create: () => false, update: () => false } }),
    health: (0, import_fields7.json)({ access: { create: () => false, update: () => false } }),
    version: versionField(),
    ...trackingFields
  }
});

// features/keystone/models/platform.ts
var platform_exports = {};
__export(platform_exports, {
  ApprovalDecision: () => ApprovalDecision,
  ApprovalPolicy: () => ApprovalPolicy,
  ApprovalRequest: () => ApprovalRequest,
  AuditEvent: () => AuditEvent,
  BusinessCalendar: () => BusinessCalendar,
  CalendarException: () => CalendarException,
  CommandReceipt: () => CommandReceipt,
  DOCUMENT_KINDS: () => DOCUMENT_KINDS,
  Document: () => Document,
  DocumentVersion: () => DocumentVersion,
  ExternalId: () => ExternalId,
  Lease: () => Lease,
  Media: () => Media,
  Note: () => Note,
  Notification: () => Notification,
  ProviderObservation: () => ProviderObservation,
  ScheduledJob: () => ScheduledJob,
  SecretBox: () => SecretBox,
  Sequence: () => Sequence,
  Tag: () => Tag,
  Task: () => Task
});
var import_core9 = require("@keystone-6/core");
var import_fields9 = require("@keystone-6/core/fields");
init_access();

// features/keystone/models/costHidden.ts
var import_core8 = require("@keystone-6/core");
var import_fields8 = require("@keystone-6/core/fields");
init_access();
var COST_PERMISSIONS = ["canManagePriceBook", "canApprovePriceBook", "canApproveDiscounts"];
var canReadCost = (session) => !!session && !session.agent && isSignedIn({ session }) && COST_PERMISSIONS.some((name) => session.data?.role?.[name] === true);
var actorCanReadCost = (actor) => actor.kind === "user" && COST_PERMISSIONS.some((name) => actor.permissions?.has(name));
var costRule = ({ session }) => canReadCost(session);
var costOnly = { access: { read: costRule }, isFilterable: costRule, isOrderable: costRule };
var costHash = (options = {}) => (0, import_fields8.text)({
  ...options.indexed ? { isIndexed: options.indexed } : {},
  validation: { isRequired: options.required ?? false },
  access: { create: () => false, update: () => false, read: costRule },
  isFilterable: costRule,
  isOrderable: costRule,
  ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }
});
var COSTLY = /cost|margin|^(contentHash|quoteHash)$/i;
function withoutCost(value) {
  if (Array.isArray(value)) return value.map(withoutCost);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key2]) => !COSTLY.test(key2)).map(([key2, v]) => [key2, withoutCost(v)]));
  }
  return value;
}
var costGuardedJson = (config2 = {}) => (meta) => {
  const base = (0, import_fields8.json)({ ...config2, isFilterable: false, isOrderable: false })(meta);
  return {
    ...base,
    output: import_core8.graphql.field({
      type: import_core8.graphql.JSON,
      resolve({ value }, _args, context) {
        return canReadCost(context.session) ? value : withoutCost(value);
      }
    })
  };
};

// features/keystone/models/platform.ts
var AuditEvent = (0, import_core9.list)({
  access: immutable("canReadAudit"),
  ui: { labelField: "eventType", listView: { initialColumns: ["seq", "at", "eventType", "entityType", "entityId", "actorUser"], initialSort: { field: "seq", direction: "DESC" } } },
  fields: {
    seq: (0, import_fields9.integer)({ isIndexed: "unique", validation: { isRequired: true }, ...readOnly }),
    eventKey: systemText({ indexed: "unique", required: true }),
    eventType: systemText({ indexed: true, required: true }),
    entityType: systemText({ indexed: true, required: true }),
    entityId: systemText({ indexed: true, required: true }),
    actorUser: (0, import_fields9.relationship)({ ref: "User", ...readOnly }),
    actorAgent: (0, import_fields9.relationship)({ ref: "AgentIdentity", ...readOnly }),
    approver: (0, import_fields9.relationship)({ ref: "User", ...readOnly }),
    reason: systemText(),
    before: costGuardedJson({ ...readOnly }),
    after: costGuardedJson({ ...readOnly }),
    metadata: costGuardedJson({ ...readOnly }),
    requestId: systemText(),
    // Chain hashes are keyed, but still only for people who may read cost: no one else needs them, and no one else can filter or order by them.
    prevHash: costHash({ required: true }),
    hash: costHash({ required: true, indexed: "unique" }),
    at: (0, import_fields9.timestamp)({ validation: { isRequired: true }, defaultValue: { kind: "now" }, ...readOnly })
  }
});
var CommandReceipt = (0, import_core9.list)({
  access: serverOnly,
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    idempotencyKey: (0, import_fields9.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    command: (0, import_fields9.text)({ validation: { isRequired: true } }),
    principalKey: (0, import_fields9.text)({ validation: { isRequired: true } }),
    requestHash: (0, import_fields9.text)({ validation: { isRequired: true } }),
    requestParams: (0, import_fields9.json)(),
    responseCode: (0, import_fields9.text)(),
    responseBody: (0, import_fields9.json)(),
    recoveryPoint: (0, import_fields9.text)({ defaultValue: "completed" }),
    completedAt: (0, import_fields9.timestamp)({ defaultValue: { kind: "now" } }),
    ...trackingFields
  }
});
var ProviderObservation = (0, import_core9.list)({
  access: governed("canManageIntegrations"),
  ui: { labelField: "externalId", listView: { initialColumns: ["source", "kind", "externalId", "signatureVerified", "receivedAt", "appliedAt"] } },
  fields: {
    source: systemText({ indexed: true, required: true }),
    kind: systemText({ required: true }),
    connection: (0, import_fields9.relationship)({ ref: "IntegrationConnection", ...readOnly }),
    externalId: systemText({ required: true }),
    contentHash: systemText({ required: true }),
    signatureVerified: (0, import_fields9.checkbox)({ defaultValue: false, ...readOnly }),
    payload: (0, import_fields9.json)({ ...readOnly }),
    correlation: (0, import_fields9.json)({ ...readOnly }),
    receivedAt: (0, import_fields9.timestamp)({ defaultValue: { kind: "now" }, ...readOnly }),
    appliedAt: (0, import_fields9.timestamp)({ ...readOnly }),
    ...trackingFields
  }
});
var Lease = (0, import_core9.list)({
  access: serverOnly,
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    key: (0, import_fields9.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    owner: (0, import_fields9.text)({ validation: { isRequired: true } }),
    fencingToken: (0, import_fields9.integer)({ defaultValue: 0, validation: { isRequired: true } }),
    expiresAt: (0, import_fields9.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var Sequence = (0, import_core9.list)({
  access: serverOnly,
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    key: (0, import_fields9.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    nextValue: (0, import_fields9.integer)({ defaultValue: 1, validation: { isRequired: true } })
  }
});
var ScheduledJob = (0, import_core9.list)({
  access: governed("canManageCompany"),
  ui: { labelField: "key", listView: { initialColumns: ["kind", "key", "dueAt", "status", "attempts"] } },
  fields: {
    kind: systemText({ indexed: true, required: true }),
    key: systemText({ indexed: "unique", required: true }),
    dueAt: (0, import_fields9.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    intervalSeconds: (0, import_fields9.integer)({ ...readOnly, ui: { ...readOnly.ui, description: "Set for recurring jobs; empty for one-shot timers." } }),
    payload: (0, import_fields9.json)({ ...readOnly }),
    status: lifecycle(["pending", "running", "done", "failed", "cancelled"]),
    attempts: (0, import_fields9.integer)({ defaultValue: 0, ...readOnly }),
    lastRunAt: (0, import_fields9.timestamp)({ ...readOnly }),
    lastError: systemText(),
    version: versionField(),
    ...trackingFields
  }
});
var Notification = (0, import_core9.list)({
  access: {
    operation: { query: permissions.canAccessDashboard, create: () => false, update: permissions.canAccessDashboard, delete: () => false },
    filter: {
      query: ({ session }) => session ? { recipient: { id: { equals: session.itemId } } } : false,
      update: ({ session }) => session ? { recipient: { id: { equals: session.itemId } } } : false
    }
  },
  fields: {
    recipient: (0, import_fields9.relationship)({ ref: "User", ...readOnly }),
    channel: choice(["in_app", "email"], "in_app"),
    template: systemText({ required: true }),
    payload: (0, import_fields9.json)({ ...readOnly }),
    status: lifecycle(["pending", "sent", "failed"]),
    sentAt: (0, import_fields9.timestamp)({ ...readOnly }),
    readAt: (0, import_fields9.timestamp)(),
    ...trackingFields
  }
});
var BusinessCalendar = (0, import_core9.list)({
  access: managed("signedIn", "canManageCompany"),
  ui: { labelField: "code", listView: { initialColumns: ["code", "name", "kind", "timeZone", "coverageThrough"] } },
  fields: {
    code: (0, import_fields9.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    name: (0, import_fields9.text)(),
    kind: choice(["legal_business_days", "company_hours"], "company_hours"),
    timeZone: (0, import_fields9.text)({ validation: { isRequired: true }, defaultValue: "America/Chicago" }),
    weekendDays: (0, import_fields9.json)({ defaultValue: [0], ui: { description: "Non-business weekdays, 0 = Sunday. The federal business-day calendar excludes Sundays only (16 CFR 429.0(f))." } }),
    regularOpen: (0, import_fields9.text)({ defaultValue: "08:00", ui: { description: "HH:mm local (company hours only)." } }),
    regularClose: (0, import_fields9.text)({ defaultValue: "17:00", ui: { description: "HH:mm local (company hours only)." } }),
    composedOf: (0, import_fields9.relationship)({ ref: "BusinessCalendar", many: true, ui: { description: "Closed whenever any of these is closed (a company calendar includes the federal holidays)." } }),
    exceptions: (0, import_fields9.relationship)({ ref: "CalendarException.calendar", many: true }),
    coverageThrough: (0, import_fields9.calendarDay)({ ui: { description: "Dates past this fail closed: no deadline is computed on a guess." } }),
    source: (0, import_fields9.text)({ ui: { description: "Where the holiday table came from and when it was checked." } }),
    ...trackingFields
  }
});
var CalendarException = (0, import_core9.list)({
  access: managed("signedIn", "canManageCompany"),
  ui: { labelField: "date", listView: { initialColumns: ["calendar", "date", "kind", "note"] } },
  fields: {
    calendar: (0, import_fields9.relationship)({ ref: "BusinessCalendar.exceptions" }),
    date: (0, import_fields9.calendarDay)({ validation: { isRequired: true } }),
    kind: choice(["holiday", "closure", "special_open"], "holiday"),
    openAt: (0, import_fields9.text)(),
    closeAt: (0, import_fields9.text)(),
    note: (0, import_fields9.text)(),
    ...trackingFields
  }
});
var ApprovalPolicy = (0, import_core9.list)({
  access: { operation: { query: permissions.canAccessDashboard, create: () => false, update: () => false, delete: () => false } },
  ui: { labelField: "action" },
  fields: {
    action: (0, import_fields9.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    description: (0, import_fields9.text)(),
    requiredPermission: (0, import_fields9.text)({ validation: { isRequired: true } }),
    minApprovals: (0, import_fields9.integer)({ defaultValue: 1, validation: { min: 1 } }),
    thresholdMinor: minor(),
    expiresAfterMinutes: (0, import_fields9.integer)({ defaultValue: 1440 }),
    ...trackingFields
  }
});
var ApprovalRequest = (0, import_core9.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "action", listView: { initialColumns: ["action", "status", "targetList", "requestedBy", "createdAt", "expiresAt"] } },
  fields: {
    action: systemText({ indexed: true, required: true }),
    summary: systemText(),
    targetList: systemText({ required: true }),
    targetId: systemText({ indexed: true, required: true }),
    payload: costGuardedJson({ ...readOnly }),
    payloadHash: systemText({ required: true }),
    requiredPermission: systemText({ required: true }),
    requestedBy: (0, import_fields9.relationship)({ ref: "User", ...readOnly }),
    requestedByAgent: (0, import_fields9.relationship)({ ref: "AgentIdentity", ...readOnly }),
    status: lifecycle(["pending", "approved", "rejected", "expired", "cancelled"]),
    expiresAt: (0, import_fields9.timestamp)({ ...readOnly }),
    consumedAt: (0, import_fields9.timestamp)({ ...readOnly, ui: { ...readOnly.ui, description: "When the approved action was carried out. An approval is used once." } }),
    decisions: (0, import_fields9.relationship)({ ref: "ApprovalDecision.request", many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var ApprovalDecision = (0, import_core9.list)({
  access: immutable("canAccessDashboard"),
  fields: {
    request: (0, import_fields9.relationship)({ ref: "ApprovalRequest.decisions", ...readOnly }),
    decidedBy: (0, import_fields9.relationship)({ ref: "User", ...readOnly }),
    decision: (0, import_fields9.select)({ type: "string", options: ["approve", "reject"].map((value) => ({ label: value, value })), validation: { isRequired: true }, ...readOnly }),
    reason: systemText(),
    at: (0, import_fields9.timestamp)({ defaultValue: { kind: "now" }, ...readOnly })
  }
});
var Task = (0, import_core9.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "title", listView: { initialColumns: ["title", "kind", "status", "priority", "dueAt", "assignee", "role"] } },
  fields: {
    kind: systemText({ indexed: true, required: true }),
    title: systemText({ required: true }),
    detail: systemText(),
    subjectType: systemText(),
    subjectId: systemText({ indexed: true }),
    dueAt: (0, import_fields9.timestamp)({ ...readOnly }),
    assignee: (0, import_fields9.relationship)({ ref: "User", ...readOnly }),
    role: (0, import_fields9.relationship)({ ref: "Role", ...readOnly }),
    status: lifecycle(["open", "in_progress", "done", "cancelled"]),
    priority: (0, import_fields9.select)({ type: "string", options: ["low", "normal", "high", "urgent"].map((value) => ({ label: value, value })), defaultValue: "normal", validation: { isRequired: true }, ...readOnly }),
    dedupeKey: systemText({ indexed: "unique" }),
    resolution: systemText(),
    closedAt: (0, import_fields9.timestamp)({ ...readOnly }),
    closedBy: (0, import_fields9.relationship)({ ref: "User", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var DOCUMENT_KINDS = [
  "estimate_pdf",
  "invoice_pdf",
  "cancellation_notice",
  "emergency_waiver",
  "signature",
  "contract",
  "permit",
  "inspection_report",
  "warranty_packet",
  "po_pdf",
  "license",
  "insurance",
  "transcript",
  "logo",
  "policy_source",
  "other"
];
var Document = (0, import_core9.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "title", listView: { initialColumns: ["title", "kind", "visibility", "subjectType", "subjectId", "createdAt"] } },
  fields: {
    title: systemText({ required: true }),
    kind: (0, import_fields9.select)({ type: "string", options: DOCUMENT_KINDS.map((value) => ({ label: value.replaceAll("_", " "), value })), defaultValue: "other", validation: { isRequired: true }, ...readOnly }),
    visibility: (0, import_fields9.select)({ type: "string", options: ["internal", "customer"].map((value) => ({ label: value, value })), defaultValue: "internal", validation: { isRequired: true }, ...readOnly }),
    subjectType: systemText(),
    subjectId: systemText({ indexed: true }),
    versions: (0, import_fields9.relationship)({ ref: "DocumentVersion.document", many: true, ...readOnly }),
    retentionUntil: (0, import_fields9.calendarDay)({ ...readOnly }),
    /** When a certificate (e.g. a sales-tax exemption) expires: it is good only for dates before this day. Empty = no expiry. */
    expiresAt: (0, import_fields9.calendarDay)({ ...readOnly }),
    ...trackingFields
  }
});
var DocumentVersion = (0, import_core9.list)({
  access: immutable("canAccessDashboard"),
  ui: { labelField: "sha256" },
  fields: {
    document: (0, import_fields9.relationship)({ ref: "Document.versions", ...readOnly }),
    versionNumber: (0, import_fields9.integer)({ validation: { isRequired: true, min: 1 }, ...readOnly }),
    storageKey: systemText({ required: true }),
    sha256: systemText({ required: true }),
    mimeType: systemText({ required: true }),
    sizeBytes: (0, import_fields9.integer)({ ...readOnly }),
    createdBy: (0, import_fields9.relationship)({ ref: "User", ...readOnly }),
    ...trackingFields
  }
});
var Media = (0, import_core9.list)({
  access: governed("canAccessDashboard"),
  graphql: { plural: "MediaItems" },
  ui: { labelField: "storageKey", listView: { initialColumns: ["kind", "subjectType", "subjectId", "capturedAt", "visibility"] } },
  fields: {
    subjectType: systemText({ required: true }),
    subjectId: systemText({ indexed: true, required: true }),
    kind: (0, import_fields9.select)({ type: "string", options: ["photo", "video", "scan_3d", "audio", "recording"].map((value) => ({ label: value.replaceAll("_", " "), value })), defaultValue: "photo", validation: { isRequired: true }, ...readOnly }),
    storageKey: systemText({ required: true }),
    sha256: systemText({ required: true }),
    mimeType: systemText(),
    capturedAt: (0, import_fields9.timestamp)({ ...readOnly }),
    capturedBy: (0, import_fields9.relationship)({ ref: "User", ...readOnly }),
    visibility: (0, import_fields9.select)({ type: "string", options: ["internal", "customer"].map((value) => ({ label: value, value })), defaultValue: "internal", validation: { isRequired: true }, ...readOnly }),
    ...trackingFields
  }
});
var Note = (0, import_core9.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "body", listView: { initialColumns: ["subjectType", "subjectId", "visibility", "author", "pinned", "createdAt"] } },
  fields: {
    subjectType: systemText({ required: true }),
    subjectId: systemText({ indexed: true, required: true }),
    body: systemText({ required: true }),
    visibility: (0, import_fields9.select)({ type: "string", options: ["internal", "tech", "customer"].map((value) => ({ label: value, value })), defaultValue: "internal", validation: { isRequired: true }, ...readOnly }),
    author: (0, import_fields9.relationship)({ ref: "User", ...readOnly }),
    pinned: (0, import_fields9.checkbox)({ defaultValue: false, ...readOnly }),
    ...trackingFields
  }
});
var Tag = (0, import_core9.list)({
  access: managed("canAccessDashboard", ["canManageCustomers", "canManageCompany"]),
  ui: { labelField: "name" },
  fields: {
    name: (0, import_fields9.text)({ isIndexed: "unique", validation: { isRequired: true, length: { max: 60 } } }),
    color: choice(["slate", "blue", "green", "amber", "red", "violet"], "slate"),
    ...trackingFields
  }
});
var ExternalId = (0, import_core9.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "externalId", listView: { initialColumns: ["system", "subjectType", "subjectId", "externalId"] } },
  fields: {
    subjectType: systemText({ required: true }),
    subjectId: systemText({ indexed: true, required: true }),
    system: systemText({ required: true }),
    externalId: systemText({ required: true }),
    ...trackingFields
  }
});
var SecretBox = (0, import_core9.list)({
  access: serverOnly,
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    purpose: (0, import_fields9.select)({ type: "string", options: ["integration_credential", "access_secret", "webhook_secret"].map((value) => ({ label: value, value })), validation: { isRequired: true } }),
    ciphertext: (0, import_fields9.text)({ validation: { isRequired: true } }),
    iv: (0, import_fields9.text)({ validation: { isRequired: true } }),
    authTag: (0, import_fields9.text)({ validation: { isRequired: true } }),
    keyVersion: (0, import_fields9.integer)({ defaultValue: 1 }),
    createdBy: (0, import_fields9.relationship)({ ref: "User" }),
    rotatedAt: (0, import_fields9.timestamp)(),
    ...trackingFields
  }
});

// features/keystone/models/policy.ts
var policy_exports = {};
__export(policy_exports, {
  POLICY_KINDS: () => POLICY_KINDS,
  PolicyBinding: () => PolicyBinding,
  PolicyPack: () => PolicyPack,
  PolicyVersion: () => PolicyVersion
});
var import_core10 = require("@keystone-6/core");
var import_fields10 = require("@keystone-6/core/fields");
var POLICY_KINDS = [
  "home_solicitation",
  "home_improvement_contract",
  "auto_renewal",
  "call_recording",
  "contact_hours",
  "refrigerant",
  "licensing",
  "sales_tax",
  "wage_hour",
  "lien",
  "privacy"
];
var PolicyPack = (0, import_core10.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "code", listView: { initialColumns: ["code", "name", "kind", "jurisdictionCode"] } },
  fields: {
    code: systemText({ indexed: "unique", required: true }),
    name: systemText({ required: true }),
    kind: fixedChoice(POLICY_KINDS),
    jurisdictionCode: systemText({ required: true }),
    description: systemText(),
    versions: (0, import_fields10.relationship)({ ref: "PolicyVersion.pack", many: true, ...readOnly }),
    bindings: (0, import_fields10.relationship)({ ref: "PolicyBinding.pack", many: true, ...readOnly }),
    ...trackingFields
  }
});
var PolicyVersion = (0, import_core10.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "contentHash", listView: { initialColumns: ["pack", "versionNumber", "status", "effectiveFrom", "effectiveTo", "verifiedAt"] } },
  fields: {
    pack: (0, import_fields10.relationship)({ ref: "PolicyPack.versions", ...readOnly }),
    versionNumber: (0, import_fields10.integer)({ validation: { isRequired: true, min: 1 }, ...readOnly }),
    effectiveFrom: (0, import_fields10.calendarDay)({ validation: { isRequired: true }, ...readOnly }),
    effectiveTo: (0, import_fields10.calendarDay)({ ...readOnly, ui: { ...readOnly.ui, description: "Exclusive. Empty means open-ended." } }),
    rules: (0, import_fields10.json)({ ...readOnly, ui: { ...readOnly.ui, description: "Validated against the Zod schema for the pack kind (domain/policySchemas.ts)." } }),
    sourceRefs: (0, import_fields10.json)({ ...readOnly, ui: { ...readOnly.ui, description: 'Citations for every rule, e.g. "16 CFR 429.1(a)".' } }),
    verifiedBy: (0, import_fields10.text)({ ...readOnly }),
    verifiedAt: (0, import_fields10.timestamp)({ ...readOnly }),
    status: lifecycle(["draft", "pending_approval", "active", "retired"]),
    approval: (0, import_fields10.relationship)({ ref: "ApprovalRequest", ...readOnly }),
    contentHash: systemText({ required: true }),
    version: versionField(),
    ...trackingFields
  }
});
var PolicyBinding = (0, import_core10.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "scopeValue", listView: { initialColumns: ["pack", "scope", "scopeValue", "priority", "status"] } },
  fields: {
    pack: (0, import_fields10.relationship)({ ref: "PolicyPack.bindings", ...readOnly }),
    scope: fixedChoice(["company", "branch", "state", "county", "city", "zip"]),
    scopeValue: systemText({ required: true }),
    branch: (0, import_fields10.relationship)({ ref: "Branch.policyBindings", ...readOnly }),
    priority: (0, import_fields10.integer)({ defaultValue: 0, ...readOnly }),
    status: lifecycle(["active", "retired"]),
    version: versionField(),
    ...trackingFields
  }
});

// features/keystone/models/agents.ts
var agents_exports = {};
__export(agents_exports, {
  AGENT_AUTONOMY: () => AGENT_AUTONOMY,
  AgentAction: () => AgentAction,
  AgentIdentity: () => AgentIdentity,
  AgentRun: () => AgentRun,
  AgentScopeGrant: () => AgentScopeGrant
});
var import_core11 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");
init_access();
var AGENT_AUTONOMY = ["disabled", "propose_only", "auto_within_policy"];
var AgentIdentity = (0, import_core11.list)({
  access: { operation: { query: permissions.canAccessDashboard, create: () => false, update: () => false, delete: () => false } },
  ui: { labelField: "name", listView: { initialColumns: ["name", "kind", "status", "killSwitch", "owner"] } },
  fields: {
    name: (0, import_fields11.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    kind: choice(["llm_agent", "rules_engine", "external_mcp_client"], "llm_agent"),
    provider: (0, import_fields11.text)(),
    modelRef: (0, import_fields11.text)(),
    owner: (0, import_fields11.relationship)({ ref: "User" }),
    oauthApp: (0, import_fields11.relationship)({ ref: "OAuthApp" }),
    status: lifecycle(["active", "paused", "revoked"]),
    killSwitch: (0, import_fields11.checkbox)({ defaultValue: false, ...readOnly, ui: { ...readOnly.ui, description: "When on, every tool call is refused before it runs." } }),
    limits: (0, import_fields11.json)({ ...readOnly, ui: { ...readOnly.ui, description: 'Rate and amount limits, e.g. {"actionsPerHour":120}.' } }),
    grants: (0, import_fields11.relationship)({ ref: "AgentScopeGrant.agent", many: true, ...readOnly }),
    runs: (0, import_fields11.relationship)({ ref: "AgentRun.agent", many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var AgentScopeGrant = (0, import_core11.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "tool", listView: { initialColumns: ["agent", "tool", "autonomy", "status", "effectiveFrom", "revokedAt"] } },
  fields: {
    agent: (0, import_fields11.relationship)({ ref: "AgentIdentity.grants", ...readOnly }),
    tool: systemText({ indexed: true, required: true }),
    autonomy: fixedChoice(AGENT_AUTONOMY),
    constraints: (0, import_fields11.json)({ ...readOnly, ui: { ...readOnly.ui, description: 'Limits, e.g. {"businessUnits":["HVAC-SVC"],"maxQuoteMinor":"250000"}.' } }),
    status: lifecycle(["requested", "active", "revoked"]),
    grantedBy: (0, import_fields11.relationship)({ ref: "User", ...readOnly }),
    approval: (0, import_fields11.relationship)({ ref: "ApprovalRequest", ...readOnly }),
    effectiveFrom: (0, import_fields11.timestamp)({ ...readOnly }),
    revokedAt: (0, import_fields11.timestamp)({ ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var AgentRun = (0, import_core11.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "trigger", listView: { initialColumns: ["agent", "trigger", "status", "startedAt", "endedAt"] } },
  fields: {
    agent: (0, import_fields11.relationship)({ ref: "AgentIdentity.runs", ...readOnly }),
    trigger: fixedChoice(["inbound_call", "inbound_sms", "schedule", "user_request", "webhook"]),
    callRef: systemText({ indexed: true }),
    startedAt: (0, import_fields11.timestamp)({ defaultValue: { kind: "now" }, ...readOnly }),
    endedAt: (0, import_fields11.timestamp)({ ...readOnly }),
    status: lifecycle(["started", "completed", "failed", "aborted"]),
    tokenUsage: (0, import_fields11.json)({ ...readOnly }),
    costMinor: minor(),
    actions: (0, import_fields11.relationship)({ ref: "AgentAction.run", many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var AgentAction = (0, import_core11.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "tool", listView: { initialColumns: ["tool", "status", "run", "createdAt"] } },
  fields: {
    run: (0, import_fields11.relationship)({ ref: "AgentRun.actions", ...readOnly }),
    agent: (0, import_fields11.relationship)({ ref: "AgentIdentity", ...readOnly }),
    tool: systemText({ indexed: true, required: true }),
    idempotencyKey: systemText({ indexed: "unique", required: true }),
    inputsHash: systemText({ required: true }),
    inputsProvenance: (0, import_fields11.json)({ ...readOnly }),
    output: costGuardedJson({ ...readOnly }),
    reasoningSummary: systemText(),
    status: lifecycle(["proposed", "awaiting_approval", "approved", "rejected", "applied", "failed", "expired"]),
    approval: (0, import_fields11.relationship)({ ref: "ApprovalRequest", ...readOnly }),
    appliedEffects: (0, import_fields11.json)({ ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});

// features/keystone/models/people.ts
var people_exports = {};
__export(people_exports, {
  CREDENTIAL_KINDS: () => CREDENTIAL_KINDS,
  Credential: () => Credential,
  Crew: () => Crew,
  EMPLOYEE_KINDS: () => EMPLOYEE_KINDS,
  EPA_TYPES: () => EPA_TYPES,
  EligibilityEvaluation: () => EligibilityEvaluation,
  Employee: () => Employee,
  JobTypeRequirement: () => JobTypeRequirement,
  OnCallRotation: () => OnCallRotation,
  Shift: () => Shift,
  ShiftTemplate: () => ShiftTemplate,
  Skill: () => Skill
});
var import_core12 = require("@keystone-6/core");
var import_fields12 = require("@keystone-6/core/fields");
init_access();
var EMPLOYEE_KINDS = ["technician", "csr", "dispatcher", "sales", "manager", "warehouse", "office", "apprentice"];
var Employee = (0, import_core12.list)({
  access: managed("signedIn", "canManagePeople"),
  ui: { labelField: "displayName", listView: { initialColumns: ["displayName", "kind", "homeBranch", "employmentType", "status"] } },
  fields: {
    user: (0, import_fields12.relationship)({ ref: "User" }),
    firstName: (0, import_fields12.text)({ validation: { isRequired: true } }),
    lastName: (0, import_fields12.text)({ validation: { isRequired: true } }),
    displayName: (0, import_fields12.text)({ validation: { isRequired: true } }),
    employeeNumber: (0, import_fields12.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    homeBranch: (0, import_fields12.relationship)({ ref: "Branch" }),
    businessUnits: (0, import_fields12.relationship)({ ref: "BusinessUnit", many: true }),
    kind: choice(EMPLOYEE_KINDS, "technician"),
    employmentType: choice(["w2_hourly", "w2_salaried_exempt", "w2_salaried_nonexempt", "contractor_1099"], "w2_hourly"),
    hireDate: (0, import_fields12.calendarDay)(),
    terminationDate: (0, import_fields12.calendarDay)(),
    skills: (0, import_fields12.relationship)({ ref: "Skill", many: true }),
    credentials: (0, import_fields12.relationship)({ ref: "Credential.employee", many: true, ...readOnly }),
    phoneE164: (0, import_fields12.text)({ validation: { match: { regex: /^(\+[1-9]\d{7,14})?$/, explanation: "E.164, like +15125550123" } } }),
    email: (0, import_fields12.text)(),
    lat: geo({ description: "Start-of-day latitude (home or shop), used for drive estimates." }),
    lng: geo({ description: "Start-of-day longitude." }),
    dispatchable: (0, import_fields12.checkbox)({ defaultValue: true, ui: { description: "Shown on the dispatch board." } }),
    status: choice(["active", "on_leave", "terminated"], "active"),
    ...trackingFields
  }
});
var CREDENTIAL_KINDS = ["state_trade_license", "epa_608", "nate", "manufacturer", "backflow", "osha", "driver_license", "other"];
var EPA_TYPES = ["none", "type_i", "type_ii", "type_iii", "universal"];
var Credential = (0, import_core12.list)({
  access: {
    operation: { query: anyOf("canManagePeople", "canDispatch", "canViewBoard", "canWorkVisits"), create: anyOf("canManagePeople"), update: anyOf("canManagePeople"), delete: () => false },
    filter: {
      query: ({ session }) => {
        if (!isSignedIn({ session })) return false;
        const role = session.data.role ?? {};
        if (role.canManagePeople || role.canDispatch || role.canViewBoard) return true;
        return { employee: { user: { id: { equals: session.itemId } } } };
      }
    }
  },
  ui: { labelField: "number", listView: { initialColumns: ["employee", "kind", "trade", "licenseClass", "epaType", "expiresOn", "status"] } },
  fields: {
    employee: (0, import_fields12.relationship)({ ref: "Employee.credentials" }),
    kind: choice(CREDENTIAL_KINDS, "state_trade_license"),
    trade: choice(["hvac", "plumbing", "electrical", "general"], "general"),
    jurisdictionCode: (0, import_fields12.text)({ defaultValue: "US-TX", validation: { match: { regex: /^([A-Z]{2}(-[A-Z0-9]{2,})*)?$/, explanation: "Like US-TX" } } }),
    issuer: (0, import_fields12.text)({ ui: { description: "TDLR, TSBPE, EPA-approved certifying organisation, NATE\u2026" } }),
    number: (0, import_fields12.text)(),
    licenseClass: (0, import_fields12.text)({ ui: { description: "Texas class code: acr_certified_technician, acr_registered_technician, plumber_apprentice, tradesman_plumber, journeyman_plumber, master_plumber, electrical_apprentice, journeyman_electrician, master_electrician, residential_wireman." } }),
    epaType: choice(EPA_TYPES, "none"),
    endorsements: (0, import_fields12.json)({ defaultValue: [] }),
    issuedOn: (0, import_fields12.calendarDay)(),
    expiresOn: (0, import_fields12.calendarDay)({ ui: { description: "An expired credential stops new assignments only (I-P2)." } }),
    evidence: (0, import_fields12.relationship)({ ref: "Document" }),
    verifiedBy: (0, import_fields12.relationship)({ ref: "User", ...readOnly }),
    verifiedAt: (0, import_fields12.timestamp)({ ...readOnly }),
    status: lifecycle(["pending_verification", "verified", "expired", "revoked"]),
    version: versionField(),
    ...trackingFields
  }
});
var Skill = (0, import_core12.list)({
  access: managed("signedIn", "canManagePeople"),
  ui: { labelField: "name" },
  fields: {
    code: (0, import_fields12.text)({ isIndexed: "unique", validation: { isRequired: true, match: { regex: /^[a-z0-9_]{2,40}$/, explanation: "lower_snake_case" } } }),
    name: (0, import_fields12.text)({ validation: { isRequired: true } }),
    trade: choice(["hvac", "plumbing", "electrical", "general"], "general"),
    ...trackingFields
  }
});
var JobTypeRequirement = (0, import_core12.list)({
  access: managed("signedIn", "canManageCompany"),
  ui: { labelField: "name" },
  fields: {
    name: (0, import_fields12.text)({ validation: { isRequired: true } }),
    licensingTags: (0, import_fields12.json)({ defaultValue: [], ui: { description: 'Job tags in the licensing policy pack, e.g. ["acr_service","refrigerant_handling"].' } }),
    requiredCredentialKinds: (0, import_fields12.json)({ defaultValue: [], ui: { description: 'Extra credential kinds every assigned tech must hold, e.g. ["backflow"].' } }),
    requiresSupervisorOnJob: (0, import_fields12.checkbox)({ defaultValue: false }),
    maxCoolingTons: qty(),
    maxHeatingBtuh: (0, import_fields12.integer)(),
    skills: (0, import_fields12.relationship)({ ref: "Skill", many: true }),
    ...trackingFields
  }
});
var EligibilityEvaluation = (0, import_core12.list)({
  access: immutable(["canDispatch", "canViewBoard", "canManagePeople"]),
  ui: { labelField: "result", listView: { initialColumns: ["visit", "employee", "result", "evaluatedAt"] } },
  fields: {
    visit: (0, import_fields12.relationship)({ ref: "Visit", ...readOnly }),
    employee: (0, import_fields12.relationship)({ ref: "Employee", ...readOnly }),
    policyVersion: (0, import_fields12.relationship)({ ref: "PolicyVersion", ...readOnly }),
    result: fixedChoice(["eligible", "ineligible", "override"]),
    findings: (0, import_fields12.json)({ ...readOnly }),
    evaluatedAt: (0, import_fields12.timestamp)({ ...readOnly }),
    overrideApproval: (0, import_fields12.relationship)({ ref: "ApprovalRequest", ...readOnly }),
    ...trackingFields
  }
});
var Crew = (0, import_core12.list)({
  access: managed("signedIn", ["canDispatch", "canManagePeople"]),
  ui: { labelField: "name" },
  fields: {
    name: (0, import_fields12.text)({ validation: { isRequired: true } }),
    lead: (0, import_fields12.relationship)({ ref: "Employee" }),
    members: (0, import_fields12.relationship)({ ref: "Employee", many: true }),
    businessUnit: (0, import_fields12.relationship)({ ref: "BusinessUnit" }),
    ...trackingFields
  }
});
var LOCAL_TIME = { regex: /^([01]\d|2[0-3]):[0-5]\d$/, explanation: "HH:MM, 24-hour" };
var ShiftTemplate = (0, import_core12.list)({
  access: managed("signedIn", ["canDispatch", "canManagePeople"]),
  ui: { labelField: "startLocal", listView: { initialColumns: ["employee", "weekday", "startLocal", "endLocal"] } },
  fields: {
    employee: (0, import_fields12.relationship)({ ref: "Employee" }),
    weekday: (0, import_fields12.integer)({ validation: { isRequired: true, min: 0, max: 6 }, ui: { description: "0 = Sunday" } }),
    startLocal: (0, import_fields12.text)({ validation: { isRequired: true, match: LOCAL_TIME } }),
    endLocal: (0, import_fields12.text)({ validation: { isRequired: true, match: LOCAL_TIME } }),
    ...trackingFields
  }
});
var Shift = (0, import_core12.list)({
  access: governed(["canDispatch", "canViewBoard", "canManagePeople", "canWorkVisits"]),
  ui: { labelField: "date", listView: { initialColumns: ["employee", "date", "startsAt", "endsAt", "kind"] } },
  fields: {
    employee: (0, import_fields12.relationship)({ ref: "Employee", ...readOnly }),
    date: (0, import_fields12.calendarDay)({ validation: { isRequired: true }, ...readOnly }),
    startsAt: (0, import_fields12.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    endsAt: (0, import_fields12.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    kind: fixedChoice(["regular", "on_call", "overtime"]),
    ...trackingFields
  }
});
var OnCallRotation = (0, import_core12.list)({
  access: managed("signedIn", ["canDispatch", "canManagePeople"]),
  ui: { labelField: "phoneE164", listView: { initialColumns: ["businessUnit", "employee", "startsAt", "endsAt", "escalationOrder"] } },
  fields: {
    businessUnit: (0, import_fields12.relationship)({ ref: "BusinessUnit" }),
    employee: (0, import_fields12.relationship)({ ref: "Employee" }),
    startsAt: (0, import_fields12.timestamp)({ validation: { isRequired: true } }),
    endsAt: (0, import_fields12.timestamp)({ validation: { isRequired: true } }),
    phoneE164: (0, import_fields12.text)({ validation: { isRequired: true, match: { regex: /^\+[1-9]\d{7,14}$/, explanation: "E.164" } } }),
    escalationOrder: (0, import_fields12.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1, max: 9 } }),
    ...trackingFields
  }
});

// features/keystone/models/crm.ts
var crm_exports = {};
__export(crm_exports, {
  AccessSecret: () => AccessSecret,
  AccessSecretReveal: () => AccessSecretReveal,
  CONSENT_PURPOSES: () => CONSENT_PURPOSES,
  ConsentRecord: () => ConsentRecord,
  Contact: () => Contact,
  ContactPoint: () => ContactPoint,
  Customer: () => Customer,
  DncEntry: () => DncEntry,
  LocationContact: () => LocationContact,
  LocationOwnership: () => LocationOwnership,
  ServiceLocation: () => ServiceLocation
});
var import_core13 = require("@keystone-6/core");
var import_fields13 = require("@keystone-6/core/fields");
init_access();

// features/keystone/models/scope.ts
init_access();
var has = (session, names) => names.some((name) => session?.data.role?.[name] === true);
var OFFICE_READ = ["canManageCustomers", "canBook", "canViewBoard", "canDispatch", "canManageInvoices", "canManageLeads"];
var assignedTo = (userId) => ({ some: { active: { equals: true }, employee: { user: { id: { equals: userId } } } } });
var visitFilter = (userId) => ({ assignments: assignedTo(userId) });
var WEEK_MS = 7 * 24 * 60 * 60 * 1e3;
var jobFilter = (userId, windowed = false) => ({
  visits: { some: { ...visitFilter(userId), ...windowed ? { plannedStart: { gte: new Date(Date.now() - WEEK_MS), lte: new Date(Date.now() + WEEK_MS) } } : {} } }
});
var officeOrTech = (extra = []) => ({ session }) => isSignedIn({ session }) && (has(session, [...OFFICE_READ, ...extra]) || has(session, ["canWorkVisits"]));
var scoped = (own, extra = []) => ({ session }) => {
  if (!isSignedIn({ session })) return false;
  if (has(session, [...OFFICE_READ, ...extra])) return true;
  if (has(session, ["canWorkVisits"])) return own(session.itemId);
  return false;
};

// features/keystone/models/crm.ts
var techCustomer = (userId) => ({ jobs: { some: jobFilter(userId, true) } });
var techLocation = (userId) => ({ jobs: { some: jobFilter(userId, true) } });
var piiRead = anyOf("canReadCustomerPII", "canBook", "canDispatch", "canWorkVisits");
var Customer = (0, import_core13.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: permissions.canManageCustomers, delete: sys },
    filter: { query: scoped(techCustomer) }
  },
  ui: { labelField: "displayName", listView: { initialColumns: ["ref", "displayName", "kind", "doNotService", "createdAt"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    kind: choice(["residential", "commercial"], "residential"),
    displayName: (0, import_fields13.text)({ validation: { isRequired: true } }),
    organizationName: (0, import_fields13.text)(),
    primaryContact: (0, import_fields13.relationship)({ ref: "Contact" }),
    contacts: (0, import_fields13.relationship)({ ref: "Contact.customer", many: true, ...readOnly }),
    locations: (0, import_fields13.relationship)({ ref: "ServiceLocation.customer", many: true, ...readOnly }),
    jobs: (0, import_fields13.relationship)({ ref: "Job.customer", many: true, ...readOnly }),
    billingLine1: (0, import_fields13.text)(),
    billingLine2: (0, import_fields13.text)(),
    billingCity: (0, import_fields13.text)(),
    billingRegion: (0, import_fields13.text)(),
    billingPostalCode: (0, import_fields13.text)(),
    taxExemptCertificate: (0, import_fields13.relationship)({ ref: "Document" }),
    tags: (0, import_fields13.relationship)({ ref: "Tag", many: true }),
    doNotService: (0, import_fields13.checkbox)({ defaultValue: false }),
    doNotServiceReason: (0, import_fields13.text)(),
    mergedInto: (0, import_fields13.relationship)({ ref: "Customer", ...readOnly }),
    source: (0, import_fields13.relationship)({ ref: "Campaign", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var Contact = (0, import_core13.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: permissions.canManageCustomers, delete: sys },
    filter: { query: scoped((userId) => ({ customer: techCustomer(userId) })) }
  },
  ui: { labelField: "lastName", listView: { initialColumns: ["firstName", "lastName", "role", "customer"] } },
  fields: {
    customer: (0, import_fields13.relationship)({ ref: "Customer.contacts", ...readOnly }),
    firstName: (0, import_fields13.text)(),
    lastName: (0, import_fields13.text)(),
    role: choice(["owner", "spouse", "tenant", "property_manager", "billing", "site_contact", "other"], "owner"),
    points: (0, import_fields13.relationship)({ ref: "ContactPoint.contact", many: true, ...readOnly }),
    preferredLanguage: (0, import_fields13.text)({ defaultValue: "en" }),
    ...trackingFields
  }
});
var ContactPoint = (0, import_core13.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: sys, delete: sys },
    filter: { query: scoped((userId) => ({ contact: { customer: techCustomer(userId) } })) }
  },
  ui: { labelField: "kind", listView: { initialColumns: ["contact", "kind", "value", "isPrimary", "carrierLineType"] } },
  fields: {
    contact: (0, import_fields13.relationship)({ ref: "Contact.points", ...readOnly }),
    kind: fixedChoice(["mobile", "landline", "email"]),
    value: (0, import_fields13.text)({ validation: { isRequired: true }, access: { read: piiRead, create: () => false, update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    valueHash: systemText({ indexed: true, required: true }),
    verifiedAt: (0, import_fields13.timestamp)({ ...readOnly }),
    isPrimary: (0, import_fields13.checkbox)({ defaultValue: false, ...readOnly }),
    carrierLineType: fixedChoice(["unknown", "mobile", "landline", "voip"]),
    consents: (0, import_fields13.relationship)({ ref: "ConsentRecord.contactPoint", many: true, ...readOnly }),
    ...trackingFields
  }
});
var CONSENT_PURPOSES = ["transactional_sms", "transactional_voice", "marketing_sms", "marketing_email", "marketing_voice", "ai_voice_outbound", "call_recording", "auto_renewal"];
var ConsentRecord = (0, import_core13.list)({
  access: immutable(["canManageCustomers", "canBook", "canSendMessages", "canDispatch"]),
  ui: { labelField: "purpose", listView: { initialColumns: ["contactPoint", "purpose", "action", "channel", "recordedAt"] } },
  fields: {
    contactPoint: (0, import_fields13.relationship)({ ref: "ContactPoint.consents", ...readOnly }),
    purpose: fixedChoice(CONSENT_PURPOSES),
    action: fixedChoice(["grant", "revoke"]),
    channel: fixedChoice(["web_form", "portal", "phone", "sms_keyword", "paper", "in_person", "import"]),
    evidence: (0, import_fields13.json)({ ...readOnly }),
    wordingVersion: systemText(),
    policyVersion: (0, import_fields13.relationship)({ ref: "PolicyVersion", ...readOnly }),
    recordedAt: (0, import_fields13.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    actorKind: fixedChoice(["user", "agent", "system", "customer", "webhook"]),
    actorId: systemText(),
    ...trackingFields
  }
});
var DncEntry = (0, import_core13.list)({
  access: immutable(["canManageCustomers", "canSendMessages", "canManageCampaigns"]),
  ui: { labelField: "valueHash", listView: { initialColumns: ["kind", "source", "addedAt"] } },
  fields: {
    valueHash: systemText({ indexed: true, required: true }),
    kind: fixedChoice(["internal", "national_cache"]),
    source: systemText(),
    addedAt: (0, import_fields13.timestamp)({ ...readOnly }),
    ...trackingFields
  }
});
var ServiceLocation = (0, import_core13.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: permissions.canManageCustomers, delete: sys },
    filter: { query: scoped(techLocation) }
  },
  ui: { labelField: "address1", listView: { initialColumns: ["ref", "address1", "city", "postalCode", "customer", "serviceArea", "geocodeQuality"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    customer: (0, import_fields13.relationship)({ ref: "Customer.locations", ...readOnly }),
    address1: (0, import_fields13.text)({ validation: { isRequired: true } }),
    address2: (0, import_fields13.text)(),
    city: (0, import_fields13.text)({ validation: { isRequired: true } }),
    state: (0, import_fields13.text)({ defaultValue: "TX", validation: { isRequired: true, match: { regex: /^[A-Z]{2}$/, explanation: "Two-letter state code" } } }),
    county: (0, import_fields13.text)(),
    postalCode: (0, import_fields13.text)({ validation: { isRequired: true, match: { regex: /^\d{5}(-\d{4})?$/, explanation: "ZIP or ZIP+4" } } }),
    country: (0, import_fields13.text)({ defaultValue: "US" }),
    lat: geo({ ...readOnly }),
    lng: geo({ ...readOnly }),
    geocodeQuality: fixedChoice(["rooftop", "interpolated", "zip", "failed"]),
    timeZone: systemText({ required: true }),
    serviceArea: (0, import_fields13.relationship)({ ref: "ServiceArea", ...readOnly }),
    propertyClass: choice(["residential", "nonresidential", "multiple_use"], "residential"),
    propertyType: choice(["single_family", "townhome", "condo", "multifamily", "mobile_home", "commercial"], "single_family"),
    yearBuilt: (0, import_fields13.integer)({ validation: { min: 1800, max: 2100 } }),
    squareFeet: (0, import_fields13.integer)({ validation: { min: 0 } }),
    contacts: (0, import_fields13.relationship)({ ref: "LocationContact.location", many: true, ...readOnly }),
    accessSecrets: (0, import_fields13.relationship)({ ref: "AccessSecret.location", many: true, ...readOnly }),
    jobs: (0, import_fields13.relationship)({ ref: "Job.location", many: true, ...readOnly }),
    mergedInto: (0, import_fields13.relationship)({ ref: "ServiceLocation", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var LocationOwnership = (0, import_core13.list)({
  access: immutable(["canManageCustomers", "canBook"]),
  ui: { labelField: "reason" },
  fields: {
    location: (0, import_fields13.relationship)({ ref: "ServiceLocation", ...readOnly }),
    customer: (0, import_fields13.relationship)({ ref: "Customer", ...readOnly }),
    from: (0, import_fields13.calendarDay)({ ...readOnly }),
    to: (0, import_fields13.calendarDay)({ ...readOnly }),
    reason: fixedChoice(["purchase", "sale", "tenant_change", "import", "created"]),
    ...trackingFields
  }
});
var LocationContact = (0, import_core13.list)({
  access: governed(["canManageCustomers", "canBook", "canDispatch"]),
  ui: { labelField: "role" },
  fields: {
    location: (0, import_fields13.relationship)({ ref: "ServiceLocation.contacts", ...readOnly }),
    contact: (0, import_fields13.relationship)({ ref: "Contact", ...readOnly }),
    role: fixedChoice(["owner", "tenant", "property_manager", "site_contact"]),
    canAuthorizeWork: (0, import_fields13.checkbox)({ defaultValue: true, ...readOnly }),
    nteMinor: minor({ description: "Not-to-exceed this contact may authorise, in cents." }),
    ...trackingFields
  }
});
var AccessSecret = (0, import_core13.list)({
  access: {
    operation: { query: anyOf("canManageCustomers", "canDispatch", "canRevealAccessSecret"), create: sys, update: sys, delete: sys },
    filter: { query: ({ session }) => isSignedIn({ session }) ? true : false }
  },
  ui: { labelField: "label", listView: { initialColumns: ["location", "kind", "label", "status"] } },
  fields: {
    location: (0, import_fields13.relationship)({ ref: "ServiceLocation.accessSecrets", ...readOnly }),
    kind: fixedChoice(["gate_code", "lockbox", "alarm", "garage", "pet", "other"]),
    label: systemText({ required: true }),
    secretRef: (0, import_fields13.text)({ access: { read: () => false, create: () => false, update: () => false }, ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" } } }),
    status: lifecycle(["active", "retired"]),
    reveals: (0, import_fields13.relationship)({ ref: "AccessSecretReveal.secret", many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var AccessSecretReveal = (0, import_core13.list)({
  access: immutable(["canManageCustomers", "canReadAudit"]),
  ui: { labelField: "revealedAt", listView: { initialColumns: ["secret", "revealedTo", "visit", "revealedAt", "expiresAt"] } },
  fields: {
    secret: (0, import_fields13.relationship)({ ref: "AccessSecret.reveals", ...readOnly }),
    revealedTo: (0, import_fields13.relationship)({ ref: "User", ...readOnly }),
    visit: (0, import_fields13.relationship)({ ref: "Visit", ...readOnly }),
    revealedAt: (0, import_fields13.timestamp)({ ...readOnly }),
    expiresAt: (0, import_fields13.timestamp)({ ...readOnly }),
    reason: systemText(),
    ...trackingFields
  }
});

// features/keystone/models/demand.ts
var demand_exports = {};
__export(demand_exports, {
  CALL_DISPOSITIONS: () => CALL_DISPOSITIONS,
  CAMPAIGN_CHANNELS: () => CAMPAIGN_CHANNELS,
  Call: () => Call,
  Campaign: () => Campaign,
  Conversation: () => Conversation,
  LEAD_SOURCES: () => LEAD_SOURCES,
  LEAD_STATUSES: () => LEAD_STATUSES,
  LOST_REASONS: () => LOST_REASONS,
  Lead: () => Lead,
  MESSAGE_BLOCK_REASONS: () => MESSAGE_BLOCK_REASONS,
  Message: () => Message,
  Opportunity: () => Opportunity,
  TrackingNumber: () => TrackingNumber
});
var import_core14 = require("@keystone-6/core");
var import_fields14 = require("@keystone-6/core/fields");
init_access();
var CAMPAIGN_CHANNELS = ["google_lsa", "google_ads", "seo", "direct_mail", "referral", "yard_sign", "truck_wrap", "tv_radio", "marketplace", "repeat", "tech_generated", "other"];
var Campaign = (0, import_core14.list)({
  access: managed(["canManageCampaigns", "canManageLeads", "canBook"], "canManageCampaigns"),
  ui: { labelField: "name", listView: { initialColumns: ["name", "channel", "active"] } },
  fields: {
    name: (0, import_fields14.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    channel: choice(CAMPAIGN_CHANNELS, "other"),
    monthlyCostMinor: minor({ defaultValue: 0n, description: "Planned monthly spend in cents (actuals arrive with the accounting export)." }),
    active: (0, import_fields14.checkbox)({ defaultValue: true }),
    trackingNumbers: (0, import_fields14.relationship)({ ref: "TrackingNumber.campaign", many: true }),
    ...trackingFields
  }
});
var TrackingNumber = (0, import_core14.list)({
  access: managed(["canManageCampaigns", "canManageLeads", "canBook"], "canManageCampaigns"),
  ui: { labelField: "phoneE164", listView: { initialColumns: ["phoneE164", "campaign", "provider", "businessUnit"] } },
  fields: {
    phoneE164: (0, import_fields14.text)({ isIndexed: "unique", validation: { isRequired: true, match: { regex: /^\+[1-9]\d{7,14}$/, explanation: "E.164" } } }),
    campaign: (0, import_fields14.relationship)({ ref: "Campaign.trackingNumbers" }),
    provider: (0, import_fields14.text)({ defaultValue: "manual" }),
    forwardTo: (0, import_fields14.text)(),
    businessUnit: (0, import_fields14.relationship)({ ref: "BusinessUnit" }),
    ...trackingFields
  }
});
var LEAD_SOURCES = ["call", "sms", "web_form", "online_booking", "lsa", "marketplace", "tech_generated", "membership", "import", "ai_agent"];
var LEAD_STATUSES = ["new", "contacted", "qualified", "booked", "converted", "lost", "spam", "merged"];
var LOST_REASONS = ["price", "timing", "out_of_area", "no_answer", "competitor", "not_serviceable", "duplicate", "other"];
var Lead = (0, import_core14.list)({
  access: governed(["canManageLeads", "canBook"]),
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "contactName", "source", "status", "requestedJobType", "createdAt"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    source: fixedChoice(LEAD_SOURCES),
    campaign: (0, import_fields14.relationship)({ ref: "Campaign", ...readOnly }),
    trackingNumber: (0, import_fields14.relationship)({ ref: "TrackingNumber", ...readOnly }),
    externalId: systemText(),
    customer: (0, import_fields14.relationship)({ ref: "Customer", ...readOnly }),
    location: (0, import_fields14.relationship)({ ref: "ServiceLocation", ...readOnly }),
    contactName: systemText(),
    phoneE164: (0, import_fields14.text)({ access: { read: anyOf("canReadCustomerPII", "canBook", "canManageLeads"), create: () => false, update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    email: (0, import_fields14.text)({ access: { read: anyOf("canReadCustomerPII", "canBook", "canManageLeads"), create: () => false, update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    requestedJobType: (0, import_fields14.relationship)({ ref: "JobType", ...readOnly }),
    summary: systemText(),
    status: lifecycle(LEAD_STATUSES),
    lostReason: fixedChoice(["", ...LOST_REASONS]),
    firstResponseSeconds: (0, import_fields14.integer)({ ...readOnly }),
    respondDueAt: (0, import_fields14.timestamp)({ ...readOnly }),
    job: (0, import_fields14.relationship)({ ref: "Job", ...readOnly }),
    mergedInto: (0, import_fields14.relationship)({ ref: "Lead", ...readOnly }),
    assignedTo: (0, import_fields14.relationship)({ ref: "User", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var Conversation = (0, import_core14.list)({
  access: governed(["canManageLeads", "canBook", "canSendMessages", "canDispatch"]),
  ui: { labelField: "channel", listView: { initialColumns: ["customer", "channel", "status", "updatedAt"] } },
  fields: {
    customer: (0, import_fields14.relationship)({ ref: "Customer", ...readOnly }),
    contactPoint: (0, import_fields14.relationship)({ ref: "ContactPoint", ...readOnly }),
    channel: fixedChoice(["voice", "sms", "email", "chat"]),
    status: lifecycle(["open", "waiting_customer", "waiting_staff", "closed"]),
    assignedTo: (0, import_fields14.relationship)({ ref: "User", ...readOnly }),
    lead: (0, import_fields14.relationship)({ ref: "Lead", ...readOnly }),
    job: (0, import_fields14.relationship)({ ref: "Job", ...readOnly }),
    calls: (0, import_fields14.relationship)({ ref: "Call.conversation", many: true, ...readOnly }),
    messages: (0, import_fields14.relationship)({ ref: "Message.conversation", many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var CALL_DISPOSITIONS = ["", "booked", "not_booked", "existing_job", "spam", "emergency_paged", "transferred"];
var Call = (0, import_core14.list)({
  access: governed(["canManageLeads", "canBook", "canDispatch"]),
  ui: { labelField: "providerCallId", listView: { initialColumns: ["startedAt", "direction", "fromMasked", "answeredBy", "disposition", "status"] } },
  fields: {
    conversation: (0, import_fields14.relationship)({ ref: "Conversation.calls", ...readOnly }),
    direction: fixedChoice(["inbound", "outbound"]),
    providerCallId: systemText({ indexed: "unique", required: true }),
    provider: systemText(),
    from: (0, import_fields14.text)({ access: { read: anyOf("canReadCustomerPII", "canBook"), create: () => false, update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    fromMasked: systemText(),
    to: systemText(),
    trackingNumber: (0, import_fields14.relationship)({ ref: "TrackingNumber", ...readOnly }),
    startedAt: (0, import_fields14.timestamp)({ ...readOnly }),
    endedAt: (0, import_fields14.timestamp)({ ...readOnly }),
    durationSeconds: (0, import_fields14.integer)({ ...readOnly }),
    answeredBy: fixedChoice(["human", "ai_agent", "voicemail", "ivr"]),
    agentRun: (0, import_fields14.relationship)({ ref: "AgentRun", ...readOnly }),
    recording: (0, import_fields14.relationship)({ ref: "Media", ...readOnly }),
    transcript: (0, import_fields14.json)({ ...readOnly, ui: { ...readOnly.ui, description: "Turns as [{speaker, text, at}]. Card numbers are never spoken on our calls (payment links only)." } }),
    recordingDisclosurePlayed: (0, import_fields14.checkbox)({ defaultValue: false, ...readOnly }),
    emergency: (0, import_fields14.json)({ ...readOnly }),
    summary: systemText(),
    disposition: fixedChoice(CALL_DISPOSITIONS),
    bookable: (0, import_fields14.checkbox)({ defaultValue: false, ...readOnly }),
    lead: (0, import_fields14.relationship)({ ref: "Lead", ...readOnly }),
    job: (0, import_fields14.relationship)({ ref: "Job", ...readOnly }),
    status: lifecycle(["ringing", "ai_answering", "human_answering", "handoff_requested", "completed"]),
    version: versionField(),
    ...trackingFields
  }
});
var MESSAGE_BLOCK_REASONS = ["", "no_consent", "dnc", "quiet_hours", "unregistered_10dlc", "opted_out", "policy_unresolved"];
var Message = (0, import_core14.list)({
  access: governed(["canSendMessages", "canBook", "canDispatch", "canManageLeads"]),
  ui: { labelField: "template", listView: { initialColumns: ["createdAt", "direction", "purpose", "template", "status", "blockedReason"] } },
  fields: {
    conversation: (0, import_fields14.relationship)({ ref: "Conversation.messages", ...readOnly }),
    contactPoint: (0, import_fields14.relationship)({ ref: "ContactPoint", ...readOnly }),
    direction: fixedChoice(["inbound", "outbound"]),
    channel: fixedChoice(["sms", "email"]),
    purpose: fixedChoice(["transactional", "marketing", "internal"]),
    consentPurpose: systemText(),
    template: systemText(),
    body: (0, import_fields14.text)({ access: { read: anyOf("canSendMessages", "canBook", "canDispatch", "canManageLeads"), create: () => false, update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    status: lifecycle(["queued", "sending", "blocked", "sent", "manual", "delivered", "failed", "undeliverable", "received"]),
    blockedReason: fixedChoice(MESSAGE_BLOCK_REASONS),
    guardFindings: (0, import_fields14.json)({ ...readOnly }),
    providerMessageId: systemText({ indexed: true }),
    job: (0, import_fields14.relationship)({ ref: "Job", ...readOnly }),
    visit: (0, import_fields14.relationship)({ ref: "Visit", ...readOnly }),
    sentAt: (0, import_fields14.timestamp)({ ...readOnly }),
    deliveredAt: (0, import_fields14.timestamp)({ ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var Opportunity = (0, import_core14.list)({
  access: governed(["canManageLeads", "canBook", "canPresentEstimates"]),
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "customer", "kind", "stage", "estimatedValueMinor"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    customer: (0, import_fields14.relationship)({ ref: "Customer", ...readOnly }),
    location: (0, import_fields14.relationship)({ ref: "ServiceLocation", ...readOnly }),
    kind: fixedChoice(["replacement", "repair_followup", "membership", "commercial_bid", "upgrade"]),
    source: fixedChoice(["tech_generated", "estimate_followup", "agent_scan", "membership_visit", "inbound"]),
    generatedBy: (0, import_fields14.relationship)({ ref: "Employee", ...readOnly }),
    estimatedValueMinor: minor(),
    reasons: (0, import_fields14.json)({ ...readOnly }),
    stage: lifecycle(["open", "appointment_set", "estimate_presented", "won", "lost"]),
    assignedTo: (0, import_fields14.relationship)({ ref: "Employee", ...readOnly }),
    lead: (0, import_fields14.relationship)({ ref: "Lead", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});

// features/keystone/models/booking.ts
var booking_exports = {};
__export(booking_exports, {
  ArrivalWindow: () => ArrivalWindow,
  ArrivalWindowTemplate: () => ArrivalWindowTemplate,
  BookingHold: () => BookingHold,
  CapacityOverride: () => CapacityOverride,
  CapacityPlan: () => CapacityPlan,
  CapacityUsage: () => CapacityUsage,
  JOB_PRIORITIES: () => JOB_PRIORITIES,
  JobType: () => JobType
});
var import_core15 = require("@keystone-6/core");
var import_fields15 = require("@keystone-6/core/fields");
var JOB_PRIORITIES = ["emergency", "urgent", "standard", "maintenance"];
var JobType = (0, import_core15.list)({
  access: managed("signedIn", "canManageCompany"),
  ui: { labelField: "name", listView: { initialColumns: ["code", "name", "businessUnit", "priority", "capacityHours", "bookableByAi"] } },
  fields: {
    code: (0, import_fields15.text)({ isIndexed: "unique", validation: { isRequired: true, match: { regex: /^[A-Z0-9-]{3,24}$/, explanation: "Like HVAC-NOCOOL" } } }),
    name: (0, import_fields15.text)({ validation: { isRequired: true } }),
    businessUnit: (0, import_fields15.relationship)({ ref: "BusinessUnit" }),
    trade: choice(["hvac", "plumbing", "electrical"], "hvac"),
    priority: choice(JOB_PRIORITIES, "standard"),
    defaultDurationMinutes: (0, import_fields15.integer)({ defaultValue: 90, validation: { isRequired: true, min: 15, max: 1440 } }),
    capacityHours: qty({ required: true, description: "Tech-hours one booking uses from a window (I-B1)." }),
    crewSize: (0, import_fields15.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1, max: 12 } }),
    requirements: (0, import_fields15.relationship)({ ref: "JobTypeRequirement" }),
    keywords: (0, import_fields15.json)({ defaultValue: [], ui: { description: "Words a caller uses for this problem; jobtype.match ranks by them." } }),
    bookableOnline: (0, import_fields15.checkbox)({ defaultValue: false }),
    bookableByAi: (0, import_fields15.checkbox)({ defaultValue: false }),
    emergencyPolicy: (0, import_fields15.json)({ ui: { description: '{"keywords":[...],"script":"\u2026","page":true}. A match makes the AI CSR give the script and page on-call (SM\xA717).' } }),
    checklistTemplate: (0, import_fields15.relationship)({ ref: "ChecklistTemplate" }),
    refrigerantWork: (0, import_fields15.checkbox)({ defaultValue: false }),
    permitLikely: (0, import_fields15.checkbox)({ defaultValue: false }),
    bookingQuestions: (0, import_fields15.json)({ defaultValue: [] }),
    active: (0, import_fields15.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var LOCAL_TIME2 = { regex: /^([01]\d|2[0-3]):[0-5]\d$/, explanation: "HH:MM, 24-hour" };
var ArrivalWindowTemplate = (0, import_core15.list)({
  access: managed("signedIn", ["canManageCompany", "canDispatch"]),
  ui: { labelField: "label", listView: { initialColumns: ["businessUnit", "weekday", "label", "startLocal", "endLocal", "capacityHours", "active"] } },
  fields: {
    businessUnit: (0, import_fields15.relationship)({ ref: "BusinessUnit" }),
    weekday: (0, import_fields15.integer)({ validation: { isRequired: true, min: 0, max: 6 }, ui: { description: "0 = Sunday" } }),
    startLocal: (0, import_fields15.text)({ validation: { isRequired: true, match: LOCAL_TIME2 } }),
    endLocal: (0, import_fields15.text)({ validation: { isRequired: true, match: LOCAL_TIME2 } }),
    label: (0, import_fields15.text)({ validation: { isRequired: true } }),
    capacityHours: qty({ required: true, description: "Tech-hours sold into this window before the plan factor." }),
    capacityFactor: rate({ description: "Multiplier for the window (1.000000 = as planned)." }),
    active: (0, import_fields15.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var ArrivalWindow = (0, import_core15.list)({
  access: governed(["canBook", "canDispatch", "canViewBoard", "canWorkVisits"]),
  ui: { labelField: "label", listView: { initialColumns: ["businessUnit", "date", "label", "capacityHours", "bookedHours", "closed"] } },
  fields: {
    businessUnit: (0, import_fields15.relationship)({ ref: "BusinessUnit", ...readOnly }),
    template: (0, import_fields15.relationship)({ ref: "ArrivalWindowTemplate", ...readOnly }),
    date: (0, import_fields15.calendarDay)({ validation: { isRequired: true }, ...readOnly }),
    startsAt: (0, import_fields15.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    endsAt: (0, import_fields15.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    label: systemText({ required: true }),
    capacityHours: qty({ required: true }),
    bookedHours: qty({ required: true }),
    closed: (0, import_fields15.checkbox)({ defaultValue: false, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var CapacityPlan = (0, import_core15.list)({
  access: governed(["canBook", "canDispatch", "canViewBoard"]),
  ui: { labelField: "date" },
  fields: {
    businessUnit: (0, import_fields15.relationship)({ ref: "BusinessUnit", ...readOnly }),
    date: (0, import_fields15.calendarDay)({ validation: { isRequired: true }, ...readOnly }),
    techHoursAvailable: qty({ required: true }),
    reservedEmergencyHours: qty({ required: true }),
    ...trackingFields
  }
});
var CapacityUsage = (0, import_core15.list)({
  access: governed(["canBook", "canDispatch", "canViewBoard"]),
  ui: { labelField: "kind", listView: { initialColumns: ["window", "kind", "hours", "createdAt"] } },
  fields: {
    window: (0, import_fields15.relationship)({ ref: "ArrivalWindow", ...readOnly }),
    kind: fixedChoice(["hold", "visit"]),
    hold: (0, import_fields15.relationship)({ ref: "BookingHold", ...readOnly }),
    visit: (0, import_fields15.relationship)({ ref: "Visit", ...readOnly }),
    hours: qty({ required: true }),
    ...trackingFields
  }
});
var CapacityOverride = (0, import_core15.list)({
  access: governed(["canBook", "canDispatch", "canViewBoard"]),
  ui: { labelField: "reason" },
  fields: {
    window: (0, import_fields15.relationship)({ ref: "ArrivalWindow", ...readOnly }),
    addHours: qty({ required: true }),
    reason: systemText({ required: true }),
    requestedBy: (0, import_fields15.relationship)({ ref: "User", ...readOnly }),
    approval: (0, import_fields15.relationship)({ ref: "ApprovalRequest", ...readOnly }),
    ...trackingFields
  }
});
var BookingHold = (0, import_core15.list)({
  access: governed(["canBook", "canDispatch", "canViewBoard"]),
  ui: { labelField: "publicCode", listView: { initialColumns: ["publicCode", "window", "jobType", "source", "status", "expiresAt"] } },
  fields: {
    publicCode: systemText({ indexed: "unique", required: true }),
    window: (0, import_fields15.relationship)({ ref: "ArrivalWindow", ...readOnly }),
    jobType: (0, import_fields15.relationship)({ ref: "JobType", ...readOnly }),
    hours: qty({ required: true }),
    source: fixedChoice(["csr", "online", "ai_agent"]),
    heldByUser: (0, import_fields15.relationship)({ ref: "User", ...readOnly }),
    heldByAgent: (0, import_fields15.relationship)({ ref: "AgentIdentity", ...readOnly }),
    customerDraft: (0, import_fields15.json)({ ...readOnly }),
    expiresAt: (0, import_fields15.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    status: lifecycle(["held", "converted", "released", "expired"]),
    job: (0, import_fields15.relationship)({ ref: "Job", ...readOnly }),
    visit: (0, import_fields15.relationship)({ ref: "Visit", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});

// features/keystone/models/jobs.ts
var jobs_exports = {};
__export(jobs_exports, {
  ChecklistResponse: () => ChecklistResponse,
  ChecklistTemplate: () => ChecklistTemplate,
  DispatchRecommendation: () => DispatchRecommendation,
  JOB_CANCEL_REASONS: () => JOB_CANCEL_REASONS,
  JOB_HOLD_REASONS: () => JOB_HOLD_REASONS,
  JOB_STATUSES: () => JOB_STATUSES,
  Job: () => Job,
  JobPayer: () => JobPayer,
  VISIT_STATUSES: () => VISIT_STATUSES,
  Visit: () => Visit,
  VisitAssignment: () => VisitAssignment,
  VisitStatusEvent: () => VisitStatusEvent,
  WorkLine: () => WorkLine
});
var import_core16 = require("@keystone-6/core");
var import_fields16 = require("@keystone-6/core/fields");
init_access();
var JOB_STATUSES = ["draft", "booked", "scheduled", "in_progress", "on_hold", "work_complete", "awaiting_inspection", "completed", "closed", "cancelled"];
var JOB_HOLD_REASONS = ["", "parts", "customer_decision", "financing", "permit", "authorization", "access", "other"];
var JOB_CANCEL_REASONS = ["", "customer_request", "duplicate", "no_access", "out_of_area", "scheduling", "weather", "other"];
var Job = (0, import_core16.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: anyOf("canBook", "canDispatch"), delete: sys },
    filter: { query: scoped((userId) => jobFilter(userId)) }
  },
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "customer", "jobType", "priority", "status", "createdAt"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    publicCode: systemText({ indexed: "unique", required: true }),
    customer: (0, import_fields16.relationship)({ ref: "Customer.jobs", ...readOnly }),
    location: (0, import_fields16.relationship)({ ref: "ServiceLocation.jobs", ...readOnly }),
    businessUnit: (0, import_fields16.relationship)({ ref: "BusinessUnit", ...readOnly }),
    jobType: (0, import_fields16.relationship)({ ref: "JobType", ...readOnly }),
    priority: fixedChoice(["emergency", "urgent", "standard", "maintenance"]),
    status: lifecycle(JOB_STATUSES),
    statusBeforeHold: systemText(),
    holdReason: fixedChoice(JOB_HOLD_REASONS),
    holdFollowUpOn: (0, import_fields16.calendarDay)({ ...readOnly }),
    cancelReason: fixedChoice(JOB_CANCEL_REASONS),
    summary: (0, import_fields16.text)({ ui: { description: "What the customer reported, in their words." } }),
    source: fixedChoice(["csr", "online", "ai_agent", "tech_generated", "membership", "import"]),
    lead: (0, import_fields16.relationship)({ ref: "Lead", ...readOnly }),
    recallOf: (0, import_fields16.relationship)({ ref: "Job", ...readOnly }),
    payers: (0, import_fields16.relationship)({ ref: "JobPayer.job", many: true, ...readOnly }),
    poNumber: (0, import_fields16.text)(),
    nteMinor: minor({ description: "Not-to-exceed authorised by the payer, in cents." }),
    visits: (0, import_fields16.relationship)({ ref: "Visit.job", many: true, ...readOnly }),
    workLines: (0, import_fields16.relationship)({ ref: "WorkLine.job", many: true, ...readOnly }),
    bookedBy: (0, import_fields16.relationship)({ ref: "User", ...readOnly }),
    bookedByAgent: (0, import_fields16.relationship)({ ref: "AgentIdentity", ...readOnly }),
    tags: (0, import_fields16.relationship)({ ref: "Tag", many: true }),
    completedAt: (0, import_fields16.timestamp)({ ...readOnly }),
    closedAt: (0, import_fields16.timestamp)({ ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var JobPayer = (0, import_core16.list)({
  access: governed(["canBook", "canDispatch", "canManageInvoices"]),
  ui: { labelField: "payerKind" },
  fields: {
    job: (0, import_fields16.relationship)({ ref: "Job.payers", ...readOnly }),
    payerKind: fixedChoice(["customer", "home_warranty", "commercial_payer", "manufacturer"]),
    payerCustomer: (0, import_fields16.relationship)({ ref: "Customer", ...readOnly }),
    authorizationRef: systemText(),
    sharePolicy: fixedChoice(["all", "up_to_authorized", "specific_lines"]),
    ...trackingFields
  }
});
var VISIT_STATUSES = ["unassigned", "scheduled", "dispatched", "en_route", "on_site", "working", "paused", "done", "cancelled", "no_access"];
var Visit = (0, import_core16.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: sys, delete: sys },
    filter: { query: scoped(visitFilter) }
  },
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "job", "window", "plannedStart", "status"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    job: (0, import_fields16.relationship)({ ref: "Job.visits", ...readOnly }),
    window: (0, import_fields16.relationship)({ ref: "ArrivalWindow", ...readOnly }),
    plannedStart: (0, import_fields16.timestamp)({ ...readOnly }),
    plannedDurationMinutes: (0, import_fields16.integer)({ ...readOnly }),
    capacityHours: qty({ required: true }),
    status: lifecycle(VISIT_STATUSES),
    cancelReason: systemText(),
    assignments: (0, import_fields16.relationship)({ ref: "VisitAssignment.visit", many: true, ...readOnly }),
    statusEvents: (0, import_fields16.relationship)({ ref: "VisitStatusEvent.visit", many: true, ...readOnly }),
    actualArrivalAt: (0, import_fields16.timestamp)({ ...readOnly }),
    actualDoneAt: (0, import_fields16.timestamp)({ ...readOnly }),
    etaMinutes: (0, import_fields16.integer)({ ...readOnly }),
    customerSummaryDraft: systemText(),
    needsReview: (0, import_fields16.checkbox)({ defaultValue: false, ...readOnly, ui: { ...readOnly.ui, description: "An out-of-order device event arrived; a dispatcher should look (I-D3)." } }),
    version: versionField(),
    ...trackingFields
  }
});
var VisitAssignment = (0, import_core16.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: sys, delete: sys },
    filter: { query: scoped((userId) => ({ employee: { user: { id: { equals: userId } } } })) }
  },
  ui: { labelField: "role", listView: { initialColumns: ["visit", "employee", "role", "active", "assignedAt"] } },
  fields: {
    visit: (0, import_fields16.relationship)({ ref: "Visit.assignments", ...readOnly }),
    employee: (0, import_fields16.relationship)({ ref: "Employee", ...readOnly }),
    role: fixedChoice(["lead", "helper", "sales", "apprentice"]),
    assignedAt: (0, import_fields16.timestamp)({ ...readOnly }),
    assignedBy: (0, import_fields16.relationship)({ ref: "User", ...readOnly }),
    assignedByAgent: (0, import_fields16.relationship)({ ref: "AgentIdentity", ...readOnly }),
    recommendation: (0, import_fields16.relationship)({ ref: "DispatchRecommendation", ...readOnly }),
    overrideReason: fixedChoice(["", "customer_request", "skill", "continuity", "geography", "fairness", "other"]),
    eligibility: (0, import_fields16.relationship)({ ref: "EligibilityEvaluation", ...readOnly }),
    active: (0, import_fields16.checkbox)({ defaultValue: true, ...readOnly }),
    endedAt: (0, import_fields16.timestamp)({ ...readOnly }),
    ...trackingFields
  }
});
var VisitStatusEvent = (0, import_core16.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: sys, delete: sys },
    filter: { query: scoped((userId) => ({ visit: visitFilter(userId) })) }
  },
  ui: { labelField: "toStatus", listView: { initialColumns: ["visit", "fromStatus", "toStatus", "kind", "occurredAt", "clientRecordedAt"] } },
  fields: {
    visit: (0, import_fields16.relationship)({ ref: "Visit.statusEvents", ...readOnly }),
    employee: (0, import_fields16.relationship)({ ref: "Employee", ...readOnly }),
    actorUser: (0, import_fields16.relationship)({ ref: "User", ...readOnly }),
    fromStatus: systemText({ required: true }),
    toStatus: systemText({ required: true }),
    kind: fixedChoice(["transition", "correction"]),
    occurredAt: (0, import_fields16.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    clientRecordedAt: (0, import_fields16.timestamp)({ ...readOnly }),
    idempotencyKey: systemText({ indexed: "unique", required: true }),
    lat: geo({ ...readOnly }),
    lng: geo({ ...readOnly }),
    deviceId: systemText(),
    note: systemText(),
    ...trackingFields
  }
});
var DispatchRecommendation = (0, import_core16.list)({
  access: immutable(["canDispatch", "canViewBoard"]),
  ui: { labelField: "decision", listView: { initialColumns: ["visit", "decision", "modelRef", "createdAt"] } },
  fields: {
    visit: (0, import_fields16.relationship)({ ref: "Visit", ...readOnly }),
    rankedCandidates: (0, import_fields16.json)({ ...readOnly }),
    inputsHash: systemText({ required: true }),
    features: (0, import_fields16.json)({ ...readOnly, ui: { ...readOnly.ui, description: "The scoring features used. Revenue prediction is not one of them until reviewed." } }),
    modelRef: systemText({ required: true }),
    generatedBy: (0, import_fields16.relationship)({ ref: "AgentIdentity", ...readOnly }),
    requestedBy: (0, import_fields16.relationship)({ ref: "User", ...readOnly }),
    decision: lifecycle(["proposed", "applied", "overridden", "expired"]),
    decidedBy: (0, import_fields16.relationship)({ ref: "User", ...readOnly }),
    decidedAt: (0, import_fields16.timestamp)({ ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var ChecklistTemplate = (0, import_core16.list)({
  access: managed("signedIn", ["canManageCompany", "canDispatch"]),
  ui: { labelField: "name" },
  fields: {
    name: (0, import_fields16.text)({ validation: { isRequired: true } }),
    items: (0, import_fields16.json)({ defaultValue: [], ui: { description: '[{"key":"static_pressure","label":"Total static pressure","type":"reading","unit":"inWC","required":true}]' } }),
    templateVersion: (0, import_fields16.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1 } }),
    required: (0, import_fields16.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var ChecklistResponse = (0, import_core16.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: sys, delete: sys },
    filter: { query: scoped((userId) => ({ visit: visitFilter(userId) })) }
  },
  ui: { labelField: "completedAt" },
  fields: {
    visit: (0, import_fields16.relationship)({ ref: "Visit", ...readOnly }),
    template: (0, import_fields16.relationship)({ ref: "ChecklistTemplate", ...readOnly }),
    templateVersion: (0, import_fields16.integer)({ ...readOnly }),
    answers: (0, import_fields16.json)({ ...readOnly }),
    completedBy: (0, import_fields16.relationship)({ ref: "User", ...readOnly }),
    completedAt: (0, import_fields16.timestamp)({ ...readOnly }),
    ...trackingFields
  }
});
var WorkLine = (0, import_core16.list)({
  access: {
    operation: { query: officeOrTech(["canManageInvoices"]), create: sys, update: sys, delete: sys },
    filter: { query: scoped((userId) => ({ job: jobFilter(userId) }), ["canManageInvoices"]) }
  },
  ui: { labelField: "description", listView: { initialColumns: ["job", "description", "quantity", "unitPriceMinor", "amountMinor", "status"] } },
  fields: {
    job: (0, import_fields16.relationship)({ ref: "Job.workLines", ...readOnly }),
    source: fixedChoice(["estimate_line", "pricebook", "manual", "change_order", "membership_benefit"]),
    description: systemText({ required: true }),
    snapshot: costGuardedJson({ ...readOnly }),
    quantity: qty({ required: true }),
    uom: systemText(),
    unitPriceMinor: minor({ defaultValue: 0n }),
    amountMinor: minor({ defaultValue: 0n }),
    taxCategory: fixedChoice(["labor", "material", "equipment", "fee", "disposal", "permit_passthrough", "warranty_reimbursed", "membership", "maintenance"]),
    trade: fixedChoice(["hvac", "plumbing", "electrical", "general"]),
    cancellationClass: fixedChoice(["requested_repair", "necessary_replacement_parts", "additional_goods_services"]),
    status: lifecycle(["planned", "completed", "removed", "cancelled_by_buyer"]),
    estimateLine: (0, import_fields16.relationship)({ ref: "EstimateLine", ...readOnly }),
    changeOrder: (0, import_fields16.relationship)({ ref: "ChangeOrder", ...readOnly }),
    cancellationNotices: (0, import_fields16.relationship)({ ref: "CancellationNotice.coveredWorkLines", many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});

// features/keystone/models/sales.ts
var sales_exports = {};
__export(sales_exports, {
  Authorization: () => Authorization,
  CANCELLATION_CLASSES: () => CANCELLATION_CLASSES,
  CancellationEvaluation: () => CancellationEvaluation,
  CancellationNotice: () => CancellationNotice,
  ChangeOrder: () => ChangeOrder,
  DECLINE_REASONS: () => DECLINE_REASONS,
  ESTIMATE_STATUSES: () => ESTIMATE_STATUSES,
  EquipmentModel: () => EquipmentModel,
  Estimate: () => Estimate,
  EstimateLine: () => EstimateLine,
  EstimateOption: () => EstimateOption,
  EstimateVersion: () => EstimateVersion,
  ITEM_KINDS: () => ITEM_KINDS,
  LaborRate: () => LaborRate,
  MarkupTable: () => MarkupTable,
  MemberPricingRule: () => MemberPricingRule,
  NOTICE_STATUSES: () => NOTICE_STATUSES,
  PAYMENT_METHODS: () => PAYMENT_METHODS,
  PRICEBOOK_STATUSES: () => PRICEBOOK_STATUSES,
  Payment: () => Payment,
  PriceBook: () => PriceBook,
  PriceBookCategory: () => PriceBookCategory,
  PriceBookItem: () => PriceBookItem,
  PriceBookVersion: () => PriceBookVersion,
  Refund: () => Refund,
  SALE_LOCATIONS: () => SALE_LOCATIONS,
  TAX_CATEGORIES: () => TAX_CATEGORIES,
  TRADE_OR_GENERAL: () => TRADE_OR_GENERAL,
  UnitOfMeasure: () => UnitOfMeasure
});
var import_core17 = require("@keystone-6/core");
var import_fields17 = require("@keystone-6/core/fields");
init_access();

// features/keystone/models/billingAccess.ts
init_access();
var has2 = (session, names) => names.some((name) => session?.data?.role?.[name] === true);
var BILLING_OFFICE = [
  "canManageInvoices",
  "canPostInvoices",
  "canManagePayments",
  "canIssueRefunds",
  "canApproveWriteOff",
  "canApproveCredits",
  "canApproveRefunds",
  "canManageAccounting",
  "canCloseAr",
  "canApproveArClose"
];
var COUNTER = ["canTakePayments", "canOfferFinancing"];
var billingQuery = ({ session }) => isSignedIn({ session }) && (has2(session, BILLING_OFFICE) || has2(session, COUNTER));
var officeOnlyQuery = ({ session }) => isSignedIn({ session }) && has2(session, BILLING_OFFICE);
var jobScoped = (path) => ({
  operation: { query: billingQuery, create: sys, update: sys, delete: sys },
  filter: {
    query: ({ session }) => {
      if (!isSignedIn({ session })) return false;
      if (has2(session, BILLING_OFFICE)) return true;
      if (has2(session, ["canWorkVisits"])) return path(jobFilter(session.itemId));
      return has2(session, COUNTER) ? true : false;
    }
  }
});

// features/keystone/models/sales.ts
var TRADE_OR_GENERAL = ["hvac", "plumbing", "electrical", "general"];
var TAX_CATEGORIES = ["labor", "material", "equipment", "fee", "disposal", "permit_passthrough", "warranty_reimbursed", "membership", "maintenance"];
var CANCELLATION_CLASSES = ["requested_repair", "necessary_replacement_parts", "additional_goods_services"];
var ITEM_KINDS = ["service_task", "material", "equipment", "fee", "discount", "bundle"];
var PRICEBOOK_STATUSES = ["draft", "pending_approval", "published", "active", "retired", "discarded"];
var ESTIMATE_STATUSES = ["draft", "pending_approval", "presented", "sold", "declined", "expired", "superseded", "cancelled", "discarded"];
var NOTICE_STATUSES = ["issued", "delivered", "waived", "cancelled_by_buyer", "expired_uncancelled", "refunded"];
var DECLINE_REASONS = ["price", "timing", "chose_competitor", "will_call_back", "financing_declined", "no_longer_needed", "other"];
var SALE_LOCATIONS = ["buyer_residence", "other_non_merchant", "merchant_place", "remote"];
var has3 = (session, names) => names.some((name) => session?.data?.role?.[name] === true);
var costRead = ({ session }) => canReadCost(session);
var PRICEBOOK_READ = [...OFFICE_READ, "canManagePriceBook", "canApprovePriceBook", "canPresentEstimates", "canSellEstimates", "canWorkVisits"];
var SALES_OFFICE = [...OFFICE_READ, "canManagePriceBook", "canApproveDiscounts", "canApprovePolicies"];
var salesQuery = ({ session }) => isSignedIn({ session }) && (has3(session, SALES_OFFICE) || has3(session, ["canWorkVisits", "canPresentEstimates"]));
var ownEstimates = (userId) => ({ OR: [{ job: jobFilter(userId) }, { presentedBy: { user: { id: { equals: userId } } } }] });
var salesFilter = (path) => ({ session }) => {
  if (!isSignedIn({ session })) return false;
  if (has3(session, SALES_OFFICE)) return true;
  if (has3(session, ["canWorkVisits", "canPresentEstimates"])) return path(ownEstimates(session.itemId));
  return false;
};
var salesAccess = (path) => ({
  operation: { query: salesQuery, create: sys, update: sys, delete: sys },
  filter: { query: salesFilter(path) }
});
var jobRows = {
  operation: { query: salesQuery, create: sys, update: sys, delete: sys },
  filter: {
    query: ({ session }) => {
      if (!isSignedIn({ session })) return false;
      if (has3(session, SALES_OFFICE)) return true;
      if (has3(session, ["canWorkVisits", "canPresentEstimates"])) return { job: jobFilter(session.itemId) };
      return false;
    }
  }
};
var UnitOfMeasure = (0, import_core17.list)({
  access: managed("signedIn", "canManagePriceBook"),
  ui: { labelField: "code", listView: { initialColumns: ["code", "name", "kind", "maxDecimals"] } },
  fields: {
    code: (0, import_fields17.text)({ isIndexed: "unique", validation: { isRequired: true, match: { regex: /^[a-z][a-z0-9_]{0,15}$/, explanation: "Lower-case code like ea, ft, lb" } } }),
    name: (0, import_fields17.text)({ validation: { isRequired: true } }),
    kind: choice(["count", "length", "weight", "volume", "time", "package"], "count"),
    maxDecimals: (0, import_fields17.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0, max: 4 }, ui: { description: "How many decimal places a quantity may have (ea 0, ft 2, lb 2, hr 2)." } }),
    ...trackingFields
  }
});
var EquipmentModel = (0, import_core17.list)({
  access: managed("signedIn", ["canManagePriceBook", "canManageEquipment"]),
  ui: { labelField: "modelNumber", listView: { initialColumns: ["manufacturer", "brand", "modelNumber", "kind", "tonnage", "refrigerantType"] } },
  fields: {
    manufacturer: (0, import_fields17.text)({ validation: { isRequired: true } }),
    brand: (0, import_fields17.text)(),
    modelNumber: (0, import_fields17.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    kind: choice(["ac_condenser", "heat_pump", "furnace", "air_handler", "coil", "mini_split", "water_heater_tank", "water_heater_tankless", "boiler", "panel", "generator", "ev_charger", "other"], "other"),
    tonnage: qty(),
    btuh: (0, import_fields17.integer)({ validation: { min: 0 } }),
    efficiency: (0, import_fields17.json)({ defaultValue: {}, ui: { description: 'SEER2 / EER2 / HSPF2 / AFUE / UEF as decimal strings, e.g. {"seer2":"15.2"}.' } }),
    refrigerantType: (0, import_fields17.text)({ ui: { description: "R-454B, R-32, R-410A\u2026" } }),
    ahriRef: (0, import_fields17.text)(),
    warrantySummary: (0, import_fields17.text)({ ui: { displayMode: "textarea" } }),
    ...trackingFields
  }
});
var PriceBook = (0, import_core17.list)({
  access: governed(PRICEBOOK_READ),
  ui: { labelField: "name", listView: { initialColumns: ["name", "code", "activeVersion", "currencyCode"] } },
  fields: {
    name: systemText({ required: true }),
    code: systemText({ indexed: "unique", required: true }),
    currencyCode: systemText({ required: true }),
    businessUnits: (0, import_fields17.relationship)({ ref: "BusinessUnit", many: true, ...readOnly }),
    activeVersion: (0, import_fields17.relationship)({ ref: "PriceBookVersion", ...readOnly }),
    versions: (0, import_fields17.relationship)({ ref: "PriceBookVersion.priceBook", many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var PriceBookVersion = (0, import_core17.list)({
  access: governed(PRICEBOOK_READ),
  ui: { labelField: "label", listView: { initialColumns: ["priceBook", "versionNumber", "status", "effectiveAt", "source"] } },
  fields: {
    priceBook: (0, import_fields17.relationship)({ ref: "PriceBook.versions", ...readOnly }),
    versionNumber: (0, import_fields17.integer)({ validation: { isRequired: true, min: 1 }, ...readOnly }),
    label: systemText({ required: true }),
    status: lifecycle(PRICEBOOK_STATUSES),
    source: fixedChoice(["manual", "copy", "supplier_import"], "manual"),
    basedOn: (0, import_fields17.relationship)({ ref: "PriceBookVersion", ...readOnly }),
    notes: systemText(),
    effectiveAt: (0, import_fields17.timestamp)({ ...readOnly }),
    contentHash: costHash(),
    diffReport: (0, import_fields17.json)({ ...readOnly }),
    costChangeReport: (0, import_fields17.json)({ ...readOnly, access: { ...readOnly.access, read: costRead } }),
    approval: (0, import_fields17.relationship)({ ref: "ApprovalRequest", ...readOnly }),
    submittedBy: (0, import_fields17.relationship)({ ref: "User", ...readOnly }),
    submittedAt: (0, import_fields17.timestamp)({ ...readOnly }),
    publishedBy: (0, import_fields17.relationship)({ ref: "User", ...readOnly }),
    publishedAt: (0, import_fields17.timestamp)({ ...readOnly }),
    activatedAt: (0, import_fields17.timestamp)({ ...readOnly }),
    retiredAt: (0, import_fields17.timestamp)({ ...readOnly }),
    categories: (0, import_fields17.relationship)({ ref: "PriceBookCategory.priceBookVersion", many: true, ...readOnly }),
    items: (0, import_fields17.relationship)({ ref: "PriceBookItem.priceBookVersion", many: true, ...readOnly }),
    markupTables: (0, import_fields17.relationship)({ ref: "MarkupTable.priceBookVersion", many: true, ...readOnly }),
    laborRates: (0, import_fields17.relationship)({ ref: "LaborRate.priceBookVersion", many: true, ...readOnly }),
    memberPricingRules: (0, import_fields17.relationship)({ ref: "MemberPricingRule.priceBookVersion", many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var PriceBookCategory = (0, import_core17.list)({
  access: governed(PRICEBOOK_READ),
  ui: { labelField: "name", listView: { initialColumns: ["name", "categoryKey", "trade", "sortOrder", "priceBookVersion"] } },
  fields: {
    priceBookVersion: (0, import_fields17.relationship)({ ref: "PriceBookVersion.categories", ...readOnly }),
    categoryKey: systemText({ required: true }),
    name: systemText({ required: true }),
    trade: fixedChoice(TRADE_OR_GENERAL, "general"),
    parentKey: systemText(),
    sortOrder: (0, import_fields17.integer)({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    ...trackingFields
  }
});
var PriceBookItem = (0, import_core17.list)({
  access: governed(PRICEBOOK_READ),
  ui: { labelField: "name", listView: { initialColumns: ["itemKey", "name", "kind", "trade", "unitPriceMinor", "priceBookVersion"] } },
  fields: {
    priceBookVersion: (0, import_fields17.relationship)({ ref: "PriceBookVersion.items", ...readOnly }),
    itemKey: systemText({ indexed: true, required: true }),
    kind: fixedChoice(ITEM_KINDS, "service_task"),
    categoryKey: systemText(),
    name: systemText({ required: true }),
    customerDescription: systemText(),
    internalNotes: systemText(),
    trade: fixedChoice(TRADE_OR_GENERAL, "general"),
    businessUnit: (0, import_fields17.relationship)({ ref: "BusinessUnit", ...readOnly }),
    pricingMethod: fixedChoice(["fixed", "formula"], "fixed"),
    unitPriceMinor: minor({ defaultValue: 0n }),
    memberUnitPriceMinor: minor(),
    costMinor: minor({ defaultValue: 0n, ...costOnly }),
    laborHours: qty({ ...readOnly }),
    uom: systemText({ required: true }),
    taxCategory: fixedChoice(TAX_CATEGORIES, "labor"),
    warrantyText: systemText(),
    equipmentModel: (0, import_fields17.relationship)({ ref: "EquipmentModel", ...readOnly }),
    materials: (0, import_fields17.json)({ ...readOnly, ui: { ...readOnly.ui, description: "Formula inputs and bill of materials: [{ itemKey, quantity }] of material items in the same version." } }),
    commissionCode: systemText(),
    spiffCode: systemText(),
    cancellationClassDefault: fixedChoice(CANCELLATION_CLASSES, "requested_repair"),
    ladderKey: systemText({ indexed: true }),
    tier: fixedChoice(["", "good", "better", "best"], ""),
    sortOrder: (0, import_fields17.integer)({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    active: (0, import_fields17.checkbox)({ defaultValue: true, ...readOnly }),
    ...trackingFields
  }
});
var MarkupTable = (0, import_core17.list)({
  access: governed(["canManagePriceBook", "canApprovePriceBook"]),
  ui: { labelField: "name" },
  fields: {
    priceBookVersion: (0, import_fields17.relationship)({ ref: "PriceBookVersion.markupTables", ...readOnly }),
    name: systemText({ required: true }),
    appliesTo: fixedChoice(["material", "equipment"], "material"),
    tiers: (0, import_fields17.json)({ ...readOnly, ui: { ...readOnly.ui, description: "[{ fromCostMinor, toCostMinor | null, multiplier }]: cost in cents, multiplier a decimal string." } }),
    ...trackingFields
  }
});
var LaborRate = (0, import_core17.list)({
  access: governed(["canManagePriceBook", "canApprovePriceBook"]),
  ui: { labelField: "hourlyMinor" },
  fields: {
    priceBookVersion: (0, import_fields17.relationship)({ ref: "PriceBookVersion.laborRates", ...readOnly }),
    businessUnit: (0, import_fields17.relationship)({ ref: "BusinessUnit", ...readOnly }),
    hourlyMinor: minor({ required: true }),
    afterHoursMultiplier: rate({ ...readOnly }),
    ...trackingFields
  }
});
var MemberPricingRule = (0, import_core17.list)({
  access: governed(PRICEBOOK_READ),
  ui: { labelField: "planCode" },
  fields: {
    priceBookVersion: (0, import_fields17.relationship)({ ref: "PriceBookVersion.memberPricingRules", ...readOnly }),
    planCode: systemText({ required: true }),
    scope: fixedChoice(["all", "category", "item"], "all"),
    scopeKey: systemText(),
    discountBps: (0, import_fields17.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0, max: 1e4 }, ...readOnly }),
    waiveTripFee: (0, import_fields17.checkbox)({ defaultValue: false, ...readOnly }),
    ...trackingFields
  }
});
var Estimate = (0, import_core17.list)({
  access: salesAccess((own) => own),
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "customer", "job", "status", "createdAt"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    publicCode: systemText({ indexed: "unique", required: true }),
    title: systemText(),
    job: (0, import_fields17.relationship)({ ref: "Job", ...readOnly }),
    opportunity: (0, import_fields17.relationship)({ ref: "Opportunity", ...readOnly }),
    customer: (0, import_fields17.relationship)({ ref: "Customer", ...readOnly }),
    location: (0, import_fields17.relationship)({ ref: "ServiceLocation", ...readOnly }),
    businessUnit: (0, import_fields17.relationship)({ ref: "BusinessUnit", ...readOnly }),
    status: lifecycle(["open", "sold", "declined", "expired", "cancelled", "discarded"]),
    source: fixedChoice(["staff", "technician", "agent_draft", "followup"], "staff"),
    currentVersion: (0, import_fields17.relationship)({ ref: "EstimateVersion", ...readOnly }),
    soldVersion: (0, import_fields17.relationship)({ ref: "EstimateVersion", ...readOnly }),
    versions: (0, import_fields17.relationship)({ ref: "EstimateVersion.estimate", many: true, ...readOnly }),
    presentedBy: (0, import_fields17.relationship)({ ref: "Employee", ...readOnly }),
    createdBy: (0, import_fields17.relationship)({ ref: "User", ...readOnly }),
    createdByAgent: (0, import_fields17.relationship)({ ref: "AgentIdentity", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var EstimateVersion = (0, import_core17.list)({
  access: salesAccess((own) => ({ estimate: own })),
  ui: { labelField: "label", listView: { initialColumns: ["estimate", "versionNumber", "status", "presentedAt", "validUntil"] } },
  fields: {
    estimate: (0, import_fields17.relationship)({ ref: "Estimate.versions", ...readOnly }),
    versionNumber: (0, import_fields17.integer)({ validation: { isRequired: true, min: 1 }, ...readOnly }),
    label: systemText({ required: true }),
    status: lifecycle(ESTIMATE_STATUSES),
    priceBookVersion: (0, import_fields17.relationship)({ ref: "PriceBookVersion", ...readOnly }),
    supersedes: (0, import_fields17.relationship)({ ref: "EstimateVersion", ...readOnly }),
    discountBps: (0, import_fields17.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0, max: 1e4 }, ...readOnly }),
    discountReason: systemText(),
    discountApproval: (0, import_fields17.relationship)({ ref: "ApprovalRequest", ...readOnly }),
    notes: systemText(),
    presentedAt: (0, import_fields17.timestamp)({ ...readOnly }),
    presentedBy: (0, import_fields17.relationship)({ ref: "User", ...readOnly }),
    presentedVia: fixedChoice(["", "in_person", "email", "printed"], ""),
    validUntil: (0, import_fields17.timestamp)({ ...readOnly }),
    snapshot: costGuardedJson({ ...readOnly }),
    contentHash: systemText(),
    pdf: (0, import_fields17.relationship)({ ref: "Document", ...readOnly }),
    options: (0, import_fields17.relationship)({ ref: "EstimateOption.estimateVersion", many: true, ...readOnly }),
    soldOption: (0, import_fields17.relationship)({ ref: "EstimateOption", ...readOnly }),
    authorization: (0, import_fields17.relationship)({ ref: "Authorization", ...readOnly }),
    soldAt: (0, import_fields17.timestamp)({ ...readOnly }),
    depositRequiredMinor: minor({ defaultValue: 0n }),
    declineReason: fixedChoice(["", ...DECLINE_REASONS], ""),
    declineNote: systemText(),
    closedAt: (0, import_fields17.timestamp)({ ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var EstimateOption = (0, import_core17.list)({
  access: salesAccess((own) => ({ estimateVersion: { estimate: own } })),
  ui: { labelField: "name", listView: { initialColumns: ["estimateVersion", "tier", "name", "totalMinor"] } },
  fields: {
    estimateVersion: (0, import_fields17.relationship)({ ref: "EstimateVersion.options", ...readOnly }),
    tier: fixedChoice(["good", "better", "best", "single", "custom"], "single"),
    name: systemText({ required: true }),
    description: systemText(),
    sortOrder: (0, import_fields17.integer)({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    subtotalMinor: minor({ defaultValue: 0n }),
    discountMinor: minor({ defaultValue: 0n }),
    estimatedTaxMinor: minor({ defaultValue: 0n }),
    totalMinor: minor({ defaultValue: 0n }),
    monthlyPaymentDisplay: (0, import_fields17.json)({ ...readOnly }),
    contentHash: costHash(),
    lines: (0, import_fields17.relationship)({ ref: "EstimateLine.option", many: true, ...readOnly }),
    ...trackingFields
  }
});
var EstimateLine = (0, import_core17.list)({
  access: salesAccess((own) => ({ option: { estimateVersion: { estimate: own } } })),
  ui: { labelField: "description", listView: { initialColumns: ["option", "description", "quantity", "unitPriceMinor", "amountMinor", "cancellationClass"] } },
  fields: {
    option: (0, import_fields17.relationship)({ ref: "EstimateOption.lines", ...readOnly }),
    pricebookItem: (0, import_fields17.relationship)({ ref: "PriceBookItem", ...readOnly }),
    itemKey: systemText(),
    snapshot: costGuardedJson({ ...readOnly }),
    description: systemText({ required: true }),
    quantity: qty({ required: true, ...readOnly }),
    uom: systemText({ required: true }),
    unitPriceMinor: minor({ defaultValue: 0n }),
    amountMinor: minor({ defaultValue: 0n }),
    discountMinor: minor({ defaultValue: 0n }),
    memberPriced: (0, import_fields17.checkbox)({ defaultValue: false, ...readOnly }),
    costMinor: minor({ defaultValue: 0n, ...costOnly }),
    taxCategory: fixedChoice(TAX_CATEGORIES, "labor"),
    trade: fixedChoice(TRADE_OR_GENERAL, "general"),
    cancellationClass: fixedChoice(CANCELLATION_CLASSES, "requested_repair"),
    isAddOn: (0, import_fields17.checkbox)({ defaultValue: false, ...readOnly }),
    sortOrder: (0, import_fields17.integer)({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    ...trackingFields
  }
});
var Authorization = (0, import_core17.list)({
  access: jobRows,
  ui: { labelField: "signerName", listView: { initialColumns: ["subjectType", "signerName", "method", "location", "authorizedAt"] } },
  fields: {
    subjectType: fixedChoice(["EstimateVersion", "ChangeOrder"], "EstimateVersion"),
    subjectId: systemText({ indexed: true, required: true }),
    job: (0, import_fields17.relationship)({ ref: "Job", ...readOnly }),
    method: fixedChoice(["signature_on_device", "portal_signature", "verbal_recorded", "written_paper", "po_number"], "signature_on_device"),
    signerName: systemText({ required: true }),
    signerContact: (0, import_fields17.relationship)({ ref: "Contact", ...readOnly }),
    signerRole: fixedChoice(["owner", "tenant", "property_manager", "other"], "owner"),
    signature: (0, import_fields17.json)({ ...readOnly, ui: { ...readOnly.ui, description: "Signature strokes or typed name, as captured on the device." } }),
    call: (0, import_fields17.relationship)({ ref: "Call", ...readOnly }),
    poNumber: systemText(),
    ip: systemText(),
    userAgent: systemText(),
    location: fixedChoice(SALE_LOCATIONS, "buyer_residence"),
    initiatedBy: fixedChoice(["customer_request", "solicited"], "customer_request"),
    selectedLineIds: (0, import_fields17.json)({ ...readOnly }),
    depositMinor: minor({ defaultValue: 0n }),
    payments: (0, import_fields17.relationship)({ ref: "Payment.authorization", many: true, ...readOnly }),
    contentHash: costHash({ required: true }),
    authorizedAt: (0, import_fields17.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    recordedBy: (0, import_fields17.relationship)({ ref: "User", ...readOnly }),
    ...trackingFields
  }
});
var PAYMENT_METHODS = ["card", "ach", "cash", "check", "other", "financing", "third_party", "customer_credit"];
var Payment = (0, import_core17.list)({
  // Money: billing permissions read it (a technician only on assigned jobs), not everyone who can see sales rows.
  access: jobScoped((own) => ({ job: own })),
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "job", "kind", "method", "amountMinor", "receivedAt"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    job: (0, import_fields17.relationship)({ ref: "Job", ...readOnly }),
    customer: (0, import_fields17.relationship)({ ref: "Customer", ...readOnly }),
    authorization: (0, import_fields17.relationship)({ ref: "Authorization.payments", ...readOnly }),
    kind: fixedChoice(["deposit", "payment"], "deposit"),
    method: fixedChoice(PAYMENT_METHODS, "card"),
    amountMinor: minor({ required: true }),
    feeMinor: minor({ defaultValue: 0n }),
    payer: (0, import_fields17.relationship)({ ref: "PayerProfile", ...readOnly }),
    checkNumber: systemText(),
    reference: systemText(),
    receivedAt: (0, import_fields17.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    recordedBy: (0, import_fields17.relationship)({ ref: "User", ...readOnly }),
    refunds: (0, import_fields17.relationship)({ ref: "Refund.payment", many: true, ...readOnly }),
    ...trackingFields
  }
});
var Refund = (0, import_core17.list)({
  access: jobScoped((own) => ({ payment: { job: own } })),
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "payment", "method", "amountMinor", "refundedAt"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    payment: (0, import_fields17.relationship)({ ref: "Payment.refunds", ...readOnly }),
    notice: (0, import_fields17.relationship)({ ref: "CancellationNotice.refunds", ...readOnly }),
    method: fixedChoice(["processor_refund", "check"], "processor_refund"),
    amountMinor: minor({ required: true }),
    reason: systemText(),
    approval: (0, import_fields17.relationship)({ ref: "ApprovalRequest", ...readOnly }),
    reference: systemText({ required: true }),
    refundedAt: (0, import_fields17.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    recordedBy: (0, import_fields17.relationship)({ ref: "User", ...readOnly }),
    ...trackingFields
  }
});
var CancellationEvaluation = (0, import_core17.list)({
  access: jobRows,
  ui: { labelField: "governingRule", listView: { initialColumns: ["job", "governingRule", "rightApplies", "evaluatedAt"] } },
  fields: {
    job: (0, import_fields17.relationship)({ ref: "Job", ...readOnly }),
    authorization: (0, import_fields17.relationship)({ ref: "Authorization", ...readOnly }),
    subjectType: fixedChoice(["EstimateVersion", "ChangeOrder"], "EstimateVersion"),
    subjectId: systemText({ indexed: true, required: true }),
    policyVersion: (0, import_fields17.relationship)({ ref: "PolicyVersion", ...readOnly }),
    inputs: (0, import_fields17.json)({ ...readOnly }),
    results: (0, import_fields17.json)({ ...readOnly }),
    rightApplies: (0, import_fields17.checkbox)({ defaultValue: false, ...readOnly }),
    governingRule: systemText(),
    evaluatedAt: (0, import_fields17.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    ...trackingFields
  }
});
var CancellationNotice = (0, import_core17.list)({
  access: jobRows,
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "job", "rule", "status", "cancelBy"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    evaluation: (0, import_fields17.relationship)({ ref: "CancellationEvaluation", ...readOnly }),
    job: (0, import_fields17.relationship)({ ref: "Job", ...readOnly }),
    customer: (0, import_fields17.relationship)({ ref: "Customer", ...readOnly }),
    estimateVersion: (0, import_fields17.relationship)({ ref: "EstimateVersion", ...readOnly }),
    changeOrder: (0, import_fields17.relationship)({ ref: "ChangeOrder", ...readOnly }),
    rule: fixedChoice(["ftc_16cfr429", "tx_bcc_601", "other"], "ftc_16cfr429"),
    rules: (0, import_fields17.json)({ ...readOnly }),
    policyVersion: (0, import_fields17.relationship)({ ref: "PolicyVersion", ...readOnly }),
    noticeTemplate: systemText({ required: true }),
    language: systemText({ required: true }),
    coveredWorkLines: (0, import_fields17.relationship)({ ref: "WorkLine.cancellationNotices", many: true, ...readOnly }),
    coveredAmountMinor: minor({ defaultValue: 0n }),
    transactionAt: (0, import_fields17.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    cancelBy: (0, import_fields17.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    timeZone: systemText({ required: true }),
    status: lifecycle(NOTICE_STATUSES),
    snapshot: (0, import_fields17.json)({ ...readOnly }),
    deliveryEvidence: (0, import_fields17.json)({ ...readOnly }),
    deliveredAt: (0, import_fields17.timestamp)({ ...readOnly }),
    noticeDocument: (0, import_fields17.relationship)({ ref: "Document", ...readOnly }),
    waiverDocument: (0, import_fields17.relationship)({ ref: "Document", ...readOnly }),
    cancelledAt: (0, import_fields17.timestamp)({ ...readOnly }),
    cancellationReceivedVia: fixedChoice(["", "signed_form", "mail", "email", "in_person", "portal"], ""),
    refundDueBy: (0, import_fields17.timestamp)({ ...readOnly }),
    refundDueMinor: minor({ defaultValue: 0n }),
    refundEvidence: (0, import_fields17.json)({ ...readOnly }),
    refunds: (0, import_fields17.relationship)({ ref: "Refund.notice", many: true, ...readOnly }),
    startOverride: (0, import_fields17.relationship)({ ref: "ApprovalRequest", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var ChangeOrder = (0, import_core17.list)({
  access: jobRows,
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "job", "status", "deltaMinor", "createdAt"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    job: (0, import_fields17.relationship)({ ref: "Job", ...readOnly }),
    estimate: (0, import_fields17.relationship)({ ref: "Estimate", ...readOnly }),
    priceBookVersion: (0, import_fields17.relationship)({ ref: "PriceBookVersion", ...readOnly }),
    status: lifecycle(["draft", "presented", "approved", "declined"]),
    reason: systemText(),
    lines: costGuardedJson({ ...readOnly, ui: { ...readOnly.ui, description: "{ add: [frozen line snapshots], remove: [workLineId] }" } }),
    deltaMinor: minor({ defaultValue: 0n, description: "Signed change to the sold price, in cents (removals are negative)." }),
    contentHash: costHash(),
    presentedAt: (0, import_fields17.timestamp)({ ...readOnly }),
    authorization: (0, import_fields17.relationship)({ ref: "Authorization", ...readOnly }),
    cancellationEvaluation: (0, import_fields17.relationship)({ ref: "CancellationEvaluation", ...readOnly }),
    decidedAt: (0, import_fields17.timestamp)({ ...readOnly }),
    createdBy: (0, import_fields17.relationship)({ ref: "User", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});

// features/keystone/models/billing.ts
var billing_exports = {};
__export(billing_exports, {
  AR_KINDS: () => AR_KINDS,
  AccountingExportBatch: () => AccountingExportBatch,
  AccountingExportLine: () => AccountingExportLine,
  ArEntry: () => ArEntry,
  ArPeriod: () => ArPeriod,
  BILLING_OFFICE: () => BILLING_OFFICE,
  COLLECTIONS_STATUSES: () => COLLECTIONS_STATUSES,
  CreditMemo: () => CreditMemo,
  CustomerCreditEntry: () => CustomerCreditEntry,
  Dispute: () => Dispute,
  FINANCING_STATUSES: () => FINANCING_STATUSES,
  FinancingApplication: () => FinancingApplication,
  FinancingFunding: () => FinancingFunding,
  FinancingProgram: () => FinancingProgram,
  INVOICE_STATUSES: () => INVOICE_STATUSES,
  Invoice: () => Invoice,
  InvoiceLine: () => InvoiceLine,
  PAYER_KINDS: () => PAYER_KINDS,
  PayerProfile: () => PayerProfile,
  PaymentAllocation: () => PaymentAllocation,
  PaymentAttempt: () => PaymentAttempt,
  PaymentBatch: () => PaymentBatch,
  TERMS: () => TERMS,
  ThirdPartyAuthorization: () => ThirdPartyAuthorization
});
var import_core18 = require("@keystone-6/core");
var import_fields18 = require("@keystone-6/core/fields");
init_access();
var INVOICE_STATUSES = ["draft", "posted", "partially_paid", "paid", "written_off", "voided", "discarded"];
var COLLECTIONS_STATUSES = ["current", "reminder_1", "reminder_2", "final_notice", "collections_agency", "lien_track", "resolved"];
var PAYER_KINDS = ["customer", "home_warranty_company", "property_manager", "commercial", "manufacturer", "distributor"];
var TERMS = ["due_on_receipt", "net_15", "net_30", "net_45", "net_60"];
var AR_KINDS = ["invoice_posted", "payment_applied", "payment_reversed", "credit_memo", "write_off", "write_off_reversal", "refund_reopen", "dispute_withdrawal", "dispute_reinstatement"];
var FINANCING_STATUSES = ["started", "submitted", "approved", "declined", "needs_info", "docs_signed", "awaiting_funding", "funded", "cancelled", "expired"];
var invoiceRows = jobScoped((own) => ({ job: own }));
var officeRows = { operation: { query: officeOnlyQuery, create: sys, update: sys, delete: sys } };
var PayerProfile = (0, import_core18.list)({
  access: managed(["canManageInvoices", "canPostInvoices", "canTakePayments", "canManageAccounting"], "canManageInvoices"),
  ui: { labelField: "name", listView: { initialColumns: ["name", "kind", "terms", "poRequired", "defaultNteMinor"] } },
  fields: {
    name: (0, import_fields18.text)({ validation: { isRequired: true } }),
    kind: fixedChoice(PAYER_KINDS, "commercial"),
    terms: fixedChoice(TERMS, "net_30"),
    poRequired: (0, import_fields18.checkbox)({ defaultValue: false }),
    defaultNteMinor: minor({ description: "Not-to-exceed on this payer's jobs unless the job sets its own, in cents." }),
    portalUrl: (0, import_fields18.text)(),
    billingContact: (0, import_fields18.text)(),
    accountingCustomerRef: (0, import_fields18.text)({ ui: { description: "The customer id in the accounting system, for the export." } }),
    active: (0, import_fields18.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var ThirdPartyAuthorization = (0, import_core18.list)({
  access: jobScoped((own) => ({ job: own })),
  ui: { labelField: "externalRef", listView: { initialColumns: ["externalRef", "job", "payer", "kind", "authorizedAmountMinor", "status"] } },
  fields: {
    job: (0, import_fields18.relationship)({ ref: "Job", ...readOnly }),
    payer: (0, import_fields18.relationship)({ ref: "PayerProfile", ...readOnly }),
    kind: fixedChoice(["home_warranty", "po", "nte", "insurance"], "po"),
    externalRef: systemText({ required: true }),
    authorizedAmountMinor: minor({ defaultValue: 0n }),
    serviceFeeMinor: minor({ defaultValue: 0n }),
    status: lifecycle(["requested", "authorized", "cash_out_offered", "denied", "consumed", "expired", "revised"]),
    revisionOf: (0, import_fields18.relationship)({ ref: "ThirdPartyAuthorization", ...readOnly }),
    evidence: (0, import_fields18.relationship)({ ref: "Document", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var ArPeriod = (0, import_core18.list)({
  access: governed(["canManageInvoices", "canPostInvoices", "canManageAccounting", "canCloseAr", "canApproveArClose"]),
  ui: { labelField: "month" },
  fields: {
    month: (0, import_fields18.calendarDay)({ isIndexed: "unique", validation: { isRequired: true }, ...readOnly }),
    status: lifecycle(["open", "closing", "closed"]),
    closedBy: (0, import_fields18.relationship)({ ref: "User", ...readOnly }),
    closedAt: (0, import_fields18.timestamp)({ ...readOnly }),
    approval: (0, import_fields18.relationship)({ ref: "ApprovalRequest", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var Invoice = (0, import_core18.list)({
  access: invoiceRows,
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "customer", "status", "invoiceDate", "dueDate", "totalMinor", "balanceMinor"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    publicCode: systemText({ indexed: "unique", required: true }),
    job: (0, import_fields18.relationship)({ ref: "Job", ...readOnly }),
    customer: (0, import_fields18.relationship)({ ref: "Customer", ...readOnly }),
    payer: (0, import_fields18.relationship)({ ref: "PayerProfile", ...readOnly }),
    payerKind: fixedChoice(PAYER_KINDS, "customer"),
    location: (0, import_fields18.relationship)({ ref: "ServiceLocation", ...readOnly }),
    propertyClass: fixedChoice(["residential", "nonresidential", "multiple_use"], "residential"),
    contractTaxMode: fixedChoice(["lump_sum", "separated", "not_applicable"], "lump_sum"),
    taxResult: (0, import_fields18.json)({ ...readOnly }),
    status: lifecycle(INVOICE_STATUSES),
    invoiceDate: (0, import_fields18.calendarDay)({ ...readOnly }),
    dueDate: (0, import_fields18.calendarDay)({ ...readOnly }),
    arPeriod: (0, import_fields18.relationship)({ ref: "ArPeriod", ...readOnly }),
    subtotalMinor: minor({ defaultValue: 0n }),
    discountMinor: minor({ defaultValue: 0n }),
    taxMinor: minor({ defaultValue: 0n }),
    totalMinor: minor({ defaultValue: 0n }),
    balanceMinor: minor({ defaultValue: 0n }),
    poNumber: systemText(),
    authorization: (0, import_fields18.relationship)({ ref: "ThirdPartyAuthorization", ...readOnly }),
    progressReason: systemText(),
    collectionsStatus: fixedChoice(COLLECTIONS_STATUSES, "current"),
    snapshot: (0, import_fields18.json)({ ...readOnly }),
    pdf: (0, import_fields18.relationship)({ ref: "Document", ...readOnly }),
    lines: (0, import_fields18.relationship)({ ref: "InvoiceLine.invoice", many: true, ...readOnly }),
    allocations: (0, import_fields18.relationship)({ ref: "PaymentAllocation.invoice", many: true, ...readOnly }),
    arEntries: (0, import_fields18.relationship)({ ref: "ArEntry.invoice", many: true, ...readOnly }),
    creditMemos: (0, import_fields18.relationship)({ ref: "CreditMemo.invoice", many: true, ...readOnly }),
    postedAt: (0, import_fields18.timestamp)({ ...readOnly }),
    postedBy: (0, import_fields18.relationship)({ ref: "User", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var InvoiceLine = (0, import_core18.list)({
  access: jobScoped((own) => ({ invoice: { job: own } })),
  ui: { labelField: "description", listView: { initialColumns: ["invoice", "description", "quantity", "unitPriceMinor", "amountMinor", "taxMinor"] } },
  fields: {
    invoice: (0, import_fields18.relationship)({ ref: "Invoice.lines", ...readOnly }),
    workLine: (0, import_fields18.relationship)({ ref: "WorkLine", ...readOnly }),
    description: systemText({ required: true }),
    quantity: qty({ required: true, ...readOnly }),
    uom: systemText(),
    unitPriceMinor: minor({ defaultValue: 0n }),
    amountMinor: minor({ defaultValue: 0n }),
    discountMinor: minor({ defaultValue: 0n }),
    taxCategory: fixedChoice(TAX_CATEGORIES, "labor"),
    taxable: (0, import_fields18.checkbox)({ defaultValue: false, ...readOnly }),
    taxBaseMinor: minor({ defaultValue: 0n }),
    taxRate: systemText(),
    taxMinor: minor({ defaultValue: 0n }),
    taxJurisdictions: (0, import_fields18.json)({ ...readOnly }),
    costMinor: minor({ defaultValue: 0n, ...costOnly }),
    revenueAccountCode: systemText(),
    sortOrder: (0, import_fields18.integer)({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    ...trackingFields
  }
});
var CreditMemo = (0, import_core18.list)({
  access: jobScoped((own) => ({ invoice: { job: own } })),
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "invoice", "reason", "status", "totalMinor"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    invoice: (0, import_fields18.relationship)({ ref: "Invoice.creditMemos", ...readOnly }),
    reason: fixedChoice(["pricing_error", "goodwill", "cancellation_right", "warranty", "recall", "duplicate", "other"], "other"),
    note: systemText(),
    status: lifecycle(["draft", "pending_approval", "posted", "applied", "rejected"]),
    totalMinor: minor({ defaultValue: 0n }),
    appliedToInvoiceMinor: minor({ defaultValue: 0n }),
    appliedToCreditMinor: minor({ defaultValue: 0n }),
    appliesTo: fixedChoice(["invoice_balance", "customer_credit"], "invoice_balance"),
    approval: (0, import_fields18.relationship)({ ref: "ApprovalRequest", ...readOnly }),
    createdBy: (0, import_fields18.relationship)({ ref: "User", ...readOnly }),
    postedAt: (0, import_fields18.timestamp)({ ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var PaymentBatch = (0, import_core18.list)({
  access: officeRows,
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "businessDate", "tenderGroup", "status", "expectedMinor", "depositedMinor", "varianceMinor"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    businessDate: (0, import_fields18.calendarDay)({ ...readOnly }),
    tenderGroup: fixedChoice(["card", "ach", "check_cash", "financing", "third_party"], "card"),
    status: lifecycle(["open", "closed", "reconciled", "exported"]),
    expectedMinor: minor({ defaultValue: 0n }),
    depositedMinor: minor({ defaultValue: 0n }),
    feesMinor: minor({ defaultValue: 0n }),
    varianceMinor: minor({ defaultValue: 0n }),
    depositReference: systemText(),
    closedBy: (0, import_fields18.relationship)({ ref: "User", ...readOnly }),
    closedAt: (0, import_fields18.timestamp)({ ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var PaymentAttempt = (0, import_core18.list)({
  access: officeRows,
  ui: { labelField: "intentKey", listView: { initialColumns: ["intentKey", "invoice", "amountMinor", "status", "createdAt"] } },
  fields: {
    intentKey: systemText({ indexed: "unique", required: true }),
    invoice: (0, import_fields18.relationship)({ ref: "Invoice", ...readOnly }),
    customer: (0, import_fields18.relationship)({ ref: "Customer", ...readOnly }),
    amountMinor: minor({ required: true }),
    method: fixedChoice(["card", "ach"], "card"),
    status: lifecycle(["pending", "succeeded", "failed", "unknown"]),
    failureNote: systemText(),
    resolutionNote: systemText(),
    payment: (0, import_fields18.relationship)({ ref: "Payment", ...readOnly }),
    createdBy: (0, import_fields18.relationship)({ ref: "User", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var PaymentAllocation = (0, import_core18.list)({
  access: officeRows,
  ui: { labelField: "kind", listView: { initialColumns: ["payment", "invoice", "kind", "amountMinor", "createdAt"] } },
  fields: {
    payment: (0, import_fields18.relationship)({ ref: "Payment", ...readOnly }),
    invoice: (0, import_fields18.relationship)({ ref: "Invoice.allocations", ...readOnly }),
    kind: fixedChoice(["apply", "reverse"], "apply"),
    reverses: (0, import_fields18.relationship)({ ref: "PaymentAllocation", ...readOnly }),
    amountMinor: minor({ required: true }),
    reason: systemText(),
    createdBy: (0, import_fields18.relationship)({ ref: "User", ...readOnly }),
    ...trackingFields
  }
});
var Dispute = (0, import_core18.list)({
  access: officeRows,
  ui: { labelField: "providerDisputeId", listView: { initialColumns: ["providerDisputeId", "payment", "amountMinor", "status", "evidenceDueBy"] } },
  fields: {
    payment: (0, import_fields18.relationship)({ ref: "Payment", ...readOnly }),
    providerDisputeId: systemText({ indexed: "unique", required: true }),
    amountMinor: minor({ required: true }),
    reasonCode: systemText(),
    status: lifecycle(["opened", "evidence_due", "evidence_submitted", "won", "lost"]),
    evidenceDueBy: (0, import_fields18.timestamp)({ ...readOnly }),
    note: systemText(),
    version: versionField(),
    ...trackingFields
  }
});
var ArEntry = (0, import_core18.list)({
  access: officeRows,
  ui: { labelField: "kind", listView: { initialColumns: ["invoice", "kind", "amountMinor", "sourceType", "postedAt"] } },
  fields: {
    invoice: (0, import_fields18.relationship)({ ref: "Invoice.arEntries", ...readOnly }),
    customer: (0, import_fields18.relationship)({ ref: "Customer", ...readOnly }),
    payer: (0, import_fields18.relationship)({ ref: "PayerProfile", ...readOnly }),
    kind: fixedChoice(AR_KINDS, "invoice_posted"),
    amountMinor: minor({ required: true }),
    sourceType: systemText(),
    sourceId: systemText({ indexed: true }),
    arPeriod: (0, import_fields18.relationship)({ ref: "ArPeriod", ...readOnly }),
    postedAt: (0, import_fields18.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    note: systemText(),
    ...trackingFields
  }
});
var CustomerCreditEntry = (0, import_core18.list)({
  access: officeRows,
  ui: { labelField: "kind", listView: { initialColumns: ["customer", "kind", "amountMinor", "sourceType", "createdAt"] } },
  fields: {
    customer: (0, import_fields18.relationship)({ ref: "Customer", ...readOnly }),
    kind: fixedChoice(["issued", "applied", "refunded", "expired"], "issued"),
    amountMinor: minor({ required: true, description: "Signed: issued is positive, the others reduce the balance." }),
    sourceType: systemText(),
    sourceId: systemText({ indexed: true }),
    ...trackingFields
  }
});
var FinancingProgram = (0, import_core18.list)({
  access: managed(["canOfferFinancing", "canManageInvoices", "canTakePayments"], ["canManageInvoices", "canManageAccounting"]),
  ui: { labelField: "name", listView: { initialColumns: ["name", "partner", "minMinor", "maxMinor", "active"] } },
  fields: {
    name: (0, import_fields18.text)({ validation: { isRequired: true } }),
    partner: fixedChoice(["wisetack", "other"], "wisetack"),
    minMinor: minor({ defaultValue: 50000n }),
    maxMinor: minor({ defaultValue: 2500000n }),
    termsNote: (0, import_fields18.text)({ ui: { displayMode: "textarea", description: "As the partner publishes it. We do not compute or promise rates." } }),
    applyUrl: (0, import_fields18.text)({ ui: { description: "The partner's hosted application link given to the customer." } }),
    active: (0, import_fields18.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var FinancingApplication = (0, import_core18.list)({
  access: jobScoped((own) => ({ job: own })),
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "customer", "program", "amountMinor", "status"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    customer: (0, import_fields18.relationship)({ ref: "Customer", ...readOnly }),
    job: (0, import_fields18.relationship)({ ref: "Job", ...readOnly }),
    estimateVersion: (0, import_fields18.relationship)({ ref: "EstimateVersion", ...readOnly }),
    invoice: (0, import_fields18.relationship)({ ref: "Invoice", ...readOnly }),
    program: (0, import_fields18.relationship)({ ref: "FinancingProgram", ...readOnly }),
    amountMinor: minor({ required: true }),
    status: lifecycle(FINANCING_STATUSES),
    consentRecordedAt: (0, import_fields18.timestamp)({ ...readOnly }),
    partnerReference: systemText(),
    offers: (0, import_fields18.json)({ ...readOnly, ui: { ...readOnly.ui, description: "Offers exactly as the partner gave them." } }),
    selectedOffer: (0, import_fields18.json)({ ...readOnly }),
    offerExpiresAt: (0, import_fields18.timestamp)({ ...readOnly }),
    declineNote: systemText(),
    fundings: (0, import_fields18.relationship)({ ref: "FinancingFunding.application", many: true, ...readOnly }),
    createdBy: (0, import_fields18.relationship)({ ref: "User", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var FinancingFunding = (0, import_core18.list)({
  access: officeRows,
  ui: { labelField: "reference", listView: { initialColumns: ["application", "grossMinor", "feeMinor", "fundedAt"] } },
  fields: {
    application: (0, import_fields18.relationship)({ ref: "FinancingApplication.fundings", ...readOnly }),
    grossMinor: minor({ required: true }),
    feeMinor: minor({ defaultValue: 0n }),
    reference: systemText({ required: true }),
    fundedAt: (0, import_fields18.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    payment: (0, import_fields18.relationship)({ ref: "Payment", ...readOnly }),
    ...trackingFields
  }
});
var AccountingExportBatch = (0, import_core18.list)({
  access: governed(["canManageAccounting", "canCloseAr"]),
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "periodFrom", "periodTo", "lineCount", "debitMinor", "creditMinor", "createdAt"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    format: fixedChoice(["csv"], "csv"),
    periodFrom: (0, import_fields18.calendarDay)({ ...readOnly }),
    periodTo: (0, import_fields18.calendarDay)({ ...readOnly }),
    status: lifecycle(["created", "downloaded"]),
    lineCount: (0, import_fields18.integer)({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    debitMinor: minor({ defaultValue: 0n }),
    creditMinor: minor({ defaultValue: 0n }),
    sha256: systemText(),
    lines: (0, import_fields18.relationship)({ ref: "AccountingExportLine.batch", many: true, ...readOnly }),
    createdBy: (0, import_fields18.relationship)({ ref: "User", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var AccountingExportLine = (0, import_core18.list)({
  access: governed(["canManageAccounting", "canCloseAr"]),
  ui: { labelField: "memo", listView: { initialColumns: ["batch", "entryDate", "account", "debitMinor", "creditMinor", "memo"] } },
  fields: {
    batch: (0, import_fields18.relationship)({ ref: "AccountingExportBatch.lines", ...readOnly }),
    sourceKey: systemText({ indexed: "unique", required: true }),
    entryDate: (0, import_fields18.calendarDay)({ ...readOnly }),
    account: systemText({ required: true }),
    debitMinor: minor({ defaultValue: 0n }),
    creditMinor: minor({ defaultValue: 0n }),
    memo: systemText(),
    docRef: systemText(),
    customerRef: systemText(),
    sortOrder: (0, import_fields18.integer)({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    ...trackingFields
  }
});

// features/keystone/models/memberships.ts
var memberships_exports = {};
__export(memberships_exports, {
  ATTEMPT_STATUSES: () => ATTEMPT_STATUSES,
  BILLING_FREQUENCIES: () => BILLING_FREQUENCIES,
  ENTRY_KINDS: () => ENTRY_KINDS,
  EntitlementEntry: () => EntitlementEntry,
  EntitlementGrant: () => EntitlementGrant,
  MEMBERSHIP_STATUSES: () => MEMBERSHIP_STATUSES,
  Membership: () => Membership,
  MembershipBillingAttempt: () => MembershipBillingAttempt,
  MembershipBillingRun: () => MembershipBillingRun,
  MembershipPlan: () => MembershipPlan,
  MembershipPlanVersion: () => MembershipPlanVersion,
  MembershipTerm: () => MembershipTerm,
  PLAN_VERSION_STATUSES: () => PLAN_VERSION_STATUSES,
  RecurringServiceEvent: () => RecurringServiceEvent,
  RenewalNotice: () => RenewalNotice,
  SIGNUP_CHANNELS: () => SIGNUP_CHANNELS,
  ServiceAgreement: () => ServiceAgreement
});
var import_core19 = require("@keystone-6/core");
var import_fields19 = require("@keystone-6/core/fields");
init_access();
var PLAN_VERSION_STATUSES = ["draft", "active", "retired"];
var MEMBERSHIP_STATUSES = ["pending_payment", "active", "past_due", "suspended", "renewal_due", "expired", "cancelled", "transferred"];
var BILLING_FREQUENCIES = ["annual", "monthly"];
var ATTEMPT_STATUSES = ["queued", "charging", "succeeded", "failed", "unknown"];
var ENTRY_KINDS = ["debit", "restore", "expire", "rollover"];
var SIGNUP_CHANNELS = ["office", "field", "phone", "online"];
var SELL = ["canSellMemberships", "canManageMemberships"];
var BILLING = ["canManageMemberships", "canManageInvoices", "canManageAccounting"];
var customerRows = (path) => ({
  operation: { query: officeOrTech([...SELL]), create: sys, update: sys, delete: sys },
  filter: { query: scoped((userId) => path({ jobs: { some: jobFilter(userId, true) } }), [...SELL]) }
});
var billingOnly = anyOf(...BILLING);
var hidden = { access: { read: billingOnly, create: () => false, update: () => false }, isFilterable: billingOnly, isOrderable: billingOnly, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } };
var MembershipPlan = (0, import_core19.list)({
  access: governed([...SELL, "canManagePriceBook"]),
  ui: { labelField: "name", listView: { initialColumns: ["name", "code", "status"] } },
  fields: {
    name: systemText({ required: true }),
    code: systemText({ indexed: "unique", required: true }),
    description: systemText(),
    status: lifecycle(["active", "retired"]),
    versions: (0, import_fields19.relationship)({ ref: "MembershipPlanVersion.plan", many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var MembershipPlanVersion = (0, import_core19.list)({
  access: governed([...SELL, "canManagePriceBook"]),
  ui: { labelField: "label", listView: { initialColumns: ["plan", "versionNumber", "status", "priceMinor", "billingFrequency"] } },
  fields: {
    plan: (0, import_fields19.relationship)({ ref: "MembershipPlan.versions", ...readOnly }),
    versionNumber: (0, import_fields19.integer)({ validation: { isRequired: true }, ...readOnly }),
    label: systemText(),
    status: lifecycle(PLAN_VERSION_STATUSES),
    /** Price of one payment: the whole term when billed annually, one month when billed monthly. */
    priceMinor: minor({ defaultValue: 0n, access: { read: () => true } }),
    billingFrequency: fixedChoice(BILLING_FREQUENCIES, "annual"),
    termMonths: (0, import_fields19.integer)({ defaultValue: 12, validation: { isRequired: true }, ...readOnly }),
    autoRenew: (0, import_fields19.checkbox)({ defaultValue: false, ...readOnly }),
    renewalNoticeDays: (0, import_fields19.integer)({ defaultValue: 30, validation: { isRequired: true }, ...readOnly }),
    /** [{ code, name, quantity, seasonStart: 'MM-DD'?, seasonEnd: 'MM-DD'?, rollover: 'none' | 'one_term' }] */
    entitlements: (0, import_fields19.json)({ ...readOnly }),
    /** [{ title, text }] the customer is promised besides visits (member prices, no trip fee, priority booking). */
    benefits: (0, import_fields19.json)({ ...readOnly }),
    cancellationRefundMethod: fixedChoice(["none", "prorata", "full_within_days"], "none"),
    cancellationRefundDays: (0, import_fields19.integer)({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    autoRenewalPolicyVersion: systemText(),
    consentWordingVersion: systemText(),
    consentWording: systemText(),
    activatedAt: (0, import_fields19.timestamp)({ ...readOnly }),
    createdBy: (0, import_fields19.relationship)({ ref: "User", ...readOnly }),
    ...trackingFields
  }
});
var Membership = (0, import_core19.list)({
  access: customerRows((own) => ({ customer: own })),
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "customer", "plan", "status", "startsOn"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    publicCode: systemText({ indexed: "unique", required: true }),
    customer: (0, import_fields19.relationship)({ ref: "Customer", ...readOnly }),
    location: (0, import_fields19.relationship)({ ref: "ServiceLocation", ...readOnly }),
    plan: (0, import_fields19.relationship)({ ref: "MembershipPlan", ...readOnly }),
    planVersion: (0, import_fields19.relationship)({ ref: "MembershipPlanVersion", ...readOnly }),
    status: lifecycle(MEMBERSHIP_STATUSES, "pending_payment"),
    startsOn: (0, import_fields19.calendarDay)({ ...readOnly }),
    terms: (0, import_fields19.relationship)({ ref: "MembershipTerm.membership", many: true, ...readOnly }),
    paymentMethodRef: (0, import_fields19.text)({ ...hidden }),
    paymentMethodLabel: systemText(),
    autoRenew: (0, import_fields19.checkbox)({ defaultValue: false, ...readOnly }),
    autoRenewConsent: (0, import_fields19.relationship)({ ref: "ConsentRecord", ...readOnly }),
    signupChannel: fixedChoice(SIGNUP_CHANNELS, "office"),
    soldBy: (0, import_fields19.relationship)({ ref: "User", ...readOnly }),
    transferredTo: (0, import_fields19.relationship)({ ref: "Membership", ...readOnly }),
    cancelledAt: (0, import_fields19.timestamp)({ ...readOnly }),
    cancelReason: systemText(),
    cancelEffectiveOn: (0, import_fields19.calendarDay)({ ...readOnly }),
    refundOwedMinor: minor({ defaultValue: 0n, access: { read: billingOnly } }),
    version: versionField(),
    ...trackingFields
  }
});
var MembershipTerm = (0, import_core19.list)({
  access: customerRows((own) => ({ membership: { customer: own } })),
  ui: { labelField: "termKey", listView: { initialColumns: ["membership", "termNumber", "startsOn", "endsOn", "status"] } },
  fields: {
    termKey: systemText({ indexed: "unique", required: true }),
    membership: (0, import_fields19.relationship)({ ref: "Membership.terms", ...readOnly }),
    termNumber: (0, import_fields19.integer)({ validation: { isRequired: true }, ...readOnly }),
    planVersion: (0, import_fields19.relationship)({ ref: "MembershipPlanVersion", ...readOnly }),
    startsOn: (0, import_fields19.calendarDay)({ ...readOnly }),
    endsOn: (0, import_fields19.calendarDay)({ ...readOnly }),
    billingFrequency: fixedChoice(BILLING_FREQUENCIES, "annual"),
    priceMinor: minor({ defaultValue: 0n, access: { read: () => true } }),
    slots: (0, import_fields19.integer)({ defaultValue: 1, validation: { isRequired: true }, ...readOnly }),
    status: lifecycle(["active", "cancelled"]),
    grants: (0, import_fields19.relationship)({ ref: "EntitlementGrant.term", many: true, ...readOnly }),
    ...trackingFields
  }
});
var EntitlementGrant = (0, import_core19.list)({
  access: customerRows((own) => ({ membership: { customer: own } })),
  ui: { labelField: "grantKey", listView: { initialColumns: ["membership", "name", "quantity", "windowStart", "windowEnd"] } },
  fields: {
    grantKey: systemText({ indexed: "unique", required: true }),
    membership: (0, import_fields19.relationship)({ ref: "Membership", ...readOnly }),
    term: (0, import_fields19.relationship)({ ref: "MembershipTerm.grants", ...readOnly }),
    code: systemText({ required: true }),
    name: systemText({ required: true }),
    quantity: (0, import_fields19.integer)({ validation: { isRequired: true }, ...readOnly }),
    windowStart: (0, import_fields19.calendarDay)({ ...readOnly }),
    windowEnd: (0, import_fields19.calendarDay)({ ...readOnly }),
    rolloverPolicy: fixedChoice(["none", "one_term"], "none"),
    entries: (0, import_fields19.relationship)({ ref: "EntitlementEntry.grant", many: true, ...readOnly }),
    ...trackingFields
  }
});
var EntitlementEntry = (0, import_core19.list)({
  access: customerRows((own) => ({ grant: { membership: { customer: own } } })),
  ui: { labelField: "kind", listView: { initialColumns: ["grant", "kind", "quantity", "occurredAt"] } },
  fields: {
    key: systemText({ indexed: "unique", required: true }),
    grant: (0, import_fields19.relationship)({ ref: "EntitlementGrant.entries", ...readOnly }),
    kind: fixedChoice(ENTRY_KINDS, "debit"),
    quantity: (0, import_fields19.integer)({ validation: { isRequired: true }, ...readOnly }),
    job: (0, import_fields19.relationship)({ ref: "Job", ...readOnly }),
    reason: systemText(),
    occurredAt: (0, import_fields19.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    createdBy: (0, import_fields19.relationship)({ ref: "User", ...readOnly }),
    ...trackingFields
  }
});
var RecurringServiceEvent = (0, import_core19.list)({
  access: customerRows((own) => ({ OR: [{ membership: { customer: own } }, { agreement: { customer: own } }] })),
  ui: { labelField: "name", listView: { initialColumns: ["name", "membership", "agreement", "dueFrom", "dueBy", "status"] } },
  fields: {
    eventKey: systemText({ indexed: "unique", required: true }),
    membership: (0, import_fields19.relationship)({ ref: "Membership", ...readOnly }),
    agreement: (0, import_fields19.relationship)({ ref: "ServiceAgreement.events", ...readOnly }),
    grant: (0, import_fields19.relationship)({ ref: "EntitlementGrant", ...readOnly }),
    code: systemText(),
    name: systemText({ required: true }),
    dueFrom: (0, import_fields19.calendarDay)({ ...readOnly }),
    dueBy: (0, import_fields19.calendarDay)({ ...readOnly }),
    status: lifecycle(["open", "booked", "skipped"]),
    job: (0, import_fields19.relationship)({ ref: "Job", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var MembershipBillingRun = (0, import_core19.list)({
  access: governed([...BILLING]),
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "period", "status", "chargedCount", "failedCount", "unknownCount"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    period: systemText({ required: true }),
    idempotencyKey: (0, import_fields19.text)({ ...hidden, isIndexed: "unique" }),
    status: lifecycle(["running", "completed", "partial"]),
    queuedCount: (0, import_fields19.integer)({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    chargedCount: (0, import_fields19.integer)({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    failedCount: (0, import_fields19.integer)({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    unknownCount: (0, import_fields19.integer)({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    remainingCount: (0, import_fields19.integer)({ defaultValue: 0, validation: { isRequired: true }, ...readOnly }),
    chargedMinor: minor({ defaultValue: 0n }),
    startedBy: (0, import_fields19.relationship)({ ref: "User", ...readOnly }),
    startedAt: (0, import_fields19.timestamp)({ ...readOnly }),
    completedAt: (0, import_fields19.timestamp)({ ...readOnly }),
    ...trackingFields
  }
});
var MembershipBillingAttempt = (0, import_core19.list)({
  access: governed([...BILLING]),
  ui: { labelField: "attemptKey", listView: { initialColumns: ["membership", "termNumber", "slot", "dueOn", "amountMinor", "status"] } },
  fields: {
    attemptKey: systemText({ indexed: "unique", required: true }),
    membership: (0, import_fields19.relationship)({ ref: "Membership", ...readOnly }),
    term: (0, import_fields19.relationship)({ ref: "MembershipTerm", ...readOnly }),
    termNumber: (0, import_fields19.integer)({ validation: { isRequired: true }, ...readOnly }),
    slot: (0, import_fields19.integer)({ validation: { isRequired: true }, ...readOnly }),
    dueOn: (0, import_fields19.calendarDay)({ ...readOnly }),
    amountMinor: minor({ defaultValue: 0n }),
    status: lifecycle(ATTEMPT_STATUSES),
    /** Goes up by one only after the processor confirmed the last try failed; each generation has its own processor key. */
    generation: (0, import_fields19.integer)({ defaultValue: 1, validation: { isRequired: true }, ...readOnly }),
    providerKey: (0, import_fields19.text)({ ...hidden }),
    providerRef: (0, import_fields19.text)({ ...hidden }),
    failureNote: systemText(),
    run: (0, import_fields19.relationship)({ ref: "MembershipBillingRun", ...readOnly }),
    invoice: (0, import_fields19.relationship)({ ref: "Invoice", ...readOnly }),
    payment: (0, import_fields19.relationship)({ ref: "Payment", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var RenewalNotice = (0, import_core19.list)({
  access: governed([...SELL]),
  ui: { labelField: "noticeKey", listView: { initialColumns: ["membership", "kind", "dueOn", "status"] } },
  fields: {
    noticeKey: systemText({ indexed: "unique", required: true }),
    membership: (0, import_fields19.relationship)({ ref: "Membership", ...readOnly }),
    term: (0, import_fields19.relationship)({ ref: "MembershipTerm", ...readOnly }),
    kind: fixedChoice(["renewal_coming", "auto_renew_reminder"], "renewal_coming"),
    dueOn: (0, import_fields19.calendarDay)({ ...readOnly }),
    message: systemText(),
    status: lifecycle(["drafted", "contacted", "dismissed"]),
    preparedBy: (0, import_fields19.relationship)({ ref: "User", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var AGREEMENT_PERMISSIONS = ["canManageMemberships", "canManageInvoices", "canManageAccounting", "canBook", "canDispatch"];
var ServiceAgreement = (0, import_core19.list)({
  access: governed([...AGREEMENT_PERMISSIONS]),
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "name", "customer", "status", "startsOn", "endsOn"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    name: systemText({ required: true }),
    customer: (0, import_fields19.relationship)({ ref: "Customer", ...readOnly }),
    location: (0, import_fields19.relationship)({ ref: "ServiceLocation", ...readOnly }),
    payer: (0, import_fields19.relationship)({ ref: "PayerProfile", ...readOnly }),
    status: lifecycle(["draft", "active", "ended"]),
    startsOn: (0, import_fields19.calendarDay)({ ...readOnly }),
    endsOn: (0, import_fields19.calendarDay)({ ...readOnly }),
    scope: systemText(),
    /** Months of the year (01-12) a planned-maintenance visit is due. */
    visitMonths: (0, import_fields19.json)({ ...readOnly }),
    poNumber: (0, import_fields19.text)({ ...hidden }),
    nteMinor: minor({ defaultValue: 0n, access: { read: billingOnly } }),
    events: (0, import_fields19.relationship)({ ref: "RecurringServiceEvent.agreement", many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});

// features/keystone/models/index.ts
var listsOf = (module2) => Object.fromEntries(Object.entries(module2).filter(([name, value]) => /^[A-Z]/.test(name) && typeof value === "object" && value !== null && "fields" in value));
var models = {
  User,
  Role,
  OAuthApp,
  OAuthToken,
  ...listsOf(company_exports),
  ...listsOf(platform_exports),
  ...listsOf(policy_exports),
  ...listsOf(agents_exports),
  ...listsOf(people_exports),
  ...listsOf(crm_exports),
  ...listsOf(demand_exports),
  ...listsOf(booking_exports),
  ...listsOf(jobs_exports),
  ...listsOf(sales_exports),
  ...listsOf(billing_exports),
  ...listsOf(memberships_exports)
};

// features/keystone/index.ts
var import_session2 = require("@keystone-6/core/session");

// features/keystone/mutations/index.ts
var import_schema = require("@graphql-tools/schema");

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(root, args, context) {
  const userCount = await context.sudo().query.User.count({});
  if (userCount === 0) {
    return true;
  }
  return false;
}
var redirectToInit_default = redirectToInit;

// features/keystone/mutations/updateActiveUser.ts
init_access();
async function updateActiveUser(_root, { data }, context) {
  const session = context.session;
  if (!isSignedIn({ session })) throw new Error("Not authenticated");
  const allowed = /* @__PURE__ */ new Set(["email", "name", "password", "onboardingStatus"]);
  if (Object.keys(data || {}).some((key2) => !allowed.has(key2))) throw new Error("Unsupported profile field");
  return context.db.User.updateOne({ where: { id: session.itemId }, data });
}
var updateActiveUser_default = updateActiveUser;

// features/keystone/mutations/op.ts
var import_graphql = require("graphql");
init_errors();
var UNSAFE = /prisma|invocation|\bat\s+\S+\s*\(|node_modules|postgres(ql)?:\/\/|\bSQL\b|ECONN|query engine|\.ts:\d+|\.js:\d+/i;
var SAFE_DETAIL_KEYS = /* @__PURE__ */ new Set(["currentStatus", "currentVersion", "to", "reason", "field", "problems", "replay"]);
var op = (fn) => async (root, args, context) => {
  try {
    return await fn(root, args, context);
  } catch (error) {
    if (error instanceof import_graphql.GraphQLError) throw error;
    if (isDomainError(error)) {
      const details = Object.fromEntries(Object.entries(error.details).filter(([key2]) => SAFE_DETAIL_KEYS.has(key2)));
      throw new import_graphql.GraphQLError(error.message, { extensions: { code: error.code, ...details } });
    }
    const message = typeof error?.message === "string" ? error.message : "";
    console.error("Operation failed:", message.slice(0, 300).replace(/postgres(ql)?:\/\/\S+/g, "<url>"));
    const safe = message && message.length <= 300 && !UNSAFE.test(message) && !error?.code;
    throw new import_graphql.GraphQLError(safe ? message : "Unable to complete the request. Please try again.", { extensions: { code: "KS_USER_INPUT_ERROR" } });
  }
};

// features/keystone/mutations/setup.ts
init_actor();

// features/keystone/lib/agentGate.ts
var import_node_crypto3 = require("node:crypto");
init_canonical();
init_actor();
init_errors();
async function authorizeOperation(db, actor, tool, permissions2, inputs = {}) {
  if (actor.kind !== "agent") return requirePermission(actor, ...permissions2);
  if (actor.scopes.has(tool)) return;
  await db.agentAction.create({
    data: {
      agentId: actor.agentId,
      tool,
      idempotencyKey: `denied:${(0, import_node_crypto3.randomUUID)()}`,
      inputsHash: payloadHash(inputs),
      status: "rejected",
      output: toJsonValue({ code: Codes.SCOPE_DENIED })
    }
  });
  throw new DomainError(Codes.SCOPE_DENIED, `The agent has no active ${tool} grant.`);
}
async function recordAgentAction(uow, actor, spec) {
  if (actor.kind !== "agent") return null;
  const row = await uow.tx.agentAction.create({
    data: {
      agentId: actor.agentId,
      tool: spec.tool,
      idempotencyKey: `${actor.agentId}:${spec.idempotencyKey}`,
      inputsHash: payloadHash(spec.inputs),
      status: "applied",
      output: toJsonValue(spec.output),
      appliedEffects: toJsonValue({ auditEvents: uow.pendingAuditCount() })
    }
  });
  return row.id;
}
async function recordAgentRead(db, actor, spec) {
  if (actor.kind !== "agent") return null;
  const row = await db.agentAction.create({
    data: { agentId: actor.agentId, tool: spec.tool, idempotencyKey: `${actor.agentId}:read:${(0, import_node_crypto3.randomUUID)()}`, inputsHash: payloadHash(spec.inputs), status: "applied", output: toJsonValue(spec.output) },
    select: { id: true }
  });
  return row.id;
}

// features/keystone/mutations/actorFor.ts
init_actor();
init_errors();

// features/keystone/mcp-oauth/agentSession.ts
var AGENT_ROLE_ID = "seed_role_ai_agent";
var agentUserId = (agentId) => `agent_user_${agentId}`;

// features/keystone/mcp-oauth/session.ts
async function resolveMcpAccessToken(context, token, listKey = "User") {
  try {
    const sudo = context.sudo();
    const record = await sudo.db.OAuthToken.findOne({ where: { token: digestToken(token) } });
    if (!record || record.tokenType !== "access_token" || record.isRevoked !== "false" || !record.userId || !record.expiresAt || new Date(record.expiresAt).getTime() <= Date.now()) {
      return void 0;
    }
    const app = await sudo.db.OAuthApp.findOne({ where: { clientId: record.clientId } });
    if (!app || app.status !== "active") return void 0;
    const mcp = {
      clientId: record.clientId,
      scopes: storedScopes(record.scopes),
      tokenId: String(record.id)
    };
    const bound = await sudo.db.AgentIdentity.findMany({ where: { oauthApp: { id: { equals: app.id } } }, take: 1 });
    const agent = bound[0];
    const issuedTo = String(record.agentId ?? "");
    if (issuedTo || agent) {
      if (!agent || !issuedTo || String(agent.id) !== issuedTo) return void 0;
      if (agent.status !== "active" || agent.killSwitch) return void 0;
      mcp.agentId = String(agent.id);
      return { itemId: agentUserId(String(agent.id)), listKey, mcp, agent: { id: String(agent.id) } };
    }
    return { itemId: String(record.userId), listKey, mcp };
  } catch {
    return void 0;
  }
}
function withMcpBearerSessions(strategy, listKey = "User") {
  return {
    ...strategy,
    async get({ context }) {
      const token = bearerToken(context?.req?.headers?.authorization);
      if (isMcpAccessToken(token)) return resolveMcpAccessToken(context, token, listKey);
      return strategy.get({ context });
    }
  };
}
function mcpSessionMarker(session) {
  const marker = session?.mcp;
  return marker && typeof marker.clientId === "string" && Array.isArray(marker.scopes) ? marker : null;
}

// features/keystone/mutations/actorFor.ts
async function actorFor(context) {
  const person = actorFromSession(context.session);
  const marker = mcpSessionMarker(context.session);
  if (!marker) return person;
  const agent = await context.prisma.agentIdentity.findFirst({
    where: { ...marker.agentId ? { id: marker.agentId } : {}, oauthApp: { clientId: { equals: marker.clientId } } },
    select: { id: true, name: true, status: true, killSwitch: true, ownerId: true, grants: { where: { status: "active", autonomy: { not: "disabled" }, revokedAt: null }, select: { tool: true } } }
  });
  if (!agent) {
    if (marker.agentId) throw new DomainError(Codes.NOT_AUTHORIZED, "This connection is no longer linked to an agent. Reconnect the app.");
    return person;
  }
  if (agent.status !== "active" || agent.killSwitch) throw new DomainError(Codes.AGENT_DISABLED, `The agent ${agent.name} is ${agent.killSwitch ? "stopped by its kill switch" : agent.status}.`);
  return { kind: "agent", agentId: agent.id, ownerUserId: agent.ownerId, name: agent.name, scopes: new Set(agent.grants.map((g) => g.tool)) };
}

// features/keystone/lib/command.ts
init_canonical();
init_actor();

// features/keystone/lib/idempotency.ts
init_canonical();
init_db();
init_errors();
var IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,200}$/;
function assertIdempotencyKey(key2) {
  if (typeof key2 !== "string" || !key2.trim()) throw new DomainError(Codes.IDEMPOTENCY_KEY_REQUIRED, "An idempotency key is required.");
  if (!IDEMPOTENCY_KEY.test(key2)) throw new DomainError(Codes.INVALID_INPUT, "The idempotency key must be 8 to 200 letters, digits or . _ : -");
}
async function claimReceipt(tx, input) {
  assertIdempotencyKey(input.key);
  await advisoryLock(tx, `command:${input.key}`);
  const existing = await tx.commandReceipt.findUnique({ where: { idempotencyKey: input.key } });
  if (!existing) return { replay: false };
  const requestHash = payloadHash(input.params);
  if (existing.command !== input.command || existing.principalKey !== input.principalKey || existing.requestHash !== requestHash) {
    throw new DomainError(Codes.IDEMPOTENCY_KEY_REUSED, "This idempotency key was already used for a different request.");
  }
  return { replay: true, responseBody: existing.responseBody };
}
async function writeReceipt(tx, input) {
  await tx.commandReceipt.create({
    data: {
      idempotencyKey: input.key,
      command: input.command,
      principalKey: input.principalKey,
      requestHash: payloadHash(input.params),
      requestParams: toJsonValue(canonicalize(input.params)),
      responseCode: "ok",
      responseBody: toJsonValue(input.response),
      recoveryPoint: "completed",
      completedAt: input.now
    }
  });
}

// features/keystone/lib/audit.ts
var import_node_crypto4 = require("node:crypto");
init_canonical();
init_db();
var GENESIS_HASH = "0".repeat(64);
function auditHashBody(row) {
  return {
    seq: row.seq,
    eventKey: row.eventKey,
    eventType: row.eventType,
    entityType: row.entityType,
    entityId: row.entityId,
    actorUserId: row.actorUserId ?? null,
    actorAgentId: row.actorAgentId ?? null,
    approverId: row.approverId ?? null,
    reason: row.reason || null,
    before: row.before ?? null,
    after: row.after ?? null,
    metadata: row.metadata ?? null,
    requestId: row.requestId || null,
    at: row.at.toISOString()
  };
}
var AUDIT_HASH_VERSION = "v2";
var auditHash = (prevHash, row) => `${AUDIT_HASH_VERSION}:${keyedPayloadHash({ prev: prevHash, body: auditHashBody(row) }, "audit-chain")}`;
function storedAuditOf(row) {
  return {
    ...row,
    reason: row.reason || null,
    requestId: row.requestId || null,
    actorUserId: row.actorUserId ?? null,
    actorAgentId: row.actorAgentId ?? null,
    approverId: row.approverId ?? null
  };
}
async function appendAuditEvents(tx, events, now = /* @__PURE__ */ new Date()) {
  if (!events.length) return [];
  await advisoryLock(tx, "audit:chain");
  const last = await tx.auditEvent.findFirst({ orderBy: { seq: "desc" }, select: { seq: true, hash: true } });
  let seq = last?.seq ?? 0;
  let prevHash = last?.hash ?? GENESIS_HASH;
  const written = [];
  const rows = [];
  for (const event of events) {
    seq += 1;
    const row = {
      seq,
      eventKey: event.eventKey ?? (0, import_node_crypto4.randomUUID)(),
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      actorUserId: event.actorUserId ?? null,
      actorAgentId: event.actorAgentId ?? null,
      approverId: event.approverId ?? null,
      reason: event.reason ? event.reason.slice(0, 2e3) : null,
      before: event.before === void 0 ? null : toJsonValue(event.before),
      after: event.after === void 0 ? null : toJsonValue(event.after),
      metadata: event.metadata === void 0 ? null : toJsonValue(event.metadata),
      requestId: event.requestId ?? null,
      prevHash,
      at: now
    };
    const hash = auditHash(prevHash, row);
    rows.push({
      seq: row.seq,
      eventKey: row.eventKey,
      eventType: row.eventType,
      entityType: row.entityType,
      entityId: row.entityId,
      actorUserId: row.actorUserId,
      actorAgentId: row.actorAgentId,
      approverId: row.approverId,
      reason: row.reason ?? "",
      // Nullable json columns: omit null (stored as SQL NULL, read back as null).
      ...row.before === null ? {} : { before: row.before },
      ...row.after === null ? {} : { after: row.after },
      ...row.metadata === null ? {} : { metadata: row.metadata },
      requestId: row.requestId ?? "",
      prevHash,
      hash,
      at: row.at
    });
    written.push({ seq, hash });
    prevHash = hash;
  }
  await tx.auditEvent.createMany({ data: rows });
  return written;
}
async function verifyAuditChain(db, batchSize = 1e3) {
  let prevHash = GENESIS_HASH;
  let expectedSeq = 1;
  let count = 0;
  for (; ; ) {
    const rows = await db.auditEvent.findMany({ where: { seq: { gte: expectedSeq } }, orderBy: { seq: "asc" }, take: batchSize });
    if (!rows.length) break;
    for (const row of rows) {
      if (row.seq !== expectedSeq) return { ok: false, count, lastSeq: expectedSeq - 1, lastHash: prevHash, brokenAtSeq: expectedSeq, problem: "missing event" };
      if (row.prevHash !== prevHash) return { ok: false, count, lastSeq: row.seq - 1, lastHash: prevHash, brokenAtSeq: row.seq, problem: "previous hash does not match" };
      const hash = auditHash(prevHash, storedAuditOf(row));
      if (hash !== row.hash) return { ok: false, count, lastSeq: row.seq - 1, lastHash: prevHash, brokenAtSeq: row.seq, problem: row.hash.startsWith(`${AUDIT_HASH_VERSION}:`) ? "content does not match its hash" : "hash is not a keyed chain hash (run npm run audit:rechain)" };
      prevHash = row.hash;
      expectedSeq += 1;
      count += 1;
    }
  }
  return { ok: true, count, lastSeq: expectedSeq - 1, lastHash: prevHash };
}

// features/keystone/lib/unitOfWork.ts
init_db();
var UnitOfWork = class {
  constructor(tx, now, requestId) {
    this.tx = tx;
    this.now = now;
    this.requestId = requestId;
    this.audits = [];
  }
  audit(event) {
    this.audits.push({ requestId: this.requestId, ...event });
  }
  pendingAuditCount() {
    return this.audits.length;
  }
};
async function runInTransaction(db, work, options = {}) {
  return db.$transaction(async (tx) => {
    const uow = new UnitOfWork(tx, options.now ?? /* @__PURE__ */ new Date(), options.requestId ?? null);
    const result = await work(uow);
    await appendAuditEvents(tx, uow.audits, uow.now);
    return result;
  }, TRANSACTION_OPTIONS);
}

// features/keystone/lib/command.ts
var RETRYABLE = /deadlock detected|could not serialize|P2034|40P01|40001/i;
async function command(db, spec, work) {
  const principal = principalKey(spec.actor);
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await runInTransaction(db, async (uow) => {
        const receipt = await claimReceipt(uow.tx, { key: spec.idempotencyKey, command: spec.name, principalKey: principal, params: spec.params });
        if (receipt.replay) return { replay: true, value: receipt.responseBody };
        const value = toJsonValue(await work(uow));
        await writeReceipt(uow.tx, { key: spec.idempotencyKey, command: spec.name, principalKey: principal, params: spec.params, response: value, now: uow.now });
        return { replay: false, value };
      }, { requestId: spec.requestId ?? null, now: spec.now });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = error?.code ?? "";
      if (attempt < 4 && (RETRYABLE.test(message) || RETRYABLE.test(code))) continue;
      throw error;
    }
  }
}

// features/keystone/mutations/setup.ts
init_errors();

// features/keystone/seed/platform.ts
init_access();

// features/keystone/lib/calendar.ts
var FEDERAL_HOLIDAYS = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-01-19", name: "Birthday of Martin Luther King, Jr." },
  { date: "2026-02-16", name: "Washington's Birthday" },
  { date: "2026-05-25", name: "Memorial Day" },
  { date: "2026-06-19", name: "Juneteenth National Independence Day" },
  { date: "2026-07-03", name: "Independence Day", observed: true },
  { date: "2026-07-04", name: "Independence Day" },
  { date: "2026-09-07", name: "Labor Day" },
  { date: "2026-10-12", name: "Columbus Day" },
  { date: "2026-11-11", name: "Veterans Day" },
  { date: "2026-11-26", name: "Thanksgiving Day" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2027-01-01", name: "New Year's Day" },
  { date: "2027-01-18", name: "Birthday of Martin Luther King, Jr." },
  { date: "2027-02-15", name: "Washington's Birthday" },
  { date: "2027-05-31", name: "Memorial Day" },
  { date: "2027-06-18", name: "Juneteenth National Independence Day", observed: true },
  { date: "2027-06-19", name: "Juneteenth National Independence Day" },
  { date: "2027-07-04", name: "Independence Day" },
  { date: "2027-07-05", name: "Independence Day", observed: true },
  { date: "2027-09-06", name: "Labor Day" },
  { date: "2027-10-11", name: "Columbus Day" },
  { date: "2027-11-11", name: "Veterans Day" },
  { date: "2027-11-25", name: "Thanksgiving Day" },
  { date: "2027-12-24", name: "Christmas Day", observed: true },
  { date: "2027-12-25", name: "Christmas Day" },
  { date: "2027-12-31", name: "New Year's Day", observed: true },
  { date: "2028-01-01", name: "New Year's Day" },
  { date: "2028-01-17", name: "Birthday of Martin Luther King, Jr." },
  { date: "2028-02-21", name: "Washington's Birthday" },
  { date: "2028-05-29", name: "Memorial Day" },
  { date: "2028-06-19", name: "Juneteenth National Independence Day" },
  { date: "2028-07-04", name: "Independence Day" },
  { date: "2028-09-04", name: "Labor Day" },
  { date: "2028-10-09", name: "Columbus Day" },
  { date: "2028-11-10", name: "Veterans Day", observed: true },
  { date: "2028-11-11", name: "Veterans Day" },
  { date: "2028-11-23", name: "Thanksgiving Day" },
  { date: "2028-12-25", name: "Christmas Day" }
];
var FEDERAL_SOURCE = "16 CFR 429.0(f) business day (eCFR, checked 2026-11-07); holidays per 5 U.S.C. 6103(a)-(b), 2026-2028, actual and observed dates";
var US_FEDERAL = {
  code: "US-FEDERAL",
  timeZone: "America/New_York",
  weekendDays: [0],
  holidays: new Set(FEDERAL_HOLIDAYS.map((h) => h.date)),
  coverageThrough: "2028-12-31"
};
var DATE = /^\d{4}-\d{2}-\d{2}$/;
function assertDate(date) {
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || (/* @__PURE__ */ new Date(`${date}T00:00:00Z`)).toISOString().slice(0, 10) !== date) throw new Error(`Invalid date ${date}`);
}
function addDays(date, days) {
  assertDate(date);
  const t = Date.parse(`${date}T12:00:00Z`) + days * 864e5;
  return new Date(t).toISOString().slice(0, 10);
}
var weekday = (date) => (/* @__PURE__ */ new Date(`${date}T12:00:00Z`)).getUTCDay();
var inZone = (calendar, timeZone) => ({ ...calendar, timeZone });
function covered(calendar, date) {
  if (date > calendar.coverageThrough) throw new Error(`${calendar.code} has no verified schedule for ${date}`);
}
function isBusinessDay(calendar, date) {
  assertDate(date);
  covered(calendar, date);
  return !calendar.weekendDays.includes(weekday(date)) && !calendar.holidays.has(date);
}
function nextBusinessDay(calendar, date) {
  let d = addDays(date, 1);
  while (!isBusinessDay(calendar, d)) d = addDays(d, 1);
  return d;
}
function previousBusinessDay(calendar, date) {
  let d = addDays(date, -1);
  while (!isBusinessDay(calendar, d)) d = addDays(d, -1);
  return d;
}
function addBusinessDays(calendar, date, n) {
  if (!Number.isSafeInteger(n)) throw new Error("Business-day count must be a whole number");
  let d = date;
  for (let i = 0; i < Math.abs(n); i += 1) d = n > 0 ? nextBusinessDay(calendar, d) : previousBusinessDay(calendar, d);
  return d;
}
var zoneParts = (timeZone, at) => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(at)).map((p) => [p.type, p.value]));
function localDate(calendar, at) {
  const p = zoneParts(calendar.timeZone, typeof at === "number" ? at : at.getTime());
  return `${p.year}-${p.month}-${p.day}`;
}
function zonedInstant(timeZone, date, hhmm2) {
  assertDate(date);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm2)) throw new Error(`Invalid time ${hhmm2}`);
  const [h, m] = hhmm2.split(":").map((x) => Number.parseInt(x, 10));
  let guess = Date.parse(`${date}T${hhmm2}:00Z`);
  for (let i = 0; i < 3; i += 1) {
    const p = zoneParts(timeZone, guess);
    const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    const target = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), h, m);
    const diff = target - local;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}
function cancelByDeadline(calendar, transactionAt, timeZone, businessDays) {
  const cal = inZone(calendar, timeZone);
  const transactionDate = localDate(cal, transactionAt);
  const lastDay = addBusinessDays(cal, transactionDate, businessDays);
  return { transactionDate, lastDay, deadline: zonedInstant(timeZone, addDays(lastDay, 1), "00:00") };
}

// features/keystone/seed/platform.ts
init_cas();
init_canonical();

// features/keystone/domain/policySchemas.ts
var import_zod = require("zod");
var minorText = import_zod.z.string().regex(/^\d{1,15}$/, "whole cents as a string");
var decimalText = import_zod.z.string().regex(/^\d+(\.\d+)?$/, "a decimal as a string");
var hhmm = import_zod.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm");
var trade = import_zod.z.enum(["hvac", "plumbing", "electrical", "general"]);
var window = import_zod.z.object({ start: hhmm, end: hhmm }).refine((w) => w.start < w.end, "start must be before end");
var homeSolicitationRules = import_zod.z.object({
  rules: import_zod.z.array(import_zod.z.object({
    code: import_zod.z.string().min(1),
    title: import_zod.z.string().min(1),
    /** Price that triggers the right, at the buyer's residence and elsewhere (temporary places). */
    thresholdAtResidenceMinor: minorText,
    thresholdElsewhereMinor: minorText.nullable(),
    /** "$25 or more" (at_least) vs "exceeds $25" (more_than). */
    thresholdComparison: import_zod.z.enum(["at_least", "more_than"]),
    /**
     * door_to_door (16 CFR 429.0(a)): the agreement is given at a non-merchant place, including after the
     * buyer invited the seller; requested-repair lines are excluded per line. personal_solicitation (Tex.
     * Bus. & Com. Code §601.002(a)): only what the merchant personally solicited away from its place of
     * business is covered: every line when the visit itself was solicited, else the added lines.
     */
    scope: import_zod.z.enum(["door_to_door", "personal_solicitation"]).default("door_to_door"),
    /** Cancel until midnight of this business day after the transaction. */
    businessDays: import_zod.z.number().int().min(1).max(15),
    calendar: import_zod.z.string().min(1),
    /** Situations where the right does not arise; evaluated per sold line. */
    exclusions: import_zod.z.array(import_zod.z.object({ code: import_zod.z.string(), description: import_zod.z.string(), perLine: import_zod.z.boolean().default(false) })),
    /** Trade-specific exemptions, e.g. the Texas ACR exemption for consumer-initiated transactions. */
    exemptions: import_zod.z.array(import_zod.z.object({ code: import_zod.z.string(), trades: import_zod.z.array(trade).min(1), when: import_zod.z.enum(["consumer_initiated"]), except: import_zod.z.array(import_zod.z.string()).default([]) })).default([]),
    emergencyWaiver: import_zod.z.object({ allowed: import_zod.z.boolean(), handwritten: import_zod.z.boolean(), signedAndDated: import_zod.z.boolean() }),
    noticeTemplate: import_zod.z.string().min(1),
    /**
     * Rules the pack follows without a primary source. Each is data: it shows on the Policies screen
     * and in DOMAIN, and stays flagged until counsel confirms it and a new version replaces it.
     */
    assumptions: import_zod.z.array(import_zod.z.object({ code: import_zod.z.string().min(1), status: import_zod.z.enum(["counsel_to_confirm"]), flaggedOn: import_zod.z.string(), statement: import_zod.z.string().min(1), affects: import_zod.z.array(import_zod.z.string()).default([]) })).default([]),
    /** Refund, return of trade-ins and release of security interests within this many business days of the buyer's notice. */
    refundBusinessDays: import_zod.z.number().int().min(1).max(30).default(10)
  })).min(1)
});
var homeImprovementContractRules = import_zod.z.object({
  depositCapPct: decimalText.nullable(),
  depositCapMinor: minorText.nullable(),
  requiredFields: import_zod.z.array(import_zod.z.string()),
  licenseDisplay: import_zod.z.boolean()
});
var autoRenewalRules = import_zod.z.object({
  affirmativeConsentRequired: import_zod.z.boolean(),
  noticeLeadDays: import_zod.z.number().int().min(0).max(120).nullable(),
  annualReminder: import_zod.z.boolean(),
  onlineCancelRequired: import_zod.z.boolean()
});
var callRecordingRules = import_zod.z.object({
  consent: import_zod.z.enum(["one_party", "all_party"]),
  disclosureRequired: import_zod.z.boolean(),
  disclosureText: import_zod.z.string().min(1)
});
var contactHoursRules = import_zod.z.object({
  /** Purposes these hours restrict. Transactional messages the customer asked for are governed separately. */
  purposes: import_zod.z.array(import_zod.z.enum(["solicitation", "marketing", "ai_voice_outbound", "transactional"])).min(1),
  basis: import_zod.z.literal("recipient_local_time"),
  weekdays: window,
  saturday: window,
  sunday: window,
  exemptions: import_zod.z.array(import_zod.z.string()).default([])
});
var refrigerantRules = import_zod.z.object({
  technicianCertificationRequired: import_zod.z.boolean(),
  certificationTypes: import_zod.z.array(import_zod.z.enum(["type_i", "type_ii", "type_iii", "universal"])),
  disposalRecords: import_zod.z.object({ minChargeLb: decimalText, maxChargeLb: decimalText, includesHfc: import_zod.z.boolean() }),
  leakRepair: import_zod.z.object({ minChargeLb: decimalText, repairDays: import_zod.z.number().int().min(1), effectiveFrom: import_zod.z.string(), excludedSubsectors: import_zod.z.array(import_zod.z.string()) }),
  installRules: import_zod.z.array(import_zod.z.object({ refrigerant: import_zod.z.string(), equipmentClass: import_zod.z.string(), allowed: import_zod.z.boolean(), condition: import_zod.z.string() }))
});
var licensingRules = import_zod.z.object({
  requirements: import_zod.z.array(import_zod.z.object({
    trade,
    jobTag: import_zod.z.string().min(1),
    companyLicense: import_zod.z.object({ issuer: import_zod.z.string(), classes: import_zod.z.array(import_zod.z.string()).min(1), endorsement: import_zod.z.string().nullable() }).nullable(),
    individual: import_zod.z.object({ anyOf: import_zod.z.array(import_zod.z.string()).min(1), supervisionBy: import_zod.z.array(import_zod.z.string()).default([]) }).nullable(),
    maxCoolingTons: decimalText.nullable().default(null),
    maxHeatingBtuh: import_zod.z.number().int().nullable().default(null)
  })).min(1)
});
var salesTaxRules = import_zod.z.object({
  engine: import_zod.z.enum(["native_tables", "adapter"]),
  stateRate: decimalText,
  maxLocalRate: decimalText,
  localRates: import_zod.z.array(import_zod.z.object({ code: import_zod.z.string(), name: import_zod.z.string(), rate: decimalText })),
  matrix: import_zod.z.array(import_zod.z.object({
    propertyClass: import_zod.z.enum(["residential", "nonresidential", "multiple_use"]),
    contractTaxMode: import_zod.z.enum(["lump_sum", "separated", "any"]),
    taxCategory: import_zod.z.enum(["labor", "material", "equipment", "fee", "disposal", "maintenance", "warranty_reimbursed", "any"]),
    taxable: import_zod.z.boolean(),
    basis: import_zod.z.enum(["price", "at_least_cost", "none"]),
    note: import_zod.z.string().optional()
  })).min(1),
  rounding: import_zod.z.enum(["per_line", "per_invoice_jurisdiction"])
});
var wageHourRules = import_zod.z.object({
  weeklyOvertimeHours: decimalText,
  dailyOvertimeHours: decimalText.nullable(),
  overtimeMultiplier: decimalText,
  workweekStartDay: import_zod.z.number().int().min(0).max(6),
  regularRateReview: import_zod.z.boolean()
});
var lienRules = import_zod.z.object({
  clocks: import_zod.z.array(import_zod.z.object({
    party: import_zod.z.enum(["original_contractor", "derivative_claimant"]),
    projectClass: import_zod.z.enum(["residential", "other"]),
    action: import_zod.z.enum(["file_affidavit", "notice_to_owner"]),
    kind: import_zod.z.literal("day_of_nth_month_after"),
    monthsAfter: import_zod.z.number().int().min(1).max(12),
    dayOfMonth: import_zod.z.number().int().min(1).max(28),
    from: import_zod.z.enum(["month_work_completed", "month_labor_or_materials_delivered"])
  })).min(1)
});
var privacyRules = import_zod.z.object({
  retention: import_zod.z.array(import_zod.z.object({ record: import_zod.z.string(), years: import_zod.z.number().int().min(0), verified: import_zod.z.boolean() })),
  dataSubjectRequests: import_zod.z.object({ export: import_zod.z.boolean(), delete: import_zod.z.boolean(), legalHoldRecords: import_zod.z.array(import_zod.z.string()) })
});
var POLICY_SCHEMAS = {
  home_solicitation: homeSolicitationRules,
  home_improvement_contract: homeImprovementContractRules,
  auto_renewal: autoRenewalRules,
  call_recording: callRecordingRules,
  contact_hours: contactHoursRules,
  refrigerant: refrigerantRules,
  licensing: licensingRules,
  sales_tax: salesTaxRules,
  wage_hour: wageHourRules,
  lien: lienRules,
  privacy: privacyRules
};
function parsePolicyRules(kind, rules2) {
  const schema = POLICY_SCHEMAS[kind];
  if (!schema) throw new Error(`Unknown policy kind ${kind}`);
  return schema.safeParse(rules2);
}

// features/keystone/seed/company.ts
init_access();
var COMPANY = {
  legalName: "Summit Plumbing & Air LLC",
  displayName: "Summit Plumbing & Air",
  homeTimeZone: "America/Chicago",
  currencyCode: "USD",
  defaultCountry: "US"
};
var BASE = ["canAccessDashboard", "canSeeOtherPeople"];
var all = (except) => permissionNames.filter((name) => !except.includes(name));
var ROLES = [
  { id: "seed_role_ai_agent", name: "AI Agent", description: "Least privilege for AI agents. Holds no permission: an agent acts only through its tool grants, and never sees cost or margin.", permissions: [] },
  { id: "seed_role_owner", name: "Owner", description: "Everything except break-glass. Break-glass is never on a default role.", permissions: all(["canBreakGlass"]) },
  { id: "seed_role_gm", name: "General Manager", description: "Runs the shop day to day and approves money and policy changes.", permissions: all(["canBreakGlass", "canManageRoles", "canRunPayroll"]) },
  { id: "seed_role_csr", name: "CSR", description: "Answers calls, books jobs, takes payments and sells memberships.", permissions: [...BASE, "canManageCustomers", "canReadCustomerPII", "canManageLeads", "canBook", "canViewBoard", "canTakePayments", "canSellMemberships", "canOfferFinancing", "canSendMessages"] },
  { id: "seed_role_dispatcher", name: "Dispatcher", description: "Owns the board: assigns, reassigns and overbooks within limits.", permissions: [...BASE, "canManageCustomers", "canReadCustomerPII", "canRevealAccessSecret", "canBook", "canOverbook", "canDispatch", "canViewBoard", "canSendMessages"] },
  { id: "seed_role_technician", name: "Technician", description: "Works assigned visits in the field app: estimates, payments, equipment and refrigerant entries.", permissions: ["canAccessDashboard", "canWorkVisits", "canRevealAccessSecret", "canPresentEstimates", "canSellEstimates", "canTakePayments", "canOfferFinancing", "canManageEquipment", "canManageRefrigerant"] },
  { id: "seed_role_comfort_advisor", name: "Comfort Advisor", description: "Replacement sales: presents good/better/best options and financing.", permissions: [...BASE, "canManageCustomers", "canReadCustomerPII", "canViewBoard", "canPresentEstimates", "canSellEstimates", "canTakePayments", "canOfferFinancing", "canSellMemberships"] },
  { id: "seed_role_service_manager", name: "Service Manager", description: "Runs the service department: discounts, overbooks, timesheets, warranty and the price book draft.", permissions: [...BASE, "canManageCustomers", "canReadCustomerPII", "canBook", "canDispatch", "canViewBoard", "canApproveOverbook", "canApproveDiscounts", "canManagePriceBook", "canManageEquipment", "canSubmitWarrantyClaims", "canManagePermits", "canApproveTimesheets", "canReadAudit"] },
  { id: "seed_role_install_manager", name: "Install Manager", description: "Runs installs: permits, purchasing and install crews.", permissions: [...BASE, "canManageCustomers", "canReadCustomerPII", "canViewBoard", "canDispatch", "canApproveDiscounts", "canManageEquipment", "canSubmitWarrantyClaims", "canManagePermits", "canManageRefrigerant", "canPurchase", "canApproveTimesheets"] },
  { id: "seed_role_warehouse", name: "Warehouse", description: "Receives, counts and replenishes trucks.", permissions: ["canAccessDashboard", "canManageInventory", "canPurchase", "canReceive"] },
  { id: "seed_role_accounting", name: "Accounting", description: "Invoices, payments, AR, refunds and the accounting export.", permissions: [...BASE, "canReadCustomerPII", "canManageInvoices", "canPostInvoices", "canTakePayments", "canManagePayments", "canIssueRefunds", "canApproveRefunds", "canApproveCredits", "canApproveWriteOff", "canManageAccounting", "canCloseAr", "canApprovePurchases", "canReadAudit"] },
  { id: "seed_role_payroll", name: "Payroll Admin", description: "Timesheets, pay plans and pay periods.", permissions: [...BASE, "canApproveTimesheets", "canManagePayPlans", "canRunPayroll", "canReadPay"] },
  { id: "seed_role_marketing", name: "Marketing", description: "Campaigns, tracking numbers and message templates.", permissions: [...BASE, "canManageLeads", "canManageCampaigns", "canRunCampaigns", "canManageTemplates", "canSendMessages"] },
  { id: "seed_role_customer", name: "Customer", description: "Customer portal API only; no dashboard.", permissions: [] },
  { id: "seed_role_payer_contact", name: "Payer Contact", description: "Third-party payer portal API only (home warranty, property managers); no dashboard.", permissions: [] }
];
var STAFF = [
  { id: "seed_user_whitfield", name: "Dana Whitfield", email: "dana.whitfield@summitplumbingair.com", title: "Owner", phone: "+15125550101", roleId: "seed_role_owner" },
  { id: "seed_user_ortega", name: "Marcus Ortega", email: "marcus.ortega@summitplumbingair.com", title: "General Manager", phone: "+15125550102", roleId: "seed_role_gm" },
  { id: "seed_user_raman", name: "Priya Raman", email: "priya.raman@summitplumbingair.com", title: "Customer Service Representative", phone: "+15125550103", roleId: "seed_role_csr" },
  { id: "seed_user_mendoza", name: "Luis Mendoza", email: "luis.mendoza@summitplumbingair.com", title: "Customer Service Representative", phone: "+15125550104", roleId: "seed_role_csr" },
  { id: "seed_user_tran", name: "Kelsey Tran", email: "kelsey.tran@summitplumbingair.com", title: "Customer Service Representative", phone: "+15125550105", roleId: "seed_role_csr" },
  { id: "seed_user_brooks", name: "Andre Brooks", email: "andre.brooks@summitplumbingair.com", title: "Dispatcher", phone: "+15125550106", roleId: "seed_role_dispatcher" },
  { id: "seed_user_reyes", name: "Tom\xE1s Reyes", email: "tomas.reyes@summitplumbingair.com", title: "Warehouse Lead", phone: "+15125550107", roleId: "seed_role_warehouse" },
  { id: "seed_user_cole", name: "Hannah Cole", email: "hannah.cole@summitplumbingair.com", title: "Accountant", phone: "+15125550108", roleId: "seed_role_accounting" },
  { id: "seed_user_kim", name: "Rachel Kim", email: "rachel.kim@summitplumbingair.com", title: "Comfort Advisor", phone: "+15125550109", roleId: "seed_role_comfort_advisor" }
];
var BRAND = { id: "seed_brand_summit", name: "Summit Plumbing & Air", phone: "+15125550100", email: "service@summitplumbingair.com", website: "https://summitplumbingair.com" };
var LICENSES = [
  { id: "seed_license_acr", trade: "hvac", jurisdictionCode: "US-TX", issuer: "TDLR", licenseNumber: "TACLA00098765E", licenseClass: "A", endorsements: ["environmental_air"], responsibleName: "Dana Whitfield" },
  { id: "seed_license_rmp", trade: "plumbing", jurisdictionCode: "US-TX", issuer: "TSBPE", licenseNumber: "RMP-00045678", licenseClass: "Responsible Master Plumber", endorsements: [], responsibleName: "Ray Castillo" },
  { id: "seed_license_tecl", trade: "electrical", jurisdictionCode: "US-TX", issuer: "TDLR", licenseNumber: "TECL-00034567", licenseClass: "Electrical Contractor", endorsements: [], responsibleName: "Grace Bennett" }
];
var BRANCH = {
  id: "seed_branch_austin",
  name: "Austin",
  code: "AUS",
  timeZone: "America/Chicago",
  line1: "4100 Industrial Blvd",
  city: "Austin",
  region: "TX",
  postalCode: "78744",
  country: "US",
  lat: "30.209500",
  lng: "-97.738100"
};
var BUSINESS_UNITS = [
  { id: "seed_bu_hvac_service", name: "HVAC Service", code: "HVAC-SVC", trade: "hvac", kind: "service", revenueAccountCode: "4010" },
  { id: "seed_bu_hvac_install", name: "HVAC Install", code: "HVAC-INS", trade: "hvac", kind: "install", revenueAccountCode: "4020" },
  { id: "seed_bu_plumbing_service", name: "Plumbing Service", code: "PLB-SVC", trade: "plumbing", kind: "service", revenueAccountCode: "4110" },
  { id: "seed_bu_electrical", name: "Electrical", code: "ELE-SVC", trade: "electrical", kind: "service", revenueAccountCode: "4210" }
];
var SERVICE_AREAS = [
  { id: "seed_area_austin", name: "Austin core", travelZone: "standard", zips: ["78701", "78702", "78703", "78704", "78705", "78721", "78722", "78723", "78741", "78744", "78745", "78746", "78748", "78749", "78751", "78756", "78757", "78758", "78759"] },
  { id: "seed_area_north", name: "Round Rock, Pflugerville & Cedar Park", travelZone: "standard", zips: ["78613", "78660", "78664", "78665", "78681", "78717", "78727", "78728", "78729", "78750"] },
  { id: "seed_area_extended", name: "Extended (trip fee applies)", travelZone: "extended", zips: ["78610", "78620", "78626", "78628", "78633", "78634", "78641", "78652", "78653", "78737", "78738", "78739"] }
];
var COMPANY_CLOSED_HOLIDAYS = ["New Year's Day", "Memorial Day", "Independence Day", "Labor Day", "Thanksgiving Day", "Christmas Day"];
var APPROVAL_POLICIES = [
  { action: "company.controls", description: "Change the company-wide discount, refund and purchase-order approval thresholds.", requiredPermission: "canApprovePolicies", expiresAfterMinutes: 1440 },
  { action: "policy.publish", description: "Publish a jurisdiction policy version (cancellation rights, tax, licensing, contact hours).", requiredPermission: "canApprovePolicies", expiresAfterMinutes: 7 * 1440 },
  { action: "role.assign_approval", description: "Give a person a role that can approve.", requiredPermission: "canManageRoles", expiresAfterMinutes: 1440 },
  { action: "agent_grant.activate", description: "Activate a tool grant for an AI agent.", requiredPermission: "canApproveAgentGrants", expiresAfterMinutes: 1440 },
  { action: "booking.overbook", description: "Book past a window's capacity.", requiredPermission: "canApproveOverbook", expiresAfterMinutes: 60 },
  { action: "customer.merge", description: "Merge two customer records.", requiredPermission: "canApproveMerges", expiresAfterMinutes: 1440 },
  { action: "estimate.discount", description: "Apply a discount above the seller's limit.", requiredPermission: "canApproveDiscounts", expiresAfterMinutes: 240 },
  { action: "cancellation.start_override", description: "Start work the buyer can still cancel, before the cooling-off window closes.", requiredPermission: "canApprovePolicies", expiresAfterMinutes: 240 },
  { action: "pricebook.publish", description: "Publish a price book version.", requiredPermission: "canApprovePriceBook", expiresAfterMinutes: 7 * 1440 },
  { action: "invoice.write_off", description: "Write off an invoice balance.", requiredPermission: "canApproveWriteOff", expiresAfterMinutes: 1440 },
  { action: "credit.issue", description: "Issue a customer credit.", requiredPermission: "canApproveCredits", expiresAfterMinutes: 1440 },
  { action: "refund.issue", description: "Refund a payment above the refund threshold.", requiredPermission: "canApproveRefunds", expiresAfterMinutes: 1440, thresholdMinor: 50000n },
  { action: "purchase_order.submit", description: "Submit a purchase order above the PO threshold.", requiredPermission: "canApprovePurchases", expiresAfterMinutes: 1440, thresholdMinor: 250000n },
  { action: "stock.variance", description: "Post a cycle-count variance.", requiredPermission: "canApproveStockVariance", expiresAfterMinutes: 1440 },
  { action: "warranty.write_off", description: "Write off an unrecovered warranty claim.", requiredPermission: "canApproveWarrantyWriteOff", expiresAfterMinutes: 1440 },
  { action: "pay_plan.publish", description: "Publish a pay plan version.", requiredPermission: "canApprovePayPlans", expiresAfterMinutes: 1440 },
  { action: "pay_period.approve", description: "Approve a calculated pay period for export.", requiredPermission: "canApprovePayPeriods", expiresAfterMinutes: 1440 },
  { action: "ar_period.close", description: "Close an AR period.", requiredPermission: "canApproveArClose", expiresAfterMinutes: 1440 },
  { action: "campaign.send", description: "Send a marketing campaign.", requiredPermission: "canApproveCampaigns", expiresAfterMinutes: 1440 }
];

// features/keystone/seed/policyPacks.ts
var versionsOf = (pack) => [{ ...pack.version, versionNumber: 1, reason: "Initial verified policy load" }, ...pack.later ?? []];
var ECFR_429 = "https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-429";
var TX_601 = "https://statutes.capitol.texas.gov/Docs/BC/htm/BC.601.htm";
var TX_1302 = "https://statutes.capitol.texas.gov/Docs/OC/htm/OC.1302.htm";
var TX_PROP_41 = "https://statutes.capitol.texas.gov/Docs/PR/htm/PR.41.htm";
var TX_PROP_53 = "https://statutes.capitol.texas.gov/Docs/PR/htm/PR.53.htm";
var FTC_RULE_TX = {
  code: "ftc_cooling_off",
  title: "FTC Cooling-Off Rule (16 CFR 429)",
  thresholdAtResidenceMinor: "2500",
  thresholdElsewhereMinor: "13000",
  thresholdComparison: "at_least",
  businessDays: 3,
  calendar: "US-FEDERAL",
  exclusions: [
    { code: "retail_prior_negotiation", description: "Prior negotiations at the seller's fixed retail location.", perLine: false },
    { code: "tila_rescission", description: "Truth in Lending rescission applies instead.", perLine: false },
    { code: "emergency_waiver", description: "Buyer-initiated emergency with a dated, signed, handwritten waiver.", perLine: false },
    { code: "mail_or_phone_only", description: "Entirely by mail or telephone.", perLine: false },
    { code: "requested_repair", description: "Requested repair or maintenance; additional goods or services are not excluded.", perLine: true }
  ],
  exemptions: [],
  emergencyWaiver: { allowed: true, handwritten: true, signedAndDated: true },
  noticeTemplate: "ftc_429_notice_of_cancellation"
};
var TX_601_RULE = {
  code: "tx_601",
  title: "Texas home solicitation (Bus. & Com. Code ch. 601)",
  thresholdAtResidenceMinor: "2500",
  thresholdElsewhereMinor: "2500",
  thresholdComparison: "more_than",
  businessDays: 3,
  calendar: "US-FEDERAL",
  exclusions: [],
  exemptions: [{ code: "tx_acr_consumer_initiated", trades: ["hvac"], when: "consumer_initiated", except: ["breach_of_express_warranty", "negligent_installation"] }],
  emergencyWaiver: { allowed: false, handwritten: true, signedAndDated: true },
  noticeTemplate: "tx_601_notice_of_cancellation"
};
var TX_BUSINESS_DAY_ASSUMPTION = {
  code: "tx_business_day_calendar",
  status: "counsel_to_confirm",
  flaggedOn: "2026-11-08",
  statement: 'Chapter 601 does not define "business day". This rule counts every day except Sunday and federal holidays (the 16 CFR 429.0(f) calendar, Saturday counts). If Texas excludes Saturday, the cancel-by date printed on a notice can be a day earlier than the statute allows (\xA7601.053(b)(4): "not earlier than the third business day"). Counsel to confirm before general availability.',
  affects: ["cancel_by", "refund_due_by"]
};
var TX_SOLICITATION_REFS = [
  { ref: "16 CFR 429.0-429.1", url: ECFR_429, verified: true, checkedOn: "2026-11-07" },
  { ref: "Tex. Bus. & Com. Code \xA7601.002 (scope: personally solicited away from the place of business; price over $25)", url: TX_601, verified: true, checkedOn: "2026-11-07" },
  { ref: "Tex. Bus. & Com. Code \xA7601.051 (cancel until midnight of the third business day after signing)", url: TX_601, verified: true, checkedOn: "2026-11-07" },
  { ref: "Tex. Bus. & Com. Code \xA7601.052 (receipt or contract in the language of the sale, with the bold 10-point statement and an attached notice of cancellation)", url: TX_601, verified: true, checkedOn: "2026-11-08" },
  { ref: 'Tex. Bus. & Com. Code ch. 601 "business day" definition', url: TX_601, verified: false, note: "Section 601.001 defines no business day. The federal 16 CFR 429.0(f) calendar is used; verify before GA." },
  { ref: "Tex. Bus. & Com. Code \xA7\xA7601.003-601.004 (emergency waiver)", url: TX_601, verified: false, note: "Not readable from the statutes mirrors. No Texas emergency waiver is honoured (fail closed) until verified." },
  { ref: "Tex. Occ. Code \xA71302.003 (ch. 601 does not apply to a consumer-initiated ACR transaction, except breach of express warranty or negligent installation)", url: TX_1302, verified: true, checkedOn: "2026-11-07" }
];
var TX_SOLICITATION_REFS_V3 = TX_SOLICITATION_REFS.map((ref) => ref.ref.includes('"business day" definition') ? { ...ref, verified: false, note: "ASSUMPTION, counsel to confirm. Chapter 601 (\xA7601.001) defines no business day and no primary Texas text was found that does. The federal 16 CFR 429.0(f) calendar (Saturday counts; Sunday and federal holidays do not) is the default. Tex. Gov't Code \xA7311.014 rolls a last day that falls on a Saturday, Sunday or legal holiday forward, but does not define a business day either." } : ref);
var TX_SOLICITATION_REFS_V4 = TX_SOLICITATION_REFS_V3.map((ref) => ref.ref.includes("(emergency waiver)") ? { ref: "Tex. Bus. & Com. Code \xA7601.151 (a consumer's ch. 601 rights cannot be waived in the contract or receipt; ch. 601 has no emergency exception)", url: TX_601, verified: true, checkedOn: "2026-11-09", note: "No Texas emergency waiver is honoured (fail closed). Under 16 CFR 429.2(b) the state law stands where it protects at least as much." } : ref);
var POLICY_PACKS = [
  {
    id: "seed_pack_us_home_solicitation",
    code: "us-federal-home-solicitation",
    name: "FTC Cooling-Off Rule",
    kind: "home_solicitation",
    jurisdictionCode: "US",
    description: "16 CFR 429: three business days to cancel a door-to-door sale.",
    binding: { id: "seed_binding_us_home_solicitation", scope: "company", scopeValue: "company", priority: 0 },
    version: {
      id: "seed_policy_us_home_solicitation_v1",
      effectiveFrom: "2026-01-01",
      rules: {
        rules: [{
          code: "ftc_cooling_off",
          title: "FTC Cooling-Off Rule (16 CFR 429)",
          thresholdAtResidenceMinor: "2500",
          thresholdElsewhereMinor: "13000",
          thresholdComparison: "at_least",
          businessDays: 3,
          calendar: "US-FEDERAL",
          exclusions: [
            { code: "retail_prior_negotiation", description: "Made under prior negotiations during the buyer's visit to the seller's fixed retail location.", perLine: false },
            { code: "tila_rescission", description: "The buyer already has a right of rescission under the Truth in Lending Act.", perLine: false },
            { code: "emergency_waiver", description: "Buyer-initiated, bona fide immediate personal emergency, with a separate dated, signed, handwritten waiver.", perLine: false },
            { code: "mail_or_phone_only", description: "Conducted and consummated entirely by mail or telephone, with no other contact before delivery or performance.", perLine: false },
            { code: "requested_repair", description: "Buyer-initiated visit requested for repair or maintenance of the buyer's property. Additional goods or services beyond replacement parts necessarily used are not excluded.", perLine: true }
          ],
          exemptions: [],
          emergencyWaiver: { allowed: true, handwritten: true, signedAndDated: true },
          noticeTemplate: "ftc_429_notice_of_cancellation"
        }]
      },
      sourceRefs: [
        { ref: "16 CFR 429.0(a) (door-to-door sale; $25 at residence, $130 elsewhere; exclusions 1-6)", url: ECFR_429, verified: true, checkedOn: "2026-11-07" },
        { ref: "16 CFR 429.0(f) (business day: any calendar day except Sunday or any federal holiday)", url: ECFR_429, verified: true, checkedOn: "2026-11-07" },
        { ref: "16 CFR 429.1(a)-(b) (cancel before midnight of the third business day; notice of cancellation)", url: ECFR_429, verified: true, checkedOn: "2026-11-07" }
      ]
    }
  },
  {
    id: "seed_pack_tx_home_solicitation",
    code: "us-tx-home-solicitation",
    name: "Texas home solicitation (Bus. & Com. Code ch. 601)",
    kind: "home_solicitation",
    jurisdictionCode: "US-TX",
    description: "Federal rule plus Texas ch. 601, with the ACR exemption for consumer-initiated transactions (Occ. Code \xA71302.003).",
    binding: { id: "seed_binding_tx_home_solicitation", scope: "state", scopeValue: "US-TX", priority: 0 },
    version: {
      id: "seed_policy_tx_home_solicitation_v1",
      effectiveFrom: "2026-01-01",
      rules: {
        rules: [
          {
            code: "ftc_cooling_off",
            title: "FTC Cooling-Off Rule (16 CFR 429)",
            thresholdAtResidenceMinor: "2500",
            thresholdElsewhereMinor: "13000",
            thresholdComparison: "at_least",
            businessDays: 3,
            calendar: "US-FEDERAL",
            exclusions: [
              { code: "retail_prior_negotiation", description: "Prior negotiations at the seller's fixed retail location.", perLine: false },
              { code: "tila_rescission", description: "Truth in Lending rescission applies instead.", perLine: false },
              { code: "emergency_waiver", description: "Buyer-initiated emergency with a dated, signed, handwritten waiver.", perLine: false },
              { code: "mail_or_phone_only", description: "Entirely by mail or telephone.", perLine: false },
              { code: "requested_repair", description: "Requested repair or maintenance; additional goods or services are not excluded.", perLine: true }
            ],
            exemptions: [],
            emergencyWaiver: { allowed: true, handwritten: true, signedAndDated: true },
            noticeTemplate: "ftc_429_notice_of_cancellation"
          },
          {
            code: "tx_601",
            title: "Texas home solicitation (Bus. & Com. Code ch. 601)",
            thresholdAtResidenceMinor: "2500",
            thresholdElsewhereMinor: "2500",
            thresholdComparison: "more_than",
            businessDays: 3,
            calendar: "US-FEDERAL",
            exclusions: [],
            exemptions: [{ code: "tx_acr_consumer_initiated", trades: ["hvac"], when: "consumer_initiated", except: ["breach_of_express_warranty", "negligent_installation"] }],
            emergencyWaiver: { allowed: false, handwritten: true, signedAndDated: true },
            noticeTemplate: "tx_601_notice_of_cancellation"
          }
        ]
      },
      sourceRefs: [
        { ref: "16 CFR 429.0-429.1", url: ECFR_429, verified: true, checkedOn: "2026-11-07" },
        { ref: "Tex. Bus. & Com. Code \xA7601.002 (scope: personally solicited away from the place of business; price over $25)", url: TX_601, verified: true, checkedOn: "2026-11-07" },
        { ref: "Tex. Bus. & Com. Code \xA7601.051 (cancel until midnight of the third business day after signing)", url: TX_601, verified: true, checkedOn: "2026-11-07" },
        { ref: 'Tex. Bus. & Com. Code ch. 601 "business day" definition', url: TX_601, verified: false, note: "Not readable from the statutes site (script-rendered). The federal 16 CFR 429.0(f) calendar is used; verify the chapter 601 definition, and whether ch. 601 has an emergency waiver, before GA." },
        { ref: "Tex. Occ. Code \xA71302.003 (ch. 601 does not apply to a consumer-initiated ACR transaction, except breach of express warranty or negligent installation)", url: TX_1302, verified: true, checkedOn: "2026-11-07" }
      ]
    },
    later: [
      {
        id: "seed_policy_tx_home_solicitation_v2",
        versionNumber: 2,
        effectiveFrom: "2026-11-08",
        reason: "Chapter 601 covers what the merchant personally solicited: on a visit the customer asked for, that is the work proposed on site, not the requested repair.",
        rules: { rules: [FTC_RULE_TX, { ...TX_601_RULE, scope: "personal_solicitation", refundBusinessDays: 10 }] },
        sourceRefs: TX_SOLICITATION_REFS
      },
      {
        id: "seed_policy_tx_home_solicitation_v3",
        versionNumber: 3,
        effectiveFrom: "2026-11-09",
        reason: 'Chapter 601 does not define "business day". The federal calendar (everything but Sunday and federal holidays) stays as the conservative default, now recorded as an explicit assumption for counsel to confirm.',
        rules: { rules: [FTC_RULE_TX, { ...TX_601_RULE, scope: "personal_solicitation", refundBusinessDays: 10, assumptions: [TX_BUSINESS_DAY_ASSUMPTION] }] },
        sourceRefs: TX_SOLICITATION_REFS_V3
      },
      {
        id: "seed_policy_tx_home_solicitation_v4",
        versionNumber: 4,
        effectiveFrom: "2026-11-10",
        reason: "Corrects the source reference for the emergency waiver: Texas ch. 601 has no \xA7\xA7601.003-601.004 waiver; \xA7601.151 bars waiving ch. 601 rights. The rules are unchanged (no Texas emergency waiver).",
        rules: { rules: [FTC_RULE_TX, { ...TX_601_RULE, scope: "personal_solicitation", refundBusinessDays: 10, assumptions: [TX_BUSINESS_DAY_ASSUMPTION] }] },
        sourceRefs: TX_SOLICITATION_REFS_V4
      }
    ]
  },
  {
    id: "seed_pack_tx_home_improvement_contract",
    code: "us-tx-home-improvement-contract",
    name: "Texas residential construction contracts",
    kind: "home_improvement_contract",
    jurisdictionCode: "US-TX",
    description: "What a Texas residential improvement contract must carry: the homestead warning, the lien-law disclosure and the contractor's licence.",
    binding: { id: "seed_binding_tx_home_improvement_contract", scope: "state", scopeValue: "US-TX", priority: 0 },
    version: {
      id: "seed_policy_tx_home_improvement_contract_v1",
      effectiveFrom: "2026-01-01",
      rules: {
        depositCapPct: null,
        depositCapMinor: null,
        requiredFields: ["contractor_name_address", "contractor_license", "scope_of_work", "price", "payment_terms", "homestead_warning", "lien_disclosure", "cancellation_notice"],
        licenseDisplay: true
      },
      sourceRefs: [
        { ref: 'Tex. Prop. Code \xA741.007(a) (homestead improvement contract: 10-point bold "IMPORTANT NOTICE: You and your contractor are responsible for meeting the terms and conditions of this contract\u2026")', url: TX_PROP_41, verified: true, checkedOn: "2026-11-08" },
        { ref: "Tex. Prop. Code \xA741.007(c)-(d) (an arbitration clause must be in 10-point bold or it is unenforceable)", url: TX_PROP_41, verified: true, checkedOn: "2026-11-08" },
        { ref: "Tex. Prop. Code \xA753.001(8)-(10) (residence; residential construction contract)", url: TX_PROP_53, verified: true, checkedOn: "2026-11-08" },
        { ref: "Tex. Prop. Code \xA753.255 (disclosure statement to the owner before a residential construction contract is executed)", url: TX_PROP_53, verified: true, checkedOn: "2026-11-08" },
        { ref: "Texas deposit cap on residential repair and improvement", verified: false, note: "No general statutory deposit cap was found for Texas residential repair; the pack sets none. Verify before GA; a cap is configuration (depositCapPct/depositCapMinor), not code." },
        { ref: "Tex. Occ. Code \xA71302.251 and 16 TAC \xA775.70 (ACR contractor licence number on contracts, invoices and advertising)", verified: false, note: "Display rule carried as licenseDisplay; verify the exact text before GA." }
      ]
    }
  },
  {
    id: "seed_pack_us_contact_hours",
    code: "us-federal-contact-hours",
    name: "TCPA calling hours",
    kind: "contact_hours",
    jurisdictionCode: "US",
    description: "47 CFR 64.1200(c)(1): telephone solicitations only 8 a.m.-9 p.m. at the called party's location.",
    binding: { id: "seed_binding_us_contact_hours", scope: "company", scopeValue: "company", priority: 0 },
    version: {
      id: "seed_policy_us_contact_hours_v1",
      effectiveFrom: "2026-01-01",
      rules: {
        purposes: ["solicitation", "marketing", "ai_voice_outbound"],
        basis: "recipient_local_time",
        weekdays: { start: "08:00", end: "21:00" },
        saturday: { start: "08:00", end: "21:00" },
        sunday: { start: "08:00", end: "21:00" },
        exemptions: ["express_request", "existing_contract"]
      },
      sourceRefs: [
        { ref: "47 CFR 64.1200(c)(1)", url: "https://www.ecfr.gov/current/title-47/part-64/section-64.1200", verified: true, checkedOn: "2026-11-07" },
        { ref: 'FCC 24-17 (AI-generated voices are "artificial" under the TCPA)', url: "https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf", verified: true, checkedOn: "2026-11-07" }
      ]
    }
  },
  {
    id: "seed_pack_tx_contact_hours",
    code: "us-tx-contact-hours",
    name: "Texas telephone solicitation hours",
    kind: "contact_hours",
    jurisdictionCode: "US-TX",
    description: "Bus. & Com. Code \xA7301.051: 9 a.m.-9 p.m. weekdays and Saturdays; noon-9 p.m. Sundays.",
    binding: { id: "seed_binding_tx_contact_hours", scope: "state", scopeValue: "US-TX", priority: 0 },
    version: {
      id: "seed_policy_tx_contact_hours_v1",
      effectiveFrom: "2026-01-01",
      rules: {
        purposes: ["solicitation", "marketing", "ai_voice_outbound"],
        basis: "recipient_local_time",
        weekdays: { start: "09:00", end: "21:00" },
        saturday: { start: "09:00", end: "21:00" },
        sunday: { start: "12:00", end: "21:00" },
        exemptions: ["express_request", "existing_contract", "prior_business_relationship"]
      },
      sourceRefs: [{ ref: "Tex. Bus. & Com. Code \xA7301.051", url: "https://statutes.capitol.texas.gov/Docs/BC/htm/BC.301.htm", verified: true, checkedOn: "2026-11-07" }]
    }
  },
  {
    id: "seed_pack_tx_call_recording",
    code: "us-tx-call-recording",
    name: "Texas call recording",
    kind: "call_recording",
    jurisdictionCode: "US-TX",
    description: "One-party consent (Penal Code \xA716.02(c)(4)); the company discloses recording anyway.",
    binding: { id: "seed_binding_tx_call_recording", scope: "state", scopeValue: "US-TX", priority: 0 },
    version: {
      id: "seed_policy_tx_call_recording_v1",
      effectiveFrom: "2026-01-01",
      rules: { consent: "one_party", disclosureRequired: true, disclosureText: "This call may be recorded for quality and training." },
      sourceRefs: [
        { ref: "Tex. Penal Code \xA716.02(c)(4)", url: "https://statutes.capitol.texas.gov/Docs/PE/htm/PE.16.htm", verified: true, checkedOn: "2026-11-07" },
        { ref: "Disclosure is company policy (callers may be in all-party-consent states)", verified: true, checkedOn: "2026-11-07" }
      ]
    }
  },
  {
    id: "seed_pack_tx_sales_tax",
    code: "us-tx-sales-tax",
    name: "Texas sales tax on repair and remodeling",
    kind: "sales_tax",
    jurisdictionCode: "US-TX",
    description: "6.25% state plus up to 2% local; residential repair labour exempt; lump-sum vs separated contracts.",
    binding: { id: "seed_binding_tx_sales_tax", scope: "state", scopeValue: "US-TX", priority: 0 },
    version: {
      id: "seed_policy_tx_sales_tax_v1",
      effectiveFrom: "2026-01-01",
      rules: {
        engine: "native_tables",
        stateRate: "0.0625",
        maxLocalRate: "0.02",
        localRates: [{ code: "US-TX-AUSTIN", name: "Austin combined local", rate: "0.02" }],
        matrix: [
          { propertyClass: "residential", contractTaxMode: "any", taxCategory: "labor", taxable: false, basis: "none", note: "Residential repair/remodel labour is not taxable." },
          { propertyClass: "residential", contractTaxMode: "lump_sum", taxCategory: "any", taxable: false, basis: "none", note: "Contractor pays tax on materials when buying them." },
          { propertyClass: "residential", contractTaxMode: "separated", taxCategory: "material", taxable: true, basis: "at_least_cost" },
          { propertyClass: "residential", contractTaxMode: "separated", taxCategory: "equipment", taxable: true, basis: "at_least_cost" },
          { propertyClass: "nonresidential", contractTaxMode: "any", taxCategory: "maintenance", taxable: true, basis: "price", note: "Conservative default until the scheduled-periodic-maintenance exclusion is mapped against Rule 3.357." },
          { propertyClass: "nonresidential", contractTaxMode: "any", taxCategory: "any", taxable: true, basis: "price" }
        ],
        rounding: "per_invoice_jurisdiction"
      },
      sourceRefs: [
        { ref: "Texas Comptroller, Sales and Use Tax (6.25% state; up to 2% local)", url: "https://comptroller.texas.gov/taxes/sales/", verified: true, checkedOn: "2026-11-07" },
        { ref: "Texas Comptroller Pub. 94-116, Real Property Repair and Remodeling", url: "https://comptroller.texas.gov/taxes/publications/94-116.php", verified: true, checkedOn: "2026-11-07" },
        { ref: "Texas Comptroller Pub. 96-259, Taxable Services (scheduled periodic maintenance excluded from nonresidential repair)", url: "https://comptroller.texas.gov/taxes/publications/96-259.php", verified: true, checkedOn: "2026-11-07" },
        { ref: "34 TAC \xA73.357 mapping of maintenance categories", verified: false, note: "Commercial maintenance is taxed until verified." },
        { ref: "Rounding method", verified: false, note: "Per-invoice-per-jurisdiction rounding allocated back to lines; verify against Comptroller guidance." }
      ]
    }
  },
  {
    id: "seed_pack_tx_lien",
    code: "us-tx-lien",
    name: "Texas mechanic's liens (Prop. Code ch. 53)",
    kind: "lien",
    jurisdictionCode: "US-TX",
    description: "Month-based deadlines: the 15th day of the Nth month after the work month.",
    binding: { id: "seed_binding_tx_lien", scope: "state", scopeValue: "US-TX", priority: 0 },
    version: {
      id: "seed_policy_tx_lien_v1",
      effectiveFrom: "2026-01-01",
      rules: {
        clocks: [
          { party: "original_contractor", projectClass: "residential", action: "file_affidavit", kind: "day_of_nth_month_after", monthsAfter: 3, dayOfMonth: 15, from: "month_work_completed" },
          { party: "original_contractor", projectClass: "other", action: "file_affidavit", kind: "day_of_nth_month_after", monthsAfter: 4, dayOfMonth: 15, from: "month_work_completed" },
          { party: "derivative_claimant", projectClass: "residential", action: "notice_to_owner", kind: "day_of_nth_month_after", monthsAfter: 2, dayOfMonth: 15, from: "month_labor_or_materials_delivered" },
          { party: "derivative_claimant", projectClass: "other", action: "notice_to_owner", kind: "day_of_nth_month_after", monthsAfter: 3, dayOfMonth: 15, from: "month_labor_or_materials_delivered" }
        ]
      },
      sourceRefs: [{ ref: "Tex. Prop. Code \xA753.052, \xA753.056", url: "https://statutes.capitol.texas.gov/Docs/PR/htm/PR.53.htm", verified: true, checkedOn: "2026-11-07" }]
    }
  },
  {
    id: "seed_pack_tx_licensing",
    code: "us-tx-licensing",
    name: "Texas trade licensing",
    kind: "licensing",
    jurisdictionCode: "US-TX",
    description: "ACR (TDLR, Occ. Code ch. 1302), plumbing (TSBPE, ch. 1301) and electrical (TDLR, ch. 1305) requirements by job tag.",
    binding: { id: "seed_binding_tx_licensing", scope: "state", scopeValue: "US-TX", priority: 0 },
    version: {
      id: "seed_policy_tx_licensing_v1",
      effectiveFrom: "2026-01-01",
      rules: {
        requirements: [
          { trade: "hvac", jobTag: "acr_service", companyLicense: { issuer: "TDLR", classes: ["A", "B"], endorsement: "environmental_air" }, individual: { anyOf: ["tx_acr_certified_technician", "tx_acr_registered_technician", "tx_acr_contractor"], supervisionBy: [] }, maxCoolingTons: null, maxHeatingBtuh: null },
          { trade: "hvac", jobTag: "acr_large_system", companyLicense: { issuer: "TDLR", classes: ["A"], endorsement: "environmental_air" }, individual: { anyOf: ["tx_acr_certified_technician", "tx_acr_contractor"], supervisionBy: [] }, maxCoolingTons: null, maxHeatingBtuh: null },
          { trade: "hvac", jobTag: "refrigerant_handling", companyLicense: null, individual: { anyOf: ["epa608_type_ii", "epa608_universal"], supervisionBy: [] }, maxCoolingTons: null, maxHeatingBtuh: null },
          { trade: "plumbing", jobTag: "plumbing_service", companyLicense: { issuer: "TSBPE", classes: ["Responsible Master Plumber"], endorsement: null }, individual: { anyOf: ["tx_master_plumber", "tx_journeyman_plumber", "tx_tradesman_plumber", "tx_plumber_apprentice"], supervisionBy: ["tx_master_plumber", "tx_journeyman_plumber"] }, maxCoolingTons: null, maxHeatingBtuh: null },
          { trade: "electrical", jobTag: "electrical_service", companyLicense: { issuer: "TDLR", classes: ["Electrical Contractor"], endorsement: null }, individual: { anyOf: ["tx_master_electrician", "tx_journeyman_electrician", "tx_residential_wireman", "tx_electrical_apprentice"], supervisionBy: ["tx_master_electrician", "tx_journeyman_electrician"] }, maxCoolingTons: null, maxHeatingBtuh: null }
        ]
      },
      sourceRefs: [
        { ref: "Tex. Occ. Code \xA71302.251; TDLR ACR contractor classes A/B and endorsements", url: "https://www.tdlr.texas.gov/acr/contractor-apply.htm", verified: true, checkedOn: "2026-11-07" },
        { ref: "ACR Class B ceiling (25 tons cooling, 1.5M BTU/h heating)", url: "https://www.tdlr.texas.gov/acr/contractor-apply.htm", verified: true, checkedOn: "2026-11-07", note: "Class B jobs carry maxCoolingTons once job types record tonnage (Phase 1)." },
        { ref: "Tex. Occ. Code \xA71301.351 (licence plus supervision; responsible master plumber)", url: "https://statutes.capitol.texas.gov/Docs/OC/htm/OC.1301.htm", verified: true, checkedOn: "2026-11-07" },
        { ref: "Tex. Occ. Code \xA71305.151; TDLR electrician licence classes", url: "https://www.tdlr.texas.gov/electricians/elec.htm", verified: true, checkedOn: "2026-11-07" },
        { ref: "16 TAC ch. 75 ACR technician supervision ratios", verified: false, note: "Not yet encoded." },
        { ref: "40 CFR 82.161 (EPA 608 technician certification)", verified: true, checkedOn: "2026-11-07" }
      ]
    }
  },
  {
    id: "seed_pack_us_wage_hour",
    code: "us-federal-wage-hour",
    name: "FLSA overtime",
    kind: "wage_hour",
    jurisdictionCode: "US",
    description: "Overtime after 40 hours in a fixed workweek at 1.5x the regular rate; Texas adds no daily overtime.",
    binding: { id: "seed_binding_us_wage_hour", scope: "company", scopeValue: "company", priority: 0 },
    version: {
      id: "seed_policy_us_wage_hour_v1",
      effectiveFrom: "2026-01-01",
      rules: { weeklyOvertimeHours: "40", dailyOvertimeHours: null, overtimeMultiplier: "1.5", workweekStartDay: 1, regularRateReview: true },
      sourceRefs: [
        { ref: "29 U.S.C. 207(a); 29 CFR 778.105 (fixed workweek)", url: "https://www.ecfr.gov/current/title-29/part-778", verified: true, checkedOn: "2026-11-07" },
        { ref: "29 CFR 778.111, 778.117 (piece-rate and commission in the regular rate)", url: "https://www.ecfr.gov/current/title-29/part-778", verified: true, checkedOn: "2026-11-07", note: "v1 flags weeks with commission and overtime for review (regularRateReview)." }
      ]
    }
  },
  {
    id: "seed_pack_us_auto_renewal",
    code: "us-auto-renewal",
    name: "Automatic renewal of memberships",
    kind: "auto_renewal",
    jurisdictionCode: "US",
    description: "A membership renews itself only with the customer's affirmative, recorded consent; they are told before each renewal and can cancel online.",
    binding: { id: "seed_binding_us_auto_renewal", scope: "company", scopeValue: "company", priority: 0 },
    version: {
      id: "seed_policy_us_auto_renewal_v1",
      effectiveFrom: "2026-01-01",
      rules: { affirmativeConsentRequired: true, noticeLeadDays: 30, annualReminder: true, onlineCancelRequired: true },
      sourceRefs: [
        { ref: "FTC Negative Option Rule, 16 CFR Part 425 and the Restore Online Shoppers' Confidence Act, 15 U.S.C. 8403", url: "https://www.ecfr.gov/current/title-16/part-425", verified: false, checkedOn: "2026-11-11", note: "Conservative company default: consent in writing, a reminder before each renewal, simple online cancellation. State rules (Texas Bus. & Com. Code ch. 17) have not been read against it; a lawyer confirms before launch." }
      ]
    }
  }
];

// features/keystone/seed/platform.ts
var UNUSABLE_PASSWORD_HASH = "$2a$10$3dITCbIvf5zFA.1U8KZDhOHC3EEexi3KYy5ysZK1cRF6LHMm0H.ya";
var day = (iso) => /* @__PURE__ */ new Date(`${iso}T00:00:00Z`);
async function seedCompanyPlatform(uow, actor) {
  const { tx } = uow;
  const created = { company: 0, roles: 0, staff: 0, licenses: 0, brands: 0, branches: 0, businessUnits: 0, serviceAreas: 0, calendars: 0, calendarExceptions: 0, approvalPolicies: 0, policyPacks: 0, policyVersions: 0, policyBindings: 0 };
  if (!await tx.companySettings.findUnique({ where: { singletonKey: "company" } })) {
    const row = await tx.companySettings.create({ data: { id: 1, ...COMPANY, singletonKey: "company", onboardingStatus: "in_progress" } });
    auditCreate(uow, actor, "CompanySettings", String(row.id), "company.created", COMPANY, { metadata: { seed: true } });
    created.company = 1;
  }
  const haveRoles = new Set((await tx.role.findMany({ where: { id: { in: ROLES.map((r) => r.id) } }, select: { id: true } })).map((r) => r.id));
  const newRoles = ROLES.filter((role) => !haveRoles.has(role.id));
  if (newRoles.length) {
    await tx.role.createMany({ data: newRoles.map((role) => ({ id: role.id, name: role.name, description: role.description, ...Object.fromEntries(permissionNames.map((name) => [name, role.permissions.includes(name)])) })) });
    for (const role of newRoles) auditCreate(uow, actor, "Role", role.id, "role.created", { name: role.name, permissions: role.permissions }, { metadata: { seed: true } });
    created.roles = newRoles.length;
  }
  const haveUsers = await tx.user.findMany({ where: { OR: [{ id: { in: STAFF.map((p) => p.id) } }, { email: { in: STAFF.map((p) => p.email) } }] }, select: { id: true, email: true } });
  const newStaff = STAFF.filter((person) => !haveUsers.some((u) => u.id === person.id || u.email === person.email));
  if (newStaff.length) {
    await tx.user.createMany({
      data: newStaff.map((person) => ({ id: person.id, name: person.name, email: person.email, title: person.title, phone: person.phone, password: UNUSABLE_PASSWORD_HASH, kind: "staff", roleId: person.roleId, onboardingStatus: "dismissed" }))
    });
    for (const person of newStaff) auditCreate(uow, actor, "User", person.id, "user.created", { name: person.name, title: person.title, role: person.roleId }, { metadata: { seed: true } });
    created.staff = newStaff.length;
  }
  if (!await tx.brand.findUnique({ where: { id: BRAND.id } })) {
    await tx.brand.create({ data: BRAND });
    auditCreate(uow, actor, "Brand", BRAND.id, "brand.created", BRAND, { metadata: { seed: true } });
    created.brands = 1;
  }
  const haveLicenses = new Set((await tx.contractorLicense.findMany({ where: { id: { in: LICENSES.map((l) => l.id) } }, select: { id: true } })).map((r) => r.id));
  for (const license of LICENSES.filter((l) => !haveLicenses.has(l.id))) {
    await tx.contractorLicense.create({ data: { ...license, endorsements: [...license.endorsements], expiresOn: day("2027-08-31"), brands: { connect: [{ id: BRAND.id }] } } });
    auditCreate(uow, actor, "ContractorLicense", license.id, "license.created", license, { metadata: { seed: true } });
    created.licenses += 1;
  }
  let federal = await tx.businessCalendar.findUnique({ where: { code: US_FEDERAL.code } });
  if (!federal) {
    federal = await tx.businessCalendar.create({
      data: { id: "seed_calendar_us_federal", code: US_FEDERAL.code, name: "US federal business days", kind: "legal_business_days", timeZone: US_FEDERAL.timeZone, weekendDays: [...US_FEDERAL.weekendDays], regularOpen: "00:00", regularClose: "23:59", coverageThrough: day(US_FEDERAL.coverageThrough), source: FEDERAL_SOURCE }
    });
    auditCreate(uow, actor, "BusinessCalendar", federal.id, "calendar.created", { code: US_FEDERAL.code, coverageThrough: US_FEDERAL.coverageThrough }, { metadata: { seed: true } });
    created.calendars += 1;
  }
  let shop = await tx.businessCalendar.findUnique({ where: { code: "SUMMIT-HOURS" } });
  if (!shop) {
    shop = await tx.businessCalendar.create({
      data: { id: "seed_calendar_summit_hours", code: "SUMMIT-HOURS", name: "Summit office hours", kind: "company_hours", timeZone: "America/Chicago", weekendDays: [0], regularOpen: "07:00", regularClose: "19:00", coverageThrough: day(US_FEDERAL.coverageThrough), source: "Company decision: closed Sundays and six major holidays; on-call covers closed days." }
    });
    auditCreate(uow, actor, "BusinessCalendar", shop.id, "calendar.created", { code: "SUMMIT-HOURS" }, { metadata: { seed: true } });
    created.calendars += 1;
  }
  const calendarDays = [
    [federal.id, FEDERAL_HOLIDAYS, "Federal holiday"],
    [shop.id, FEDERAL_HOLIDAYS.filter((h) => COMPANY_CLOSED_HOLIDAYS.includes(h.name)), "Office closed"]
  ];
  for (const [calendarId, holidays, note] of calendarDays) {
    const have = new Set((await tx.calendarException.findMany({ where: { calendarId }, select: { date: true } })).map((d) => d.date.toISOString().slice(0, 10)));
    const days = holidays.filter((h) => !have.has(h.date));
    if (!days.length) continue;
    await tx.calendarException.createMany({ data: days.map((h) => ({ calendarId, date: day(h.date), kind: "holiday", note: `${note}: ${h.name}${h.observed ? " (observed)" : ""}` })) });
    uow.audit({ eventType: "calendar.exceptions_loaded", entityType: "BusinessCalendar", entityId: calendarId, actorUserId: actor.kind === "user" ? actor.userId : null, after: { count: days.length } });
    created.calendarExceptions += days.length;
  }
  if (!await tx.branch.findUnique({ where: { id: BRANCH.id } })) {
    await tx.branch.create({ data: { ...BRANCH, calendar: { connect: { id: shop.id } } } });
    auditCreate(uow, actor, "Branch", BRANCH.id, "branch.created", BRANCH, { metadata: { seed: true } });
    created.branches = 1;
  }
  const haveAreas = new Set((await tx.serviceArea.findMany({ where: { id: { in: SERVICE_AREAS.map((r) => r.id) } }, select: { id: true } })).map((r) => r.id));
  const newAreas = SERVICE_AREAS.filter((area) => !haveAreas.has(area.id));
  if (newAreas.length) {
    await tx.serviceArea.createMany({ data: newAreas.map((area) => ({ id: area.id, name: area.name, kind: "zip_list", zips: [...area.zips], travelZone: area.travelZone, branchId: BRANCH.id })) });
    for (const area of newAreas) auditCreate(uow, actor, "ServiceArea", area.id, "service_area.created", { name: area.name, zips: area.zips.length }, { metadata: { seed: true } });
    created.serviceAreas = newAreas.length;
  }
  const haveUnits = new Set((await tx.businessUnit.findMany({ where: { id: { in: BUSINESS_UNITS.map((r) => r.id) } }, select: { id: true } })).map((r) => r.id));
  for (const bu of BUSINESS_UNITS.filter((u) => !haveUnits.has(u.id))) {
    await tx.businessUnit.create({ data: { ...bu, brand: { connect: { id: BRAND.id } }, branch: { connect: { id: BRANCH.id } }, serviceAreas: { connect: SERVICE_AREAS.map((a) => ({ id: a.id })) } } });
    auditCreate(uow, actor, "BusinessUnit", bu.id, "business_unit.created", bu, { metadata: { seed: true } });
    created.businessUnits += 1;
  }
  const havePolicies = new Set((await tx.approvalPolicy.findMany({ select: { action: true } })).map((p) => p.action));
  const newPolicies = APPROVAL_POLICIES.filter((p) => !havePolicies.has(p.action));
  if (newPolicies.length) {
    const rows = await tx.approvalPolicy.createManyAndReturn({ data: newPolicies.map((policy2) => ({ action: policy2.action, description: policy2.description, requiredPermission: policy2.requiredPermission, minApprovals: 1, expiresAfterMinutes: policy2.expiresAfterMinutes, thresholdMinor: policy2.thresholdMinor ?? null })), select: { id: true, action: true, requiredPermission: true } });
    for (const row of rows) auditCreate(uow, actor, "ApprovalPolicy", row.id, "approval_policy.created", { action: row.action, requiredPermission: row.requiredPermission }, { metadata: { seed: true } });
    created.approvalPolicies = rows.length;
  }
  const policy = await seedPolicyPacks(uow, actor);
  created.policyPacks = policy.policyPacks;
  created.policyVersions = policy.policyVersions;
  created.policyBindings = policy.policyBindings;
  return created;
}
async function seedPolicyPacks(uow, actor) {
  const { tx } = uow;
  const created = { policyPacks: 0, policyVersions: 0, policyBindings: 0 };
  for (const pack of POLICY_PACKS) {
    for (const v of versionsOf(pack)) {
      const parsed2 = parsePolicyRules(pack.kind, v.rules);
      if (!parsed2.success) throw new Error(`Seed policy ${pack.code} (${v.id}) does not match its schema: ${parsed2.error.issues[0]?.message}`);
    }
  }
  const havePacks = new Set((await tx.policyPack.findMany({ where: { id: { in: POLICY_PACKS.map((p) => p.id) } }, select: { id: true } })).map((r) => r.id));
  const haveVersions = new Set((await tx.policyVersion.findMany({ where: { id: { in: POLICY_PACKS.flatMap((p) => versionsOf(p).map((v) => v.id)) } }, select: { id: true } })).map((r) => r.id));
  const haveBindings = new Set((await tx.policyBinding.findMany({ where: { id: { in: POLICY_PACKS.map((p) => p.binding.id) } }, select: { id: true } })).map((r) => r.id));
  const packs = POLICY_PACKS.filter((p) => !havePacks.has(p.id));
  if (packs.length) {
    await tx.policyPack.createMany({ data: packs.map((pack) => ({ id: pack.id, code: pack.code, name: pack.name, kind: pack.kind, jurisdictionCode: pack.jurisdictionCode, description: pack.description })) });
    for (const pack of packs) auditCreate(uow, actor, "PolicyPack", pack.id, "policy_pack.created", { code: pack.code, kind: pack.kind }, { metadata: { seed: true } });
    created.policyPacks = packs.length;
  }
  const versions = POLICY_PACKS.filter((p) => !haveVersions.has(p.version.id)).map((pack) => ({ pack, contentHash: payloadHash({ rules: pack.version.rules, sourceRefs: pack.version.sourceRefs }) }));
  if (versions.length) {
    await tx.policyVersion.createMany({
      data: versions.map(({ pack, contentHash }) => ({
        id: pack.version.id,
        packId: pack.id,
        versionNumber: 1,
        effectiveFrom: day(pack.version.effectiveFrom),
        rules: toJsonValue(pack.version.rules),
        sourceRefs: toJsonValue(pack.version.sourceRefs),
        verifiedBy: "Openfront research (RESEARCH.md \xA712)",
        verifiedAt: /* @__PURE__ */ new Date("2026-11-07T18:00:00Z"),
        status: "active",
        contentHash
      }))
    });
    for (const { pack, contentHash } of versions) auditCreate(uow, actor, "PolicyVersion", pack.version.id, "policy_version.activated", { pack: pack.code, versionNumber: 1, contentHash }, { metadata: { seed: true }, reason: "Initial verified policy load" });
    created.policyVersions = versions.length;
  }
  for (const pack of POLICY_PACKS) {
    const chain = versionsOf(pack);
    for (let i = 1; i < chain.length; i++) {
      const next = chain[i];
      if (haveVersions.has(next.id)) continue;
      const previous = chain[i - 1];
      const contentHash = payloadHash({ rules: next.rules, sourceRefs: next.sourceRefs });
      await tx.policyVersion.update({ where: { id: previous.id }, data: { effectiveTo: day(next.effectiveFrom) } });
      await tx.policyVersion.create({
        data: {
          id: next.id,
          packId: pack.id,
          versionNumber: next.versionNumber,
          effectiveFrom: day(next.effectiveFrom),
          rules: toJsonValue(next.rules),
          sourceRefs: toJsonValue(next.sourceRefs),
          verifiedBy: "Openfront research (RESEARCH.md \xA712.1a)",
          verifiedAt: /* @__PURE__ */ new Date("2026-11-08T12:00:00Z"),
          status: "active",
          contentHash
        }
      });
      auditCreate(uow, actor, "PolicyVersion", previous.id, "policy_version.superseded", { pack: pack.code, effectiveTo: next.effectiveFrom, by: next.id }, { metadata: { seed: true }, reason: next.reason });
      auditCreate(uow, actor, "PolicyVersion", next.id, "policy_version.activated", { pack: pack.code, versionNumber: next.versionNumber, contentHash }, { metadata: { seed: true }, reason: next.reason });
      created.policyVersions += 1;
    }
  }
  const bindings = POLICY_PACKS.filter((p) => !haveBindings.has(p.binding.id));
  if (bindings.length) {
    await tx.policyBinding.createMany({ data: bindings.map((pack) => ({ id: pack.binding.id, packId: pack.id, scope: pack.binding.scope, scopeValue: pack.binding.scopeValue, priority: pack.binding.priority, status: "active" })) });
    for (const pack of bindings) auditCreate(uow, actor, "PolicyBinding", pack.binding.id, "policy_binding.created", pack.binding, { metadata: { seed: true } });
    created.policyBindings = bindings.length;
  }
  return created;
}

// features/keystone/seed/operations.ts
init_cas();

// features/keystone/domain/contact.ts
var import_node_crypto5 = require("node:crypto");
init_errors();
function normalizePhone(input) {
  const raw = String(input ?? "").trim();
  if (raw.startsWith("+")) {
    const digits2 = raw.slice(1).replace(/[\s().-]/g, "");
    if (!/^[1-9]\d{7,14}$/.test(digits2)) throw new DomainError(Codes.INVALID_INPUT, "That phone number is not valid.", { field: "phone" });
    return `+${digits2}`;
  }
  const digits = raw.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) throw new DomainError(Codes.INVALID_INPUT, "That phone number is not valid.", { field: "phone" });
  return `+1${national}`;
}
function normalizeEmail(input) {
  const value = String(input ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) || value.length > 254) throw new DomainError(Codes.INVALID_INPUT, "That email address is not valid.", { field: "email" });
  return value;
}
var contactHash = (normalized) => (0, import_node_crypto5.createHash)("sha256").update(`contact:${normalized}`).digest("hex");
function maskPhone(e164) {
  if (!e164) return "";
  return `(\u2022\u2022\u2022) \u2022\u2022\u2022-${e164.slice(-4)}`;
}
function maskEmail(email) {
  if (!email) return "";
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}\u2022\u2022\u2022@${domain ?? ""}`;
}
function maskAddress(line1) {
  if (!line1) return "";
  const [number, ...rest] = line1.trim().split(/\s+/);
  const street = rest.join(" ");
  return street ? `${number} ${street.slice(0, 1)}\u2022\u2022\u2022` : `${number.slice(0, 1)}\u2022\u2022\u2022`;
}
function maskName(first, last) {
  return [first?.trim(), last?.trim() ? `${last.trim()[0]}.` : ""].filter(Boolean).join(" ");
}

// features/integrations/maps/index.ts
var ZIP_CENTROIDS = {
  "78701": ["30.271100", "-97.743700"],
  "78702": ["30.263300", "-97.716600"],
  "78703": ["30.294400", "-97.766000"],
  "78704": ["30.242800", "-97.765800"],
  "78705": ["30.294800", "-97.738600"],
  "78721": ["30.272200", "-97.683700"],
  "78722": ["30.289600", "-97.714900"],
  "78723": ["30.304600", "-97.685600"],
  "78741": ["30.231000", "-97.721000"],
  "78744": ["30.183800", "-97.739500"],
  "78745": ["30.206700", "-97.795600"],
  "78746": ["30.294400", "-97.810900"],
  "78748": ["30.162600", "-97.822700"],
  "78749": ["30.213300", "-97.858600"],
  "78751": ["30.310500", "-97.723400"],
  "78756": ["30.322300", "-97.739800"],
  "78757": ["30.351600", "-97.731700"],
  "78758": ["30.387600", "-97.706500"],
  "78759": ["30.403500", "-97.752500"],
  "78613": ["30.505200", "-97.820300"],
  "78660": ["30.439400", "-97.620000"],
  "78664": ["30.514600", "-97.668300"],
  "78665": ["30.545000", "-97.644300"],
  "78681": ["30.518500", "-97.714400"],
  "78717": ["30.490000", "-97.753900"],
  "78727": ["30.426800", "-97.718900"],
  "78728": ["30.450200", "-97.688900"],
  "78729": ["30.452100", "-97.768800"],
  "78750": ["30.422000", "-97.796600"]
};
function manualGeocoder(timeZone = "America/Chicago") {
  return {
    key: "manual",
    async geocode(input) {
      const zip = input.postalCode.trim().slice(0, 5);
      const point = ZIP_CENTROIDS[zip];
      return point ? { lat: point[0], lng: point[1], quality: "zip", postalCode: zip, timeZone } : { lat: null, lng: null, quality: "failed", postalCode: zip, timeZone };
    }
  };
}
var current = manualGeocoder();
var geocoder = () => current;

// features/keystone/seed/operationsData.ts
init_decimal();
var acr = (cls, number) => ({ kind: "state_trade_license", trade: "hvac", issuer: "TDLR", number, licenseClass: cls, expiresOn: "2027-06-30" });
var epa = (type, number) => ({ kind: "epa_608", trade: "hvac", issuer: "EPA-approved certifying organization", number, epaType: type });
var plb = (cls, number, extra = {}) => ({ kind: "state_trade_license", trade: "plumbing", issuer: "TSBPE", number, licenseClass: cls, expiresOn: "2027-03-31", ...extra });
var ele = (cls, number, extra = {}) => ({ kind: "state_trade_license", trade: "electrical", issuer: "TDLR", number, licenseClass: cls, expiresOn: "2027-09-30", ...extra });
var TECHS = [
  { key: "morrison", first: "Jake", last: "Morrison", title: "HVAC Technician", kind: "technician", units: ["seed_bu_hvac_service"], zip: "78745", phone: "+15125550110", skills: ["hvac_diag", "heat_pump", "refrigerant"], credentials: [acr("acr_certified_technician", "TACLR-CT-104512"), epa("universal", "EPA608-U-88213"), { kind: "nate", trade: "hvac", issuer: "NATE", number: "NATE-551204" }], saturday: true },
  { key: "alvarez", first: "Sofia", last: "Alvarez", title: "HVAC Technician", kind: "technician", units: ["seed_bu_hvac_service"], zip: "78723", phone: "+15125550111", skills: ["hvac_diag", "refrigerant"], credentials: [acr("acr_registered_technician", "TACLR-RT-209331"), epa("type_ii", "EPA608-II-44120")] },
  { key: "chu", first: "Derek", last: "Chu", title: "HVAC Install Lead", kind: "technician", units: ["seed_bu_hvac_service", "seed_bu_hvac_install"], zip: "78759", phone: "+15125550112", skills: ["hvac_diag", "install", "heat_pump", "refrigerant"], credentials: [acr("acr_certified_technician", "TACLR-CT-118870"), epa("universal", "EPA608-U-90157")] },
  { key: "lee", first: "Brandon", last: "Lee", title: "HVAC Apprentice", kind: "apprentice", units: ["seed_bu_hvac_service"], zip: "78741", phone: "+15125550113", skills: ["maintenance"], credentials: [acr("acr_registered_technician", "TACLR-RT-311046"), epa("type_i", "EPA608-I-12007")], saturday: true },
  { key: "castillo", first: "Ray", last: "Castillo", title: "Master Plumber", kind: "technician", units: ["seed_bu_plumbing_service"], zip: "78704", phone: "+15125550114", skills: ["water_heater", "repipe", "gas_line", "drain"], credentials: [plb("master_plumber", "M-40122")] },
  { key: "patel", first: "Nina", last: "Patel", title: "Journeyman Plumber", kind: "technician", units: ["seed_bu_plumbing_service"], zip: "78757", phone: "+15125550115", skills: ["water_heater", "drain", "leak_detection"], credentials: [plb("journeyman_plumber", "J-55418")], saturday: true },
  { key: "harris", first: "Cody", last: "Harris", title: "Plumber Apprentice", kind: "apprentice", units: ["seed_bu_plumbing_service"], zip: "78744", phone: "+15125550116", skills: ["drain"], credentials: [plb("plumber_apprentice", "AP-77310")] },
  { key: "haddad", first: "Omar", last: "Haddad", title: "Journeyman Plumber (drains)", kind: "technician", units: ["seed_bu_plumbing_service"], zip: "78660", phone: "+15125550117", skills: ["drain", "sewer_camera", "hydro_jet"], credentials: [plb("journeyman_plumber", "J-58902", { status: "pending_verification" })] },
  { key: "bennett", first: "Grace", last: "Bennett", title: "Master Electrician", kind: "technician", units: ["seed_bu_electrical"], zip: "78703", phone: "+15125550118", skills: ["panel", "ev_charger", "troubleshooting"], credentials: [ele("master_electrician", "ME-21877")] },
  { key: "dawson", first: "Luke", last: "Dawson", title: "Journeyman Electrician", kind: "technician", units: ["seed_bu_electrical"], zip: "78681", phone: "+15125550119", skills: ["troubleshooting", "ev_charger"], credentials: [ele("journeyman_electrician", "JE-63540")], saturday: true },
  { key: "ford", first: "Maya", last: "Ford", title: "Residential Wireman", kind: "technician", units: ["seed_bu_electrical"], zip: "78613", phone: "+15125550120", skills: ["troubleshooting"], credentials: [ele("residential_wireman", "RW-70215", { expiresOn: "2026-11-30" })] },
  { key: "turner", first: "Eli", last: "Turner", title: "Electrical Apprentice", kind: "apprentice", units: ["seed_bu_electrical"], zip: "78748", phone: "+15125550121", skills: [], credentials: [ele("electrical_apprentice", "EA-90551")] }
];
var SKILLS = [
  ["hvac_diag", "HVAC diagnostics", "hvac"],
  ["heat_pump", "Heat pumps", "hvac"],
  ["refrigerant", "Refrigerant recovery and charging", "hvac"],
  ["install", "System installs", "hvac"],
  ["maintenance", "Tune-ups", "hvac"],
  ["water_heater", "Water heaters", "plumbing"],
  ["repipe", "Repipes", "plumbing"],
  ["gas_line", "Gas lines", "plumbing"],
  ["drain", "Drain cleaning", "plumbing"],
  ["leak_detection", "Leak detection", "plumbing"],
  ["sewer_camera", "Sewer camera", "plumbing"],
  ["hydro_jet", "Hydro-jetting", "plumbing"],
  ["panel", "Panels and services", "electrical"],
  ["ev_charger", "EV chargers", "electrical"],
  ["troubleshooting", "Electrical troubleshooting", "electrical"]
];
var REQUIREMENTS = [
  { id: "seed_req_acr_refrigerant", name: "ACR work with refrigerant", licensingTags: ["acr_service", "refrigerant_handling"], skills: ["hvac_diag"] },
  { id: "seed_req_acr", name: "ACR work, no refrigerant", licensingTags: ["acr_service"], skills: [] },
  { id: "seed_req_plumbing", name: "Licensed plumbing", licensingTags: ["plumbing_service"], skills: [] },
  { id: "seed_req_drain", name: "Drain and sewer", licensingTags: ["plumbing_service"], skills: ["drain"] },
  { id: "seed_req_electrical", name: "Licensed electrical", licensingTags: ["electrical_service"], skills: [] },
  { id: "seed_req_sales", name: "Comfort advisor visit (no field work)", licensingTags: [], skills: [] }
];
var GAS = { keywords: ["smell gas", "gas smell", "smells like gas", "carbon monoxide", "co alarm", "co detector"], script: "If you smell gas or your CO alarm is going off, leave the house now with everyone, do not switch anything on or off, and call Texas Gas Service or 911 from outside. I am paging our on-call technician.", page: true };
var WATER = { keywords: ["burst pipe", "pipe burst", "flooding", "water everywhere", "gushing", "water pouring"], script: "Please turn off the main water shut-off now; it is usually where the water line enters the house or at the meter box by the street. I am paging our on-call plumber.", page: true };
var SPARKS = { keywords: ["sparking", "sparks", "burning smell", "smoke from", "panel is hot", "outlet melted"], script: "If you see smoke or sparks, stay away from it. If it is safe, switch off the main breaker. If there is fire or smoke, leave and call 911. I am paging our on-call electrician.", page: true };
var JOB_TYPES = [
  { id: "seed_jt_ac_diag", code: "AC-DIAG", name: "AC not cooling: diagnostic", bu: "seed_bu_hvac_service", trade: "hvac", priority: "urgent", minutes: 90, hours: "2", req: "seed_req_acr_refrigerant", ai: true, keywords: ["ac", "air conditioner", "not cooling", "warm air", "hot air", "compressor", "refrigerant", "freon", "frozen coil", "ice on", "thermostat", "cooling"], emergency: null },
  { id: "seed_jt_heat_diag", code: "HEAT-DIAG", name: "No heat: diagnostic", bu: "seed_bu_hvac_service", trade: "hvac", priority: "urgent", minutes: 90, hours: "2", req: "seed_req_acr", ai: true, keywords: ["heat", "heater", "furnace", "no heat", "cold air", "heat pump", "pilot"], emergency: GAS },
  { id: "seed_jt_ac_tune", code: "AC-TUNE", name: "Cooling tune-up", bu: "seed_bu_hvac_service", trade: "hvac", priority: "maintenance", minutes: 60, hours: "1.5", req: "seed_req_acr_refrigerant", ai: true, keywords: ["tune-up", "tune up", "maintenance", "check-up", "checkup", "service my ac"], emergency: null },
  { id: "seed_jt_heat_tune", code: "HEAT-TUNE", name: "Heating tune-up", bu: "seed_bu_hvac_service", trade: "hvac", priority: "maintenance", minutes: 60, hours: "1.5", req: "seed_req_acr", ai: true, keywords: ["furnace tune", "heating tune", "heating maintenance", "safety check"], emergency: null },
  { id: "seed_jt_hvac_est", code: "HVAC-EST", name: "System replacement estimate", bu: "seed_bu_hvac_install", trade: "hvac", priority: "standard", minutes: 75, hours: "1.5", req: "seed_req_sales", ai: true, keywords: ["replace", "replacement", "new system", "new ac", "new unit", "quote", "estimate", "old unit"], emergency: null },
  { id: "seed_jt_drain", code: "DRAIN-CLR", name: "Clogged drain", bu: "seed_bu_plumbing_service", trade: "plumbing", priority: "standard", minutes: 60, hours: "1.5", req: "seed_req_drain", ai: true, keywords: ["clog", "clogged", "drain", "slow drain", "backed up", "toilet", "sink", "shower"], emergency: null },
  { id: "seed_jt_leak", code: "LEAK-REP", name: "Water leak", bu: "seed_bu_plumbing_service", trade: "plumbing", priority: "urgent", minutes: 90, hours: "2", req: "seed_req_plumbing", ai: true, keywords: ["leak", "leaking", "drip", "dripping", "water on floor", "pipe"], emergency: WATER },
  { id: "seed_jt_wh_diag", code: "WH-DIAG", name: "Water heater not working", bu: "seed_bu_plumbing_service", trade: "plumbing", priority: "urgent", minutes: 90, hours: "2", req: "seed_req_plumbing", ai: true, keywords: ["water heater", "hot water", "no hot water", "tankless", "pilot light"], emergency: GAS },
  { id: "seed_jt_sewer_cam", code: "SEWER-CAM", name: "Sewer camera inspection", bu: "seed_bu_plumbing_service", trade: "plumbing", priority: "standard", minutes: 75, hours: "1.5", req: "seed_req_drain", ai: false, keywords: ["sewer", "camera", "main line", "roots"], emergency: null },
  { id: "seed_jt_elec_diag", code: "ELEC-DIAG", name: "Electrical problem: diagnostic", bu: "seed_bu_electrical", trade: "electrical", priority: "urgent", minutes: 75, hours: "1.5", req: "seed_req_electrical", ai: true, keywords: ["outlet", "breaker", "tripping", "lights flicker", "flickering", "no power", "switch", "electrical"], emergency: SPARKS },
  { id: "seed_jt_panel_est", code: "PANEL-EST", name: "Panel upgrade estimate", bu: "seed_bu_electrical", trade: "electrical", priority: "standard", minutes: 60, hours: "1", req: "seed_req_electrical", ai: true, keywords: ["panel", "upgrade", "200 amp", "fuse box", "service upgrade"], emergency: null },
  { id: "seed_jt_ev", code: "EV-CHG", name: "EV charger install estimate", bu: "seed_bu_electrical", trade: "electrical", priority: "standard", minutes: 60, hours: "1", req: "seed_req_electrical", ai: true, keywords: ["ev", "charger", "tesla", "level 2", "car charger"], emergency: null }
];
var SERVICE_WINDOWS = [["08:00", "10:00", "8\u201310 AM"], ["10:00", "12:00", "10 AM\u201312 PM"], ["12:00", "14:00", "12\u20132 PM"], ["14:00", "16:00", "2\u20134 PM"]];
var INSTALL_WINDOWS = [["08:00", "12:00", "8 AM\u201312 PM"], ["12:00", "16:00", "12\u20134 PM"]];
var WINDOW_TEMPLATES = BUSINESS_UNITS.flatMap((bu) => {
  const slots = bu.kind === "install" ? INSTALL_WINDOWS : SERVICE_WINDOWS;
  const hours = bu.kind === "install" ? "3" : "6";
  return [1, 2, 3, 4, 5, 6].flatMap((weekday2) => slots.map(([start, end, label]) => ({
    id: `seed_awt_${bu.code.toLowerCase().replace(/[^a-z]/g, "")}_${weekday2}_${start.replace(":", "")}`,
    businessUnitId: bu.id,
    weekday: weekday2,
    startLocal: start,
    endLocal: end,
    label,
    capacityHours: hours,
    capacityFactor: weekday2 === 6 ? "0.5" : null
  })));
});
var CAMPAIGNS = [
  { id: "seed_campaign_lsa", name: "Google Local Services", channel: "google_lsa", monthlyCostMinor: 450000n, number: "+15125550190" },
  { id: "seed_campaign_ads", name: "Google Ads: AC repair", channel: "google_ads", monthlyCostMinor: 300000n, number: "+15125550191" },
  { id: "seed_campaign_yard", name: "Yard signs", channel: "yard_sign", monthlyCostMinor: 20000n, number: "+15125550192" },
  { id: "seed_campaign_truck", name: "Truck wraps", channel: "truck_wrap", monthlyCostMinor: 0n, number: "+15125550193" }
];
var FIRST = ["Emily", "Michael", "Ashley", "David", "Jessica", "Chris", "Sarah", "Daniel", "Laura", "James", "Megan", "Robert", "Olivia", "Carlos", "Hannah", "Kevin", "Rebecca", "Jason", "Natalie", "Andrew"];
var LAST = ["Garcia", "Nguyen", "Johnson", "Martinez", "Brown", "Wilson", "Lopez", "Anderson", "Thomas", "Hernandez", "Moore", "Jackson", "White", "Clark", "Lewis", "Walker", "Young", "Allen", "King", "Wright"];
var STREETS = ["Shoal Creek Blvd", "Bluebonnet Ln", "Oak Hollow Dr", "Mesquite Trl", "Pecan Grove Rd", "Cedar Elm Way", "Live Oak St", "Prairie Dawn Dr", "Limestone Ridge", "Agave Ct", "Sycamore Bend", "Hill Country Dr"];
var CITY = { "78613": "Cedar Park", "78660": "Pflugerville", "78664": "Round Rock", "78665": "Round Rock", "78681": "Round Rock", "78717": "Austin", "78727": "Austin", "78728": "Austin", "78729": "Austin", "78750": "Austin" };
var ZIPS = Object.keys(ZIP_CENTROIDS);
var jitter = (base, i, salt) => {
  const offsetMicro = (i * 7919 + salt * 104729) % 4e3 - 2e3;
  return toScale(dec(base).plus(dec(offsetMicro).div(1e5)), 6);
};
var MAIL_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "icloud.com", "att.net", "hotmail.com"];
var HOUSEHOLDS = Array.from({ length: 60 }, (_, i) => {
  const first = FIRST[i % FIRST.length];
  const last = LAST[(i * 7 + 3) % LAST.length];
  const zip = ZIPS[i * 11 % ZIPS.length];
  const [lat, lng] = ZIP_CENTROIDS[zip];
  const n = String(i + 1).padStart(3, "0");
  return {
    id: `seed_cus_${n}`,
    ref: `CUS-SEED-${n}`,
    first,
    last,
    displayName: `${first} ${last}`,
    phone: `+1512555${String(130 + i).padStart(4, "0")}`,
    email: `${first}.${last}${i + 1}@${MAIL_DOMAINS[i % MAIL_DOMAINS.length]}`.toLowerCase(),
    location: { id: `seed_loc_${n}`, ref: `LOC-SEED-${n}`, address1: `${1e3 + i * 37 % 8900} ${STREETS[i % STREETS.length]}`, city: CITY[zip] ?? "Austin", postalCode: zip, lat: jitter(lat, i, 1), lng: jitter(lng, i, 2), propertyType: i % 9 === 4 ? "townhome" : "single_family", yearBuilt: 1972 + i * 13 % 52 },
    // Three households never agreed to texts; one has opted out by STOP.
    smsConsent: ![7, 23, 41].includes(i),
    optedOut: i === 52
  };
});
var COMMERCIAL = { id: "seed_cus_hcpm", ref: "CUS-SEED-HCPM", displayName: "Hill Country Property Management", first: "Jordan", last: "Reese", phone: "+15125550199", email: "maintenance@hillcountrypm.com", location: { id: "seed_loc_hcpm_1", ref: "LOC-SEED-HCPM-1", address1: "2200 Riverside Commons, Bldg C", city: "Austin", postalCode: "78741", lat: "30.238100", lng: "-97.723300", propertyType: "multifamily", yearBuilt: 1998 } };

// features/keystone/seed/operations.ts
var UNUSABLE_PASSWORD_HASH2 = "$2a$10$3dITCbIvf5zFA.1U8KZDhOHC3EEexi3KYy5ysZK1cRF6LHMm0H.ya";
var day2 = (iso) => /* @__PURE__ */ new Date(`${iso}T00:00:00Z`);
async function seedOperations(uow, actor) {
  const { tx, now } = uow;
  const created = { skills: 0, technicians: 0, credentials: 0, requirements: 0, jobTypes: 0, windowTemplates: 0, shiftTemplates: 0, onCall: 0, campaigns: 0, customers: 0, locations: 0, consents: 0 };
  const meta = { metadata: { seed: true } };
  const haveSkills = new Set((await tx.skill.findMany({ select: { code: true } })).map((s) => s.code));
  const newSkills = SKILLS.filter(([code]) => !haveSkills.has(code));
  if (newSkills.length) {
    await tx.skill.createMany({ data: newSkills.map(([code, name, trade2]) => ({ id: `seed_skill_${code}`, code, name, trade: trade2 })) });
    created.skills = newSkills.length;
  }
  const skillId = (code) => `seed_skill_${code}`;
  const techIds = TECHS.map((t) => `seed_emp_${t.key}`);
  const haveEmployees = new Set((await tx.employee.findMany({ where: { id: { in: [...techIds, "seed_emp_kim"] } }, select: { id: true } })).map((e) => e.id));
  const newTechs = TECHS.filter((t) => !haveEmployees.has(`seed_emp_${t.key}`));
  if (newTechs.length) {
    const emails = newTechs.map((t) => `${t.first}.${t.last}@summitplumbingair.com`.toLowerCase());
    const existingUsers = new Set((await tx.user.findMany({ where: { email: { in: emails } }, select: { email: true } })).map((u) => u.email));
    await tx.user.createMany({ data: newTechs.filter((t) => !existingUsers.has(`${t.first}.${t.last}@summitplumbingair.com`.toLowerCase())).map((t) => ({ id: `seed_user_${t.key}`, name: `${t.first} ${t.last}`, email: `${t.first}.${t.last}@summitplumbingair.com`.toLowerCase(), title: t.title, phone: t.phone, password: UNUSABLE_PASSWORD_HASH2, kind: "staff", roleId: "seed_role_technician", onboardingStatus: "dismissed" })) });
    for (const [i, t] of newTechs.entries()) {
      const [lat, lng] = ZIP_CENTROIDS[t.zip];
      await tx.employee.create({
        data: {
          id: `seed_emp_${t.key}`,
          userId: `seed_user_${t.key}`,
          firstName: t.first,
          lastName: t.last,
          displayName: `${t.first} ${t.last}`,
          employeeNumber: `E-${String(1101 + TECHS.indexOf(t))}`,
          homeBranchId: BRANCH.id,
          kind: t.kind,
          employmentType: "w2_hourly",
          hireDate: day2(`20${String(14 + i % 10).padStart(2, "0")}-0${1 + i % 9}-15`),
          phoneE164: t.phone,
          email: `${t.first}.${t.last}@summitplumbingair.com`.toLowerCase(),
          lat: jitter(lat, i, 3),
          lng: jitter(lng, i, 4),
          dispatchable: true,
          status: "active",
          businessUnits: { connect: t.units.map((id) => ({ id })) },
          skills: { connect: t.skills.map((code) => ({ id: skillId(code) })) }
        }
      });
      auditCreate(uow, actor, "Employee", `seed_emp_${t.key}`, "employee.created", { name: `${t.first} ${t.last}`, kind: t.kind, units: t.units }, meta);
    }
    const credentials = newTechs.flatMap((t) => t.credentials.map((c, j) => ({
      id: `seed_cred_${t.key}_${j}`,
      employeeId: `seed_emp_${t.key}`,
      kind: c.kind,
      trade: c.trade,
      jurisdictionCode: c.kind === "epa_608" ? "US" : "US-TX",
      issuer: c.issuer,
      number: c.number,
      licenseClass: c.licenseClass ?? "",
      epaType: c.epaType ?? "none",
      issuedOn: day2("2022-01-15"),
      expiresOn: c.expiresOn ? day2(c.expiresOn) : null,
      status: c.status ?? "verified",
      verifiedById: (c.status ?? "verified") === "verified" ? "seed_user_ortega" : null,
      verifiedAt: (c.status ?? "verified") === "verified" ? /* @__PURE__ */ new Date("2026-10-01T15:00:00Z") : null
    })));
    await tx.credential.createMany({ data: credentials });
    for (const c of credentials) auditCreate(uow, actor, "Credential", c.id, c.status === "verified" ? "credential.verified" : "credential.created", { employeeId: c.employeeId, kind: c.kind, licenseClass: c.licenseClass, epaType: c.epaType, expiresOn: c.expiresOn }, meta);
    created.technicians = newTechs.length;
    created.credentials = credentials.length;
    const shiftTemplates = newTechs.flatMap((t) => [1, 2, 3, 4, 5].map((weekday2) => ({ employeeId: `seed_emp_${t.key}`, weekday: weekday2, startLocal: "07:30", endLocal: "17:00" })).concat(t.saturday ? [{ employeeId: `seed_emp_${t.key}`, weekday: 6, startLocal: "08:00", endLocal: "14:00" }] : []));
    await tx.shiftTemplate.createMany({ data: shiftTemplates, skipDuplicates: true });
    created.shiftTemplates = shiftTemplates.length;
  }
  if (!haveEmployees.has("seed_emp_kim")) {
    await tx.employee.create({ data: { id: "seed_emp_kim", userId: "seed_user_kim", firstName: "Rachel", lastName: "Kim", displayName: "Rachel Kim", employeeNumber: "E-1201", homeBranchId: BRANCH.id, kind: "sales", employmentType: "w2_salaried_nonexempt", phoneE164: "+15125550109", email: "rachel.kim@summitplumbingair.com", lat: "30.351600", lng: "-97.731700", dispatchable: true, status: "active", businessUnits: { connect: [{ id: "seed_bu_hvac_install" }] } } });
    await tx.shiftTemplate.createMany({ data: [1, 2, 3, 4, 5].map((weekday2) => ({ employeeId: "seed_emp_kim", weekday: weekday2, startLocal: "08:00", endLocal: "17:00" })), skipDuplicates: true });
    auditCreate(uow, actor, "Employee", "seed_emp_kim", "employee.created", { name: "Rachel Kim", kind: "sales" }, meta);
    created.technicians += 1;
  }
  const haveReqs = new Set((await tx.jobTypeRequirement.findMany({ where: { id: { in: REQUIREMENTS.map((r) => r.id) } }, select: { id: true } })).map((r) => r.id));
  for (const r of REQUIREMENTS.filter((r2) => !haveReqs.has(r2.id))) {
    await tx.jobTypeRequirement.create({ data: { id: r.id, name: r.name, licensingTags: [...r.licensingTags], requiredCredentialKinds: [], requiresSupervisorOnJob: false, skills: { connect: r.skills.map((code) => ({ id: skillId(code) })) } } });
    created.requirements += 1;
  }
  if (!await tx.checklistTemplate.findUnique({ where: { id: "seed_checklist_ac" } })) {
    await tx.checklistTemplate.create({ data: { id: "seed_checklist_ac", name: "Cooling system check", required: true, items: [{ key: "thermostat", label: "Thermostat set and responding" }, { key: "filter", label: "Filter condition" }, { key: "pressures", label: "Suction and liquid pressures recorded" }, { key: "delta_t", label: "Supply/return temperature split" }, { key: "condensate", label: "Condensate drain clear" }] } });
  }
  const haveTypes = new Set((await tx.jobType.findMany({ where: { id: { in: JOB_TYPES.map((j) => j.id) } }, select: { id: true } })).map((j) => j.id));
  const newTypes = JOB_TYPES.filter((j) => !haveTypes.has(j.id));
  if (newTypes.length) {
    await tx.jobType.createMany({
      data: newTypes.map((j) => ({
        id: j.id,
        code: j.code,
        name: j.name,
        businessUnitId: j.bu,
        trade: j.trade,
        priority: j.priority,
        defaultDurationMinutes: j.minutes,
        capacityHours: j.hours,
        crewSize: 1,
        requirementsId: j.req,
        keywords: [...j.keywords],
        bookableOnline: j.ai,
        bookableByAi: j.ai,
        emergencyPolicy: j.emergency ?? void 0,
        checklistTemplateId: j.code === "AC-DIAG" || j.code === "AC-TUNE" ? "seed_checklist_ac" : null,
        refrigerantWork: j.req === "seed_req_acr_refrigerant",
        permitLikely: false,
        bookingQuestions: [],
        active: true
      }))
    });
    for (const j of newTypes) auditCreate(uow, actor, "JobType", j.id, "job_type.created", { code: j.code, businessUnitId: j.bu, requirement: j.req, bookableByAi: j.ai, emergency: !!j.emergency }, meta);
    created.jobTypes = newTypes.length;
  }
  const haveTemplates = new Set((await tx.arrivalWindowTemplate.findMany({ select: { id: true } })).map((t) => t.id));
  const newTemplates = WINDOW_TEMPLATES.filter((t) => !haveTemplates.has(t.id));
  if (newTemplates.length) {
    await tx.arrivalWindowTemplate.createMany({ data: newTemplates.map((t) => ({ ...t, active: true })), skipDuplicates: true });
    uow.audit({ eventType: "capacity.templates_loaded", entityType: "ArrivalWindowTemplate", entityId: "seed", actorUserId: actor.kind === "user" ? actor.userId : null, after: { count: newTemplates.length } });
    created.windowTemplates = newTemplates.length;
  }
  if (!await tx.onCallRotation.count()) {
    const sixAm = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6);
    const start = new Date(sixAm > now.getTime() ? sixAm - 864e5 : sixAm);
    const rota = {
      seed_bu_hvac_service: [["morrison", "chu"], ["alvarez", "chu"], ["chu", "morrison"], ["morrison", "chu"]],
      seed_bu_plumbing_service: [["patel", "castillo"], ["haddad", "castillo"], ["castillo", "patel"], ["patel", "castillo"]],
      seed_bu_electrical: [["dawson", "bennett"], ["bennett", "dawson"], ["dawson", "bennett"], ["bennett", "dawson"]]
    };
    const rows = Object.entries(rota).flatMap(([bu, weeks]) => weeks.flatMap(([primary, backup], w) => [primary, backup].map((key2, order) => ({
      businessUnitId: bu,
      employeeId: `seed_emp_${key2}`,
      startsAt: new Date(start.getTime() + w * 7 * 864e5),
      endsAt: new Date(start.getTime() + (w + 1) * 7 * 864e5),
      phoneE164: TECHS.find((t) => t.key === key2).phone,
      escalationOrder: order + 1
    }))));
    await tx.onCallRotation.createMany({ data: rows });
    created.onCall = rows.length;
  }
  const haveCampaigns = new Set((await tx.campaign.findMany({ select: { id: true } })).map((c) => c.id));
  for (const c of CAMPAIGNS.filter((c2) => !haveCampaigns.has(c2.id))) {
    await tx.campaign.create({ data: { id: c.id, name: c.name, channel: c.channel, monthlyCostMinor: c.monthlyCostMinor, active: true, trackingNumbers: { create: [{ phoneE164: c.number, provider: "manual", forwardTo: "+15125550100" }] } } });
    created.campaigns += 1;
  }
  const all2 = [...HOUSEHOLDS.map((h) => ({ ...h, kind: "residential", organizationName: "" })), { ...COMMERCIAL, kind: "commercial", organizationName: COMMERCIAL.displayName, smsConsent: true, optedOut: false }];
  const haveCustomers = new Set((await tx.customer.findMany({ where: { id: { in: all2.map((c) => c.id) } }, select: { id: true } })).map((c) => c.id));
  const fresh = all2.filter((c) => !haveCustomers.has(c.id));
  if (fresh.length) {
    await tx.customer.createMany({ data: fresh.map((c) => ({ id: c.id, ref: c.ref, kind: c.kind, displayName: c.displayName, organizationName: c.organizationName })) });
    await tx.contact.createMany({ data: fresh.map((c) => ({ id: `${c.id}_contact`, customerId: c.id, firstName: c.first, lastName: c.last, role: c.kind === "commercial" ? "property_manager" : "owner" })) });
    await tx.$executeRaw`UPDATE "Customer" SET "primaryContact" = id || '_contact' WHERE id = ANY(${fresh.map((c) => c.id)}::text[])`;
    await tx.contactPoint.createMany({
      data: fresh.flatMap((c) => [
        { id: `${c.id}_mobile`, contactId: `${c.id}_contact`, kind: "mobile", value: c.phone, valueHash: contactHash(c.phone), isPrimary: true, carrierLineType: "mobile" },
        { id: `${c.id}_email`, contactId: `${c.id}_contact`, kind: "email", value: c.email, valueHash: contactHash(c.email), isPrimary: false, carrierLineType: "unknown" }
      ])
    });
    const serviceArea = (zip) => ["78613", "78660", "78664", "78665", "78681", "78717", "78727", "78728", "78729", "78750"].includes(zip) ? "seed_area_north" : "seed_area_austin";
    await tx.serviceLocation.createMany({
      data: fresh.map((c) => ({ id: c.location.id, ref: c.location.ref, customerId: c.id, address1: c.location.address1, city: c.location.city, state: "TX", county: ["78613", "78660", "78664", "78665", "78681", "78717", "78729"].includes(c.location.postalCode) ? "Williamson" : "Travis", postalCode: c.location.postalCode, country: "US", lat: c.location.lat, lng: c.location.lng, geocodeQuality: "interpolated", timeZone: "America/Chicago", serviceAreaId: serviceArea(c.location.postalCode), propertyClass: c.kind === "commercial" ? "nonresidential" : "residential", propertyType: c.location.propertyType, yearBuilt: c.location.yearBuilt }))
    });
    await tx.locationOwnership.createMany({ data: fresh.map((c) => ({ locationId: c.location.id, customerId: c.id, from: day2("2020-01-01"), reason: "import" })) });
    const consents = fresh.flatMap((c) => [
      ...c.smsConsent ? [{ contactPointId: `${c.id}_mobile`, purpose: "transactional_sms", action: "grant", channel: "import", evidence: { source: "prior system export", capturedAt: "2026-06-01" }, wordingVersion: "booking-texts-v1", recordedAt: /* @__PURE__ */ new Date("2026-06-01T15:00:00Z"), actorKind: "system", actorId: "seed" }] : [],
      ...c.optedOut ? [{ contactPointId: `${c.id}_mobile`, purpose: "transactional_sms", action: "revoke", channel: "sms_keyword", evidence: { keyword: "STOP" }, wordingVersion: "ctia-keywords", recordedAt: /* @__PURE__ */ new Date("2026-09-12T19:20:00Z"), actorKind: "customer", actorId: "" }] : []
    ]);
    await tx.consentRecord.createMany({ data: consents });
    const optedOut = fresh.filter((c) => c.optedOut);
    if (optedOut.length) await tx.dncEntry.createMany({ data: optedOut.map((c) => ({ valueHash: contactHash(c.phone), kind: "internal", source: "sms_stop", addedAt: /* @__PURE__ */ new Date("2026-09-12T19:20:00Z") })) });
    for (const c of fresh) auditCreate(uow, actor, "Customer", c.id, "customer.created", { ref: c.ref, kind: c.kind, locationId: c.location.id, smsConsent: c.smsConsent }, meta);
    created.customers = fresh.length;
    created.locations = fresh.length;
    created.consents = consents.length;
  }
  return created;
}

// features/keystone/services/booking.ts
init_actor();
init_cas();
init_decimal();
init_errors();

// features/keystone/lib/sequence.ts
var import_node_crypto6 = require("node:crypto");
init_db();
async function nextReference(tx, prefix, now = /* @__PURE__ */ new Date(), width = 6) {
  if (!/^[A-Z]{2,5}$/.test(prefix)) throw new Error("Reference prefix must be 2-5 capital letters");
  const key2 = `${prefix}-${now.getUTCFullYear()}`;
  await advisoryLock(tx, `sequence:${key2}`);
  const row = await tx.sequence.upsert({ where: { key: key2 }, create: { key: key2, nextValue: 2 }, update: { nextValue: { increment: 1 } } });
  const value = row.nextValue - 1;
  return `${key2}-${String(value).padStart(width, "0")}`;
}
var CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function publicCode(prefix, groups = 2) {
  const bytes = (0, import_node_crypto6.randomBytes)(groups * 4);
  const chars = Array.from(bytes, (byte) => CROCKFORD[byte % 32]);
  const parts2 = Array.from({ length: groups }, (_, i) => chars.slice(i * 4, i * 4 + 4).join(""));
  return `${prefix}-${parts2.join("-")}`;
}

// features/keystone/domain/capacity.ts
init_decimal();
function windowsForDate(templates, date, timeZone, isOpen) {
  assertDate(date);
  if (!isOpen(date)) return [];
  const day3 = weekday(date);
  return templates.filter((t) => t.active && t.weekday === day3).map((t) => {
    const startsAt = zonedInstant(timeZone, date, t.startLocal);
    const endsAt = zonedInstant(timeZone, date, t.endLocal);
    if (endsAt <= startsAt) throw new Error(`Window ${t.label} ends before it starts on ${date}`);
    const factor = t.capacityFactor === null || t.capacityFactor === void 0 ? dec(1) : dec(t.capacityFactor);
    return { templateId: t.id, businessUnitId: t.businessUnitId, date, startsAt, endsAt, label: t.label, capacityHours: toScale(dec(t.capacityHours).times(factor), "qty") };
  }).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
function dateRange(from, days) {
  assertDate(from);
  return Array.from({ length: Math.max(0, days) }, (_, i) => addDays(from, i));
}
function holdExpiry(now, source, requestedMinutes) {
  const max = source === "csr" ? 30 : 10;
  const minutes = requestedMinutes ? Math.min(Math.max(1, Math.floor(requestedMinutes)), max) : max;
  return new Date(now.getTime() + minutes * 6e4);
}

// features/keystone/services/booking.ts
async function reserve(tx, windowId, hours) {
  const rows = await tx.$queryRaw`
    UPDATE "ArrivalWindow" SET "bookedHours" = "bookedHours" + ${hours}::numeric, version = version + 1, "updatedAt" = now()
    WHERE id = ${windowId} AND NOT closed AND "bookedHours" + ${hours}::numeric <= "capacityHours"
    RETURNING id, "businessUnit", date, "startsAt", "endsAt", label, "capacityHours", "bookedHours"`;
  return rows[0] ?? null;
}
async function unreserve(tx, windowId, hours) {
  await tx.$executeRaw`UPDATE "ArrivalWindow" SET "bookedHours" = GREATEST(0, "bookedHours" - ${hours}::numeric), version = version + 1, "updatedAt" = now() WHERE id = ${windowId}`;
}
async function sweepExpiredHolds(uow, actor, windowId) {
  const expired = await uow.tx.$queryRaw`
    UPDATE "BookingHold" SET status = 'expired', version = version + 1, "updatedAt" = now()
    WHERE "window" = ${windowId} AND status = 'held' AND "expiresAt" <= ${uow.now}
    RETURNING id, hours, version`;
  if (!expired.length) return 0;
  const total = expired.reduce((sum, h) => sum.plus(h.hours.toString()), dec(0));
  await unreserve(uow.tx, windowId, toScale(total, "qty"));
  await uow.tx.capacityUsage.deleteMany({ where: { holdId: { in: expired.map((h) => h.id) } } });
  for (const h of expired) uow.audit({ eventType: "booking_hold.expired", entityType: "BookingHold", entityId: h.id, actorUserId: actorUserId(actor), actorAgentId: actorAgentId(actor), before: { status: "held", version: h.version - 1 }, after: { status: "expired", version: h.version } });
  return expired.length;
}
async function loadJobType(tx, jobTypeId) {
  const jobType = await tx.jobType.findUnique({ where: { id: jobTypeId }, select: { id: true, code: true, name: true, active: true, capacityHours: true, businessUnitId: true, priority: true, defaultDurationMinutes: true, bookableByAi: true, bookableOnline: true } });
  if (!jobType || !jobType.active) throw new DomainError(Codes.NOT_FOUND, "That job type is not offered.", { field: "jobTypeId" });
  return jobType;
}
function assertSourceAllowed(actor, jobType, source) {
  if (actor.kind === "agent" && !jobType.bookableByAi) throw new DomainError(Codes.GUARD_FAILED, `${jobType.name} is booked by a person, not the AI receptionist. Hand the call off.`, { reason: "not_bookable_by_ai" });
  if (source === "online" && !jobType.bookableOnline) throw new DomainError(Codes.GUARD_FAILED, `${jobType.name} can't be booked online.`, { reason: "not_bookable_online" });
}
async function serviceAreaFor(db, businessUnitId, postalCode) {
  const zip = postalCode.trim().slice(0, 5);
  const areas = await db.serviceArea.findMany({ where: { zips: { array_contains: [zip] }, ...businessUnitId ? { businessUnits: { some: { id: businessUnitId } } } : {} }, select: { id: true, name: true, travelZone: true } });
  return areas[0] ?? null;
}
async function branchCalendar(db, branchId) {
  const branch = branchId ? await db.branch.findUnique({ where: { id: branchId }, select: { timeZone: true, calendar: { select: { code: true, weekendDays: true, coverageThrough: true, exceptions: { where: { kind: { in: ["holiday", "closure"] } }, select: { date: true } } } } } }) : null;
  const timeZone = branch?.timeZone || "America/Chicago";
  const cal = branch?.calendar;
  const spec = cal ? { code: cal.code, timeZone, weekendDays: cal.weekendDays ?? [0], holidays: new Set(cal.exceptions.map((e) => e.date.toISOString().slice(0, 10))), coverageThrough: cal.coverageThrough ? cal.coverageThrough.toISOString().slice(0, 10) : US_FEDERAL.coverageThrough } : { code: "DEFAULT", timeZone, weekendDays: [0], holidays: new Set(FEDERAL_HOLIDAYS.map((h) => h.date)), coverageThrough: US_FEDERAL.coverageThrough };
  return { timeZone, isOpen: (date) => date <= spec.coverageThrough && isBusinessDay(spec, date) };
}
async function materializeWindows(db, actor, args) {
  await authorizeOperation(db, actor, "capacity.materialize", ["canDispatch", "canManageCompany"], args);
  if (!Number.isSafeInteger(args.days) || args.days < 1 || args.days > 120) throw new DomainError(Codes.INVALID_INPUT, "Materialise between 1 and 120 days.", { field: "days" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.from)) throw new DomainError(Codes.INVALID_INPUT, "Start date must be YYYY-MM-DD.", { field: "from" });
  const dates = dateRange(args.from, args.days);
  const units = await db.businessUnit.findMany({ where: { active: true, capacityEnabled: true, ...args.businessUnitIds?.length ? { id: { in: args.businessUnitIds } } : {} }, select: { id: true, branchId: true } });
  const templates = await db.arrivalWindowTemplate.findMany({ where: { active: true, businessUnitId: { in: units.map((u) => u.id) } } });
  const calendars = /* @__PURE__ */ new Map();
  const calendarFor = async (branchId) => {
    const key2 = branchId ?? "";
    if (!calendars.has(key2)) calendars.set(key2, await branchCalendar(db, branchId));
    return calendars.get(key2);
  };
  const windows = [];
  for (const unit of units) {
    const cal = await calendarFor(unit.branchId);
    const specs = templates.filter((t) => t.businessUnitId === unit.id).map((t) => ({ id: t.id, businessUnitId: unit.id, weekday: t.weekday, startLocal: t.startLocal, endLocal: t.endLocal, label: t.label, capacityHours: t.capacityHours.toString(), capacityFactor: t.capacityFactor?.toString() ?? null, active: t.active }));
    for (const date of dates) {
      for (const w of windowsForDate(specs, date, cal.timeZone, cal.isOpen)) {
        windows.push({ businessUnitId: unit.id, templateId: w.templateId, date: /* @__PURE__ */ new Date(`${date}T00:00:00Z`), startsAt: w.startsAt, endsAt: w.endsAt, label: w.label, capacityHours: w.capacityHours, bookedHours: "0" });
      }
    }
  }
  const shiftTemplates = await db.shiftTemplate.findMany({ where: { employee: { status: "active" } }, select: { employeeId: true, weekday: true, startLocal: true, endLocal: true, employee: { select: { homeBranchId: true } } } });
  const shifts = [];
  for (const t of shiftTemplates) {
    const cal = await calendarFor(t.employee?.homeBranchId ?? null);
    for (const date of dates) {
      if (weekday(date) !== t.weekday || !cal.isOpen(date)) continue;
      shifts.push({ employeeId: t.employeeId, date: /* @__PURE__ */ new Date(`${date}T00:00:00Z`), startsAt: zonedInstant(cal.timeZone, date, t.startLocal), endsAt: zonedInstant(cal.timeZone, date, t.endLocal), kind: "regular" });
    }
  }
  const result = await command(db, { name: "capacity.materialize", actor, idempotencyKey: args.idempotencyKey, params: args }, async (uow) => {
    const createdWindows = windows.length ? await uow.tx.arrivalWindow.createMany({ data: windows, skipDuplicates: true }) : { count: 0 };
    const createdShifts = shifts.length ? await uow.tx.shift.createMany({ data: shifts, skipDuplicates: true }) : { count: 0 };
    uow.audit({ eventType: "capacity.windows_materialized", entityType: "ArrivalWindow", entityId: `${args.from}+${args.days}`, actorUserId: actorUserId(actor), actorAgentId: actorAgentId(actor), after: { windows: createdWindows.count, shifts: createdShifts.count } });
    const value = { planned: windows.length, created: createdWindows.count, shifts: createdShifts.count };
    await recordAgentAction(uow, actor, { tool: "capacity.materialize", idempotencyKey: args.idempotencyKey, inputs: args, output: value });
    return value;
  });
  return { replay: result.replay, ...result.value };
}
async function availableWindows(db, actor, args) {
  await authorizeOperation(db, actor, "capacity.windows", ["canBook", "canDispatch"], args);
  const jobType = await loadJobType(db, args.jobTypeId);
  const area = await serviceAreaFor(db, jobType.businessUnitId, args.postalCode);
  if (!area) {
    const out2 = { inArea: false, serviceArea: null, jobType: { id: jobType.id, name: jobType.name, priority: jobType.priority }, windows: [] };
    await recordAgentRead(db, actor, { tool: "capacity.windows", inputs: args, output: { inArea: false } });
    return out2;
  }
  const days = Math.min(Math.max(args.days ?? 7, 1), 31);
  const now = args.now ?? /* @__PURE__ */ new Date();
  const rows = await db.arrivalWindow.findMany({
    where: { businessUnitId: jobType.businessUnitId, closed: false, date: { gte: /* @__PURE__ */ new Date(`${args.from}T00:00:00Z`), lt: /* @__PURE__ */ new Date(`${addDays(args.from, days)}T00:00:00Z`) }, startsAt: { gt: now } },
    orderBy: [{ startsAt: "asc" }],
    select: { id: true, date: true, label: true, startsAt: true, endsAt: true, capacityHours: true, bookedHours: true, businessUnitId: true }
  });
  const need = dec(jobType.capacityHours.toString());
  const windows = rows.map((w) => ({ windowId: w.id, date: w.date.toISOString().slice(0, 10), label: w.label, startsAt: w.startsAt.toISOString(), endsAt: w.endsAt.toISOString(), remainingHours: toScale(dec(w.capacityHours.toString()).minus(w.bookedHours.toString()), "qty"), businessUnitId: w.businessUnitId })).filter((w) => dec(w.remainingHours).gte(need));
  const out = { inArea: true, serviceArea: { id: area.id, name: area.name, travelZone: area.travelZone }, jobType: { id: jobType.id, name: jobType.name, priority: jobType.priority }, windows };
  await recordAgentRead(db, actor, { tool: "capacity.windows", inputs: args, output: { inArea: true, windows: windows.length } });
  return out;
}
async function holdWindow(db, actor, args) {
  await authorizeOperation(db, actor, "booking.hold", ["canBook"], args);
  const source = actor.kind === "agent" ? "ai_agent" : args.source;
  const jobType = await loadJobType(db, args.jobTypeId);
  assertSourceAllowed(actor, jobType, source);
  const hours = toScale(jobType.capacityHours.toString(), "qty");
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "booking.hold", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    let window2 = await reserve(uow.tx, args.windowId, hours);
    if (!window2 && await sweepExpiredHolds(uow, actor, args.windowId)) window2 = await reserve(uow.tx, args.windowId, hours);
    if (!window2) {
      const exists = await uow.tx.arrivalWindow.findUnique({ where: { id: args.windowId }, select: { id: true, closed: true, businessUnitId: true } });
      if (!exists) throw new DomainError(Codes.NOT_FOUND, "That arrival window does not exist.", { field: "windowId" });
      throw new DomainError(Codes.CAPACITY_FULL, exists.closed ? "That window is closed." : "That window just filled up. Offer the next one.", { reason: exists.closed ? "closed" : "full" });
    }
    if (window2.businessUnit !== jobType.businessUnitId) throw new DomainError(Codes.INVALID_INPUT, "That window belongs to a different department.", { field: "windowId" });
    const expiresAt = holdExpiry(uow.now, source, args.minutes);
    const code = publicCode("HLD");
    const hold = await uow.tx.bookingHold.create({
      data: { publicCode: code, windowId: window2.id, jobTypeId: jobType.id, hours, source, heldByUserId: actorUserId(actor), heldByAgentId: actorAgentId(actor), customerDraft: args.customerDraft ?? void 0, expiresAt, status: "held" },
      select: { id: true, version: true }
    });
    await uow.tx.capacityUsage.create({ data: { windowId: window2.id, kind: "hold", holdId: hold.id, hours } });
    auditCreate(uow, actor, "BookingHold", hold.id, "booking_hold.held", { windowId: window2.id, jobTypeId: jobType.id, hours, source, expiresAt });
    const value = { holdId: hold.id, publicCode: code, version: hold.version, windowId: window2.id, label: window2.label, startsAt: window2.startsAt.toISOString(), endsAt: window2.endsAt.toISOString(), expiresAt: expiresAt.toISOString(), hours };
    await recordAgentAction(uow, actor, { tool: "booking.hold", idempotencyKey, inputs: params, output: value });
    return value;
  });
  return { replay: result.replay, ...result.value };
}
async function releaseHold(db, actor, args) {
  await authorizeOperation(db, actor, "booking.release", ["canBook"], args);
  const result = await command(db, { name: "booking.release", actor, idempotencyKey: args.idempotencyKey, params: { holdId: args.holdId }, now: args.now }, async (uow) => {
    const [hold] = await uow.tx.$queryRaw`SELECT id, status, version, "window", hours, "heldByAgent" FROM "BookingHold" WHERE id = ${args.holdId} FOR UPDATE`;
    if (!hold) throw new DomainError(Codes.NOT_FOUND, "Hold not found.");
    if (actor.kind === "agent" && hold.heldByAgent !== actor.agentId) throw new DomainError(Codes.NOT_AUTHORIZED, "An agent can release only its own holds.");
    if (hold.status !== "held") return { holdId: hold.id, status: hold.status };
    await casUpdate(uow, { model: "BookingHold", id: hold.id, version: hold.version, from: ["held"], to: "released", actor, eventType: "booking_hold.released" });
    await unreserve(uow.tx, hold.window, hold.hours.toString());
    await uow.tx.capacityUsage.deleteMany({ where: { holdId: hold.id } });
    await recordAgentAction(uow, actor, { tool: "booking.release", idempotencyKey: args.idempotencyKey, inputs: { holdId: args.holdId }, output: { status: "released" } });
    return { holdId: hold.id, status: "released" };
  });
  return { replay: result.replay, ...result.value };
}
async function expireHolds(db, now = /* @__PURE__ */ new Date()) {
  const lapsed = await db.bookingHold.findMany({ where: { status: "held", expiresAt: { lte: now } }, select: { windowId: true }, distinct: ["windowId"], take: 500 });
  let expired = 0;
  for (const { windowId } of lapsed) {
    if (!windowId) continue;
    const actor = { kind: "system", name: "hold-expiry" };
    const r = await command(db, { name: "booking.expire", actor, idempotencyKey: `hold-expiry:${windowId}:${now.toISOString()}`, params: { windowId }, now }, (uow) => sweepExpiredHolds(uow, actor, windowId));
    expired += Number(r.value);
  }
  return { expired };
}
async function bookJob(db, actor, args) {
  await authorizeOperation(db, actor, "booking.confirm", ["canBook"], args);
  const jobType = await loadJobType(db, args.jobTypeId);
  const source = actor.kind === "agent" ? "ai_agent" : args.source ?? "csr";
  assertSourceAllowed(actor, jobType, source);
  if (!args.holdId && !args.windowId) throw new DomainError(Codes.INVALID_INPUT, "Choose an arrival window (or a hold).", { field: "windowId" });
  if (!args.customerId && !args.customer) throw new DomainError(Codes.INVALID_INPUT, "Choose or create a customer.", { field: "customer" });
  if (!args.locationId && !args.location) throw new DomainError(Codes.INVALID_INPUT, "Choose or add a service address.", { field: "location" });
  const geo2 = args.location ? await geocoder().geocode({ address1: args.location.address1, city: args.location.city, state: args.location.state ?? "TX", postalCode: args.location.postalCode }) : null;
  const phone = args.customer?.phone ? normalizePhone(args.customer.phone) : null;
  const email = args.customer?.email ? normalizeEmail(args.customer.email) : null;
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "booking.confirm", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const hours = toScale(jobType.capacityHours.toString(), "qty");
    let windowId;
    let holdId = null;
    if (args.holdId) {
      const [hold] = await tx.$queryRaw`SELECT id, status, version, "window", "jobType", "expiresAt", "heldByAgent" FROM "BookingHold" WHERE id = ${args.holdId} FOR UPDATE`;
      if (!hold) throw new DomainError(Codes.NOT_FOUND, "Hold not found.", { field: "holdId" });
      if (hold.status !== "held") throw new DomainError(Codes.INVALID_TRANSITION, `That hold is ${hold.status}.`, { currentStatus: hold.status, to: "converted" });
      if (hold.expiresAt <= uow.now) throw new DomainError(Codes.HOLD_EXPIRED, "The hold ran out. Check the window again.", { currentStatus: "held", reason: "expired" });
      if (hold.jobType !== jobType.id) throw new DomainError(Codes.INVALID_INPUT, "The hold was for a different job type.", { field: "jobTypeId" });
      if (actor.kind === "agent" && hold.heldByAgent !== actor.agentId) throw new DomainError(Codes.NOT_AUTHORIZED, "An agent can confirm only its own holds.");
      await casUpdate(uow, { model: "BookingHold", id: hold.id, version: hold.version, from: ["held"], to: "converted", actor, eventType: "booking_hold.converted" });
      windowId = hold.window;
      holdId = hold.id;
    } else {
      const reserved = await reserve(tx, args.windowId, hours);
      if (!reserved) throw new DomainError(Codes.CAPACITY_FULL, "That window just filled up. Offer the next one.", { reason: "full" });
      if (reserved.businessUnit !== jobType.businessUnitId) throw new DomainError(Codes.INVALID_INPUT, "That window belongs to a different department.", { field: "windowId" });
      windowId = reserved.id;
    }
    const window2 = await tx.arrivalWindow.findUniqueOrThrow({ where: { id: windowId }, select: { id: true, startsAt: true, endsAt: true, label: true, date: true, businessUnitId: true } });
    const customer = args.customerId ? await tx.customer.findUnique({ where: { id: args.customerId }, select: { id: true, displayName: true, doNotService: true } }) : await createCustomerInTx(uow, actor, { ...args.customer, phone, email }, { smsConsent: !!args.smsConsent, evidence: args.consentEvidence ?? { source } });
    if (!customer) throw new DomainError(Codes.NOT_FOUND, "Customer not found.", { field: "customerId" });
    if (customer.doNotService) throw new DomainError(Codes.GUARD_FAILED, "This customer is marked do-not-service. A manager has to book it.", { reason: "do_not_service" });
    const location = args.locationId ? await tx.serviceLocation.findUnique({ where: { id: args.locationId }, select: { id: true, postalCode: true, customerId: true } }) : await createLocationInTx(uow, actor, customer.id, args.location, geo2);
    if (!location) throw new DomainError(Codes.NOT_FOUND, "Service address not found.", { field: "locationId" });
    const area = await serviceAreaFor(tx, jobType.businessUnitId, location.postalCode);
    if (!area) throw new DomainError(Codes.OUT_OF_AREA, `ZIP ${location.postalCode} is outside the service area for ${jobType.name}.`, { reason: "out_of_area" });
    const ref = await nextReference(tx, "JOB", uow.now);
    const job = await tx.job.create({
      data: {
        ref,
        publicCode: publicCode("J"),
        customerId: customer.id,
        locationId: location.id,
        businessUnitId: jobType.businessUnitId,
        jobTypeId: jobType.id,
        priority: jobType.priority,
        status: "booked",
        summary: args.summary ?? "",
        source,
        leadId: args.leadId ?? null,
        bookedById: actorUserId(actor),
        bookedByAgentId: actorAgentId(actor)
      },
      select: { id: true, ref: true, publicCode: true }
    });
    const visit = await tx.visit.create({
      data: { ref: `${ref}-V1`, jobId: job.id, windowId: window2.id, plannedStart: window2.startsAt, plannedDurationMinutes: jobType.defaultDurationMinutes, capacityHours: hours, status: "unassigned" },
      select: { id: true, ref: true }
    });
    if (holdId) {
      await tx.capacityUsage.updateMany({ where: { holdId }, data: { kind: "visit", visitId: visit.id } });
      await tx.bookingHold.update({ where: { id: holdId }, data: { jobId: job.id, visitId: visit.id } });
    } else {
      await tx.capacityUsage.create({ data: { windowId: window2.id, kind: "visit", visitId: visit.id, hours } });
    }
    auditCreate(uow, actor, "Job", job.id, "job.booked", { ref, customerId: customer.id, locationId: location.id, jobTypeId: jobType.id, windowId: window2.id, source, holdId });
    auditCreate(uow, actor, "Visit", visit.id, "visit.created", { ref: visit.ref, windowId: window2.id, status: "unassigned" });
    if (args.leadId) {
      const lead = await tx.lead.findUnique({ where: { id: args.leadId }, select: { id: true, status: true, version: true } });
      if (lead && ["new", "contacted", "qualified"].includes(lead.status)) {
        await casUpdate(uow, { model: "Lead", id: lead.id, version: lead.version, from: [lead.status], to: "booked", actor, eventType: "lead.booked", data: { jobId: job.id, customerId: customer.id, locationId: location.id } });
      }
    }
    const value = { jobId: job.id, ref: job.ref, publicCode: job.publicCode, visitId: visit.id, windowId: window2.id, window: window2.label, date: window2.date.toISOString().slice(0, 10), startsAt: window2.startsAt.toISOString(), endsAt: window2.endsAt.toISOString(), customerId: customer.id, locationId: location.id };
    await recordAgentAction(uow, actor, { tool: "booking.confirm", idempotencyKey, inputs: params, output: value });
    return value;
  });
  return { replay: result.replay, ...result.value };
}
async function createCustomerInTx(uow, actor, input, consent) {
  const { tx } = uow;
  const displayName = (input.displayName || [input.firstName, input.lastName].filter(Boolean).join(" ") || input.organizationName || "").trim();
  if (!displayName) throw new DomainError(Codes.INVALID_INPUT, "A customer needs a name.", { field: "customer" });
  const ref = await nextReference(tx, "CUS", uow.now);
  const customer = await tx.customer.create({ data: { ref, kind: input.kind ?? "residential", displayName, organizationName: input.organizationName ?? "" }, select: { id: true, displayName: true, doNotService: true } });
  const contact = await tx.contact.create({ data: { customerId: customer.id, firstName: input.firstName ?? "", lastName: input.lastName ?? "", role: "owner" }, select: { id: true } });
  await tx.customer.update({ where: { id: customer.id }, data: { primaryContactId: contact.id } });
  const points = [];
  if (input.phone) points.push({ contactId: contact.id, kind: "mobile", value: input.phone, valueHash: contactHash(input.phone), isPrimary: true, carrierLineType: "unknown" });
  if (input.email) points.push({ contactId: contact.id, kind: "email", value: input.email, valueHash: contactHash(input.email), isPrimary: !input.phone, carrierLineType: "unknown" });
  if (points.length) {
    const created = await tx.contactPoint.createManyAndReturn({ data: points, select: { id: true, kind: true } });
    const mobile = created.find((p) => p.kind === "mobile");
    if (mobile && consent.smsConsent) {
      await tx.consentRecord.create({ data: { contactPointId: mobile.id, purpose: "transactional_sms", action: "grant", channel: actor.kind === "agent" ? "phone" : "phone", evidence: consent.evidence, wordingVersion: "booking-texts-v1", recordedAt: uow.now, actorKind: actor.kind === "agent" ? "agent" : actor.kind === "user" ? "user" : "system", actorId: actorAgentId(actor) ?? actorUserId(actor) ?? "" } });
    }
  }
  auditCreate(uow, actor, "Customer", customer.id, "customer.created", { ref, displayName, kind: input.kind ?? "residential", contactPoints: points.length, smsConsent: consent.smsConsent });
  return customer;
}
async function createLocationInTx(uow, actor, customerId, input, geo2) {
  const { tx } = uow;
  if (!/^\d{5}(-\d{4})?$/.test(input.postalCode.trim())) throw new DomainError(Codes.INVALID_INPUT, "That ZIP code is not valid.", { field: "postalCode" });
  const area = await serviceAreaFor(tx, null, input.postalCode);
  const ref = await nextReference(tx, "LOC", uow.now);
  const location = await tx.serviceLocation.create({
    data: {
      ref,
      customerId,
      address1: input.address1.trim(),
      address2: input.address2?.trim() ?? "",
      city: input.city.trim(),
      state: (input.state ?? "TX").toUpperCase(),
      postalCode: input.postalCode.trim(),
      country: "US",
      lat: geo2.lat,
      lng: geo2.lng,
      geocodeQuality: geo2.quality,
      timeZone: geo2.timeZone,
      serviceAreaId: area?.id ?? null,
      propertyType: input.propertyType ?? "single_family"
    },
    select: { id: true, postalCode: true, customerId: true }
  });
  await tx.locationOwnership.create({ data: { locationId: location.id, customerId, from: /* @__PURE__ */ new Date(`${localDate({ timeZone: geo2.timeZone }, uow.now)}T00:00:00Z`), reason: "created" } });
  auditCreate(uow, actor, "ServiceLocation", location.id, "location.created", { ref, customerId, postalCode: location.postalCode, serviceAreaId: area?.id ?? null, geocodeQuality: geo2.quality });
  return location;
}

// features/keystone/seed/pricebook.ts
init_cas();

// features/keystone/mutations/approvals.ts
init_actor();
init_approval();

// features/keystone/lib/approvalAppliers.ts
var appliers = /* @__PURE__ */ new Map();
function registerApplier(action, apply, options = {}) {
  if (appliers.has(action)) throw new Error(`Applier for ${action} already registered`);
  appliers.set(action, { apply, applyOnApprove: options.applyOnApprove ?? true });
}
function applierFor(action) {
  return appliers.get(action) ?? null;
}

// features/keystone/mutations/approvals.ts
init_cas();
init_errors();

// features/keystone/lib/companyControls.ts
init_errors();
init_approval();
var CONTROL_KEYS = ["discountApprovalThresholdBps", "refundApprovalThresholdMinor", "poApprovalThresholdMinor"];
var minorIn = (value, name) => {
  if (typeof value !== "string" || !/^\d{1,15}$/.test(value)) throw new DomainError(Codes.INVALID_INPUT, `${name} must be whole cents as a string, e.g. "50000".`, { field: name });
  return BigInt(value);
};
function validateCompanyControls(input) {
  const keys = Object.keys(input ?? {});
  if (!keys.length) throw new DomainError(Codes.INVALID_INPUT, "Nothing to change.");
  for (const key2 of keys) if (!CONTROL_KEYS.includes(key2)) throw new DomainError(Codes.INVALID_INPUT, `${key2} is not a company control.`, { field: key2 });
  const out = {};
  if (input.discountApprovalThresholdBps !== void 0) {
    const v = input.discountApprovalThresholdBps;
    if (!Number.isSafeInteger(v) || v < 0 || v > 1e4) throw new DomainError(Codes.INVALID_INPUT, "discountApprovalThresholdBps must be a whole number from 0 to 10000.", { field: "discountApprovalThresholdBps" });
    out.discountApprovalThresholdBps = v;
  }
  if (input.refundApprovalThresholdMinor !== void 0) out.refundApprovalThresholdMinor = minorIn(input.refundApprovalThresholdMinor, "refundApprovalThresholdMinor").toString();
  if (input.poApprovalThresholdMinor !== void 0) out.poApprovalThresholdMinor = minorIn(input.poApprovalThresholdMinor, "poApprovalThresholdMinor").toString();
  return out;
}
var toData = (changes) => ({
  ...changes.discountApprovalThresholdBps !== void 0 ? { discountApprovalThresholdBps: changes.discountApprovalThresholdBps } : {},
  ...changes.refundApprovalThresholdMinor !== void 0 ? { refundApprovalThresholdMinor: BigInt(changes.refundApprovalThresholdMinor) } : {},
  ...changes.poApprovalThresholdMinor !== void 0 ? { poApprovalThresholdMinor: BigInt(changes.poApprovalThresholdMinor) } : {}
});
async function requestCompanyControlsChange(uow, actor, input, reason) {
  const changes = validateCompanyControls(input);
  const company = await uow.tx.companySettings.findUnique({ where: { singletonKey: "company" } });
  if (!company) throw new DomainError(Codes.NOT_FOUND, "Company settings are not set up yet.");
  return requestApproval(uow, actor, {
    action: "company.controls",
    targetList: "CompanySettings",
    targetId: String(company.id),
    payload: { changes, baseVersion: company.version },
    requiredPermission: "canApprovePolicies",
    summary: `Change company controls: ${Object.keys(changes).join(", ")}${reason ? ` (${reason})` : ""}`
  });
}
registerApplier("company.controls", async (uow, actor, request) => {
  const [company] = await uow.tx.$queryRaw`SELECT id, version FROM "CompanySettings" WHERE "singletonKey" = 'company' FOR UPDATE`;
  if (!company) throw new DomainError(Codes.NOT_FOUND, "Company settings are not set up yet.");
  const { changes, baseVersion } = request.payload;
  if (company.version !== baseVersion) throw new DomainError(Codes.STALE_STATE, "Company settings changed after this was approved. Request the change again.", { currentVersion: company.version });
  const before = await uow.tx.companySettings.findUnique({ where: { id: company.id }, select: { discountApprovalThresholdBps: true, refundApprovalThresholdMinor: true, poApprovalThresholdMinor: true } });
  const updated = await uow.tx.companySettings.updateMany({ where: { id: company.id, version: baseVersion }, data: { ...toData(changes), version: { increment: 1 } } });
  if (updated.count !== 1) throw new DomainError(Codes.STALE_STATE, "Company settings changed while applying.");
  uow.audit({
    eventType: "company.controls_changed",
    entityType: "CompanySettings",
    entityId: String(company.id),
    actorUserId: actor.kind === "user" ? actor.userId : null,
    before: before ? { ...before, refundApprovalThresholdMinor: before.refundApprovalThresholdMinor.toString(), poApprovalThresholdMinor: before.poApprovalThresholdMinor.toString() } : null,
    after: changes
  });
  return { applied: Object.keys(changes) };
});

// features/keystone/mutations/approvals.ts
async function decideApprovalRequest(_root, args, context) {
  return decideApprovalAs(context.prisma, await actorFor(context), args);
}
async function decideApprovalAs(db, actor, args) {
  requirePermission(actor, "canAccessDashboard");
  if (args.decision !== "approve" && args.decision !== "reject") throw new DomainError(Codes.INVALID_INPUT, "Decision must be approve or reject.");
  if (args.decision === "reject" && !args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Say why you are rejecting it.", { field: "reason" });
  const result = await command(db, { name: "approval.decide", actor, idempotencyKey: args.idempotencyKey, params: { requestId: args.requestId, decision: args.decision, reason: args.reason ?? "", expectedVersion: args.expectedVersion }, now: args.now }, async (uow) => {
    const decided = await decideApproval(uow, actor, { requestId: args.requestId, decision: args.decision, reason: args.reason ?? void 0, expectedVersion: args.expectedVersion, strictAgentOwner: true });
    let applied = null;
    const registration = applierFor(String(decided.action));
    if (args.decision === "approve" && registration?.applyOnApprove) {
      const request = await uow.tx.approvalRequest.findUniqueOrThrow({ where: { id: args.requestId } });
      await consumeApproval(uow, { requestId: request.id, action: request.action, targetList: request.targetList, targetId: request.targetId, payload: request.payload });
      applied = await registration.apply(uow, actor, request);
    }
    return { id: decided.id, status: decided.status, applied };
  });
  return { replay: result.replay, ...result.value };
}
async function cancelApprovalRequest(_root, args, context) {
  const actor = await actorFor(context);
  requirePermission(actor, "canAccessDashboard");
  const result = await command(context.prisma, { name: "approval.cancel", actor, idempotencyKey: args.idempotencyKey, params: args }, async (uow) => {
    const row = await transition(uow, {
      model: "ApprovalRequest",
      id: args.requestId,
      from: ["pending"],
      to: "cancelled",
      expectedVersion: args.expectedVersion,
      actor,
      eventType: "approval.cancelled",
      reason: args.reason ?? null,
      guard: (request) => {
        if (actor.kind !== "user" || request.requestedById !== actor.userId) throw new DomainError(Codes.NOT_AUTHORIZED, "Only the person who asked can withdraw a request.");
      }
    });
    return { id: row.id, status: row.status };
  });
  return { replay: result.replay, ...result.value };
}
async function requestCompanyControls(_root, args, context) {
  const actor = await actorFor(context);
  requirePermission(actor, "canManageCompany", "canManagePolicies");
  if (!args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Say why the controls should change.", { field: "reason" });
  const result = await command(context.prisma, { name: "company.controls.request", actor, idempotencyKey: args.idempotencyKey, params: args }, async (uow) => {
    const request = await requestCompanyControlsChange(uow, actor, args.changes, args.reason.trim());
    return { id: request.id, status: request.status };
  });
  return { replay: result.replay, ...result.value };
}

// features/keystone/services/pricebook.ts
init_actor();
init_approval();
init_cas();
init_decimal();
init_errors();

// features/keystone/lib/money.ts
init_decimal();
function allocateMinor(total, weights) {
  if (weights.length === 0) throw new Error("allocateMinor needs at least one weight");
  const w = weights.map(dec);
  if (w.some((x) => x.isNegative())) throw new Error("allocateMinor weights must be non-negative");
  const weightSum = w.reduce((a, b) => a.plus(b), new Decimal(0));
  if (weightSum.isZero()) throw new Error("allocateMinor weights must not all be zero");
  const negative = total < 0n;
  const abs = negative ? -total : total;
  const exact2 = w.map((x) => dec(abs).times(x).div(weightSum));
  const floors = exact2.map((x) => BigInt(x.floor().toFixed(0)));
  let leftover = abs - floors.reduce((a, b) => a + b, 0n);
  const order = exact2.map((x, index) => ({ index, remainder: x.minus(x.floor()) })).sort((a, b) => b.remainder.comparedTo(a.remainder) || a.index - b.index);
  const shares = [...floors];
  for (let i = 0; leftover > 0n; i = (i + 1) % order.length, leftover -= 1n) shares[order[i].index] += 1n;
  return negative ? shares.map((x) => -x) : shares;
}
function extendLine(unitPriceMinor, quantity) {
  const q = dec(quantity);
  if (q.isNegative()) throw new Error("Quantity must not be negative");
  return BigInt(dec(unitPriceMinor).times(q).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0));
}
function roundMinor(value, rounding = Decimal.ROUND_HALF_UP) {
  return BigInt(dec(value).toDecimalPlaces(0, rounding).toFixed(0));
}
function ratioBps(numerator, denominator) {
  if (denominator === 0n) return null;
  return dec(numerator).times(1e4).div(dec(denominator)).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0);
}
function bpsOf(amountMinor, bps2) {
  if (!Number.isInteger(bps2) || bps2 < 0 || bps2 > 1e4) throw new Error("Basis points must be a whole number from 0 to 10000");
  return roundMinor(dec(amountMinor).times(bps2).div(1e4));
}

// features/keystone/domain/pricing.ts
init_canonical();
init_decimal();
var PricingError = class extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
};
function markupFor(table, costMinor) {
  const tier = table.tiers.find((t) => costMinor >= BigInt(t.fromCostMinor) && (t.toCostMinor === null || costMinor < BigInt(t.toCostMinor)));
  if (!tier) throw new PricingError("INVALID_INPUT", `Markup table ${table.name} has no tier for a cost of ${costMinor} cents.`);
  return dec(tier.multiplier);
}
function validateMarkupTiers(tiers) {
  if (!tiers.length) throw new PricingError("INVALID_INPUT", "A markup table needs at least one tier.");
  let expected = 0n;
  tiers.forEach((tier, index) => {
    if (BigInt(tier.fromCostMinor) !== expected) throw new PricingError("INVALID_INPUT", `Markup tier ${index + 1} must start at ${expected} cents.`);
    if (dec(tier.multiplier).lessThan(1)) throw new PricingError("INVALID_INPUT", `Markup tier ${index + 1} multiplier must be at least 1.`);
    const last = index === tiers.length - 1;
    if (last !== (tier.toCostMinor === null)) throw new PricingError("INVALID_INPUT", last ? "The last markup tier must be open-ended." : `Markup tier ${index + 1} needs an upper bound.`);
    if (!last) {
      if (BigInt(tier.toCostMinor) <= expected) throw new PricingError("INVALID_INPUT", `Markup tier ${index + 1} must end above where it starts.`);
      expected = BigInt(tier.toCostMinor);
    }
  });
}
function formulaPrice(item, ctx) {
  const rate2 = ctx.laborRates.find((r) => r.businessUnitId === item.businessUnitId) ?? ctx.laborRates.find((r) => r.businessUnitId === null);
  if (!rate2) throw new PricingError("GUARD_FAILED", `No labour rate covers ${item.itemKey}.`, { itemKey: item.itemKey });
  const hours = dec(item.laborHours ?? "0");
  const labor = extendLine(rate2.hourlyMinor, hours);
  let materials2 = 0n;
  let materialCost = 0n;
  for (const ref of item.materials) {
    const material = ctx.materials.get(ref.itemKey);
    if (!material) throw new PricingError("GUARD_FAILED", `${item.itemKey} uses ${ref.itemKey}, which is not in this version.`, { itemKey: item.itemKey, material: ref.itemKey });
    if (!ctx.markup) throw new PricingError("GUARD_FAILED", "Formula pricing with materials needs a markup table.", { itemKey: item.itemKey });
    const multiplier = markupFor(ctx.markup, material.costMinor);
    materials2 += roundMinor(dec(material.costMinor).times(dec(ref.quantity)).times(multiplier));
    materialCost += extendLine(material.costMinor, ref.quantity);
  }
  return { unitPriceMinor: labor + materials2, laborMinor: labor, materialsMinor: materials2, costMinor: materialCost, hourlyMinor: rate2.hourlyMinor };
}
function submitFindings(items, uoms) {
  const findings = [];
  const keys = /* @__PURE__ */ new Set();
  for (const item of items) {
    const add = (code, message) => findings.push({ itemKey: item.itemKey, code, message });
    if (keys.has(item.itemKey)) add("duplicate_key", "Item key is used twice.");
    keys.add(item.itemKey);
    if (!item.active) continue;
    if (item.unitPriceMinor < 0n) add("negative_price", "Price must not be negative.");
    if (item.memberUnitPriceMinor !== null && item.memberUnitPriceMinor > item.unitPriceMinor) add("member_above_list", "Member price is above the list price.");
    if (!uoms.has(item.uom)) add("unknown_uom", `Unit ${item.uom} is not set up.`);
    if (item.kind === "service_task" && !(item.laborHours && dec(item.laborHours).greaterThan(0))) add("task_hours_missing", "A service task needs labour hours.");
    if (!item.taxCategory) add("tax_category_missing", "Tax category is required.");
    if (item.kind === "equipment" && !item.warrantyText.trim()) add("warranty_missing", "Equipment needs warranty text.");
    if (item.kind !== "material" && !item.customerDescription.trim()) add("description_missing", "Customers see a description; add one.");
    if (item.tier && !item.ladderKey) add("tier_without_ladder", "A good/better/best tier needs a ladder.");
  }
  return findings;
}
function itemContent(item) {
  return {
    itemKey: item.itemKey,
    kind: item.kind,
    categoryKey: item.categoryKey,
    name: item.name,
    customerDescription: item.customerDescription,
    trade: item.trade,
    businessUnitId: item.businessUnitId,
    pricingMethod: item.pricingMethod,
    unitPriceMinor: item.unitPriceMinor,
    memberUnitPriceMinor: item.memberUnitPriceMinor,
    costMinor: item.costMinor,
    laborHours: item.laborHours,
    uom: item.uom,
    taxCategory: item.taxCategory,
    warrantyText: item.warrantyText,
    materials: item.materials,
    cancellationClassDefault: item.cancellationClassDefault,
    ladderKey: item.ladderKey,
    tier: item.tier,
    active: item.active,
    equipmentModelId: item.equipmentModelId ?? null
  };
}
function versionContentHash(content) {
  return payloadHash({
    items: [...content.items].sort((a, b) => a.itemKey.localeCompare(b.itemKey)).map(itemContent),
    categories: content.categories,
    laborRates: content.laborRates,
    markupTables: content.markupTables,
    memberPricingRules: content.memberPricingRules
  });
}
function diffItems(before, after) {
  const prev = new Map(before.filter((i) => i.active).map((i) => [i.itemKey, i]));
  const next = new Map(after.filter((i) => i.active).map((i) => [i.itemKey, i]));
  const diff = { added: [], removed: [], repriced: [], changed: [], unchanged: 0 };
  for (const [key2, item] of next) {
    const old = prev.get(key2);
    if (!old) {
      diff.added.push({ itemKey: key2, name: item.name, unitPriceMinor: item.unitPriceMinor.toString() });
      continue;
    }
    if (old.unitPriceMinor !== item.unitPriceMinor) {
      const changeBps = ratioBps(item.unitPriceMinor - old.unitPriceMinor, old.unitPriceMinor);
      diff.repriced.push({ itemKey: key2, name: item.name, fromMinor: old.unitPriceMinor.toString(), toMinor: item.unitPriceMinor.toString(), changeBps });
      continue;
    }
    const a = itemContent(old);
    const b = itemContent(item);
    const fields = Object.keys(b).filter((k) => payloadHash(a[k] ?? null) !== payloadHash(b[k] ?? null));
    if (fields.length) diff.changed.push({ itemKey: key2, name: item.name, fields });
    else diff.unchanged += 1;
  }
  for (const [key2, item] of prev) if (!next.has(key2)) diff.removed.push({ itemKey: key2, name: item.name, unitPriceMinor: item.unitPriceMinor.toString() });
  return diff;
}
function costChangeReport(items, costs) {
  const byKey = new Map(items.map((i) => [i.itemKey, i]));
  const changes = [];
  const unknown = [];
  for (const row of costs) {
    if (row.costMinor < 0n) throw new PricingError("INVALID_INPUT", `Cost for ${row.itemKey} must not be negative.`);
    const item = byKey.get(row.itemKey);
    if (!item) {
      unknown.push(row.itemKey);
      continue;
    }
    if (item.costMinor === row.costMinor) continue;
    const marginBpsAfter = ratioBps(item.unitPriceMinor - row.costMinor, item.unitPriceMinor);
    changes.push({ itemKey: row.itemKey, name: item.name, fromMinor: item.costMinor.toString(), toMinor: row.costMinor.toString(), marginBpsAfter });
  }
  return { changes, unknown };
}
function quoteLine(versionId, input, uom) {
  const quantity = dec(input.quantity);
  if (quantity.lessThanOrEqualTo(0)) throw new PricingError("INVALID_INPUT", `Quantity for ${input.item.itemKey} must be more than zero.`);
  if (quantity.decimalPlaces() > uom.maxDecimals) throw new PricingError("INVALID_INPUT", `${input.item.uom} quantities allow ${uom.maxDecimals} decimal places.`);
  if (!input.item.active) throw new PricingError("GUARD_FAILED", `${input.item.itemKey} is not sold any more.`);
  const memberPriced = input.memberPricing && input.item.memberUnitPriceMinor !== null;
  const unit = memberPriced ? input.item.memberUnitPriceMinor : input.item.unitPriceMinor;
  return {
    priceBookVersionId: versionId,
    priceBookItemId: input.item.id,
    itemKey: input.item.itemKey,
    name: input.item.name,
    description: input.description?.trim() || input.item.customerDescription || input.item.name,
    quantity: plain(quantity),
    uom: input.item.uom,
    unitPriceMinor: unit.toString(),
    listUnitPriceMinor: input.item.unitPriceMinor.toString(),
    memberPriced,
    costMinor: extendLine(input.item.costMinor, quantity).toString(),
    taxCategory: input.item.taxCategory,
    trade: input.item.trade,
    warrantyText: input.item.warrantyText,
    cancellationClass: input.cancellationClass ?? input.item.cancellationClassDefault,
    amountMinor: extendLine(unit, quantity)
  };
}
function optionTotals(lines, discountBps) {
  if (!Number.isInteger(discountBps) || discountBps < 0 || discountBps > 1e4) throw new PricingError("INVALID_INPUT", "Discount must be between 0 and 100%.");
  const subtotal = lines.reduce((s, l) => s + l.amountMinor, 0n);
  const discount = bpsOf(subtotal, discountBps);
  const lineDiscounts = discount === 0n || subtotal === 0n ? lines.map(() => 0n) : allocateMinor(discount, lines.map((l) => l.amountMinor));
  const cost = lines.reduce((s, l) => s + l.costMinor, 0n);
  const net = subtotal - discount;
  const marginBps = ratioBps(net - cost, net);
  return { subtotalMinor: subtotal, discountMinor: discount, lineDiscounts, totalBeforeTaxMinor: net, costMinor: cost, marginBps };
}
var quoteHash = (versionId, lines, discountBps = 0) => keyedPayloadHash({ versionId, discountBps, lines });
var optionHash = (option2) => keyedPayloadHash({ tier: option2.tier, name: option2.name, subtotalMinor: option2.subtotalMinor, discountMinor: option2.discountMinor, totalMinor: option2.totalMinor, lines: option2.lines.map((l) => ({ ...l })) });
function depositCap(totalMinor, rules2) {
  const caps = [];
  if (rules2.depositCapPct !== null) caps.push(roundMinor(dec(totalMinor).times(dec(rules2.depositCapPct)).div(100), Decimal.ROUND_DOWN));
  if (rules2.depositCapMinor !== null) caps.push(BigInt(rules2.depositCapMinor));
  return caps.length ? caps.reduce((a, b) => a < b ? a : b) : null;
}
function estimateSalesTax(lines, ctx) {
  const local = ctx.rules.localRates.find((r) => r.code === ctx.cityCode);
  const rate2 = dec(ctx.rules.stateRate).plus(local ? local.rate : ctx.rules.maxLocalRate);
  let base = 0n;
  const rows = lines.map((line) => {
    const row = ctx.rules.matrix.find((m) => m.propertyClass === ctx.propertyClass && (m.contractTaxMode === "any" || m.contractTaxMode === ctx.contractTaxMode) && (m.taxCategory === "any" || m.taxCategory === line.taxCategory));
    if (!row) throw new PricingError("GUARD_FAILED", `No sales-tax rule covers ${line.taxCategory} on ${ctx.propertyClass} work.`);
    const lineBase = !row.taxable || row.basis === "none" ? 0n : row.basis === "at_least_cost" && line.costMinor > line.netMinor ? line.costMinor : line.netMinor;
    base += lineBase;
    return { taxable: lineBase > 0n, baseMinor: lineBase };
  });
  return { taxMinor: roundMinor(dec(base).times(rate2)), rate: plain(rate2), localRateCode: local?.code ?? null, rows };
}

// features/keystone/services/pricebook.ts
var EDIT = ["canManagePriceBook"];
var READ = ["canManagePriceBook", "canApprovePriceBook", "canPresentEstimates", "canSellEstimates", "canBook", "canManageCustomers"];
var fail = (error) => {
  if (error instanceof PricingError) throw new DomainError(error.code === "GUARD_FAILED" ? Codes.GUARD_FAILED : Codes.INVALID_INPUT, error.message, error.details);
  throw error;
};
var minorIn2 = (value, field, allowNull = false) => {
  if ((value === null || value === void 0 || value === "") && allowNull) return null;
  if (typeof value === "bigint") {
    if (value < 0n) throw new DomainError(Codes.INVALID_INPUT, `${field} must not be negative.`, { field });
    return value;
  }
  if (typeof value !== "string" || !/^\d{1,13}$/.test(value)) throw new DomainError(Codes.INVALID_INPUT, `${field} must be whole cents as a string, e.g. "32500".`, { field });
  return BigInt(value);
};
var oneOf = (values, value, field, fallback) => {
  if ((value === void 0 || value === null || value === "") && fallback !== void 0) return fallback;
  if (!values.includes(value)) throw new DomainError(Codes.INVALID_INPUT, `${field} must be one of ${values.join(", ")}.`, { field });
  return value;
};
var decimalText2 = (value, field, max = 4) => {
  if (value === null || value === void 0 || value === "") return null;
  if (typeof value !== "string" || !/^\d{1,10}(\.\d+)?$/.test(value)) throw new DomainError(Codes.INVALID_INPUT, `${field} must be a decimal string, e.g. "1.5".`, { field });
  if (dec(value).decimalPlaces() > max) throw new DomainError(Codes.INVALID_INPUT, `${field} allows ${max} decimal places.`, { field });
  return plain(value);
};
function draftOf(row) {
  return {
    id: row.id,
    itemKey: row.itemKey,
    kind: row.kind,
    categoryKey: row.categoryKey,
    name: row.name,
    customerDescription: row.customerDescription,
    trade: row.trade,
    businessUnitId: row.businessUnitId,
    pricingMethod: row.pricingMethod,
    unitPriceMinor: row.unitPriceMinor,
    memberUnitPriceMinor: row.memberUnitPriceMinor,
    costMinor: row.costMinor,
    laborHours: row.laborHours ? plain(row.laborHours.toString()) : null,
    uom: row.uom,
    taxCategory: row.taxCategory,
    warrantyText: row.warrantyText,
    materials: row.materials ?? [],
    cancellationClassDefault: row.cancellationClassDefault,
    ladderKey: row.ladderKey,
    tier: row.tier,
    active: row.active,
    equipmentModelId: row.equipmentModelId
  };
}
async function loadVersionContent(db, versionId) {
  const [items, categories, laborRates, markupTables, memberPricingRules] = await Promise.all([
    db.priceBookItem.findMany({ where: { priceBookVersionId: versionId }, orderBy: [{ categoryKey: "asc" }, { sortOrder: "asc" }, { itemKey: "asc" }] }),
    db.priceBookCategory.findMany({ where: { priceBookVersionId: versionId }, orderBy: [{ sortOrder: "asc" }, { categoryKey: "asc" }] }),
    db.laborRate.findMany({ where: { priceBookVersionId: versionId } }),
    db.markupTable.findMany({ where: { priceBookVersionId: versionId }, orderBy: { name: "asc" } }),
    db.memberPricingRule.findMany({ where: { priceBookVersionId: versionId } })
  ]);
  return {
    items: items.map(draftOf),
    rows: items,
    categories: categories.map((c) => ({ categoryKey: c.categoryKey, name: c.name, trade: c.trade, parentKey: c.parentKey, sortOrder: c.sortOrder })),
    laborRates: laborRates.map((r) => ({ businessUnitId: r.businessUnitId, hourlyMinor: r.hourlyMinor, afterHoursMultiplier: r.afterHoursMultiplier ? plain(r.afterHoursMultiplier.toString()) : null })).sort((a, b) => (a.businessUnitId ?? "").localeCompare(b.businessUnitId ?? "")),
    markupTables: markupTables.map((t) => ({ name: t.name, appliesTo: t.appliesTo, tiers: t.tiers ?? [] })),
    memberPricingRules: memberPricingRules.map((r) => ({ planCode: r.planCode, scope: r.scope, scopeKey: r.scopeKey, discountBps: r.discountBps, waiveTripFee: r.waiveTripFee })).sort((a, b) => `${a.planCode}:${a.scope}:${a.scopeKey}`.localeCompare(`${b.planCode}:${b.scope}:${b.scopeKey}`))
  };
}
var hashOf = (content) => versionContentHash({ items: content.items, categories: content.categories, laborRates: content.laborRates, markupTables: content.markupTables, memberPricingRules: content.memberPricingRules });
async function lockVersion(tx, versionId) {
  const [row] = await tx.$queryRaw`SELECT id, status, version, "priceBook", "versionNumber" FROM "PriceBookVersion" WHERE id = ${versionId} FOR UPDATE`;
  if (!row) throw new DomainError(Codes.NOT_FOUND, "Price book version not found.");
  return row;
}
async function lockDraft(tx, versionId, expectedVersion) {
  const row = await lockVersion(tx, versionId);
  if (expectedVersion !== void 0 && expectedVersion !== null && row.version !== expectedVersion) throw new DomainError(Codes.STALE_STATE, "This price book version changed since you loaded it. Reload and try again.", { currentStatus: row.status, currentVersion: row.version });
  if (row.status !== "draft") throw new DomainError(Codes.INVALID_TRANSITION, `This version is ${row.status.replaceAll("_", " ")}; only a draft can be edited. Start a new draft.`, { currentStatus: row.status });
  return row;
}
var touchDraft = (tx, versionId) => tx.priceBookVersion.update({ where: { id: versionId }, data: { version: { increment: 1 } }, select: { version: true } });
async function priceBookFor(db, businessUnitId) {
  const books = await db.priceBook.findMany({ select: { id: true, code: true, activeVersionId: true, businessUnits: { select: { id: true } } }, orderBy: { code: "asc" } });
  const specific = businessUnitId ? books.find((b) => b.businessUnits.some((bu) => bu.id === businessUnitId)) : void 0;
  const book = specific ?? books.find((b) => b.businessUnits.length === 0) ?? (books.length === 1 ? books[0] : void 0);
  if (!book) throw new DomainError(Codes.GUARD_FAILED, "No price book covers this department yet.", { reason: "no_price_book" });
  return book;
}
async function activeVersionFor(db, businessUnitId) {
  const book = await priceBookFor(db, businessUnitId);
  if (!book.activeVersionId) throw new DomainError(Codes.GUARD_FAILED, `Price book ${book.code} has no active version yet.`, { reason: "no_active_version" });
  return { priceBookId: book.id, versionId: book.activeVersionId };
}
async function createPriceBook(db, actor, args) {
  await authorizeOperation(db, actor, "pricebook.create", EDIT, args);
  const name = args.name?.trim();
  if (!name) throw new DomainError(Codes.INVALID_INPUT, "Name the price book.", { field: "name" });
  if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(args.code ?? "")) throw new DomainError(Codes.INVALID_INPUT, "Code is 2-24 capital letters, digits or dashes.", { field: "code" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "pricebook.create", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const company = await uow.tx.companySettings.findFirst({ select: { currencyCode: true } });
    const book = await uow.tx.priceBook.create({ data: { name, code: args.code, currencyCode: company?.currencyCode || "USD", businessUnits: { connect: (args.businessUnitIds ?? []).map((id) => ({ id })) } }, select: { id: true } });
    auditCreate(uow, actor, "PriceBook", book.id, "pricebook.created", { name, code: args.code, businessUnitIds: args.businessUnitIds ?? [] });
    const draft = await createDraftInTx(uow, actor, book.id, { label: "Initial", source: "manual" });
    return { priceBookId: book.id, draftVersionId: draft.id };
  });
  return { replay: result.replay, ...result.value };
}
async function createDraftInTx(uow, actor, priceBookId, opts) {
  const { tx } = uow;
  await tx.$queryRaw`SELECT id FROM "PriceBook" WHERE id = ${priceBookId} FOR UPDATE`;
  const open = await tx.priceBookVersion.findFirst({ where: { priceBookId, status: { in: ["draft", "pending_approval"] } }, select: { id: true, versionNumber: true, status: true } });
  if (open) throw new DomainError(Codes.GUARD_FAILED, `Version ${open.versionNumber} is already ${open.status === "draft" ? "a draft" : "waiting for approval"}; finish or discard it first.`, { reason: "open_draft", versionId: open.id });
  const book = await tx.priceBook.findUniqueOrThrow({ where: { id: priceBookId }, select: { activeVersionId: true } });
  const last = await tx.priceBookVersion.findFirst({ where: { priceBookId }, orderBy: { versionNumber: "desc" }, select: { versionNumber: true } });
  const base = book.activeVersionId ?? (await tx.priceBookVersion.findFirst({ where: { priceBookId, status: { in: ["published", "active", "retired"] } }, orderBy: { versionNumber: "desc" }, select: { id: true } }))?.id ?? null;
  const versionNumber = (last?.versionNumber ?? 0) + 1;
  const draft = await tx.priceBookVersion.create({
    data: { priceBookId, versionNumber, label: opts.label?.trim() || `Version ${versionNumber}`, status: "draft", source: base ? opts.source === "manual" ? "copy" : opts.source : "manual", basedOnId: base, notes: opts.notes ?? "" },
    select: { id: true, versionNumber: true }
  });
  if (base) {
    const content = await loadVersionContent(tx, base);
    const rates = await tx.laborRate.findMany({ where: { priceBookVersionId: base } });
    const tables = await tx.markupTable.findMany({ where: { priceBookVersionId: base } });
    if (content.categories.length) await tx.priceBookCategory.createMany({ data: content.categories.map((c) => ({ ...c, priceBookVersionId: draft.id })) });
    if (content.rows.length) await tx.priceBookItem.createMany({ data: content.rows.map(({ id: _id, createdAt: _c, updatedAt: _u, priceBookVersionId: _v, ...row }) => ({ ...row, materials: row.materials ?? void 0, priceBookVersionId: draft.id })) });
    if (rates.length) await tx.laborRate.createMany({ data: rates.map((r) => ({ priceBookVersionId: draft.id, businessUnitId: r.businessUnitId, hourlyMinor: r.hourlyMinor, afterHoursMultiplier: r.afterHoursMultiplier })) });
    if (tables.length) await tx.markupTable.createMany({ data: tables.map((t) => ({ priceBookVersionId: draft.id, name: t.name, appliesTo: t.appliesTo, tiers: t.tiers ?? void 0 })) });
    if (content.memberPricingRules.length) await tx.memberPricingRule.createMany({ data: content.memberPricingRules.map((r) => ({ ...r, priceBookVersionId: draft.id })) });
  }
  auditCreate(uow, actor, "PriceBookVersion", draft.id, "pricebook_version.drafted", { priceBookId, versionNumber, basedOn: base, source: opts.source });
  return draft;
}
async function startPriceBookDraft(db, actor, args) {
  await authorizeOperation(db, actor, "pricebook.draft", EDIT, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "pricebook.draft", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const draft = await createDraftInTx(uow, actor, args.priceBookId, { label: args.label, source: "copy" });
    return { versionId: draft.id, versionNumber: draft.versionNumber };
  });
  return { replay: result.replay, ...result.value };
}
function itemData(input) {
  const itemKey = String(input.itemKey ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,47}$/.test(itemKey)) throw new DomainError(Codes.INVALID_INPUT, "Item key is 2-48 capital letters, digits or dashes.", { field: "itemKey" });
  const name = input.name?.trim();
  if (!name) throw new DomainError(Codes.INVALID_INPUT, "Name the item.", { field: "name" });
  const pricingMethod = oneOf(["fixed", "formula"], input.pricingMethod, "pricingMethod", "fixed");
  const materials2 = (input.materials ?? []).map((m, i) => {
    const key2 = String(m?.itemKey ?? "").trim().toUpperCase();
    if (!key2) throw new DomainError(Codes.INVALID_INPUT, `Material ${i + 1} needs an item key.`, { field: "materials" });
    const quantity = decimalText2(m.quantity, `materials[${i}].quantity`);
    if (!quantity || dec(quantity).lessThanOrEqualTo(0)) throw new DomainError(Codes.INVALID_INPUT, `Material ${key2} needs a quantity above zero.`, { field: "materials" });
    return { itemKey: key2, quantity };
  });
  const unitPriceMinor = pricingMethod === "formula" ? minorIn2(input.unitPriceMinor ?? "0", "unitPriceMinor") : minorIn2(input.unitPriceMinor, "unitPriceMinor");
  const tier = oneOf(["", "good", "better", "best"], input.tier ?? "", "tier", "");
  return {
    itemKey,
    name,
    pricingMethod,
    unitPriceMinor,
    tier,
    materials: materials2,
    kind: oneOf(ITEM_KINDS, input.kind, "kind"),
    categoryKey: input.categoryKey?.trim() ?? "",
    customerDescription: input.customerDescription?.trim() ?? "",
    internalNotes: input.internalNotes?.trim() ?? "",
    trade: oneOf(TRADE_OR_GENERAL, input.trade, "trade", "general"),
    businessUnitId: input.businessUnitId || null,
    memberUnitPriceMinor: minorIn2(input.memberUnitPriceMinor, "memberUnitPriceMinor", true),
    costMinor: minorIn2(input.costMinor ?? "0", "costMinor"),
    laborHours: decimalText2(input.laborHours, "laborHours"),
    uom: String(input.uom ?? "").trim(),
    taxCategory: oneOf(TAX_CATEGORIES, input.taxCategory, "taxCategory"),
    warrantyText: input.warrantyText?.trim() ?? "",
    equipmentModelId: input.equipmentModelId || null,
    commissionCode: input.commissionCode?.trim() ?? "",
    spiffCode: input.spiffCode?.trim() ?? "",
    cancellationClassDefault: oneOf(CANCELLATION_CLASSES, input.cancellationClassDefault, "cancellationClassDefault", "requested_repair"),
    ladderKey: input.ladderKey?.trim() ?? "",
    sortOrder: Number.isSafeInteger(input.sortOrder) ? input.sortOrder : 0,
    active: input.active ?? true
  };
}
async function saveDraftItems(db, actor, args) {
  await authorizeOperation(db, actor, "pricebook.edit", EDIT, args);
  if (!Array.isArray(args.items) || !args.items.length || args.items.length > 500) throw new DomainError(Codes.INVALID_INPUT, "Send between 1 and 500 items.", { field: "items" });
  const rows = args.items.map(itemData);
  const keys = /* @__PURE__ */ new Set();
  for (const r of rows) {
    if (keys.has(r.itemKey)) throw new DomainError(Codes.INVALID_INPUT, `${r.itemKey} appears twice.`, { field: "items" });
    keys.add(r.itemKey);
  }
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "pricebook.edit", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    await lockDraft(uow.tx, args.versionId, args.expectedVersion);
    const uoms = new Set((await uow.tx.unitOfMeasure.findMany({ select: { code: true } })).map((u) => u.code));
    for (const r of rows) if (!uoms.has(r.uom)) throw new DomainError(Codes.INVALID_INPUT, `Unit ${r.uom || "(blank)"} is not set up.`, { field: "uom", itemKey: r.itemKey });
    const existing = new Map((await uow.tx.priceBookItem.findMany({ where: { priceBookVersionId: args.versionId, itemKey: { in: [...keys] } }, select: { id: true, itemKey: true } })).map((r) => [r.itemKey, r.id]));
    const fresh = [];
    for (const { materials: materials2, ...r } of rows) {
      const data = { ...r, materials: materials2, laborHours: r.laborHours };
      const id = existing.get(r.itemKey);
      if (id) await uow.tx.priceBookItem.update({ where: { id }, data });
      else fresh.push({ ...data, priceBookVersionId: args.versionId });
    }
    if (fresh.length) await uow.tx.priceBookItem.createMany({ data: fresh });
    const { version } = await touchDraft(uow.tx, args.versionId);
    auditCreate(uow, actor, "PriceBookVersion", args.versionId, "pricebook_version.items_saved", { added: rows.filter((r) => !existing.has(r.itemKey)).map((r) => r.itemKey), changed: rows.filter((r) => existing.has(r.itemKey)).map((r) => r.itemKey) });
    return { versionId: args.versionId, version, saved: rows.length };
  });
  return { replay: result.replay, ...result.value };
}
async function removeDraftItems(db, actor, args) {
  await authorizeOperation(db, actor, "pricebook.edit", EDIT, args);
  if (!args.itemKeys?.length) throw new DomainError(Codes.INVALID_INPUT, "Choose items to remove.", { field: "itemKeys" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "pricebook.remove_items", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    await lockDraft(uow.tx, args.versionId, args.expectedVersion);
    const { count } = await uow.tx.priceBookItem.deleteMany({ where: { priceBookVersionId: args.versionId, itemKey: { in: args.itemKeys } } });
    const { version } = await touchDraft(uow.tx, args.versionId);
    auditCreate(uow, actor, "PriceBookVersion", args.versionId, "pricebook_version.items_removed", { itemKeys: args.itemKeys, removed: count });
    return { versionId: args.versionId, version, removed: count };
  });
  return { replay: result.replay, ...result.value };
}
async function saveDraftSettings(db, actor, args) {
  await authorizeOperation(db, actor, "pricebook.edit", EDIT, args);
  const categories = args.categories?.map((c, i) => {
    if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(c.categoryKey ?? "")) throw new DomainError(Codes.INVALID_INPUT, `Category ${i + 1}: key is lower-case letters, digits and dashes.`, { field: "categories" });
    if (!c.name?.trim()) throw new DomainError(Codes.INVALID_INPUT, `Category ${c.categoryKey} needs a name.`, { field: "categories" });
    return { categoryKey: c.categoryKey, name: c.name.trim(), trade: oneOf(TRADE_OR_GENERAL, c.trade, "trade", "general"), parentKey: c.parentKey ?? "", sortOrder: c.sortOrder ?? i };
  });
  const laborRates = args.laborRates?.map((r) => {
    const hourly = minorIn2(r.hourlyMinor, "hourlyMinor");
    if (hourly <= 0n) throw new DomainError(Codes.INVALID_INPUT, "An hourly rate must be above zero.", { field: "laborRates" });
    const multiplier = decimalText2(r.afterHoursMultiplier, "afterHoursMultiplier", 6);
    if (multiplier && dec(multiplier).lessThan(1)) throw new DomainError(Codes.INVALID_INPUT, "The after-hours multiplier is at least 1.", { field: "laborRates" });
    return { businessUnitId: r.businessUnitId || null, hourlyMinor: hourly, afterHoursMultiplier: multiplier ? toScale(multiplier, "rate") : null };
  });
  if (laborRates && new Set(laborRates.map((r) => r.businessUnitId ?? "")).size !== laborRates.length) throw new DomainError(Codes.INVALID_INPUT, "One labour rate per department (and one default).", { field: "laborRates" });
  const markupTables = args.markupTables?.map((t) => {
    if (!t.name?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Name the markup table.", { field: "markupTables" });
    try {
      validateMarkupTiers(t.tiers ?? []);
    } catch (error) {
      fail(error);
    }
    return { name: t.name.trim(), appliesTo: oneOf(["material", "equipment"], t.appliesTo, "appliesTo", "material"), tiers: t.tiers.map((x) => ({ fromCostMinor: String(x.fromCostMinor), toCostMinor: x.toCostMinor === null ? null : String(x.toCostMinor), multiplier: plain(x.multiplier) })) };
  });
  if (markupTables && new Set(markupTables.map((t) => t.appliesTo)).size !== markupTables.length) throw new DomainError(Codes.INVALID_INPUT, "One markup table for materials and one for equipment.", { field: "markupTables" });
  const memberPricingRules = args.memberPricingRules?.map((r) => {
    if (!r.planCode?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Member pricing needs a plan code.", { field: "memberPricingRules" });
    if (!Number.isInteger(r.discountBps) || r.discountBps < 0 || r.discountBps > 1e4) throw new DomainError(Codes.INVALID_INPUT, "Member discount is 0 to 10000 basis points.", { field: "memberPricingRules" });
    return { planCode: r.planCode.trim(), scope: oneOf(["all", "category", "item"], r.scope, "scope", "all"), scopeKey: r.scopeKey ?? "", discountBps: r.discountBps, waiveTripFee: !!r.waiveTripFee };
  });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "pricebook.settings", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const versionId = args.versionId;
    await lockDraft(tx, versionId, args.expectedVersion);
    if (categories) {
      await tx.priceBookCategory.deleteMany({ where: { priceBookVersionId: versionId } });
      if (categories.length) await tx.priceBookCategory.createMany({ data: categories.map((c) => ({ ...c, priceBookVersionId: versionId })) });
    }
    if (laborRates) {
      await tx.laborRate.deleteMany({ where: { priceBookVersionId: versionId } });
      if (laborRates.length) await tx.laborRate.createMany({ data: laborRates.map((r) => ({ ...r, priceBookVersionId: versionId })) });
    }
    if (markupTables) {
      await tx.markupTable.deleteMany({ where: { priceBookVersionId: versionId } });
      if (markupTables.length) await tx.markupTable.createMany({ data: markupTables.map((t) => ({ ...t, tiers: t.tiers, priceBookVersionId: versionId })) });
    }
    if (memberPricingRules) {
      await tx.memberPricingRule.deleteMany({ where: { priceBookVersionId: versionId } });
      if (memberPricingRules.length) await tx.memberPricingRule.createMany({ data: memberPricingRules.map((r) => ({ ...r, priceBookVersionId: versionId })) });
    }
    const { version } = await touchDraft(tx, versionId);
    auditCreate(uow, actor, "PriceBookVersion", versionId, "pricebook_version.settings_saved", { categories: categories?.length ?? null, laborRates: laborRates ?? null, markupTables: markupTables ?? null, memberPricingRules: memberPricingRules ?? null });
    return { versionId, version };
  });
  return { replay: result.replay, ...result.value };
}
function memberPriceFor(item, unit, rules2) {
  for (const scope of ["item", "category", "all"]) {
    const matching = rules2.filter((r) => r.scope === scope && (scope === "all" || r.scopeKey === (scope === "item" ? item.itemKey : item.categoryKey)));
    if (matching.length) return unit - bpsOf(unit, Math.min(...matching.map((r) => r.discountBps)));
  }
  return item.memberUnitPriceMinor;
}
function recomputeFormulaPrices(content) {
  const materials2 = new Map(content.items.map((i) => [i.itemKey, i]));
  const markup = content.markupTables.find((t) => t.appliesTo === "material") ?? null;
  const changed = [];
  for (const item of content.items) {
    if (item.pricingMethod !== "formula" || !item.active) continue;
    let price;
    try {
      price = formulaPrice(item, { laborRates: content.laborRates, markup, materials: materials2 });
    } catch (error) {
      return fail(error);
    }
    const member = memberPriceFor(item, price.unitPriceMinor, content.memberPricingRules);
    if (price.unitPriceMinor !== item.unitPriceMinor || price.costMinor !== item.costMinor || member !== item.memberUnitPriceMinor) {
      changed.push({ id: item.id, itemKey: item.itemKey, unitPriceMinor: price.unitPriceMinor, memberUnitPriceMinor: member, costMinor: price.costMinor });
    }
  }
  return changed;
}
async function submitPriceBookVersion(db, actor, args) {
  await authorizeOperation(db, actor, "pricebook.submit", EDIT, args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "Agents do not submit price books.");
  const effectiveAt = args.effectiveAt ? new Date(args.effectiveAt) : null;
  if (effectiveAt && Number.isNaN(effectiveAt.getTime())) throw new DomainError(Codes.INVALID_INPUT, "effectiveAt must be an ISO date-time.", { field: "effectiveAt" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "pricebook.submit", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const version = await lockDraft(tx, args.versionId, args.expectedVersion);
    let content = await loadVersionContent(tx, args.versionId);
    if (!content.items.some((i) => i.active)) throw new DomainError(Codes.GUARD_FAILED, "A price book version needs at least one item.", { reason: "empty" });
    const frozen = recomputeFormulaPrices(content);
    for (const row of frozen) await tx.priceBookItem.update({ where: { id: row.id }, data: { unitPriceMinor: row.unitPriceMinor, memberUnitPriceMinor: row.memberUnitPriceMinor, costMinor: row.costMinor } });
    if (frozen.length) content = await loadVersionContent(tx, args.versionId);
    const uoms = new Map((await tx.unitOfMeasure.findMany({ select: { code: true, maxDecimals: true } })).map((u) => [u.code, { maxDecimals: u.maxDecimals }]));
    const findings = submitFindings(content.items, uoms);
    if (findings.length) throw new DomainError(Codes.GUARD_FAILED, `${findings.length} item${findings.length === 1 ? "" : "s"} need attention before this version can be submitted.`, { reason: "findings", findings });
    const book = await tx.priceBook.findUniqueOrThrow({ where: { id: version.priceBook }, select: { activeVersionId: true, code: true } });
    const before = book.activeVersionId ? (await loadVersionContent(tx, book.activeVersionId)).items : [];
    const diff = diffItems(before, content.items);
    if (before.length && !diff.added.length && !diff.removed.length && !diff.repriced.length && !diff.changed.length) {
      throw new DomainError(Codes.GUARD_FAILED, "This version has no changes from the active price book. Change a price or an item first, or discard the draft.", { reason: "no_changes" });
    }
    const contentHash = hashOf(content);
    const approval = await requestApproval(uow, actor, {
      action: "pricebook.publish",
      targetList: "PriceBookVersion",
      targetId: args.versionId,
      payload: { versionId: args.versionId, contentHash, effectiveAt: effectiveAt?.toISOString() ?? null },
      requiredPermission: "canApprovePriceBook",
      summary: `Publish ${book.code} v${version.versionNumber}: ${diff.added.length} added, ${diff.repriced.length} repriced, ${diff.removed.length} removed${args.note ? ` (${args.note})` : ""}`
    });
    const next = await casUpdate(uow, {
      model: "PriceBookVersion",
      id: args.versionId,
      version: version.version,
      from: ["draft"],
      to: "pending_approval",
      actor,
      eventType: "pricebook_version.submitted",
      reason: args.note ?? null,
      data: { contentHash, diffReport: diff, approvalId: approval.id, submittedById: actorUserId(actor), submittedAt: uow.now, effectiveAt },
      audit: { contentHash, approvalId: approval.id, frozenFormulaPrices: frozen.map((f) => f.itemKey), diff: { added: diff.added.length, removed: diff.removed.length, repriced: diff.repriced.length, changed: diff.changed.length } }
    });
    return { versionId: args.versionId, status: "pending_approval", version: next, approvalRequestId: approval.id, contentHash, diff };
  });
  return { replay: result.replay, ...result.value };
}
async function applyPriceBookPublish(uow, actor, request) {
  const { tx } = uow;
  const version = await lockVersion(tx, request.targetId);
  if (version.status !== "pending_approval") throw new DomainError(Codes.INVALID_TRANSITION, `This version is ${version.status}; only a version waiting for approval can be published.`, { currentStatus: version.status });
  const content = await loadVersionContent(tx, request.targetId);
  if (hashOf(content) !== request.payload.contentHash) throw new DomainError(Codes.APPROVAL_MISMATCH, "The version changed after it was submitted; submit it again.");
  const requested = request.payload.effectiveAt ? new Date(request.payload.effectiveAt) : uow.now;
  const effectiveAt = requested.getTime() < uow.now.getTime() ? uow.now : requested;
  const approverId = actorUserId(actor);
  const v = await casUpdate(uow, {
    model: "PriceBookVersion",
    id: request.targetId,
    version: version.version,
    from: ["pending_approval"],
    to: "published",
    actor,
    eventType: "pricebook_version.published",
    approverId,
    data: { publishedById: approverId, publishedAt: uow.now, effectiveAt },
    metadata: { approvalRequestId: request.id }
  });
  const activated = effectiveAt.getTime() <= uow.now.getTime() ? await activateInTx(uow, actor, request.targetId, version.priceBook, v) : null;
  return { versionId: request.targetId, status: activated ? "active" : "published", effectiveAt: effectiveAt.toISOString() };
}
async function activateInTx(uow, actor, versionId, priceBookId, versionRow) {
  const { tx } = uow;
  await tx.$queryRaw`SELECT id FROM "PriceBook" WHERE id = ${priceBookId} FOR UPDATE`;
  const prior = await tx.priceBookVersion.findFirst({ where: { priceBookId, status: "active" }, select: { id: true, version: true } });
  if (prior) await casUpdate(uow, { model: "PriceBookVersion", id: prior.id, version: prior.version, from: ["active"], to: "retired", actor, eventType: "pricebook_version.retired", data: { retiredAt: uow.now }, metadata: { supersededBy: versionId } });
  await casUpdate(uow, { model: "PriceBookVersion", id: versionId, version: versionRow, from: ["published"], to: "active", actor, eventType: "pricebook_version.activated", data: { activatedAt: uow.now }, metadata: { retired: prior?.id ?? null } });
  await tx.priceBook.update({ where: { id: priceBookId }, data: { activeVersionId: versionId, version: { increment: 1 } } });
  return true;
}
async function activateDuePriceBookVersions(db, now = /* @__PURE__ */ new Date()) {
  const due = await db.priceBookVersion.findMany({ where: { status: "published", effectiveAt: { lte: now } }, select: { id: true }, orderBy: { effectiveAt: "asc" }, take: 50 });
  let activated = 0;
  for (const { id } of due) {
    const actor = { kind: "system", name: "pricebook-activation" };
    const r = await command(db, { name: "pricebook.activate", actor, idempotencyKey: `pricebook-activate:${id}`, params: { versionId: id }, now }, async (uow) => {
      const row = await lockVersion(uow.tx, id);
      if (row.status !== "published") return false;
      const newer = await uow.tx.priceBookVersion.findFirst({ where: { priceBookId: row.priceBook, status: "published", effectiveAt: { lte: now }, versionNumber: { gt: row.versionNumber } }, select: { id: true } });
      if (newer) {
        await casUpdate(uow, { model: "PriceBookVersion", id, version: row.version, from: ["published"], to: "retired", actor, eventType: "pricebook_version.retired", data: { retiredAt: uow.now }, metadata: { supersededBy: newer.id, neverActive: true } });
        return false;
      }
      return activateInTx(uow, actor, id, row.priceBook, row.version);
    });
    if (r.value) activated += 1;
  }
  return { activated };
}
async function reopenPriceBookDraft(db, actor, args) {
  await authorizeOperation(db, actor, "pricebook.reopen", EDIT, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "pricebook.reopen", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const row = await transition(uow, {
      model: "PriceBookVersion",
      id: args.versionId,
      from: ["pending_approval"],
      to: "draft",
      expectedVersion: args.expectedVersion,
      actor,
      eventType: "pricebook_version.reopened",
      reason: args.reason ?? null,
      data: { approvalId: null, contentHash: "", submittedAt: null, submittedById: null },
      guard: async (v) => {
        const approval = v.approvalId ? await uow.tx.approvalRequest.findUnique({ where: { id: v.approvalId }, select: { status: true } }) : null;
        if (approval?.status === "approved") throw new DomainError(Codes.GUARD_FAILED, "This version was approved; it is being published.");
      }
    });
    const pending = await uow.tx.approvalRequest.findFirst({ where: { action: "pricebook.publish", targetId: args.versionId, status: "pending" }, select: { id: true, version: true } });
    if (pending) await casUpdate(uow, { model: "ApprovalRequest", id: pending.id, version: pending.version, from: ["pending"], to: "cancelled", actor, eventType: "approval.cancelled", reason: "Price book version reopened for editing" });
    return { versionId: row.id, status: "draft", version: row.version };
  });
  return { replay: result.replay, ...result.value };
}
async function discardPriceBookVersion(db, actor, args) {
  await authorizeOperation(db, actor, "pricebook.discard", EDIT, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "pricebook.discard", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const row = await transition(uow, { model: "PriceBookVersion", id: args.versionId, from: ["draft"], to: "discarded", expectedVersion: args.expectedVersion, actor, eventType: "pricebook_version.discarded", reason: args.reason ?? null });
    return { versionId: row.id, status: "discarded", version: row.version };
  });
  return { replay: result.replay, ...result.value };
}
async function importSupplierCosts(db, actor, args) {
  await authorizeOperation(db, actor, "pricebook.import_costs", EDIT, args);
  if (!args.supplier?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Name the supplier.", { field: "supplier" });
  if (!Array.isArray(args.costs) || !args.costs.length || args.costs.length > 5e3) throw new DomainError(Codes.INVALID_INPUT, "Send between 1 and 5000 cost rows.", { field: "costs" });
  const costs = args.costs.map((c) => ({ itemKey: String(c.itemKey ?? "").trim().toUpperCase(), costMinor: minorIn2(c.costMinor, `costs.${c.itemKey}`) }));
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "pricebook.import_costs", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    await tx.$queryRaw`SELECT id FROM "PriceBook" WHERE id = ${args.priceBookId} FOR UPDATE`;
    const open = await tx.priceBookVersion.findFirst({ where: { priceBookId: args.priceBookId, status: { in: ["draft", "pending_approval"] } }, select: { id: true, status: true, versionNumber: true } });
    if (open?.status === "pending_approval") throw new DomainError(Codes.GUARD_FAILED, `Version ${open.versionNumber} is waiting for approval; reopen it or wait before importing costs.`, { reason: "pending_approval" });
    const draft = open ?? await createDraftInTx(uow, actor, args.priceBookId, { label: `${args.supplier.trim()} costs`, source: "supplier_import", notes: `Supplier cost import from ${args.supplier.trim()}` });
    let content = await loadVersionContent(tx, draft.id);
    let report;
    try {
      report = costChangeReport(content.items, costs);
    } catch (error) {
      return fail(error);
    }
    const byKey = new Map(content.rows.map((r) => [r.itemKey, r.id]));
    for (const change of report.changes) await tx.priceBookItem.update({ where: { id: byKey.get(change.itemKey) }, data: { costMinor: BigInt(change.toMinor) } });
    content = await loadVersionContent(tx, draft.id);
    const repriced = recomputeFormulaPrices(content);
    for (const row of repriced) await tx.priceBookItem.update({ where: { id: row.id }, data: { unitPriceMinor: row.unitPriceMinor, memberUnitPriceMinor: row.memberUnitPriceMinor, costMinor: row.costMinor } });
    const stored = { supplier: args.supplier.trim(), importedAt: uow.now.toISOString(), changes: report.changes, unknown: report.unknown, formulaRepriced: repriced.map((r) => ({ itemKey: r.itemKey, unitPriceMinor: r.unitPriceMinor.toString() })) };
    const updated = await tx.priceBookVersion.update({ where: { id: draft.id }, data: { costChangeReport: stored, version: { increment: 1 } }, select: { version: true } });
    auditCreate(uow, actor, "PriceBookVersion", draft.id, "pricebook_version.costs_imported", { supplier: stored.supplier, changed: report.changes.length, unknown: report.unknown.length, formulaRepriced: repriced.length });
    return { versionId: draft.id, version: updated.version, ...stored };
  });
  return { replay: result.replay, ...result.value };
}
async function searchPriceBook(db, actor, args) {
  await authorizeOperation(db, actor, "pricebook.search", [...READ], args);
  const { versionId } = await activeVersionFor(db, args.businessUnitId ?? null);
  const q = args.query?.trim() ?? "";
  const rows = await db.priceBookItem.findMany({
    where: {
      priceBookVersionId: versionId,
      active: true,
      ...args.kind ? { kind: args.kind } : {},
      ...q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { itemKey: { contains: q.toUpperCase() } }, { customerDescription: { contains: q, mode: "insensitive" } }] } : {}
    },
    orderBy: [{ ladderKey: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    take: Math.min(Math.max(args.limit ?? 20, 1), 100)
  });
  const items = rows.map((r) => ({
    itemKey: r.itemKey,
    name: r.name,
    description: r.customerDescription,
    kind: r.kind,
    trade: r.trade,
    uom: r.uom,
    unitPriceMinor: r.unitPriceMinor.toString(),
    memberUnitPriceMinor: r.memberUnitPriceMinor?.toString() ?? null,
    ladderKey: r.ladderKey,
    tier: r.tier,
    warrantyText: r.warrantyText
  }));
  const output = { priceBookVersionId: versionId, items };
  await recordAgentRead(db, actor, { tool: "pricebook.search", inputs: args, output: { priceBookVersionId: versionId, count: items.length } });
  return output;
}
async function quoteFromVersion(db, versionId, lines, memberPricing) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 200) throw new DomainError(Codes.INVALID_INPUT, "Quote between 1 and 200 lines.", { field: "lines" });
  const keys = [...new Set(lines.map((l) => String(l.itemKey ?? "").trim().toUpperCase()))];
  const [rows, uoms] = await Promise.all([
    db.priceBookItem.findMany({ where: { priceBookVersionId: versionId, itemKey: { in: keys } } }),
    db.unitOfMeasure.findMany({ select: { code: true, maxDecimals: true } })
  ]);
  const byKey = new Map(rows.map((r) => [r.itemKey, draftOf(r)]));
  const uomOf = new Map(uoms.map((u) => [u.code, { maxDecimals: u.maxDecimals }]));
  return lines.map((line) => {
    const item = byKey.get(String(line.itemKey ?? "").trim().toUpperCase());
    if (!item) throw new DomainError(Codes.NOT_FOUND, `${line.itemKey} is not in the active price book.`, { field: "itemKey", itemKey: line.itemKey });
    const cancellationClass = line.cancellationClass ? oneOf(CANCELLATION_CLASSES, line.cancellationClass, "cancellationClass") : void 0;
    try {
      return quoteLine(versionId, { item, quantity: String(line.quantity ?? ""), memberPricing, cancellationClass, description: line.description ?? void 0 }, uomOf.get(item.uom) ?? { maxDecimals: 0 });
    } catch (error) {
      return fail(error);
    }
  });
}
async function quotePriceBook(db, actor, args) {
  await authorizeOperation(db, actor, "pricebook.quote", [...READ], args);
  const { versionId } = await activeVersionFor(db, args.businessUnitId ?? null);
  const lines = await quoteFromVersion(db, versionId, args.lines, !!args.memberPricing);
  let totals;
  try {
    totals = optionTotals(lines.map((l) => ({ amountMinor: l.amountMinor, costMinor: BigInt(l.costMinor) })), args.discountBps ?? 0);
  } catch (error) {
    return fail(error);
  }
  const snapshots = lines.map(({ amountMinor: _a, ...s }) => s);
  const output = {
    priceBookVersionId: versionId,
    // Internal cost and margin never leave the shop: a quote is what the customer may hear.
    lines: lines.map(({ costMinor: _c, ...l }) => ({ ...l, amountMinor: l.amountMinor.toString() })),
    subtotalMinor: totals.subtotalMinor.toString(),
    discountMinor: totals.discountMinor.toString(),
    totalBeforeTaxMinor: totals.totalBeforeTaxMinor.toString(),
    taxNote: "Plus applicable sales tax, calculated on the invoice.",
    quoteHash: quoteHash(versionId, snapshots, args.discountBps ?? 0)
  };
  await recordAgentRead(db, actor, { tool: "pricebook.quote", inputs: args, output: { priceBookVersionId: versionId, quoteHash: output.quoteHash, totalBeforeTaxMinor: output.totalBeforeTaxMinor } });
  return output;
}
async function priceBookVersionReview(db, actor, args) {
  await authorizeOperation(db, actor, "pricebook.review", ["canManagePriceBook", "canApprovePriceBook"], args);
  const version = await db.priceBookVersion.findUnique({ where: { id: args.versionId }, select: { id: true, status: true, priceBookId: true, versionNumber: true, diffReport: true, costChangeReport: true, contentHash: true } });
  if (!version) throw new DomainError(Codes.NOT_FOUND, "Price book version not found.");
  if (version.status !== "draft") return { ...version, live: null };
  const content = await loadVersionContent(db, version.id);
  const book = await db.priceBook.findUniqueOrThrow({ where: { id: version.priceBookId }, select: { activeVersionId: true } });
  const before = book.activeVersionId ? (await loadVersionContent(db, book.activeVersionId)).items : [];
  const formula2 = (() => {
    try {
      return recomputeFormulaPrices(content);
    } catch (error) {
      return { error: error.message };
    }
  })();
  const uoms = new Map((await db.unitOfMeasure.findMany({ select: { code: true, maxDecimals: true } })).map((u) => [u.code, { maxDecimals: u.maxDecimals }]));
  return { ...version, live: { diff: diffItems(before, content.items), findings: submitFindings(content.items, uoms), formula: Array.isArray(formula2) ? formula2.map((f) => ({ itemKey: f.itemKey, unitPriceMinor: f.unitPriceMinor.toString() })) : formula2 } };
}

// features/keystone/services/estimates.ts
init_actor();
init_approval();
init_cas();
init_canonical();
init_errors();

// features/keystone/domain/policy.ts
init_errors();
var SCOPE_SPECIFICITY = { company: 0, branch: 1, state: 2, county: 3, city: 4, zip: 5 };
function matches(binding, place) {
  switch (binding.scope) {
    case "company":
      return true;
    case "branch":
      return !!place.branchId && binding.scopeValue === place.branchId;
    case "state":
      return !!place.state && binding.scopeValue === place.state;
    case "county":
      return !!place.county && binding.scopeValue === place.county;
    case "city":
      return !!place.city && binding.scopeValue === place.city;
    case "zip":
      return !!place.zip && binding.scopeValue === place.zip;
    default:
      return false;
  }
}
function versionInEffect(binding, on) {
  const live = binding.pack.versions.filter((v) => v.status === "active" && v.effectiveFrom <= on && (!v.effectiveTo || on < v.effectiveTo));
  if (!live.length) throw new DomainError(Codes.POLICY_MISSING, `No ${binding.pack.kind.replaceAll("_", " ")} policy is in effect on ${on} for ${binding.pack.code}.`, { reason: "no_version" });
  if (live.length > 1) throw new DomainError(Codes.POLICY_AMBIGUOUS, `More than one ${binding.pack.code} policy version is in effect on ${on}.`, { reason: "overlapping_versions" });
  return live[0];
}
function parsed(kind, binding, version) {
  const result = parsePolicyRules(kind, version.rules);
  if (!result.success) throw new DomainError(Codes.POLICY_INVALID, `${binding.pack.code} version ${version.versionNumber} has invalid ${kind} rules.`, { reason: result.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
  return result.data;
}
var later = (a, b) => a > b ? a : b;
var earlier = (a, b) => a < b ? a : b;
function intersect(a, b) {
  const start = later(a.start, b.start);
  const end = earlier(a.end, b.end);
  return start < end ? { start, end } : { start: "00:00", end: "00:00" };
}
function stricterContactHours(layers) {
  return layers.slice(1).reduce((acc, next) => ({
    purposes: [.../* @__PURE__ */ new Set([...acc.purposes, ...next.purposes])],
    basis: "recipient_local_time",
    weekdays: intersect(acc.weekdays, next.weekdays),
    saturday: intersect(acc.saturday, next.saturday),
    sunday: intersect(acc.sunday, next.sunday),
    // An exemption survives only when every layer grants it.
    exemptions: acc.exemptions.filter((e) => next.exemptions.includes(e))
  }), layers[0]);
}
function resolvePolicy(kind, place, on, candidates) {
  if (!POLICY_KINDS.includes(kind)) throw new DomainError(Codes.INVALID_INPUT, `Unknown policy kind ${kind}.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) throw new DomainError(Codes.INVALID_INPUT, "Policy date must be YYYY-MM-DD.");
  const applicable = candidates.filter((b) => b.status === "active" && b.pack.kind === kind && matches(b, place)).sort((a, b) => SCOPE_SPECIFICITY[b.scope] - SCOPE_SPECIFICITY[a.scope] || b.priority - a.priority);
  if (!applicable.length) throw new DomainError(Codes.POLICY_MISSING, `No ${kind.replaceAll("_", " ")} policy applies here.`, { reason: "no_binding" });
  if (kind === "contact_hours") {
    const layers = applicable.map((binding) => {
      const version2 = versionInEffect(binding, on);
      return { binding, version: version2, rules: parsed(kind, binding, version2) };
    });
    const top = layers[0];
    return {
      kind,
      packCode: top.binding.pack.code,
      versionId: top.version.id,
      versionNumber: top.version.versionNumber,
      contentHash: top.version.contentHash,
      bindingId: top.binding.id,
      rules: stricterContactHours(layers.map((l) => l.rules)),
      layers: layers.map((l) => ({ packCode: l.binding.pack.code, versionId: l.version.id, scope: l.binding.scope }))
    };
  }
  const [winner, runnerUp] = applicable;
  if (runnerUp && SCOPE_SPECIFICITY[runnerUp.scope] === SCOPE_SPECIFICITY[winner.scope] && runnerUp.priority === winner.priority && runnerUp.pack.id !== winner.pack.id) {
    throw new DomainError(Codes.POLICY_AMBIGUOUS, `Two ${kind.replaceAll("_", " ")} policies (${winner.pack.code}, ${runnerUp.pack.code}) apply equally here. Set a priority on one binding.`, { reason: "tied_bindings" });
  }
  const version = versionInEffect(winner, on);
  return {
    kind,
    packCode: winner.pack.code,
    versionId: version.id,
    versionNumber: version.versionNumber,
    contentHash: version.contentHash,
    bindingId: winner.id,
    rules: parsed(kind, winner, version),
    layers: [{ packCode: winner.pack.code, versionId: version.id, scope: winner.scope }]
  };
}
var isoDay = (d) => d === null ? null : typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
async function loadPolicyCandidates(db, kind) {
  const rows = await db.policyBinding.findMany({
    where: { status: "active", pack: { kind } },
    include: { pack: { include: { versions: { where: { status: "active" } } } } }
  });
  return rows.map((b) => ({
    id: b.id,
    scope: b.scope,
    scopeValue: b.scopeValue,
    priority: b.priority,
    status: b.status,
    pack: {
      id: b.pack.id,
      code: b.pack.code,
      kind: b.pack.kind,
      versions: b.pack.versions.map((v) => ({ id: v.id, versionNumber: v.versionNumber, status: v.status, effectiveFrom: isoDay(v.effectiveFrom), effectiveTo: isoDay(v.effectiveTo), rules: v.rules, contentHash: v.contentHash, sourceRefs: v.sourceRefs }))
    }
  }));
}
async function resolvePolicyFromDb(db, kind, place, on) {
  return resolvePolicy(kind, place, on, await loadPolicyCandidates(db, kind));
}

// features/keystone/domain/noticeTexts.ts
var NoticeTextError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};
var FTC_429 = (f) => ({
  template: "ftc_429_notice_of_cancellation",
  citation: "16 CFR 429.1(a)-(b)",
  receiptStatement: "You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction. See the attached notice of cancellation form for an explanation of this right.",
  caption: "NOTICE OF CANCELLATION",
  formParagraphs: [
    `${f.transactionDate}`,
    "You may CANCEL this transaction, without any Penalty or Obligation, within THREE BUSINESS DAYS from the above date.",
    "If you cancel, any property traded in, any payments made by you under the contract or sale, and any negotiable instrument executed by you will be returned within TEN BUSINESS DAYS following receipt by the seller of your cancellation notice, and any security interest arising out of the transaction will be cancelled.",
    "If you cancel, you must make available to the seller at your residence, in substantially as good condition as when received, any goods delivered to you under this contract or sale, or you may, if you wish, comply with the instructions of the seller regarding the return shipment of the goods at the seller's expense and risk.",
    "If you do make the goods available to the seller and the seller does not pick them up within 20 days of the date of your Notice of Cancellation, you may retain or dispose of the goods without any further obligation. If you fail to make the goods available to the seller, or if you agree to return the goods to the seller and fail to do so, then you remain liable for performance of all obligations under the contract.",
    `To cancel this transaction, mail or deliver a signed and dated copy of this Cancellation Notice or any other written notice, or send a telegram, to ${f.sellerName}, at ${f.sellerAddress} NOT LATER THAN MIDNIGHT OF ${f.cancelByDate}.`,
    "I HEREBY CANCEL THIS TRANSACTION."
  ],
  signatureLines: ["(Date)", "(Buyer's signature)"],
  upperCase: false
});
var TX_6012 = (f) => ({
  template: "tx_601_notice_of_cancellation",
  citation: "Tex. Bus. & Com. Code \xA7601.052-.053",
  receiptStatement: "YOU, THE BUYER, MAY CANCEL THIS TRANSACTION AT ANY TIME PRIOR TO MIDNIGHT OF THE THIRD BUSINESS DAY AFTER THE DATE OF THIS TRANSACTION. SEE THE ATTACHED NOTICE OF CANCELLATION FORM FOR AN EXPLANATION OF THIS RIGHT.",
  caption: "NOTICE OF CANCELLATION",
  formParagraphs: [
    `${f.transactionDate}`,
    "YOU MAY CANCEL THIS TRANSACTION, WITHOUT ANY PENALTY OR OBLIGATION, WITHIN THREE BUSINESS DAYS FROM THE ABOVE DATE.",
    "IF YOU CANCEL, ANY PROPERTY TRADED IN, ANY PAYMENTS MADE BY YOU UNDER THE CONTRACT OR SALE, AND ANY NEGOTIABLE INSTRUMENT EXECUTED BY YOU WILL BE RETURNED WITHIN 10 BUSINESS DAYS FOLLOWING RECEIPT BY THE MERCHANT OF YOUR CANCELLATION NOTICE, AND ANY SECURITY INTEREST ARISING OUT OF THE TRANSACTION WILL BE CANCELLED.",
    "IF YOU CANCEL, YOU MUST MAKE AVAILABLE TO THE MERCHANT AT YOUR RESIDENCE, IN SUBSTANTIALLY AS GOOD CONDITION AS WHEN RECEIVED, ANY GOODS DELIVERED TO YOU UNDER THIS CONTRACT OR SALE; OR YOU MAY IF YOU WISH, COMPLY WITH THE INSTRUCTIONS OF THE MERCHANT REGARDING THE RETURN SHIPMENT OF THE GOODS AT THE MERCHANT'S EXPENSE AND RISK.",
    "IF YOU DO NOT AGREE TO RETURN THE GOODS TO THE MERCHANT OR IF THE MERCHANT DOES NOT PICK THEM UP WITHIN 20 DAYS OF THE DATE OF YOUR NOTICE OF CANCELLATION, YOU MAY RETAIN OR DISPOSE OF THE GOODS WITHOUT ANY FURTHER OBLIGATION.",
    `TO CANCEL THIS TRANSACTION, MAIL OR DELIVER A SIGNED AND DATED COPY OF THIS CANCELLATION NOTICE OR ANY OTHER WRITTEN NOTICE, OR SEND A TELEGRAM, TO ${f.sellerName.toUpperCase()}, AT ${f.sellerAddress.toUpperCase()} NOT LATER THAN MIDNIGHT OF ${f.cancelByDate.toUpperCase()}.`,
    "I HEREBY CANCEL THIS TRANSACTION."
  ],
  signatureLines: ["(DATE)", "(BUYER'S SIGNATURE)"],
  upperCase: true
});
var TEMPLATES = {
  ftc_429_notice_of_cancellation: FTC_429,
  tx_601_notice_of_cancellation: TX_6012
};
var LANGUAGES = { ftc_429_notice_of_cancellation: ["en"], tx_601_notice_of_cancellation: ["en"] };
function noticeText(template, language, fill) {
  const make = TEMPLATES[template];
  if (!make) throw new NoticeTextError("POLICY_INVALID", `Notice template ${template} is not available.`);
  if (!(LANGUAGES[template] ?? []).includes(language)) throw new NoticeTextError("POLICY_INVALID", `There is no verified ${language} text for ${template}; the sale must be in a language we can give notice in.`);
  for (const [k, v] of Object.entries(fill)) if (!String(v).trim()) throw new NoticeTextError("POLICY_INVALID", `The notice needs the ${k}.`);
  return make(fill);
}
var TX_HOMESTEAD_WARNING = "IMPORTANT NOTICE: You and your contractor are responsible for meeting the terms and conditions of this contract. If you sign this contract and you fail to meet the terms and conditions of this contract, you may lose your legal ownership rights in your home. KNOW YOUR RIGHTS AND DUTIES UNDER THE LAW.";
var TX_LIEN_DISCLOSURE = [
  "KNOW YOUR RIGHTS AND RESPONSIBILITIES UNDER THE LAW. You are about to enter into a transaction to build a new home or remodel existing residential property. Texas law requires your contractor to provide you with this brief overview of some of your rights, responsibilities, and risks in this transaction.",
  "CONVEYANCE TO CONTRACTOR NOT REQUIRED. Your contractor may not require you to convey your real property to your contractor as a condition to the agreement for the construction of improvements on your property.",
  "KNOW YOUR CONTRACTOR. Before you enter into your agreement for the construction of improvements to your real property, make sure that you have investigated your contractor. Obtain and verify references from other people who have used the contractor for the type and size of construction project on your property.",
  "GET IT IN WRITING. Make sure that you have a written agreement with your contractor that includes: (1) a description of the work the contractor is to perform; (2) the required or estimated time for completion of the work; (3) the cost of the work or how the cost will be determined; and (4) the procedure and method of payment, including provisions for statutory reservation of funds and conditions for final payment. If your contractor made a promise, warranty, or representation to you concerning the work the contractor is to perform, make sure that promise, warranty, or representation is specified in the written agreement. An oral promise that is not included in the written agreement may not be enforceable under Texas law.",
  "READ BEFORE YOU SIGN. Do not sign any document before you have read and understood it. NEVER SIGN A DOCUMENT THAT INCLUDES AN UNTRUE STATEMENT. Take your time in reviewing documents. If you borrow money from a lender to pay for the improvements, you are entitled to have the loan closing documents furnished to you for review at least one business day before the closing. Do not waive this requirement unless a bona fide emergency or another good cause exists, and make sure you understand the documents before you sign them. If you fail to comply with the terms of the documents, you could lose your property. You are entitled to have your own attorney review any documents. If you have any question about the meaning of a document, consult an attorney.",
  "GET A LIST OF SUBCONTRACTORS AND SUPPLIERS. Before construction commences, your contractor is required to provide you with a list of the subcontractors and suppliers the contractor intends to use on your project. Your contractor is required to supply updated information on any subcontractors and suppliers added after the list is provided. Your contractor is not required to supply this information if you sign a written waiver of your rights to receive this information.",
  "MONITOR THE WORK. Lenders and governmental authorities may inspect the work in progress from time to time for their own purposes. These inspections are not intended as quality control inspections. Quality control is a matter for you and your contractor. To ensure that your home is being constructed in accordance with your wishes and specifications, you should inspect the work yourself or have your own independent inspector review the work in progress.",
  "MONITOR PAYMENTS. If you use a lender, your lender is required to provide you with a periodic statement showing the money disbursed by the lender from the proceeds of your loan. Each time your contractor requests payment from you or your lender for work performed, your contractor is also required to furnish you with a disbursement statement that lists the name and address of each subcontractor or supplier that the contractor intends to pay from the requested funds. Review these statements and make sure that the money is being properly disbursed.",
  "CLAIMS BY SUBCONTRACTORS AND SUPPLIERS. Under Texas law, if a subcontractor or supplier who furnishes labor or materials for the construction of improvements on your property is not paid, you may become liable and your property may be subject to a lien for the unpaid amount, even if you have not contracted directly with the subcontractor or supplier. To avoid liability, you should take the following actions: (1) If you receive a written notice from a subcontractor or supplier, you should withhold payment from your contractor for the amount of the claim stated in the notice until the dispute between your contractor and the subcontractor or supplier is resolved. If your lender is disbursing money directly to your contractor, you should immediately provide a copy of the notice to your lender and instruct the lender to withhold payment in the amount of the claim stated in the notice. If you continue to pay the contractor after receiving the written notice without withholding the amount of the claim, you may be liable and your property may be subject to a lien for the amount you failed to withhold. (2) During construction and for 30 days after final completion, termination, or abandonment of the contract by the contractor, you should reserve or cause your lender to reserve 10 percent of the amount of payments made for the work performed by your contractor. If you choose not to reserve the 10 percent for at least 30 days after final completion, termination, or abandonment of the contract by the contractor and if a valid claim is timely made by a claimant and your contractor fails to pay the claim, you may be personally liable and your property may be subject to a lien up to the amount that you failed to reserve.",
  "If a claim is not paid within a certain time period, the claimant is required to file a mechanic's lien affidavit in the real property records in the county where the property is located. A mechanic's lien affidavit is not a lien on your property, but the filing of the affidavit could result in a court imposing a lien on your property if the claimant is successful in litigation to enforce the lien claim.",
  "SOME CLAIMS MAY NOT BE VALID. When you receive a written notice of a claim or when a mechanic's lien affidavit is filed on your property, you should know your legal rights and responsibilities regarding the claim. Not all claims are valid. A notice of a claim by a subcontractor or supplier is required to be sent, and the mechanic's lien affidavit is required to be filed, within strict time periods. The notice and the affidavit must contain certain information. All claimants may not fully comply with the legal requirements to collect on a claim. If you have paid the contractor in full before receiving a notice of a claim and have withheld the 10 percent of the contract price or value of work, you may not be liable for that claim. Accordingly, you should consult your attorney when you receive a written notice of a claim to determine the true extent of your liability or potential liability for that claim.",
  "OBTAIN A LIEN RELEASE AND A BILLS-PAID AFFIDAVIT. When you receive a notice of claim, do not release withheld funds without obtaining a signed and notarized release of lien and claim from the claimant. You can also reduce the risk of having a claim filed by a subcontractor or supplier by requiring as a condition of each payment made by you or your lender that your contractor furnish you with an affidavit stating that all bills have been paid. Under Texas law, on final completion of the work and before final payment, the contractor is required to furnish you with an affidavit stating that all bills have been paid. If the contractor discloses any unpaid bill in the affidavit, you should withhold payment in the amount of the unpaid bill until you receive a waiver of lien or release from that subcontractor or supplier.",
  "OBTAIN TITLE INSURANCE PROTECTION. You may be able to obtain a title insurance policy to insure that the title to your property and the existing improvements on your property are free from liens claimed by subcontractors and suppliers. If your policy is issued before the improvements are completed and covers the value of the improvements to be completed, you should obtain, on the completion of the improvements and as a condition of your final payment, a 'completion of improvements' policy endorsement. This endorsement will protect your property from liens claimed by subcontractors and suppliers that may arise from the date the original title policy is issued to the date of the endorsement."
];
function noticeDate(isoDate) {
  const [y, m, d] = isoDate.split("-");
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[Number(m) - 1]} ${Number(d)}, ${y}`;
}

// lib/pdf.ts
var PAGE_W = 612;
var PAGE_H = 792;
var MARGIN = 54;
var W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
var WB = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
function ansi(text20) {
  const map = { "\u20AC": 128, "\u201A": 130, "\u201E": 132, "\u2026": 133, "\u2018": 145, "\u2019": 146, "\u201C": 147, "\u201D": 148, "\u2022": 149, "\u2013": 150, "\u2014": 151, "\u2122": 153, "\u2212": 45, "\xB7": 183, "\xA7": 167 };
  let out = "";
  for (const ch of text20) {
    const c = ch.codePointAt(0);
    const b = map[ch] ?? (c >= 32 && c <= 255 && !(c >= 127 && c < 160) ? c : 63);
    out += String.fromCharCode(b);
  }
  return out;
}
var esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
function textWidth(text20, size, font = "regular") {
  if (font === "mono") return ansi(text20).length * 600 * size / 1e3;
  const table = font === "bold" ? WB : W;
  let w = 0;
  for (const ch of ansi(text20)) {
    const c = ch.charCodeAt(0);
    w += c >= 32 && c <= 126 ? table[c - 32] : 556;
  }
  return w * size / 1e3;
}
function wrap(text20, width, size, font = "regular") {
  const lines = [];
  for (const para of text20.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, size, font) <= width || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}
var PdfDoc = class {
  constructor() {
    this.pages = [[]];
    /** Distance from the top of the current page, in points. */
    this.y = MARGIN;
    this.width = PAGE_W - MARGIN * 2;
  }
  get ops() {
    return this.pages[this.pages.length - 1];
  }
  newPage() {
    this.pages.push([]);
    this.y = MARGIN;
  }
  /** Start a new page if fewer than `points` remain. */
  need(points) {
    if (this.y + points > PAGE_H - MARGIN - 18) this.newPage();
  }
  text(s, x, size = 10, font = "regular", align = "left", gray = 0) {
    const f = font === "bold" ? "F2" : font === "mono" ? "F3" : "F1";
    const left = align === "right" ? x - textWidth(s, size, font) : x;
    this.ops.push(`${gray} g BT /${f} ${size} Tf ${left.toFixed(2)} ${(PAGE_H - this.y - size).toFixed(2)} Td (${esc(ansi(s))}) Tj ET 0 g`);
  }
  /** A wrapped paragraph from the current y; advances y. */
  paragraph(s, size = 9, font = "regular", gray = 0, x = MARGIN, width = this.width) {
    for (const line of wrap(s, width, size, font)) {
      this.need(size * 1.35);
      this.text(line, x, size, font, "left", gray);
      this.y += size * 1.35;
    }
  }
  rule(gray = 0.8, weight = 0.5) {
    const y = (PAGE_H - this.y).toFixed(2);
    this.ops.push(`${gray} G ${weight} w ${MARGIN} ${y} m ${PAGE_W - MARGIN} ${y} l S 0 G`);
  }
  toBytes(meta = { title: "Document" }) {
    const objs = [];
    const add = (body) => {
      objs.push(body);
      return objs.length;
    };
    const catalog = add("");
    const pagesId = add("");
    const fonts = [add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"), add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"), add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>")];
    const kids = [];
    this.pages.forEach((ops, i) => {
      const footer = this.footer ? this.footer(i + 1, this.pages.length) : "";
      const all2 = footer ? [...ops, `0.45 g BT /F1 8 Tf ${MARGIN} ${MARGIN - 20} Td (${esc(ansi(footer))}) Tj ET 0 g`] : ops;
      const stream = all2.join("\n");
      const content = add(`<< /Length ${latin1Length(stream)} >>
stream
${stream}
endstream`);
      kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fonts[0]} 0 R /F2 ${fonts[1]} 0 R /F3 ${fonts[2]} 0 R >> >> /Contents ${content} 0 R >>`));
    });
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
    const info = add(`<< /Title (${esc(ansi(meta.title))}) /Producer (Openfront Home Services)${meta.author ? ` /Author (${esc(ansi(meta.author))})` : ""} >>`);
    let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    const offsets = [];
    objs.forEach((body, i) => {
      offsets.push(latin1Length(out));
      out += `${i + 1} 0 obj
${body}
endobj
`;
    });
    const xref = latin1Length(out);
    out += `xref
0 ${objs.length + 1}
0000000000 65535 f 
${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n 
`).join("")}`;
    out += `trailer
<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>
startxref
${xref}
%%EOF
`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return bytes;
  }
};
var latin1Length = (s) => s.length;

// lib/salesPdf.ts
function usd(minor2) {
  const s = String(minor2 ?? "0");
  if (!/^-?\d+$/.test(s)) return "";
  const neg = s.startsWith("-");
  const abs = s.replace("-", "").padStart(3, "0");
  const whole = abs.slice(0, -2).replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}$${whole}.${abs.slice(-2)}`;
}
var TIER = { good: "Good", better: "Better", best: "Best", single: "", custom: "" };
var presentedLabel = (s) => `Presented ${new Intl.DateTimeFormat("en-US", { timeZone: s.timeZone, dateStyle: "medium" }).format(new Date(s.presentedAt))}${s.validUntil ? ` \xB7 good through ${s.validUntil}` : ""}`;
function renderEstimatePdf(s, subtitle) {
  const pdf = new PdfDoc();
  const right = MARGIN + pdf.width;
  const col = { qty: right - 200, each: right - 110, amount: right };
  pdf.footer = (p, n) => `${s.ref} v${s.versionNumber} \xB7 ${s.company.name} \xB7 page ${p} of ${n}`;
  pdf.text(s.company.legalName || s.company.name, MARGIN, 16, "bold");
  pdf.text("ESTIMATE", right, 16, "bold", "right");
  pdf.y += 22;
  pdf.text([s.company.address, s.company.phone].filter(Boolean).join(" \xB7 "), MARGIN, 9, "regular", "left", 0.35);
  pdf.text(`${s.ref} \xB7 version ${s.versionNumber}`, right, 9, "regular", "right", 0.35);
  pdf.y += 13;
  if (s.company.licenses.length) {
    pdf.text(s.company.licenses.map((l) => `${l.label} ${l.number}`).join(" \xB7 "), MARGIN, 8.5, "regular", "left", 0.35);
  }
  pdf.text(subtitle, right, 9, "regular", "right", 0.35);
  pdf.y += 22;
  pdf.text(s.customer.name, MARGIN, 11, "bold");
  pdf.y += 15;
  if (s.location) {
    pdf.text(s.location.address, MARGIN, 10);
    pdf.y += 15;
  }
  pdf.text(s.title, MARGIN, 10, "regular", "left", 0.3);
  pdf.y += 16;
  if (s.notes) {
    pdf.paragraph(s.notes, 9, "regular", 0.25);
    pdf.y += 4;
  }
  pdf.rule(0.2, 1);
  pdf.y += 10;
  const many = s.options.length > 1;
  for (const [i, o] of s.options.entries()) {
    pdf.need(80);
    const label = [many ? `Option ${i + 1}` : "", TIER[o.tier] ?? "", o.name].filter(Boolean).join(" \xB7 ");
    pdf.text(label, MARGIN, 11.5, "bold");
    pdf.text(usd(o.totalMinor), right, 11.5, "bold", "right");
    pdf.y += 16;
    if (o.description) pdf.paragraph(o.description, 9, "regular", 0.3);
    pdf.y += 2;
    pdf.text("Qty", col.qty, 8, "regular", "right", 0.45);
    pdf.text("Each", col.each, 8, "regular", "right", 0.45);
    pdf.text("Amount", col.amount, 8, "regular", "right", 0.45);
    pdf.y += 12;
    for (const l of o.lines) {
      pdf.need(26);
      pdf.text(l.description, MARGIN + 10, 9.5);
      pdf.text(`${l.quantity} ${l.uom}`, col.qty, 9.5, "regular", "right");
      pdf.text(usd(l.unitPriceMinor), col.each, 9.5, "regular", "right");
      pdf.text(usd(l.amountMinor), col.amount, 9.5, "regular", "right");
      pdf.y += 12;
      const detail = [l.memberPriced ? "member price" : "", l.isAddOn ? "additional work" : "", l.warrantyText].filter(Boolean).join(" \xB7 ");
      if (detail) {
        pdf.paragraph(detail, 8, "regular", 0.45, MARGIN + 10, col.qty - MARGIN - 60);
      }
    }
    pdf.y += 2;
    const parts2 = [`Subtotal ${usd(o.subtotalMinor)}`, o.discountMinor !== "0" ? `Discount -${usd(o.discountMinor)}` : "", `Estimated tax ${usd(o.estimatedTaxMinor)}`].filter(Boolean);
    pdf.text(parts2.join(" \xB7 "), right, 8.5, "regular", "right", 0.35);
    pdf.y += 12;
    if (o.monthlyPaymentDisplay) {
      pdf.text(o.monthlyPaymentDisplay, right, 8.5, "regular", "right", 0.35);
      pdf.y += 12;
    }
    pdf.rule();
    pdf.y += 10;
  }
  pdf.need(40);
  if (s.discount) {
    pdf.paragraph(`Discount applied: ${s.discount.reason}`, 8.5, "regular", 0.25);
    pdf.y += 2;
  }
  pdf.paragraph(s.disclosures.taxNote, 8.5, "regular", 0.25);
  if (s.validUntil) pdf.paragraph(`Prices are good through ${s.validUntil}.`, 8.5, "regular", 0.25);
  pdf.y += 6;
  if (s.disclosures.cancellationStatement) {
    pdf.need(40);
    pdf.paragraph(s.disclosures.cancellationStatement, 10, "bold");
    pdf.y += 6;
  }
  if (s.disclosures.homesteadWarning) {
    pdf.need(50);
    pdf.paragraph(s.disclosures.homesteadWarning, 10, "bold");
    pdf.y += 6;
  }
  if (s.disclosures.lienDisclosure?.length) {
    pdf.newPage();
    for (const para of s.disclosures.lienDisclosure) {
      pdf.paragraph(para, 8.5);
      pdf.y += 4;
    }
  }
  return pdf.toBytes({ title: `Estimate ${s.ref}`, author: s.company.name });
}
function renderNoticePdf(s) {
  const pdf = new PdfDoc();
  const right = MARGIN + pdf.width;
  pdf.footer = (p, n) => `${s.ref} \xB7 ${s.seller.name} \xB7 page ${p} of ${n}`;
  pdf.text(s.seller.name, MARGIN, 14, "bold");
  pdf.text(s.ref, right, 10, "regular", "right", 0.35);
  pdf.y += 18;
  pdf.text(s.seller.address, MARGIN, 9, "regular", "left", 0.35);
  pdf.y += 18;
  pdf.text(`Buyer: ${s.buyer.name}`, MARGIN, 10);
  pdf.y += 13;
  pdf.text(s.buyer.address, MARGIN, 10);
  pdf.y += 13;
  pdf.text(`Date of transaction: ${s.transactionDate}`, MARGIN, 10);
  pdf.y += 18;
  pdf.text("Work covered by this right to cancel", MARGIN, 9, "bold");
  pdf.y += 13;
  for (const l of s.coveredLines) {
    pdf.need(14);
    pdf.text(l.description, MARGIN + 10, 9);
    pdf.text(usd(l.amountMinor), right, 9, "regular", "right");
    pdf.y += 12;
  }
  pdf.text(`Total ${usd(s.coveredAmountMinor)}`, right, 9, "bold", "right");
  pdf.y += 18;
  for (const n of s.notices) {
    pdf.need(50);
    pdf.paragraph(n.receiptStatement, 10, "bold");
    pdf.y += 8;
  }
  for (const n of s.notices) {
    for (const copy of ["Copy for the buyer to keep", "Copy for the buyer to send"]) {
      pdf.newPage();
      pdf.text(copy, right, 8, "regular", "right", 0.45);
      pdf.text(n.citation, MARGIN, 8, "regular", "left", 0.45);
      pdf.y += 18;
      pdf.text(n.caption, MARGIN, 12, "bold");
      pdf.y += 20;
      for (const p of n.formParagraphs) {
        pdf.paragraph(p, 10, "bold");
        pdf.y += 6;
      }
      pdf.y += 24;
      for (const sig of n.signatureLines) {
        pdf.rule(0.3, 0.5);
        pdf.y += 4;
        pdf.text(sig, MARGIN, 9, "bold");
        pdf.y += 30;
      }
    }
  }
  return pdf.toBytes({ title: `Notice of cancellation ${s.ref}`, author: s.seller.name });
}

// features/keystone/services/memberships.ts
var import_zod2 = require("zod");
init_actor();
init_cas();
init_errors();

// features/keystone/domain/membershipTime.ts
var pad = (n) => String(n).padStart(2, "0");
var parts = (date) => {
  assertDate(date);
  return { y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)), d: Number(date.slice(8, 10)) };
};
var isLeapYear = (y) => y % 4 === 0 && y % 100 !== 0 || y % 400 === 0;
var daysInMonth = (y, m) => [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
function addMonthsClamped(date, months) {
  const { y, m, d } = parts(date);
  const index = y * 12 + (m - 1) + months;
  const ny = Math.floor(index / 12);
  const nm = index % 12 + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(d, daysInMonth(ny, nm)))}`;
}
var termStart = (anchor, termMonths, n) => addMonthsClamped(anchor, termMonths * (n - 1));
var termEnd = (anchor, termMonths, n) => addDays(termStart(anchor, termMonths, n + 1), -1);
var slotDueDay = (anchor, termMonths, n, k) => addMonthsClamped(anchor, termMonths * (n - 1) + k);
function slotCount(billingFrequency, termMonths) {
  return billingFrequency === "monthly" ? termMonths : 1;
}
var monthDay = (md, year) => {
  const m = Number(md.slice(0, 2));
  const d = Number(md.slice(3, 5));
  if (!/^\d\d-\d\d$/.test(md) || m < 1 || m > 12 || d < 1 || d > 31) throw new Error(`Invalid season day ${md}`);
  return `${year}-${pad(m)}-${pad(Math.min(d, daysInMonth(year, m)))}`;
};
function windowFor(start, end, season) {
  if (!season) return { startDay: start, endDay: end };
  const first = parts(start).y - 1;
  const last = parts(end).y;
  const days = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5) + 1;
  let best = null;
  for (let y = first; y <= last; y += 1) {
    const s = monthDay(season.startMonthDay, y);
    const wraps = season.endMonthDay < season.startMonthDay;
    const e = monthDay(season.endMonthDay, wraps ? y + 1 : y);
    if (e < start || s > end) continue;
    const w = { startDay: s < start ? start : s, endDay: e > end ? end : e };
    if (!best || days(w.startDay, w.endDay) > days(best.startDay, best.endDay)) best = w;
  }
  return best ?? { startDay: start, endDay: end };
}
var dayAt = (timeZone, at) => localDate({ timeZone }, at);
function termDaysLeft(start, end, day3) {
  const ms = (d) => Date.parse(`${d}T00:00:00Z`);
  const total = Math.round((ms(end) - ms(start)) / 864e5) + 1;
  const left = day3 > end ? 0 : day3 < start ? total : Math.round((ms(end) - ms(day3)) / 864e5) + 1;
  return { left, total };
}
var prorate = (amountMinor, left, total) => total <= 0 ? 0n : amountMinor * BigInt(left) / BigInt(total);

// features/keystone/services/billingShared.ts
init_actor();
init_cas();
init_errors();
var TERMS_DAYS = { due_on_receipt: 0, net_15: 15, net_30: 30, net_45: 45, net_60: 60 };
var asDate = (day3) => /* @__PURE__ */ new Date(`${day3}T00:00:00Z`);
async function companyToday(tx, at) {
  const company = await tx.companySettings.findFirst({ select: { homeTimeZone: true } });
  return localDate({ timeZone: company?.homeTimeZone || "America/Chicago" }, at);
}
async function arPeriodFor(tx, day3, { requireOpen = true } = {}) {
  const month = asDate(`${day3.slice(0, 7)}-01`);
  const period = await tx.arPeriod.upsert({ where: { month }, create: { month, status: "open" }, update: {}, select: { id: true, status: true } });
  if (requireOpen && period.status !== "open") throw new DomainError(Codes.GUARD_FAILED, `The AR period for ${day3.slice(0, 7)} is ${period.status}. Choose a date in an open period.`, { reason: "ar_period_closed", month: day3.slice(0, 7) });
  return period;
}
async function lockInvoice(tx, id) {
  return lockRow(tx, "Invoice", id);
}
function statusForBalance(total, balance) {
  return balance === 0n ? "paid" : balance < total ? "partially_paid" : "posted";
}
async function postArEntry(uow, input) {
  const day3 = await companyToday(uow.tx, uow.now);
  const period = await arPeriodFor(uow.tx, day3);
  return uow.tx.arEntry.create({
    data: { invoiceId: input.invoice.id, customerId: input.invoice.customerId, payerId: input.invoice.payerId, kind: input.kind, amountMinor: input.amountMinor, sourceType: input.sourceType, sourceId: input.sourceId, arPeriodId: period.id, postedAt: uow.now, note: input.note ?? "" },
    select: { id: true }
  });
}
async function settleInvoice(uow, actor, invoice, delta, eventType, extra = {}) {
  const balance = invoice.balanceMinor + delta;
  if (balance < 0n) throw new DomainError(Codes.GUARD_FAILED, "That is more than the invoice balance.", { balanceMinor: invoice.balanceMinor.toString() });
  const to = extra.to ?? statusForBalance(invoice.totalMinor, balance);
  const version = await casUpdate(uow, { model: "Invoice", id: invoice.id, version: invoice.version, from: ["posted", "partially_paid", "paid"], to, actor, eventType, reason: extra.reason ?? null, data: { balanceMinor: balance }, audit: { balanceMinor: balance.toString() } });
  return { ...invoice, status: to, version, balanceMinor: balance };
}
async function allocatePayment(uow, actor, invoice, paymentId, amount) {
  if (!["posted", "partially_paid"].includes(invoice.status)) throw new DomainError(Codes.GUARD_FAILED, `Invoice ${invoice.ref} is ${invoice.status}; it takes no payment.`, { status: invoice.status });
  if (amount <= 0n || amount > invoice.balanceMinor) throw new DomainError(Codes.GUARD_FAILED, `Apply between $0.01 and the $${(Number(invoice.balanceMinor) / 100).toFixed(2)} balance.`);
  const allocation = await uow.tx.paymentAllocation.create({ data: { paymentId, invoiceId: invoice.id, kind: "apply", amountMinor: amount, createdById: actorUserId(actor) }, select: { id: true } });
  await postArEntry(uow, { invoice, kind: "payment_applied", amountMinor: -amount, sourceType: "Payment", sourceId: paymentId });
  const next = await settleInvoice(uow, actor, invoice, -amount, "invoice.payment_applied");
  auditCreate(uow, actor, "PaymentAllocation", allocation.id, "payment.allocated", { paymentId, invoiceId: invoice.id, amountMinor: amount.toString() });
  return next;
}
async function reverseAllocations(uow, actor, paymentId, amount, kind, reason) {
  const rows = await uow.tx.paymentAllocation.findMany({ where: { paymentId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  const reversedOf = /* @__PURE__ */ new Map();
  for (const r of rows) if (r.kind === "reverse" && r.reversesId) reversedOf.set(r.reversesId, (reversedOf.get(r.reversesId) ?? 0n) + r.amountMinor);
  let left = amount;
  for (const row of rows) {
    if (left === 0n) break;
    if (row.kind !== "apply" || !row.invoiceId) continue;
    const open = row.amountMinor - (reversedOf.get(row.id) ?? 0n);
    if (open <= 0n) continue;
    const take = open < left ? open : left;
    await uow.tx.paymentAllocation.create({ data: { paymentId, invoiceId: row.invoiceId, kind: "reverse", reversesId: row.id, amountMinor: take, reason, createdById: actorUserId(actor) } });
    const invoice = await lockInvoice(uow.tx, row.invoiceId);
    await postArEntry(uow, { invoice, kind, amountMinor: take, sourceType: "Payment", sourceId: paymentId, note: reason });
    await settleInvoice(uow, actor, invoice, take, `invoice.${kind}`, { reason });
    left -= take;
  }
  return amount - left;
}
async function unappliedOf(tx, paymentId) {
  const [payment, allocations, refunds] = await Promise.all([
    tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { amountMinor: true } }),
    tx.paymentAllocation.findMany({ where: { paymentId }, select: { kind: true, amountMinor: true } }),
    tx.refund.aggregate({ where: { paymentId }, _sum: { amountMinor: true } })
  ]);
  const applied = allocations.reduce((a, r) => a + (r.kind === "apply" ? r.amountMinor : -r.amountMinor), 0n);
  const refunded = refunds._sum.amountMinor ?? 0n;
  return { amountMinor: payment.amountMinor, applied, refunded, unapplied: payment.amountMinor - applied - refunded };
}
var money = (minor2) => `$${(Number(minor2) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// features/keystone/services/salesShared.ts
var import_node_crypto7 = require("node:crypto");
init_actor();
init_cas();
var placeOfLocation = (loc) => {
  const state2 = loc?.state ? `US-${loc.state}` : "US-TX";
  return { state: state2, zip: loc?.postalCode || null, city: loc?.city ? `${state2}-${loc.city.toUpperCase().replace(/\s+/g, "-")}` : null };
};
var addressLine = (loc) => loc ? [loc.address1, loc.address2, `${loc.city}, ${loc.state} ${loc.postalCode}`].filter(Boolean).join(", ") : "";
async function sellerBlock(tx, businessUnitId, jurisdiction, trades) {
  const [company, brand, bu] = await Promise.all([
    tx.companySettings.findFirst({ select: { legalName: true, displayName: true, homeTimeZone: true, estimateValidityDays: true } }),
    tx.brand.findFirst({ orderBy: { createdAt: "asc" }, select: { name: true, phone: true, email: true } }),
    businessUnitId ? tx.businessUnit.findUnique({ where: { id: businessUnitId }, select: { branch: { select: { line1: true, line2: true, city: true, region: true, postalCode: true } } } }) : null
  ]);
  if (!company) throw new Error("Company settings are not set up.");
  const branch = bu?.branch ?? await tx.branch.findFirst({ orderBy: { createdAt: "asc" }, select: { line1: true, line2: true, city: true, region: true, postalCode: true } });
  const licenses = await tx.contractorLicense.findMany({ where: { displayOnDocuments: true, jurisdictionCode: jurisdiction, trade: { in: [...new Set(trades)] } }, orderBy: { trade: "asc" }, select: { issuer: true, licenseNumber: true } });
  return {
    company,
    block: {
      name: brand?.name || company.displayName,
      legalName: company.legalName,
      phone: brand?.phone || "",
      email: brand?.email || "",
      address: branch ? [branch.line1, branch.line2, `${branch.city}, ${branch.region} ${branch.postalCode}`].filter(Boolean).join(", ") : "",
      licenses: licenses.map((l) => ({ label: l.issuer, number: l.licenseNumber }))
    }
  };
}
var sha256Bytes = (bytes) => (0, import_node_crypto7.createHash)("sha256").update(bytes).digest("hex");
async function storeRenderedPdf(uow, actor, spec) {
  const digest = sha256Bytes(spec.bytes);
  const doc = await uow.tx.document.create({ data: { title: spec.title, kind: spec.kind, visibility: "customer", subjectType: spec.subjectType, subjectId: spec.subjectId }, select: { id: true } });
  await uow.tx.documentVersion.create({ data: { documentId: doc.id, versionNumber: 1, storageKey: spec.storageKey, sha256: digest, mimeType: "application/pdf", sizeBytes: spec.bytes.length, createdById: actorUserId(actor) } });
  auditCreate(uow, actor, "Document", doc.id, "document.rendered", { kind: spec.kind, subjectType: spec.subjectType, subjectId: spec.subjectId, sha256: digest, sizeBytes: spec.bytes.length });
  return { documentId: doc.id, sha256: digest };
}
async function storeRecordedDocument(uow, actor, spec) {
  const digest = (0, import_node_crypto7.createHash)("sha256").update(spec.content).digest("hex");
  const doc = await uow.tx.document.create({ data: { title: spec.title, kind: spec.kind, visibility: "internal", subjectType: spec.subjectType, subjectId: spec.subjectId }, select: { id: true } });
  await uow.tx.documentVersion.create({ data: { documentId: doc.id, versionNumber: 1, storageKey: spec.storageKey, sha256: digest, mimeType: spec.mimeType, sizeBytes: Buffer.byteLength(spec.content), createdById: actorUserId(actor) } });
  auditCreate(uow, actor, "Document", doc.id, "document.recorded", { kind: spec.kind, subjectType: spec.subjectType, subjectId: spec.subjectId, sha256: digest });
  return { documentId: doc.id, sha256: digest };
}

// features/keystone/services/memberships.ts
var MANAGE = ["canManageMemberships"];
var SELL2 = ["canSellMemberships", "canManageMemberships"];
var ymd = (d) => d ? d.toISOString().slice(0, 10) : "";
var text19 = (v, field, min = 1, max = 400) => {
  const s = String(v ?? "").trim();
  if (s.length < min || s.length > max) throw new DomainError(Codes.INVALID_INPUT, min > 0 ? `${field.replace(/([A-Z])/g, " $1").toLowerCase()} is needed.` : "Too long.", { field });
  return s;
};
var monthDay2 = import_zod2.z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "MM-DD");
var entitlementSpec = import_zod2.z.object({
  code: import_zod2.z.string().regex(/^[a-z0-9_]{2,40}$/),
  name: import_zod2.z.string().min(2).max(80),
  quantity: import_zod2.z.number().int().min(1).max(12),
  /** A visit is something the crew comes out to do; the others are credits (a waived trip fee, a discount call). */
  visit: import_zod2.z.boolean().default(true),
  seasonStart: monthDay2.nullish(),
  seasonEnd: monthDay2.nullish(),
  rollover: import_zod2.z.enum(["none", "one_term"]).default("none")
}).refine((e) => e.seasonStart == null === (e.seasonEnd == null), "A season needs both a start and an end.");
var benefitSpec = import_zod2.z.object({ title: import_zod2.z.string().min(2).max(80), text: import_zod2.z.string().min(2).max(240) });
function draftData(input) {
  const data = {};
  if (input.priceMinor !== void 0) {
    if (!/^\d{1,9}$/.test(String(input.priceMinor)) || BigInt(input.priceMinor) <= 0n) throw new DomainError(Codes.INVALID_INPUT, "The price is whole cents, more than zero.", { field: "priceMinor" });
    data.priceMinor = BigInt(input.priceMinor);
  }
  if (input.billingFrequency !== void 0) {
    if (!["annual", "monthly"].includes(input.billingFrequency)) throw new DomainError(Codes.INVALID_INPUT, "Billed annually or monthly.", { field: "billingFrequency" });
    data.billingFrequency = input.billingFrequency;
  }
  if (input.termMonths !== void 0) {
    if (!Number.isInteger(input.termMonths) || input.termMonths < 1 || input.termMonths > 60) throw new DomainError(Codes.INVALID_INPUT, "A term is 1 to 60 months.", { field: "termMonths" });
    data.termMonths = input.termMonths;
  }
  if (input.autoRenew !== void 0) data.autoRenew = !!input.autoRenew;
  if (input.renewalNoticeDays !== void 0) {
    if (!Number.isInteger(input.renewalNoticeDays) || input.renewalNoticeDays < 0 || input.renewalNoticeDays > 120) throw new DomainError(Codes.INVALID_INPUT, "Tell customers 0 to 120 days ahead.", { field: "renewalNoticeDays" });
    data.renewalNoticeDays = input.renewalNoticeDays;
  }
  if (input.entitlements !== void 0) {
    const parsed2 = import_zod2.z.array(entitlementSpec).max(20).safeParse(input.entitlements);
    if (!parsed2.success) throw new DomainError(Codes.INVALID_INPUT, `What the plan includes is not valid: ${parsed2.error.issues[0]?.message ?? "check each line"}.`, { field: "entitlements" });
    if (new Set(parsed2.data.map((e) => e.code)).size !== parsed2.data.length) throw new DomainError(Codes.INVALID_INPUT, "Each included item needs its own code.", { field: "entitlements" });
    data.entitlements = parsed2.data;
  }
  if (input.benefits !== void 0) {
    const parsed2 = import_zod2.z.array(benefitSpec).max(12).safeParse(input.benefits);
    if (!parsed2.success) throw new DomainError(Codes.INVALID_INPUT, "Each benefit needs a title and a sentence.", { field: "benefits" });
    data.benefits = parsed2.data;
  }
  if (input.cancellationRefundMethod !== void 0) {
    if (!["none", "prorata", "full_within_days"].includes(input.cancellationRefundMethod)) throw new DomainError(Codes.INVALID_INPUT, "Choose how a cancellation is refunded.", { field: "cancellationRefundMethod" });
    data.cancellationRefundMethod = input.cancellationRefundMethod;
  }
  if (input.cancellationRefundDays !== void 0) {
    if (!Number.isInteger(input.cancellationRefundDays) || input.cancellationRefundDays < 0 || input.cancellationRefundDays > 365) throw new DomainError(Codes.INVALID_INPUT, "The full-refund window is 0 to 365 days.", { field: "cancellationRefundDays" });
    data.cancellationRefundDays = input.cancellationRefundDays;
  }
  if (input.consentWording !== void 0) data.consentWording = String(input.consentWording).trim().slice(0, 1200);
  return data;
}
async function createPlan(db, actor, args) {
  await authorizeOperation(db, actor, "membership.plan_create", MANAGE, args);
  const name = text19(args.name, "name", 3, 80);
  const code = String(args.code ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(code)) throw new DomainError(Codes.INVALID_INPUT, "The code is lower-case letters, digits and dashes.", { field: "code" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "membership.plan_create", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    if (await uow.tx.membershipPlan.findUnique({ where: { code }, select: { id: true } })) throw new DomainError(Codes.GUARD_FAILED, "A plan already uses that code.", { field: "code" });
    const plan = await uow.tx.membershipPlan.create({ data: { name, code, description: args.description?.trim() ?? "" }, select: { id: true } });
    const version = await uow.tx.membershipPlanVersion.create({ data: { planId: plan.id, versionNumber: 1, label: `${name} v1`, status: "draft", createdById: actorUserId(actor), ...draftData(args.draft ?? {}) }, select: { id: true } });
    auditCreate(uow, actor, "MembershipPlan", plan.id, "membership.plan_created", { name, code });
    return { planId: plan.id, versionId: version.id };
  });
  return { replay: result.replay, ...result.value };
}
async function saveDraftVersion(db, actor, args) {
  await authorizeOperation(db, actor, "membership.plan_draft", MANAGE, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "membership.plan_draft", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const plan = await lockRow(tx, "MembershipPlan", args.planId);
    if (plan.status !== "active") throw new DomainError(Codes.GUARD_FAILED, "This plan is retired.");
    const data = draftData(args.draft);
    const draft = await tx.membershipPlanVersion.findFirst({ where: { planId: plan.id, status: "draft" }, select: { id: true } });
    if (draft) {
      await tx.membershipPlanVersion.update({ where: { id: draft.id }, data });
      auditCreate(uow, actor, "MembershipPlanVersion", draft.id, "membership.plan_draft_saved", { fields: Object.keys(data) });
      return { versionId: draft.id };
    }
    const last = await tx.membershipPlanVersion.findFirstOrThrow({ where: { planId: plan.id }, orderBy: { versionNumber: "desc" } });
    const created = await tx.membershipPlanVersion.create({
      data: {
        planId: plan.id,
        versionNumber: last.versionNumber + 1,
        label: `${plan.name} v${last.versionNumber + 1}`,
        status: "draft",
        createdById: actorUserId(actor),
        priceMinor: last.priceMinor,
        billingFrequency: last.billingFrequency,
        termMonths: last.termMonths,
        autoRenew: last.autoRenew,
        renewalNoticeDays: last.renewalNoticeDays,
        entitlements: last.entitlements,
        benefits: last.benefits,
        cancellationRefundMethod: last.cancellationRefundMethod,
        cancellationRefundDays: last.cancellationRefundDays,
        consentWording: last.consentWording,
        ...data
      },
      select: { id: true }
    });
    auditCreate(uow, actor, "MembershipPlanVersion", created.id, "membership.plan_draft_started", { from: last.versionNumber });
    return { versionId: created.id };
  });
  return { replay: result.replay, ...result.value };
}
async function activatePlanVersion(db, actor, args) {
  await authorizeOperation(db, actor, "membership.plan_activate", MANAGE, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "membership.plan_activate", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const v = await lockRow(tx, "MembershipPlanVersion", args.versionId);
    if (v.status !== "draft") throw new DomainError(Codes.INVALID_TRANSITION, "Only a draft is published.");
    if (v.priceMinor <= 0n) throw new DomainError(Codes.GUARD_FAILED, "Set a price first.", { reason: "price_missing" });
    if (!Array.isArray(v.entitlements) || !v.entitlements.length) throw new DomainError(Codes.GUARD_FAILED, "List what the plan includes first.", { reason: "entitlements_missing" });
    let policyVersion = "";
    if (v.autoRenew) {
      if (v.consentWording.trim().length < 30) throw new DomainError(Codes.GUARD_FAILED, "Automatic renewal needs the wording the customer agrees to (what renews, for how much, how to cancel).", { reason: "consent_wording_missing" });
      const company = await tx.companySettings.findFirst({ select: { homeTimeZone: true } });
      const today = await companyToday(tx, uow.now);
      const location = await tx.serviceLocation.findFirst({ select: { state: true, postalCode: true, city: true, timeZone: true, propertyClass: true } });
      const policy = await resolvePolicyFromDb(tx, "auto_renewal", placeOfLocation(location ?? { state: "TX", postalCode: "", city: "", timeZone: company?.homeTimeZone ?? "America/Chicago", propertyClass: "residential" }), today);
      policyVersion = policy.versionId;
    }
    await tx.membershipPlanVersion.updateMany({ where: { planId: v.planId, status: "active" }, data: { status: "retired" } });
    await tx.membershipPlanVersion.update({ where: { id: v.id }, data: { status: "active", activatedAt: uow.now, autoRenewalPolicyVersion: policyVersion, consentWordingVersion: v.autoRenew ? `v${v.versionNumber}` : "" } });
    auditCreate(uow, actor, "MembershipPlanVersion", v.id, "membership.plan_activated", { planId: v.planId, versionNumber: v.versionNumber });
    return { versionId: v.id };
  });
  return { replay: result.replay, ...result.value };
}
async function retirePlan(db, actor, args) {
  await authorizeOperation(db, actor, "membership.plan_retire", MANAGE, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "membership.plan_retire", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const plan = await lockRow(uow.tx, "MembershipPlan", args.planId);
    await casUpdate(uow, { model: "MembershipPlan", id: plan.id, version: plan.version, from: ["active"], to: "retired", actor, eventType: "membership.plan_retired", reason: args.reason ?? null });
    await uow.tx.membershipPlanVersion.updateMany({ where: { planId: plan.id, status: "active" }, data: { status: "retired" } });
    return { planId: plan.id };
  });
  return { replay: result.replay, ...result.value };
}
async function writeTerm(uow, membership, version, n) {
  const { tx } = uow;
  const start = termStart(membership.startsOn, version.termMonths, n);
  const end = termEnd(membership.startsOn, version.termMonths, n);
  const term = await tx.membershipTerm.create({
    data: { termKey: `${membership.id}:${n}`, membershipId: membership.id, termNumber: n, planVersionId: version.id, startsOn: asDate(start), endsOn: asDate(end), billingFrequency: version.billingFrequency, priceMinor: version.priceMinor, slots: slotCount(version.billingFrequency, version.termMonths), status: "active" },
    select: { id: true }
  });
  const specs = version.entitlements ?? [];
  const grants = [];
  for (const spec of specs) {
    const season = spec.seasonStart && spec.seasonEnd ? { startMonthDay: spec.seasonStart, endMonthDay: spec.seasonEnd } : null;
    const w = windowFor(start, end, season);
    const grant = await tx.entitlementGrant.create({
      data: { grantKey: `${term.id}:${spec.code}`, membershipId: membership.id, termId: term.id, code: spec.code, name: spec.name, quantity: spec.quantity, windowStart: asDate(w.startDay), windowEnd: asDate(w.endDay), rolloverPolicy: spec.rollover },
      select: { id: true }
    });
    grants.push({ id: grant.id, code: spec.code, quantity: spec.quantity, rolloverPolicy: spec.rollover });
    if (spec.visit) {
      for (let i = 0; i < spec.quantity; i += 1) {
        await tx.recurringServiceEvent.create({ data: { eventKey: `${grant.id}:${i}`, membershipId: membership.id, grantId: grant.id, code: spec.code, name: spec.name, dueFrom: asDate(w.startDay), dueBy: asDate(w.endDay), status: "open" } });
      }
    }
  }
  return { termId: term.id, start, end, grants };
}
async function grantBalance(tx, grantId) {
  const grant = await tx.entitlementGrant.findUniqueOrThrow({ where: { id: grantId }, select: { quantity: true } });
  const used = await tx.entitlementEntry.aggregate({ where: { grantId }, _sum: { quantity: true } });
  return grant.quantity + (used._sum.quantity ?? 0);
}
async function sellMembership(db, actor, args) {
  await authorizeOperation(db, actor, "membership.sell", SELL2, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "membership.sell", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const location = await tx.serviceLocation.findUnique({ where: { id: args.locationId }, select: { id: true, customerId: true, state: true, postalCode: true, city: true, timeZone: true, propertyClass: true } });
    if (!location || location.customerId !== args.customerId) throw new DomainError(Codes.NOT_FOUND, "That address is not on this customer.", { field: "locationId" });
    const plan = await tx.membershipPlan.findUnique({ where: { id: args.planId }, select: { id: true, name: true, status: true } });
    if (!plan || plan.status !== "active") throw new DomainError(Codes.GUARD_FAILED, "That plan is not for sale.", { reason: "plan_not_active" });
    const version = await tx.membershipPlanVersion.findFirst({ where: { planId: plan.id, status: "active" } });
    if (!version) throw new DomainError(Codes.GUARD_FAILED, "That plan has no published version.", { reason: "no_active_version" });
    const today = dayAt(location.timeZone, uow.now);
    const startsOn = args.startsOn ?? today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) throw new DomainError(Codes.INVALID_INPUT, "The start date is a day.", { field: "startsOn" });
    if (startsOn < addDays(today, -7) || startsOn > addDays(today, 90)) throw new DomainError(Codes.INVALID_INPUT, "A membership starts within a week back or three months ahead.", { field: "startsOn" });
    const live = await tx.membership.findFirst({ where: { customerId: args.customerId, locationId: location.id, planId: plan.id, status: { in: ["pending_payment", "active", "past_due", "suspended", "renewal_due"] } }, select: { ref: true } });
    if (live) throw new DomainError(Codes.GUARD_FAILED, `${live.ref} already covers this address on the same plan.`, { reason: "already_member" });
    const wantsAuto = args.autoRenew ?? version.autoRenew;
    if (wantsAuto && !version.autoRenew) throw new DomainError(Codes.GUARD_FAILED, "This plan does not renew automatically.", { reason: "auto_renew_not_offered" });
    let consentId = null;
    if (wantsAuto) {
      const policy = await resolvePolicyFromDb(tx, "auto_renewal", placeOfLocation(location), today);
      const c = args.consent;
      if (policy.rules.affirmativeConsentRequired && (!c?.confirmed || c.wording?.trim() !== version.consentWording.trim())) {
        throw new DomainError(Codes.GUARD_FAILED, "Automatic renewal needs the customer to agree to the exact wording on the plan, and you to confirm they did.", { reason: "consent_required" });
      }
      if (!args.paymentMethodRef?.trim()) throw new DomainError(Codes.GUARD_FAILED, "Automatic renewal needs a card on file.", { reason: "payment_method_required" });
      const customer = await tx.customer.findUniqueOrThrow({ where: { id: args.customerId }, select: { displayName: true } });
      const consent = await tx.consentRecord.create({
        data: {
          purpose: "auto_renewal",
          action: "grant",
          channel: c?.how ?? "in_person",
          policyVersionId: policy.versionId,
          wordingVersion: version.consentWordingVersion,
          recordedAt: uow.now,
          evidence: { wording: version.consentWording, planVersionId: version.id, customer: customer.displayName, how: c?.how ?? "in_person", note: c?.note?.trim() ?? "", price: money(version.priceMinor), billing: version.billingFrequency, termMonths: version.termMonths },
          actorKind: actor.kind === "agent" ? "agent" : actor.kind === "user" ? "user" : "system",
          actorId: actorAgentId(actor) ?? actorUserId(actor) ?? ""
        },
        select: { id: true }
      });
      consentId = consent.id;
    }
    const ref = await nextReference(tx, "MBR", uow.now);
    const membership = await tx.membership.create({
      data: {
        ref,
        publicCode: publicCode("MBR"),
        customerId: args.customerId,
        locationId: location.id,
        planId: plan.id,
        planVersionId: version.id,
        status: "pending_payment",
        startsOn: asDate(startsOn),
        paymentMethodRef: args.paymentMethodRef?.trim() ?? "",
        paymentMethodLabel: args.paymentMethodLabel?.trim().slice(0, 60) ?? "",
        autoRenew: wantsAuto,
        autoRenewConsentId: consentId,
        signupChannel: args.channel ?? "office",
        soldById: actorUserId(actor)
      },
      select: { id: true, ref: true }
    });
    const term = await writeTerm(uow, { id: membership.id, startsOn }, version, 1);
    auditCreate(uow, actor, "Membership", membership.id, "membership.sold", { ref, plan: plan.name, startsOn, autoRenew: wantsAuto, consentId });
    return { membershipId: membership.id, ref, termId: term.termId, firstChargeDue: startsOn };
  });
  return { replay: result.replay, ...result.value };
}
async function updatePaymentMethod(db, actor, args) {
  await authorizeOperation(db, actor, "membership.payment_method", SELL2, { ...args, paymentMethodRef: "[redacted]" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "membership.payment_method", actor, idempotencyKey, params: { ...params, paymentMethodRef: "[redacted]" }, now: args.now }, async (uow) => {
    const m = await lockRow(uow.tx, "Membership", args.membershipId);
    if (["cancelled", "transferred", "expired"].includes(m.status)) throw new DomainError(Codes.GUARD_FAILED, `This membership is ${m.status}.`);
    if (!/^pm_[A-Za-z0-9_]{6,100}$/.test(args.paymentMethodRef.trim())) throw new DomainError(Codes.INVALID_INPUT, "That is not a saved card reference.", { field: "paymentMethodRef" });
    await uow.tx.membership.update({ where: { id: m.id }, data: { paymentMethodRef: args.paymentMethodRef.trim(), paymentMethodLabel: text19(args.paymentMethodLabel, "paymentMethodLabel", 2, 60) } });
    auditCreate(uow, actor, "Membership", m.id, "membership.payment_method_set", { label: args.paymentMethodLabel });
    return { membershipId: m.id };
  });
  return { replay: result.replay, ...result.value };
}
async function debitEntitlement(uow, actor, args) {
  const { tx } = uow;
  const membership = await tx.membership.findUnique({ where: { id: args.membershipId }, select: { id: true, status: true, location: { select: { timeZone: true } } } });
  if (!membership) throw new DomainError(Codes.NOT_FOUND, "Membership not found.");
  if (!["active", "past_due"].includes(membership.status)) throw new DomainError(Codes.GUARD_FAILED, `This membership is ${membership.status.replace(/_/g, " ")}, so its visits cannot be used.`, { reason: "membership_not_usable" });
  const existing = await tx.entitlementEntry.findUnique({ where: { key: args.key }, select: { id: true, grantId: true } });
  if (existing) return { entryId: existing.id, grantId: existing.grantId, replay: true };
  const today = dayAt(membership.location?.timeZone ?? "America/Chicago", uow.now);
  const grants = await tx.entitlementGrant.findMany({ where: { membershipId: membership.id, code: args.code, windowStart: { lte: asDate(today) }, windowEnd: { gte: asDate(today) } }, orderBy: { windowEnd: "asc" }, select: { id: true } });
  if (!grants.length) throw new DomainError(Codes.GUARD_FAILED, "That is not included right now (out of season, or not on this plan).", { reason: "not_in_window" });
  for (const g of grants) {
    await lockRow(tx, "EntitlementGrant", g.id);
    if (await grantBalance(tx, g.id) > 0) {
      const entry = await tx.entitlementEntry.create({ data: { key: args.key, grantId: g.id, kind: "debit", quantity: -1, jobId: args.jobId ?? null, reason: args.reason ?? "", occurredAt: uow.now, createdById: actorUserId(actor) }, select: { id: true } });
      return { entryId: entry.id, grantId: g.id, replay: false };
    }
  }
  throw new DomainError(Codes.GUARD_FAILED, "None left on this membership for this period.", { reason: "none_left" });
}
async function restoreEntitlement(uow, actor, args) {
  const { tx } = uow;
  const debit = await tx.entitlementEntry.findUnique({ where: { id: args.debitEntryId }, select: { id: true, grantId: true, kind: true, jobId: true } });
  if (!debit || debit.kind !== "debit" || !debit.grantId) throw new DomainError(Codes.NOT_FOUND, "That use was not found.");
  const key2 = `restore:${debit.id}`;
  if (await tx.entitlementEntry.findUnique({ where: { key: key2 }, select: { id: true } })) return { restored: false };
  await lockRow(tx, "EntitlementGrant", debit.grantId);
  await tx.entitlementEntry.create({ data: { key: key2, grantId: debit.grantId, kind: "restore", quantity: 1, jobId: debit.jobId, reason: args.reason, occurredAt: uow.now, createdById: actorUserId(actor) } });
  return { restored: true };
}
async function bookVisit(db, actor, args) {
  await authorizeOperation(db, actor, "membership.visit_book", [...SELL2, "canBook"], args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "membership.visit_book", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const event = await lockRow(tx, "RecurringServiceEvent", args.eventId);
    if (event.status !== "open") throw new DomainError(Codes.GUARD_FAILED, event.status === "booked" ? "This visit is already booked." : "This visit was skipped.", { reason: "not_open" });
    const job = await tx.job.findFirst({ where: { ref: args.jobRef.trim().toUpperCase() }, select: { id: true, customerId: true, status: true, ref: true, poNumber: true, nteMinor: true } });
    if (!job) throw new DomainError(Codes.NOT_FOUND, "No job has that reference.", { field: "jobRef" });
    if (job.status === "cancelled") throw new DomainError(Codes.GUARD_FAILED, "That job is cancelled.");
    let entryId = null;
    if (event.membershipId) {
      const m = await tx.membership.findUniqueOrThrow({ where: { id: event.membershipId }, select: { customerId: true } });
      if (m.customerId !== job.customerId) throw new DomainError(Codes.GUARD_FAILED, "That job belongs to a different customer.", { field: "jobRef" });
      const used = await debitEntitlement(uow, actor, { membershipId: event.membershipId, code: event.code, key: `visit:${event.id}`, jobId: job.id, reason: `Booked on ${job.ref}` });
      entryId = used.entryId;
    } else if (event.agreementId) {
      const a = await tx.serviceAgreement.findUniqueOrThrow({ where: { id: event.agreementId }, select: { customerId: true, status: true, poNumber: true, nteMinor: true } });
      if (a.status !== "active") throw new DomainError(Codes.GUARD_FAILED, "The agreement is not active.");
      if (a.customerId !== job.customerId) throw new DomainError(Codes.GUARD_FAILED, "That job belongs to a different customer.", { field: "jobRef" });
      if (a.poNumber && job.poNumber && job.poNumber !== a.poNumber) throw new DomainError(Codes.GUARD_FAILED, `That job is on PO ${job.poNumber}; the agreement's PO is ${a.poNumber}.`, { reason: "po_mismatch" });
      const nte = a.nteMinor > 0n ? job.nteMinor && job.nteMinor > 0n && job.nteMinor < a.nteMinor ? job.nteMinor : a.nteMinor : job.nteMinor;
      await tx.job.update({ where: { id: job.id }, data: { poNumber: a.poNumber || job.poNumber, nteMinor: nte, version: { increment: 1 } } });
    }
    await casUpdate(uow, { model: "RecurringServiceEvent", id: event.id, version: event.version, from: ["open"], to: "booked", actor, eventType: "membership.visit_booked", data: { jobId: job.id } });
    return { eventId: event.id, jobId: job.id, entryId };
  });
  return { replay: result.replay, ...result.value };
}
async function releaseVisit(db, actor, args) {
  await authorizeOperation(db, actor, "membership.visit_release", [...SELL2, "canBook"], args);
  const reason = text19(args.reason, "reason", 3, 200);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "membership.visit_release", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const event = await lockRow(uow.tx, "RecurringServiceEvent", args.eventId);
    if (event.status !== "booked") throw new DomainError(Codes.GUARD_FAILED, "This visit is not booked.");
    const debit = await uow.tx.entitlementEntry.findUnique({ where: { key: `visit:${event.id}` }, select: { id: true } });
    if (debit) await restoreEntitlement(uow, actor, { debitEntryId: debit.id, reason });
    await casUpdate(uow, { model: "RecurringServiceEvent", id: event.id, version: event.version, from: ["booked"], to: "open", actor, eventType: "membership.visit_released", reason, data: { jobId: null } });
    return { eventId: event.id };
  });
  return { replay: result.replay, ...result.value };
}
async function renewInTx(uow, actor, membershipId, today) {
  const { tx } = uow;
  const m = await lockRow(tx, "Membership", membershipId);
  if (!["active", "past_due"].includes(m.status)) throw new DomainError(Codes.GUARD_FAILED, `A ${m.status.replace(/_/g, " ")} membership is not renewed.`, { reason: "not_renewable" });
  const last = await tx.membershipTerm.findFirstOrThrow({ where: { membershipId: m.id, status: "active" }, orderBy: { termNumber: "desc" }, include: { grants: true } });
  const version = await tx.membershipPlanVersion.findFirstOrThrow({ where: { planId: m.planId, status: "active" } });
  const n = last.termNumber + 1;
  const anchor = ymd(m.startsOn);
  if (termEnd(anchor, version.termMonths, n) < today) throw new DomainError(Codes.GUARD_FAILED, "This membership lapsed too long ago to renew. Sell a new one.", { reason: "lapsed" });
  const pending = await tx.membershipTerm.findFirst({ where: { membershipId: m.id, termNumber: n }, select: { id: true } });
  if (pending) throw new DomainError(Codes.GUARD_FAILED, "The next term already exists.", { reason: "already_renewed" });
  const term = await writeTerm(uow, { id: m.id, startsOn: anchor }, version, n);
  for (const prev of last.grants) {
    await lockRow(tx, "EntitlementGrant", prev.id);
    const left = await grantBalance(tx, prev.id);
    if (left <= 0) continue;
    await tx.entitlementEntry.create({ data: { key: `expire:${prev.id}`, grantId: prev.id, kind: "expire", quantity: -left, reason: "Term ended", occurredAt: uow.now, createdById: actorUserId(actor) } });
    if (prev.rolloverPolicy === "one_term") {
      const next = term.grants.find((g) => g.code === prev.code);
      const carry = next ? Math.min(left, prev.quantity) : 0;
      if (next && carry > 0) await tx.entitlementEntry.create({ data: { key: `rollover:${next.id}`, grantId: next.id, kind: "rollover", quantity: carry, reason: "Carried over from the last term", occurredAt: uow.now, createdById: actorUserId(actor) } });
    }
  }
  auditCreate(uow, actor, "Membership", m.id, "membership.renewed", { termNumber: n, start: term.start, end: term.end, planVersionId: version.id });
  return { termId: term.termId, termNumber: n, start: term.start, end: term.end };
}
async function renewMembership(db, actor, args) {
  await authorizeOperation(db, actor, "membership.renew", SELL2, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "membership.renew", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const m = await uow.tx.membership.findUnique({ where: { id: args.membershipId }, select: { location: { select: { timeZone: true } } } });
    if (!m) throw new DomainError(Codes.NOT_FOUND, "Membership not found.");
    return renewInTx(uow, actor, args.membershipId, dayAt(m.location?.timeZone ?? "America/Chicago", uow.now));
  });
  return { replay: result.replay, ...result.value };
}
function refundFor(rule2, paidMinor, term, day3) {
  if (paidMinor <= 0n || rule2.method === "none") return 0n;
  if (rule2.method === "prorata") {
    const { left, total } = termDaysLeft(term.start, term.end, day3);
    return prorate(paidMinor, left, total);
  }
  return day3 <= addDays(term.start, rule2.days) ? paidMinor : 0n;
}
async function cancelMembershipInTx(uow, actor, membershipId, reason, via) {
  const { tx } = uow;
  const m = await lockRow(tx, "Membership", membershipId);
  if (["cancelled", "transferred", "expired"].includes(m.status)) return { membershipId: m.id, ref: m.ref, status: m.status, refundOwedMinor: "0", already: true };
  const loc = await tx.membership.findUniqueOrThrow({ where: { id: m.id }, select: { location: { select: { timeZone: true } } } });
  const today = dayAt(loc.location?.timeZone ?? "America/Chicago", uow.now);
  const term = await tx.membershipTerm.findFirst({ where: { membershipId: m.id, status: "active", startsOn: { lte: asDate(today) }, endsOn: { gte: asDate(today) } }, orderBy: { termNumber: "desc" } });
  const version = term?.planVersionId ? await tx.membershipPlanVersion.findUnique({ where: { id: term.planVersionId } }) : null;
  let refund = 0n;
  if (term && version) {
    const paid = await tx.membershipBillingAttempt.aggregate({ where: { membershipId: m.id, termId: term.id, status: "succeeded" }, _sum: { amountMinor: true } });
    refund = refundFor({ method: version.cancellationRefundMethod, days: version.cancellationRefundDays }, paid._sum.amountMinor ?? 0n, { start: ymd(term.startsOn), end: ymd(term.endsOn) }, today);
  }
  await casUpdate(uow, { model: "Membership", id: m.id, version: m.version, from: [m.status], to: "cancelled", actor, eventType: "membership.cancelled", reason, data: { cancelledAt: uow.now, cancelReason: reason, cancelEffectiveOn: asDate(today), refundOwedMinor: refund }, audit: { via, refundOwedMinor: refund.toString() } });
  await tx.membershipTerm.updateMany({ where: { membershipId: m.id, status: "active", endsOn: { gte: asDate(today) } }, data: { status: "cancelled" } });
  await tx.recurringServiceEvent.updateMany({ where: { membershipId: m.id, status: "open" }, data: { status: "skipped" } });
  return { membershipId: m.id, ref: m.ref, status: "cancelled", refundOwedMinor: refund.toString(), already: false };
}
async function closeTermForRefund(uow, actor, a) {
  const { tx } = uow;
  const m = await lockRow(tx, "Membership", a.membershipId);
  const grants = await tx.entitlementGrant.findMany({ where: { membershipId: m.id, ...a.termId ? { termId: a.termId } : {} }, select: { id: true } });
  for (const g of grants) {
    await lockRow(tx, "EntitlementGrant", g.id);
    const left = await grantBalance(tx, g.id);
    if (left > 0) await tx.entitlementEntry.create({ data: { key: `refund:${g.id}`, grantId: g.id, kind: "expire", quantity: -left, reason: `Payment refunded: ${a.reason}`.slice(0, 200), occurredAt: uow.now, createdById: actorUserId(actor) } });
  }
  if (grants.length) await tx.recurringServiceEvent.updateMany({ where: { grantId: { in: grants.map((g) => g.id) }, status: "open" }, data: { status: "skipped" } });
  if (a.termId) await tx.membershipTerm.updateMany({ where: { id: a.termId, status: "active" }, data: { status: "cancelled" } });
  const liveTerms = await tx.membershipTerm.count({ where: { membershipId: m.id, status: "active" } });
  if (!liveTerms && !["cancelled", "transferred", "expired"].includes(m.status)) {
    const loc = await tx.membership.findUniqueOrThrow({ where: { id: m.id }, select: { location: { select: { timeZone: true } } } });
    await casUpdate(uow, { model: "Membership", id: m.id, version: m.version, from: [m.status], to: "cancelled", actor, eventType: "membership.cancelled", reason: a.reason, data: { cancelledAt: uow.now, cancelReason: `Payment refunded: ${a.reason}`.slice(0, 300), cancelEffectiveOn: asDate(dayAt(loc.location?.timeZone ?? "America/Chicago", uow.now)) }, audit: { via: "refund" } });
  }
  auditCreate(uow, actor, "Membership", m.id, "membership.term_closed_by_refund", { termId: a.termId, grants: grants.length });
}
async function cancelMembership(db, actor, args) {
  await authorizeOperation(db, actor, "membership.cancel", SELL2, args);
  const reason = text19(args.reason, "reason", 3, 300);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "membership.cancel", actor, idempotencyKey, params, now: args.now }, (uow) => cancelMembershipInTx(uow, actor, args.membershipId, reason, "staff"));
  return { replay: result.replay, ...result.value };
}
async function transferMembership(db, actor, args) {
  await authorizeOperation(db, actor, "membership.transfer", MANAGE, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "membership.transfer", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const old = await lockRow(tx, "Membership", args.membershipId);
    if (!["active", "past_due"].includes(old.status)) throw new DomainError(Codes.GUARD_FAILED, `A ${old.status.replace(/_/g, " ")} membership is not transferred.`);
    if (old.customerId === args.newCustomerId) throw new DomainError(Codes.INVALID_INPUT, "Choose the new owner, a different customer.", { field: "newCustomerId" });
    const locationId = args.newLocationId ?? old.locationId;
    const location = await tx.serviceLocation.findUnique({ where: { id: locationId ?? "" }, select: { id: true, customerId: true, timeZone: true } });
    if (!location || location.customerId !== args.newCustomerId) throw new DomainError(Codes.GUARD_FAILED, "Add the new owner at that address first.", { reason: "new_owner_not_at_address" });
    const today = dayAt(location.timeZone, uow.now);
    const term = await tx.membershipTerm.findFirst({ where: { membershipId: old.id, status: "active", startsOn: { lte: asDate(today) }, endsOn: { gte: asDate(today) } }, include: { grants: true } });
    if (!term) throw new DomainError(Codes.GUARD_FAILED, "There is no current term to hand over.", { reason: "no_current_term" });
    const ref = await nextReference(tx, "MBR", uow.now);
    const created = await tx.membership.create({
      data: { ref, publicCode: publicCode("MBR"), customerId: args.newCustomerId, locationId: location.id, planId: old.planId, planVersionId: term.planVersionId, status: "active", startsOn: old.startsOn, signupChannel: "office", soldById: actorUserId(actor) },
      select: { id: true }
    });
    const nextTerm = await tx.membershipTerm.create({
      data: { termKey: `${created.id}:${term.termNumber}`, membershipId: created.id, termNumber: term.termNumber, planVersionId: term.planVersionId, startsOn: term.startsOn, endsOn: term.endsOn, billingFrequency: term.billingFrequency, priceMinor: term.priceMinor, slots: term.slots, status: "active" },
      select: { id: true }
    });
    for (const g of term.grants) {
      await lockRow(tx, "EntitlementGrant", g.id);
      const left = await grantBalance(tx, g.id);
      if (left <= 0) continue;
      const grant = await tx.entitlementGrant.create({ data: { grantKey: `${nextTerm.id}:${g.code}`, membershipId: created.id, termId: nextTerm.id, code: g.code, name: g.name, quantity: left, windowStart: g.windowStart, windowEnd: g.windowEnd, rolloverPolicy: g.rolloverPolicy }, select: { id: true } });
      await tx.entitlementEntry.create({ data: { key: `transfer:${g.id}`, grantId: g.id, kind: "expire", quantity: -left, reason: `Handed over to ${ref}`, occurredAt: uow.now, createdById: actorUserId(actor) } });
      const open = await tx.recurringServiceEvent.findMany({ where: { grantId: g.id, status: "open" }, orderBy: { dueBy: "asc" }, take: left });
      for (const [i, e] of open.entries()) await tx.recurringServiceEvent.create({ data: { eventKey: `${grant.id}:${i}`, membershipId: created.id, grantId: grant.id, code: e.code, name: e.name, dueFrom: e.dueFrom, dueBy: e.dueBy, status: "open" } });
    }
    await tx.recurringServiceEvent.updateMany({ where: { membershipId: old.id, status: "open" }, data: { status: "skipped" } });
    await tx.membershipTerm.updateMany({ where: { membershipId: old.id, status: "active" }, data: { status: "cancelled" } });
    await casUpdate(uow, { model: "Membership", id: old.id, version: old.version, from: [old.status], to: "transferred", actor, eventType: "membership.transferred", data: { transferredToId: created.id, cancelledAt: uow.now, cancelReason: "Home sold", cancelEffectiveOn: asDate(today) } });
    auditCreate(uow, actor, "Membership", created.id, "membership.received_transfer", { from: old.ref, ref });
    return { oldMembershipId: old.id, membershipId: created.id, ref };
  });
  return { replay: result.replay, ...result.value };
}
async function activePlanCode(tx, customerId, locationId, on) {
  const rows = await tx.membership.findMany({
    where: { customerId, status: { in: ["active", "past_due"] }, ...locationId ? { locationId } : {} },
    select: { plan: { select: { code: true } }, location: { select: { timeZone: true } }, terms: { where: { status: "active" }, select: { startsOn: true, endsOn: true } } }
  });
  for (const r of rows) {
    const today = dayAt(r.location?.timeZone ?? "America/Chicago", on);
    if (r.terms.some((t) => ymd(t.startsOn) <= today && ymd(t.endsOn) >= today) && r.plan) return r.plan.code;
  }
  return null;
}

// features/keystone/services/cancellation.ts
init_actor();
init_approval();
init_cas();
init_errors();

// features/keystone/domain/cancellation-rights.ts
var CancellationRightsError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};
var KNOWN_EXCLUSIONS = /* @__PURE__ */ new Set(["retail_prior_negotiation", "tila_rescission", "emergency_waiver", "mail_or_phone_only", "requested_repair"]);
function thresholdFor(rule2, location) {
  if (location === "buyer_residence") return BigInt(rule2.thresholdAtResidenceMinor);
  if (location === "other_non_merchant") return rule2.thresholdElsewhereMinor === null ? null : BigInt(rule2.thresholdElsewhereMinor);
  return null;
}
var meets = (amount, threshold, comparison) => comparison === "at_least" ? amount >= threshold : amount > threshold;
function waiverValid(rule2, facts) {
  const w = facts.emergencyWaiver;
  if (!w?.present || !rule2.emergencyWaiver.allowed) return false;
  if (facts.initiatedBy !== "customer_request") return false;
  if (rule2.emergencyWaiver.handwritten && !w.handwritten) return false;
  if (rule2.emergencyWaiver.signedAndDated && !w.signedAndDated) return false;
  return true;
}
function linesInScope(rule2, facts, reasons) {
  const perLine = new Set(rule2.exclusions.filter((e) => e.perLine).map((e) => e.code));
  let lines = facts.lines.filter((line) => line.amountMinor > 0n);
  if (rule2.scope === "personal_solicitation") {
    if (facts.initiatedBy === "customer_request") {
      const before = lines.length;
      lines = lines.filter((line) => line.cancellationClass === "additional_goods_services");
      if (lines.length < before) reasons.push("requested_work_not_solicited");
    }
  } else if (perLine.has("requested_repair") && facts.initiatedBy === "customer_request") {
    const before = lines.length;
    lines = lines.filter((line) => line.cancellationClass === "additional_goods_services");
    if (lines.length < before) reasons.push("requested_repair_lines_excluded");
  }
  for (const exemption of rule2.exemptions) {
    if (exemption.when !== "consumer_initiated" || facts.initiatedBy !== "customer_request") continue;
    if ((facts.acrContext ?? []).some((code) => exemption.except.includes(code))) {
      reasons.push(`${exemption.code}_not_available`);
      continue;
    }
    const before = lines.length;
    lines = lines.filter((line) => !exemption.trades.includes(line.trade));
    if (lines.length < before) reasons.push(exemption.code);
  }
  return lines;
}
function evaluateRule(rule2, facts, calendar) {
  if (rule2.calendar !== calendar.code) throw new CancellationRightsError("POLICY_INVALID", `Rule ${rule2.code} counts business days on ${rule2.calendar}, but ${calendar.code} was supplied.`);
  for (const code of facts.exclusions ?? []) {
    if (!KNOWN_EXCLUSIONS.has(code)) throw new CancellationRightsError("INVALID_INPUT", `Unknown exclusion ${code}.`);
  }
  const reasons = [];
  const { transactionDate, lastDay, deadline } = cancelByDeadline(calendar, facts.transactionAt, facts.timeZone, rule2.businessDays);
  const base = {
    rule: rule2.code,
    title: rule2.title,
    comparison: rule2.thresholdComparison,
    businessDays: rule2.businessDays,
    transactionDate,
    noticeTemplate: rule2.noticeTemplate,
    refundBusinessDays: rule2.refundBusinessDays
  };
  const none = (why, threshold2 = null) => ({
    ...base,
    applies: false,
    reasons: [...reasons, why],
    coveredLineIds: [],
    coveredAmountMinor: "0",
    thresholdMinor: threshold2?.toString() ?? null,
    lastDay: null,
    cancelBy: null,
    waived: false
  });
  const threshold = thresholdFor(rule2, facts.location);
  if (threshold === null) return none(facts.location === "merchant_place" ? "at_merchant_place_of_business" : "not_a_covered_location");
  const ruleExclusions = new Set(rule2.exclusions.filter((e) => !e.perLine).map((e) => e.code));
  const whole = (facts.exclusions ?? []).find((code) => ruleExclusions.has(code) && code !== "emergency_waiver");
  if (whole) return none(`excluded_${whole}`, threshold);
  if (rule2.scope === "personal_solicitation" && facts.location === "remote") return none("not_personally_solicited", threshold);
  const lines = linesInScope(rule2, facts, reasons);
  const covered2 = lines.reduce((sum, line) => sum + line.amountMinor, 0n);
  if (!lines.length) return none("no_covered_lines", threshold);
  if (!meets(covered2, threshold, rule2.thresholdComparison)) return none(rule2.thresholdComparison === "at_least" ? "below_threshold" : "not_more_than_threshold", threshold);
  const waived = waiverValid(rule2, facts);
  if (facts.emergencyWaiver?.present && !waived) reasons.push(rule2.emergencyWaiver.allowed ? "emergency_waiver_incomplete" : "emergency_waiver_not_available");
  return {
    ...base,
    applies: true,
    reasons: [...reasons, waived ? "waived_by_buyer_emergency" : "right_applies"],
    coveredLineIds: lines.map((line) => line.id),
    coveredAmountMinor: covered2.toString(),
    thresholdMinor: threshold.toString(),
    lastDay,
    cancelBy: deadline.toISOString(),
    waived
  };
}
function evaluateCancellationRights(rules2, facts, calendars) {
  if (!facts.lines.length) throw new CancellationRightsError("INVALID_INPUT", "A sale needs at least one line.");
  if (facts.lines.some((line) => line.amountMinor < 0n)) throw new CancellationRightsError("INVALID_INPUT", "Line amounts must not be negative.");
  const results = rules2.rules.map((rule2) => {
    const calendar = calendars[rule2.calendar];
    if (!calendar) throw new CancellationRightsError("POLICY_INVALID", `No ${rule2.calendar} calendar is loaded for rule ${rule2.code}.`);
    return evaluateRule(rule2, facts, calendar);
  });
  const live = results.filter((r) => r.applies && !r.waived);
  const governing = [...live].sort((a, b) => b.cancelBy < a.cancelBy ? -1 : b.cancelBy > a.cancelBy ? 1 : b.coveredLineIds.length - a.coveredLineIds.length)[0] ?? null;
  const ids = new Set(live.flatMap((r) => r.coveredLineIds));
  const coveredAmount = facts.lines.filter((line) => ids.has(line.id)).reduce((sum, line) => sum + line.amountMinor, 0n);
  return {
    applies: live.length > 0,
    governing,
    results,
    coveredLineIds: facts.lines.filter((line) => ids.has(line.id)).map((line) => line.id),
    coveredAmountMinor: coveredAmount.toString(),
    language: facts.language ?? "en"
  };
}
var noticeRuleOf = (code) => code === "ftc_cooling_off" ? "ftc_16cfr429" : code === "tx_601" ? "tx_bcc_601" : "other";

// features/keystone/services/cancellation.ts
var CALENDARS = { "US-FEDERAL": US_FEDERAL };
var SELLERS = ["canSellEstimates", "canManageCustomers", "canBook"];
var OFFICE = ["canManageCustomers", "canBook", "canDispatch", "canManageInvoices"];
var OPEN = ["issued", "delivered"];
var rightsError = (error) => {
  if (error instanceof CancellationRightsError || error instanceof NoticeTextError) {
    throw new DomainError(error.code === "INVALID_INPUT" ? Codes.INVALID_INPUT : Codes.POLICY_INVALID, error.message);
  }
  throw error;
};
async function evaluateSaleRights(uow, actor, input) {
  const { tx } = uow;
  const loc = input.serviceLocation;
  const place = placeOfLocation(loc);
  const on = localDate({ timeZone: loc.timeZone }, input.transactionAt);
  const policy = await resolvePolicyFromDb(tx, "home_solicitation", place, on);
  const facts = {
    location: input.location,
    initiatedBy: input.initiatedBy,
    transactionAt: input.transactionAt,
    timeZone: loc.timeZone,
    lines: input.lines.map((l) => ({ id: l.id, amountMinor: l.amountMinor, trade: l.trade, cancellationClass: l.cancellationClass, description: l.description })),
    exclusions: input.exclusions,
    emergencyWaiver: input.emergencyWaiver ? { present: input.emergencyWaiver.present, handwritten: input.emergencyWaiver.handwritten, signedAndDated: input.emergencyWaiver.signedAndDated } : null,
    acrContext: input.acrContext,
    language: input.language
  };
  let result;
  try {
    result = evaluateCancellationRights(policy.rules, facts, CALENDARS);
  } catch (error) {
    return rightsError(error);
  }
  const waivedOnly = !result.applies && result.results.some((r) => r.applies && r.waived);
  const evaluation = await tx.cancellationEvaluation.create({
    data: {
      jobId: input.jobId,
      authorizationId: input.authorizationId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      policyVersionId: policy.versionId,
      inputs: { ...facts, transactionAt: facts.transactionAt.toISOString(), lines: facts.lines.map((l) => ({ ...l, amountMinor: l.amountMinor.toString() })), packCode: policy.packCode, place },
      results: result,
      rightApplies: result.applies,
      governingRule: result.governing?.rule ?? "",
      evaluatedAt: uow.now
    },
    select: { id: true }
  });
  auditCreate(uow, actor, "CancellationEvaluation", evaluation.id, "cancellation.evaluated", { subject: `${input.subjectType}:${input.subjectId}`, policyVersionId: policy.versionId, applies: result.applies, waived: waivedOnly, governing: result.governing?.rule ?? null, coveredAmountMinor: result.coveredAmountMinor });
  if (!result.applies && !waivedOnly) return { evaluationId: evaluation.id, applies: false, noticeId: null, reasons: result.results.map((r) => ({ rule: r.rule, reasons: r.reasons })) };
  const live = result.results.filter((r) => r.applies && (waivedOnly ? r.waived : !r.waived));
  const governing = waivedOnly ? live[0] : result.governing;
  const coveredIds = waivedOnly ? [...new Set(live.flatMap((r) => r.coveredLineIds))] : result.coveredLineIds;
  const covered2 = input.lines.filter((l) => coveredIds.includes(l.id));
  const coveredAmount = covered2.reduce((s, l) => s + l.amountMinor, 0n);
  const { block } = await sellerBlock(tx, input.businessUnitId, place.state, []);
  const fill = { sellerName: block.legalName || block.name, sellerAddress: block.address, transactionDate: noticeDate(governing.transactionDate), cancelByDate: noticeDate(governing.lastDay) };
  const templates = [...new Set(live.map((r) => r.noticeTemplate))];
  let notices;
  try {
    notices = templates.map((t) => noticeText(t, input.language, fill));
  } catch (error) {
    return rightsError(error);
  }
  const ref = await nextReference(tx, "NOC", uow.now);
  const snapshot = {
    ref,
    transactionDate: governing.transactionDate,
    cancelByDate: governing.lastDay,
    cancelBy: governing.cancelBy,
    timeZone: loc.timeZone,
    language: input.language,
    seller: { name: fill.sellerName, address: fill.sellerAddress },
    buyer: { name: input.buyerName, address: addressLine(loc) },
    notices,
    coveredLines: covered2.map((l) => ({ description: l.description, amountMinor: l.amountMinor.toString() })),
    coveredAmountMinor: coveredAmount.toString()
  };
  const notice = await tx.cancellationNotice.create({
    data: {
      ref,
      evaluationId: evaluation.id,
      jobId: input.jobId,
      customerId: input.customerId,
      estimateVersionId: input.estimateVersionId,
      changeOrderId: input.changeOrderId,
      rule: noticeRuleOf(governing.rule),
      rules: live.map((r) => ({ rule: r.rule, title: r.title, cancelBy: r.cancelBy, lastDay: r.lastDay, refundBusinessDays: r.refundBusinessDays, coveredLineIds: r.coveredLineIds, waived: r.waived })),
      policyVersionId: policy.versionId,
      noticeTemplate: governing.noticeTemplate,
      language: input.language,
      coveredWorkLines: { connect: coveredIds.map((id) => ({ id })) },
      coveredAmountMinor: coveredAmount,
      transactionAt: input.transactionAt,
      cancelBy: new Date(governing.cancelBy),
      timeZone: loc.timeZone,
      status: "issued",
      snapshot
    },
    select: { id: true, version: true }
  });
  const pdf = await storeRenderedPdf(uow, actor, { title: `${ref} notice of cancellation`, kind: "cancellation_notice", subjectType: "CancellationNotice", subjectId: notice.id, storageKey: `render:cancellation-notice/${notice.id}`, bytes: renderNoticePdf(snapshot) });
  await tx.cancellationNotice.update({ where: { id: notice.id }, data: { noticeDocumentId: pdf.documentId } });
  auditCreate(uow, actor, "CancellationNotice", notice.id, "cancellation_notice.issued", { ref, rule: governing.rule, cancelBy: governing.cancelBy, coveredAmountMinor: coveredAmount.toString(), coveredLines: coveredIds.length, templates, documentSha256: pdf.sha256 });
  if (waivedOnly) {
    const waiver = await recordWaiver(uow, actor, notice.id, ref, input.emergencyWaiver);
    await casUpdate(uow, { model: "CancellationNotice", id: notice.id, version: notice.version, from: ["issued"], to: "waived", actor, eventType: "cancellation_notice.waived", data: { waiverDocumentId: waiver.documentId }, audit: { waiverSha256: waiver.sha256 } });
  }
  return { evaluationId: evaluation.id, applies: !waivedOnly, waived: waivedOnly, noticeId: notice.id, ref, cancelBy: governing.cancelBy, coveredAmountMinor: coveredAmount.toString(), documentId: pdf.documentId };
}
async function recordWaiver(uow, actor, noticeId, ref, waiver) {
  const statement = waiver.statement?.trim();
  if (!statement) throw new DomainError(Codes.INVALID_INPUT, "Transcribe the buyer's handwritten emergency statement.", { field: "emergencyWaiver.statement" });
  if (!waiver.mediaRef?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Attach the photo or scan of the buyer's handwritten statement.", { field: "emergencyWaiver.mediaRef" });
  return storeRecordedDocument(uow, actor, { title: `${ref} emergency waiver`, kind: "emergency_waiver", subjectType: "CancellationNotice", subjectId: noticeId, storageKey: `media:${waiver.mediaRef.trim()}`, content: statement, mimeType: "text/plain" });
}
async function unrefundedPayments(tx, evaluationId) {
  if (!evaluationId) return [];
  const rows = await tx.payment.findMany({
    where: { authorization: { from_CancellationEvaluation_authorization: { some: { id: evaluationId } } } },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
    select: { id: true, ref: true, amountMinor: true, refunds: { select: { amountMinor: true } } }
  });
  return rows.map((p) => ({ id: p.id, ref: p.ref, remainingMinor: p.amountMinor - p.refunds.reduce((sum, r) => sum + r.amountMinor, 0n) })).filter((p) => p.remainingMinor > 0n);
}
async function lockNotice(tx, id, expectedVersion) {
  const [row] = await tx.$queryRaw`SELECT id, ref, status, version, job, "cancelBy", "transactionAt", "timeZone", rules, evaluation, "startOverride", "estimateVersion" FROM "CancellationNotice" WHERE id = ${id} FOR UPDATE`;
  if (!row) throw new DomainError(Codes.NOT_FOUND, "Cancellation notice not found.");
  if (expectedVersion !== void 0 && expectedVersion !== null && row.version !== expectedVersion) throw new DomainError(Codes.STALE_STATE, "This notice changed since you loaded it. Reload and try again.", { currentStatus: row.status, currentVersion: row.version });
  return row;
}
async function assertNoticeAccess(tx, actor, jobId) {
  if (actor.kind !== "user" || OFFICE.some((p) => can(actor, p))) return;
  if (await tx.visitAssignment.count({ where: { active: true, visit: { jobId }, employee: { userId: actor.userId } } })) return;
  throw new DomainError(Codes.NOT_AUTHORIZED, "This notice is on a job you are not assigned to.");
}
var DELIVERY = ["signed_on_device", "emailed", "printed_acknowledged", "handed_paper_copy"];
async function deliverCancellationNotice(db, actor, args) {
  await authorizeOperation(db, actor, "cancellation.deliver", SELLERS, args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "A person records delivery of a notice.");
  if (!DELIVERY.includes(args.method)) throw new DomainError(Codes.INVALID_INPUT, `Delivery is one of ${DELIVERY.join(", ")}.`, { field: "method" });
  if (!args.acknowledgedBy?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Who received the notice?", { field: "acknowledgedBy" });
  if (args.method === "signed_on_device" && (args.signature === void 0 || args.signature === null || args.signature === "")) throw new DomainError(Codes.INVALID_INPUT, "Capture the buyer's signature acknowledging the notice.", { field: "signature" });
  if (args.method === "emailed" && !args.messageId) throw new DomainError(Codes.INVALID_INPUT, "Link the sent email.", { field: "messageId" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "cancellation.deliver", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const row = await lockNotice(uow.tx, args.noticeId, args.expectedVersion);
    if (row.status !== "issued") throw new DomainError(Codes.INVALID_TRANSITION, `A ${row.status.replaceAll("_", " ")} notice can't be delivered.`, { currentStatus: row.status });
    await assertNoticeAccess(uow.tx, actor, row.job);
    if (args.messageId) {
      const message = await uow.tx.message.findUnique({ where: { id: args.messageId }, select: { status: true } });
      if (!message || !["sent", "delivered"].includes(message.status)) throw new DomainError(Codes.GUARD_FAILED, "That email has not been sent.", { reason: "message_not_sent" });
    }
    const evidence = { method: args.method, acknowledgedBy: args.acknowledgedBy.trim(), signature: args.signature ?? null, messageId: args.messageId ?? null, recordedBy: actorUserId(actor), at: uow.now.toISOString() };
    const version = await casUpdate(uow, { model: "CancellationNotice", id: row.id, version: row.version, from: ["issued"], to: "delivered", actor, eventType: "cancellation_notice.delivered", data: { deliveryEvidence: evidence, deliveredAt: uow.now }, audit: { method: args.method } });
    return { noticeId: row.id, version, status: "delivered" };
  });
  return { replay: result.replay, ...result.value };
}
async function waiveCancellationNotice(db, actor, args) {
  await authorizeOperation(db, actor, "cancellation.waive", SELLERS, args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "A person records a waiver.");
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "cancellation.waive", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const row = await lockNotice(tx, args.noticeId, args.expectedVersion);
    if (!OPEN.includes(row.status)) throw new DomainError(Codes.INVALID_TRANSITION, `A ${row.status.replaceAll("_", " ")} notice can't be waived.`, { currentStatus: row.status });
    if (uow.now.getTime() >= row.cancelBy.getTime()) throw new DomainError(Codes.GUARD_FAILED, "The cancellation window has closed.", { reason: "window_closed" });
    await assertNoticeAccess(tx, actor, row.job);
    const evaluation = await tx.cancellationEvaluation.findUniqueOrThrow({ where: { id: row.evaluation }, select: { inputs: true, policyVersionId: true } });
    const inputs = evaluation.inputs;
    if (inputs.initiatedBy !== "customer_request") throw new DomainError(Codes.GUARD_FAILED, "Only a buyer who called for an emergency can waive the right.", { reason: "not_buyer_initiated" });
    const version = await tx.policyVersion.findUniqueOrThrow({ where: { id: evaluation.policyVersionId }, select: { rules: true } });
    const policyRules = version.rules.rules;
    for (const r of row.rules) {
      const rule2 = policyRules.find((p) => p.code === r.rule);
      if (!rule2?.emergencyWaiver.allowed) throw new DomainError(Codes.GUARD_FAILED, `${rule2?.title ?? r.rule} can't be waived; the buyer keeps the right to cancel.`, { reason: "waiver_not_available", rule: r.rule });
      if (rule2.emergencyWaiver.handwritten && !args.waiver.handwritten || rule2.emergencyWaiver.signedAndDated && !args.waiver.signedAndDated) throw new DomainError(Codes.GUARD_FAILED, "The waiver must be the buyer's own handwritten statement, signed and dated.", { reason: "waiver_incomplete" });
    }
    const waiver = await recordWaiver(uow, actor, row.id, row.ref, { ...args.waiver, present: true });
    const next = await casUpdate(uow, { model: "CancellationNotice", id: row.id, version: row.version, from: OPEN, to: "waived", actor, eventType: "cancellation_notice.waived", data: { waiverDocumentId: waiver.documentId }, audit: { waiverSha256: waiver.sha256 } });
    return { noticeId: row.id, version: next, status: "waived" };
  });
  return { replay: result.replay, ...result.value };
}
var RECEIVED_VIA = ["signed_form", "mail", "email", "in_person", "portal"];
async function recordBuyerCancellation(db, actor, args) {
  await authorizeOperation(db, actor, "cancellation.record_buyer_cancel", OFFICE, args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "A person records a buyer's cancellation.");
  if (!RECEIVED_VIA.includes(args.via)) throw new DomainError(Codes.INVALID_INPUT, `Received via one of ${RECEIVED_VIA.join(", ")}.`, { field: "via" });
  const sentAt = new Date(args.sentAt);
  if (Number.isNaN(sentAt.getTime())) throw new DomainError(Codes.INVALID_INPUT, "When did the buyer send it?", { field: "sentAt" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "cancellation.record_buyer_cancel", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const row = await lockNotice(tx, args.noticeId, args.expectedVersion);
    if (!OPEN.includes(row.status)) throw new DomainError(Codes.INVALID_TRANSITION, `A ${row.status.replaceAll("_", " ")} notice can't be cancelled.`, { currentStatus: row.status });
    if (sentAt.getTime() > uow.now.getTime()) throw new DomainError(Codes.INVALID_INPUT, "The send time is in the future.", { field: "sentAt" });
    if (sentAt.getTime() < row.transactionAt.getTime()) throw new DomainError(Codes.INVALID_INPUT, "The send time is before the sale.", { field: "sentAt" });
    if (sentAt.getTime() >= row.cancelBy.getTime()) throw new DomainError(Codes.GUARD_FAILED, "This was sent after the cancellation deadline. Handle it as a customer-service cancellation, not a cooling-off cancellation.", { reason: "after_deadline", cancelBy: row.cancelBy.toISOString() });
    const paid = (await unrefundedPayments(tx, row.evaluation)).reduce((sum, p) => sum + p.remainingMinor, 0n);
    const covered2 = await tx.workLine.findMany({ where: { cancellationNotices: { some: { id: row.id } } }, select: { id: true, version: true, status: true, amountMinor: true } });
    const cancelled = [];
    for (const w of covered2) {
      if (!["planned", "completed"].includes(w.status)) continue;
      await casUpdate(uow, { model: "WorkLine", id: w.id, version: w.version, from: ["planned", "completed"], to: "cancelled_by_buyer", actor, eventType: "work_line.cancelled_by_buyer", metadata: { noticeId: row.id } });
      cancelled.push(w.id);
    }
    const days = Math.min(...row.rules.filter((r) => !r.waived).map((r) => r.refundBusinessDays));
    const cal = inZone(US_FEDERAL, row.timeZone);
    const lastRefundDay = addBusinessDays(cal, localDate(cal, sentAt), Number.isFinite(days) ? days : 10);
    const refundDueBy = zonedInstant(row.timeZone, addDays(lastRefundDay, 1), "00:00");
    const version = await casUpdate(uow, {
      model: "CancellationNotice",
      id: row.id,
      version: row.version,
      from: OPEN,
      to: "cancelled_by_buyer",
      actor,
      eventType: "cancellation_notice.cancelled_by_buyer",
      reason: args.note ?? null,
      data: { cancelledAt: sentAt, cancellationReceivedVia: args.via, refundDueBy, refundDueMinor: paid },
      audit: { via: args.via, sentAt: sentAt.toISOString(), refundDueBy: lastRefundDay, refundDueMinor: paid.toString(), workLines: cancelled.length }
    });
    if (row.estimateVersion) {
      const remaining = await tx.workLine.count({ where: { estimateLine: { option: { estimateVersionId: row.estimateVersion } }, status: { in: ["planned", "completed"] } } });
      if (!remaining) {
        const ev = await tx.estimateVersion.findUniqueOrThrow({ where: { id: row.estimateVersion }, select: { id: true, version: true, status: true, estimateId: true } });
        if (ev.status === "sold") {
          await casUpdate(uow, { model: "EstimateVersion", id: ev.id, version: ev.version, from: ["sold"], to: "cancelled", actor, eventType: "estimate_version.cancelled_by_buyer", metadata: { noticeId: row.id } });
          if (ev.estimateId) await tx.estimate.update({ where: { id: ev.estimateId }, data: { status: "cancelled", version: { increment: 1 } } });
        }
      }
    }
    await tx.task.upsert({
      where: { dedupeKey: `cancellation.refund:${row.id}` },
      create: { kind: "cancellation.refund", title: `${row.ref}: buyer cancelled. ${paid > 0n ? "Refund the payment and " : ""}release any security interest by ${lastRefundDay}; cancel the scheduled work.`.slice(0, 200), subjectType: "CancellationNotice", subjectId: row.id, status: "open", priority: "high", dueAt: refundDueBy, dedupeKey: `cancellation.refund:${row.id}` },
      update: {}
    });
    return { noticeId: row.id, version, status: "cancelled_by_buyer", refundDueBy: lastRefundDay, workLineIds: cancelled };
  });
  return { replay: result.replay, ...result.value };
}
async function markCancellationRefunded(db, actor, args) {
  await authorizeOperation(db, actor, "cancellation.refunded", ["canIssueRefunds", "canManagePayments"], args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "A person records refunds.");
  const e = args.evidence;
  if (!e || !["processor_refund", "check", "nothing_paid"].includes(e.method)) throw new DomainError(Codes.INVALID_INPUT, "Refund evidence is a processor refund, a check, or nothing was paid.", { field: "evidence.method" });
  if (!/^\d{1,13}$/.test(e.amountMinor ?? "")) throw new DomainError(Codes.INVALID_INPUT, "Amount is whole cents.", { field: "evidence.amountMinor" });
  if (e.method !== "nothing_paid" && !e.reference?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Give the refund or check reference.", { field: "evidence.reference" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "cancellation.refunded", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const row = await lockNotice(uow.tx, args.noticeId, args.expectedVersion);
    if (row.status !== "cancelled_by_buyer") throw new DomainError(Codes.INVALID_TRANSITION, `A ${row.status.replaceAll("_", " ")} notice has no refund to record.`, { currentStatus: row.status });
    const due = await uow.tx.cancellationNotice.findUniqueOrThrow({ where: { id: row.id }, select: { refundDueMinor: true } });
    const amount = BigInt(e.amountMinor);
    if (amount !== due.refundDueMinor) throw new DomainError(Codes.GUARD_FAILED, `The refund must be the full amount paid (${due.refundDueMinor.toString()}\xA2).`, { reason: "refund_amount_mismatch" });
    if (e.method === "nothing_paid" !== (amount === 0n)) throw new DomainError(Codes.INVALID_INPUT, '"Nothing paid" means an amount of zero.', { field: "evidence.method" });
    const refunded = [];
    if (amount > 0n) {
      const payments = await unrefundedPayments(uow.tx, row.evaluation);
      const refundable = payments.reduce((sum, p) => sum + p.remainingMinor, 0n);
      if (refundable !== amount) throw new DomainError(Codes.GUARD_FAILED, `The payments on this sale leave ${refundable.toString()}\xA2 to refund, not ${amount.toString()}\xA2.`, { reason: "refund_payments_mismatch", refundableMinor: refundable.toString() });
      for (const p of payments) {
        const ref = await nextReference(uow.tx, "RFD", uow.now);
        await uow.tx.refund.create({ data: { ref, paymentId: p.id, noticeId: row.id, method: e.method, amountMinor: p.remainingMinor, reference: e.reference.trim(), refundedAt: uow.now, recordedById: actorUserId(actor) } });
        auditCreate(uow, actor, "Refund", ref, "refund.recorded", { noticeId: row.id, paymentRef: p.ref, amountMinor: p.remainingMinor.toString(), method: e.method, reference: e.reference.trim() });
        refunded.push({ ref, paymentRef: p.ref, amountMinor: p.remainingMinor.toString() });
      }
    }
    const version = await casUpdate(uow, { model: "CancellationNotice", id: row.id, version: row.version, from: ["cancelled_by_buyer"], to: "refunded", actor, eventType: "cancellation_notice.refunded", data: { refundEvidence: { ...e, recordedBy: actorUserId(actor), at: uow.now.toISOString() } }, audit: { method: e.method, amountMinor: e.amountMinor } });
    await uow.tx.task.updateMany({ where: { dedupeKey: `cancellation.refund:${row.id}`, status: "open" }, data: { status: "done", closedAt: uow.now, closedById: actorUserId(actor), resolution: "Refund recorded", version: { increment: 1 } } });
    return { noticeId: row.id, version, status: "refunded", refunds: refunded };
  });
  return { replay: result.replay, ...result.value };
}
async function expireCancellationNotices(db, now = /* @__PURE__ */ new Date()) {
  const due = await db.cancellationNotice.findMany({ where: { status: { in: OPEN }, cancelBy: { lte: now } }, select: { id: true, ref: true, status: true }, take: 200 });
  let expired = 0;
  let undelivered = 0;
  for (const n of due) {
    if (n.status === "issued") {
      await db.task.upsert({ where: { dedupeKey: `cancellation.undelivered:${n.id}` }, create: { kind: "cancellation.undelivered", title: `${n.ref}: the notice of cancellation was never recorded as delivered. Deliver it; the buyer's right continues until then.`.slice(0, 200), subjectType: "CancellationNotice", subjectId: n.id, status: "open", priority: "high", dedupeKey: `cancellation.undelivered:${n.id}` }, update: {} });
      undelivered += 1;
      continue;
    }
    const actor = { kind: "system", name: "cancellation-expiry" };
    const r = await command(db, { name: "cancellation.expire", actor, idempotencyKey: `cancellation-expire:${n.id}`, params: { noticeId: n.id }, now }, async (uow) => {
      const row = await lockNotice(uow.tx, n.id);
      if (row.status !== "delivered" || row.cancelBy.getTime() > now.getTime()) return false;
      await casUpdate(uow, { model: "CancellationNotice", id: row.id, version: row.version, from: ["delivered"], to: "expired_uncancelled", actor, eventType: "cancellation_notice.expired" });
      return true;
    });
    if (r.value) expired += 1;
  }
  return { expired, undelivered };
}
async function cancellationHoldsFor(db, jobId, now) {
  const notices = await db.cancellationNotice.findMany({
    where: { jobId, status: { in: OPEN } },
    select: { id: true, ref: true, status: true, cancelBy: true, startOverrideId: true, startOverride: { select: { status: true } }, coveredWorkLines: { select: { id: true, status: true } } }
  });
  return notices.filter((n) => !(n.startOverride?.status === "approved")).filter((n) => n.status === "issued" || n.cancelBy.getTime() > now.getTime()).map((n) => ({ id: n.id, ref: n.ref, status: n.status, cancelBy: n.cancelBy, lineIds: n.coveredWorkLines.filter((w) => w.status === "planned").map((w) => w.id) })).filter((n) => n.lineIds.length > 0);
}
async function assertCanStartWork(tx, jobId, now) {
  const holds = await cancellationHoldsFor(tx, jobId, now);
  if (!holds.length) return { holds: [] };
  const held = new Set(holds.flatMap((h) => h.lineIds));
  const free = await tx.workLine.count({ where: { jobId, status: "planned", id: { notIn: [...held] } } });
  if (free > 0) return { holds };
  const first = holds.sort((a, b) => a.cancelBy.getTime() - b.cancelBy.getTime())[0];
  throw new DomainError(
    Codes.GUARD_FAILED,
    first.status === "issued" ? `The buyer's notice of cancellation (${first.ref}) hasn't been recorded as delivered, so the work it covers can't start.` : `The buyer can still cancel this work until ${first.cancelBy.toISOString()} (${first.ref}). Wait, record an emergency waiver, or ask a manager to approve starting early.`,
    { reason: "cancellation_hold", noticeId: first.id, cancelBy: first.cancelBy.toISOString() }
  );
}
var MIN_OVERRIDE_REASON = 10;
async function assertMayRequestOverride(tx, actor, jobId) {
  if (actor.kind !== "user") throw new DomainError(Codes.NOT_AUTHORIZED, "A person asks to start early.");
  if (actor.permissions.has("canDispatch")) return;
  const assigned = await tx.visit.count({ where: { jobId, assignments: { some: { active: true, employee: { user: { id: { equals: actor.userId } } } } } } });
  if (!assigned) throw new DomainError(Codes.NOT_AUTHORIZED, "Only the technician assigned to this job, or dispatch, can ask to start early.");
}
async function requestCancellationHoldOverride(db, actor, args) {
  await authorizeOperation(db, actor, "cancellation.override_hold", ["canDispatch", "canSellEstimates"], args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "Agents do not override cancellation holds.");
  const reasonText = args.reason?.trim() ?? "";
  if (reasonText.length < MIN_OVERRIDE_REASON) throw new DomainError(Codes.INVALID_INPUT, `Say why the work must start before the window closes (at least ${MIN_OVERRIDE_REASON} characters).`, { field: "reason" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "cancellation.override_hold", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const row = await lockNotice(uow.tx, args.noticeId, args.expectedVersion);
    if (!OPEN.includes(row.status)) throw new DomainError(Codes.INVALID_TRANSITION, `A ${row.status.replaceAll("_", " ")} notice holds nothing back.`, { currentStatus: row.status });
    await assertMayRequestOverride(uow.tx, actor, row.job);
    if (row.startOverride) {
      const existing = await uow.tx.approvalRequest.findUnique({ where: { id: row.startOverride }, select: { status: true } });
      if (existing && ["pending", "approved"].includes(existing.status)) throw new DomainError(Codes.GUARD_FAILED, `An override is already ${existing.status}.`, { reason: "override_exists" });
    }
    const approval = await requestApproval(uow, actor, { action: "cancellation.start_override", targetList: "CancellationNotice", targetId: row.id, requiredPermission: "canApprovePolicies", payload: { noticeId: row.id, cancelBy: row.cancelBy.toISOString(), reason: args.reason.trim() }, summary: `${row.ref}: start covered work before ${row.cancelBy.toISOString()} \u2014 ${args.reason.trim()}` });
    const version = await casUpdate(uow, { model: "CancellationNotice", id: row.id, version: row.version, from: OPEN, to: row.status, actor, eventType: "cancellation_notice.override_requested", reason: args.reason, data: { startOverrideId: approval.id }, audit: { approvalId: approval.id } });
    return { noticeId: row.id, version, approvalRequestId: approval.id };
  });
  return { replay: result.replay, ...result.value };
}
registerApplier("cancellation.start_override", async (uow, actor, request) => {
  const row = await lockNotice(uow.tx, request.targetId);
  if (row.startOverride !== request.id) throw new DomainError(Codes.APPROVAL_MISMATCH, "A different override is on this notice now.");
  auditCreate(uow, actor, "CancellationNotice", row.id, "cancellation_notice.override_approved", { approvalRequestId: request.id });
  return { noticeId: row.id, overridden: true };
});

// features/keystone/services/estimates.ts
var PRESENT = ["canPresentEstimates"];
var SELL3 = ["canSellEstimates"];
var OFFICE2 = [...OFFICE_READ, "canManagePriceBook"];
var fail2 = (error) => {
  if (error instanceof PricingError) throw new DomainError(error.code === "GUARD_FAILED" ? Codes.GUARD_FAILED : Codes.INVALID_INPUT, error.message, error.details);
  throw error;
};
var ESTIMATE_SELECT = {
  id: true,
  ref: true,
  title: true,
  status: true,
  version: true,
  source: true,
  jobId: true,
  opportunityId: true,
  customerId: true,
  businessUnitId: true,
  currentVersionId: true,
  createdById: true,
  presentedBy: { select: { userId: true } },
  customer: { select: { id: true, displayName: true, primaryContact: { select: { preferredLanguage: true } } } },
  location: { select: { id: true, address1: true, address2: true, city: true, state: true, postalCode: true, timeZone: true, propertyClass: true } },
  job: { select: { id: true, ref: true, businessUnitId: true, status: true } }
};
async function loadEstimate(db, estimateId) {
  const row = await db.estimate.findUnique({ where: { id: estimateId }, select: ESTIMATE_SELECT });
  if (!row) throw new DomainError(Codes.NOT_FOUND, "Estimate not found.");
  return row;
}
async function assertEstimateAccess(tx, actor, est) {
  if (actor.kind !== "user") return;
  if (OFFICE2.some((p) => can(actor, p))) return;
  if (est.createdById === actor.userId || est.presentedBy?.userId === actor.userId) return;
  if (est.jobId && await tx.visitAssignment.count({ where: { active: true, visit: { jobId: est.jobId }, employee: { userId: actor.userId } } })) return;
  throw new DomainError(Codes.NOT_AUTHORIZED, "This estimate is on a job you are not assigned to.");
}
async function lockEstimateVersion(tx, versionId, expectedVersion) {
  const [row] = await tx.$queryRaw`SELECT id, status, version, estimate, "versionNumber", "priceBookVersion", "discountBps", "discountApproval", "validUntil" FROM "EstimateVersion" WHERE id = ${versionId} FOR UPDATE`;
  if (!row) throw new DomainError(Codes.NOT_FOUND, "Estimate version not found.");
  if (expectedVersion !== void 0 && expectedVersion !== null && row.version !== expectedVersion) throw new DomainError(Codes.STALE_STATE, "This estimate changed since you loaded it. Reload and try again.", { currentStatus: row.status, currentVersion: row.version });
  return row;
}
var requireStatus = (row, allowed, to) => {
  if (!allowed.includes(row.status)) throw new DomainError(Codes.INVALID_TRANSITION, `A ${row.status.replaceAll("_", " ")} estimate can't be ${to}.`, { currentStatus: row.status });
};
async function discountLimitBps(tx, actor) {
  if (actor.kind !== "user") return 0;
  const user = await tx.user.findUnique({ where: { id: actor.userId }, select: { roleId: true } });
  const limit = user?.roleId ? await tx.roleLimit.findFirst({ where: { roleId: user.roleId, kind: "discount_bps" }, select: { limit: true } }) : null;
  if (limit) return Number(limit.limit);
  const company = await tx.companySettings.findFirst({ select: { discountApprovalThresholdBps: true } });
  return company?.discountApprovalThresholdBps ?? 0;
}
async function taxContext(tx, est, on) {
  const loc = est.location;
  if (!loc) throw new DomainError(Codes.GUARD_FAILED, "Add the service address before pricing; sales tax depends on it.", { reason: "no_location" });
  const place = placeOfLocation(loc);
  const policy = await resolvePolicyFromDb(tx, "sales_tax", place, localDate({ timeZone: loc.timeZone }, on));
  const company = await tx.companySettings.findFirst({ select: { features: true } });
  const mode = company?.features?.contractTaxMode === "separated" ? "separated" : "lump_sum";
  return { propertyClass: loc.propertyClass, contractTaxMode: mode, cityCode: place.city, rules: policy.rules };
}
async function recomputeOption(uow, optionId, discountBps, tax) {
  const { tx } = uow;
  const option2 = await tx.estimateOption.findUniqueOrThrow({ where: { id: optionId }, select: { id: true, tier: true, name: true } });
  const lines = await tx.estimateLine.findMany({ where: { optionId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  let totals;
  let taxed;
  try {
    totals = optionTotals(lines.map((l) => ({ amountMinor: l.amountMinor, costMinor: l.costMinor })), discountBps);
    taxed = estimateSalesTax(lines.map((l, i) => ({ taxCategory: l.taxCategory, netMinor: l.amountMinor - totals.lineDiscounts[i], costMinor: l.costMinor })), tax);
  } catch (error) {
    return fail2(error);
  }
  for (const [i, l] of lines.entries()) if (l.discountMinor !== totals.lineDiscounts[i]) await tx.estimateLine.update({ where: { id: l.id }, data: { discountMinor: totals.lineDiscounts[i] } });
  const totalMinor = totals.subtotalMinor - totals.discountMinor + taxed.taxMinor;
  const contentHash = optionHash({
    tier: option2.tier,
    name: option2.name,
    subtotalMinor: totals.subtotalMinor,
    discountMinor: totals.discountMinor,
    totalMinor,
    lines: lines.map((l, i) => ({ ...l.snapshot, id: l.id, amountMinor: l.amountMinor, discountMinor: totals.lineDiscounts[i] }))
  });
  await tx.estimateOption.update({ where: { id: optionId }, data: { subtotalMinor: totals.subtotalMinor, discountMinor: totals.discountMinor, estimatedTaxMinor: taxed.taxMinor, totalMinor, contentHash } });
  return { optionId, subtotalMinor: totals.subtotalMinor, discountMinor: totals.discountMinor, estimatedTaxMinor: taxed.taxMinor, totalMinor, marginBps: totals.marginBps, contentHash };
}
async function discountBinding(tx, versionId, discountBps) {
  const options = await tx.estimateOption.findMany({ where: { estimateVersionId: versionId }, orderBy: { id: "asc" }, include: { lines: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } });
  const discountMinor = options.reduce((m, o) => o.discountMinor > m ? o.discountMinor : m, 0n);
  const bindingHash = payloadHash({
    discountBps,
    options: options.map((o) => ({ id: o.id, tier: o.tier, subtotal: o.subtotalMinor.toString(), discount: o.discountMinor.toString(), lines: o.lines.map((l) => [l.itemKey, l.quantity.toString(), l.unitPriceMinor.toString(), l.amountMinor.toString(), l.discountMinor.toString()]) }))
  });
  return { discountMinor: discountMinor.toString(), bindingHash };
}
async function voidDiscountApproval(uow, actor, row, why) {
  if (!row.discountApproval) return;
  await uow.tx.estimateVersion.update({ where: { id: row.id }, data: { discountApprovalId: null } });
  uow.audit({ eventType: "estimate_version.discount_approval_voided", entityType: "EstimateVersion", entityId: row.id, actorUserId: actorUserId(actor), actorAgentId: actorAgentId(actor), reason: why, before: { approvalId: row.discountApproval, discountBps: row.discountBps }, after: { approvalId: null }, metadata: {} });
}
var TIERS = ["good", "better", "best", "single", "custom"];
async function writeOption(uow, est, version, input, tax, sortOrder) {
  const { tx } = uow;
  if (!TIERS.includes(input.tier)) throw new DomainError(Codes.INVALID_INPUT, `Tier must be one of ${TIERS.join(", ")}.`, { field: "tier" });
  const name = input.name?.trim();
  if (!name) throw new DomainError(Codes.INVALID_INPUT, "Name the option.", { field: "name" });
  if (input.memberPricing) {
    const plan = est.customerId ? await activePlanCode(tx, est.customerId, est.location?.id ?? null, uow.now) : null;
    if (!plan) throw new DomainError(Codes.GUARD_FAILED, "This customer has no active membership, so member prices do not apply.", { reason: "no_active_membership" });
  }
  const active = await activeVersionFor(tx, est.businessUnitId ?? est.job?.businessUnitId ?? null);
  if (version.priceBookVersion && version.priceBookVersion !== active.versionId) {
    throw new DomainError(Codes.GUARD_FAILED, "A new price book is active since this estimate was started. Re-price it first.", { reason: "pricebook_changed" });
  }
  if (!version.priceBookVersion) await tx.estimateVersion.update({ where: { id: version.id }, data: { priceBookVersionId: active.versionId } });
  const quoted = await quoteFromVersion(tx, active.versionId, input.lines, !!input.memberPricing);
  let optionId = input.optionId ?? null;
  if (optionId) {
    const existing = await tx.estimateOption.findFirst({ where: { id: optionId, estimateVersionId: version.id }, select: { id: true } });
    if (!existing) throw new DomainError(Codes.NOT_FOUND, "That option is not on this estimate version.", { field: "optionId" });
    await tx.estimateLine.deleteMany({ where: { optionId } });
    await tx.estimateOption.update({ where: { id: optionId }, data: { tier: input.tier, name, description: input.description?.trim() ?? "" } });
  } else {
    optionId = (await tx.estimateOption.create({ data: { estimateVersionId: version.id, tier: input.tier, name, description: input.description?.trim() ?? "", sortOrder }, select: { id: true } })).id;
  }
  await tx.estimateLine.createMany({
    data: quoted.map(({ amountMinor, ...snap }, i) => ({
      optionId,
      pricebookItemId: snap.priceBookItemId,
      itemKey: snap.itemKey,
      snapshot: snap,
      description: snap.description,
      quantity: snap.quantity,
      uom: snap.uom,
      unitPriceMinor: BigInt(snap.unitPriceMinor),
      amountMinor,
      discountMinor: 0n,
      memberPriced: snap.memberPriced,
      costMinor: BigInt(snap.costMinor),
      taxCategory: snap.taxCategory,
      trade: snap.trade,
      cancellationClass: snap.cancellationClass,
      isAddOn: snap.cancellationClass === "additional_goods_services",
      sortOrder: i
    }))
  });
  return recomputeOption(uow, optionId, version.discountBps, tax);
}
async function createEstimateInTx(uow, actor, args, source) {
  const { tx } = uow;
  const title = args.title?.trim();
  if (!title) throw new DomainError(Codes.INVALID_INPUT, "Give the estimate a title.", { field: "title" });
  let customerId = args.customerId ?? null;
  let locationId = args.locationId ?? null;
  let businessUnitId = args.businessUnitId ?? null;
  if (args.jobId) {
    const job = await tx.job.findUnique({ where: { id: args.jobId }, select: { customerId: true, locationId: true, businessUnitId: true, status: true } });
    if (!job) throw new DomainError(Codes.NOT_FOUND, "Job not found.", { field: "jobId" });
    if (["cancelled", "closed"].includes(job.status)) throw new DomainError(Codes.GUARD_FAILED, `The job is ${job.status}.`, { reason: "job_closed" });
    customerId = job.customerId;
    locationId = job.locationId;
    businessUnitId = businessUnitId ?? job.businessUnitId;
  } else if (args.opportunityId) {
    const opp = await tx.opportunity.findUnique({ where: { id: args.opportunityId }, select: { customerId: true, locationId: true } });
    if (!opp) throw new DomainError(Codes.NOT_FOUND, "Opportunity not found.", { field: "opportunityId" });
    customerId = opp.customerId;
    locationId = opp.locationId;
  }
  if (!customerId || !locationId) throw new DomainError(Codes.INVALID_INPUT, "An estimate needs a job, an opportunity, or a customer and service address.", { field: "jobId" });
  const loc = await tx.serviceLocation.findUnique({ where: { id: locationId }, select: { customerId: true } });
  if (!loc) throw new DomainError(Codes.NOT_FOUND, "Service address not found.", { field: "locationId" });
  const ref = await nextReference(tx, "EST", uow.now);
  const estimate = await tx.estimate.create({
    data: {
      ref,
      publicCode: publicCode("EST"),
      title,
      jobId: args.jobId ?? null,
      opportunityId: args.opportunityId ?? null,
      customerId,
      locationId,
      businessUnitId,
      status: "open",
      source,
      createdById: actorUserId(actor),
      createdByAgentId: actorAgentId(actor)
    },
    select: { id: true }
  });
  const version = await tx.estimateVersion.create({ data: { estimateId: estimate.id, versionNumber: 1, label: "Version 1", status: "draft" }, select: { id: true } });
  await tx.estimate.update({ where: { id: estimate.id }, data: { currentVersionId: version.id } });
  auditCreate(uow, actor, "Estimate", estimate.id, "estimate.created", { ref, title, jobId: args.jobId ?? null, opportunityId: args.opportunityId ?? null, customerId, locationId, source });
  const options = [];
  if (args.options?.length) {
    const est = await loadEstimate(tx, estimate.id);
    const tax = await taxContext(tx, est, uow.now);
    const row = await lockEstimateVersion(tx, version.id);
    for (const [i, o] of args.options.entries()) {
      options.push(await writeOption(uow, est, { ...row, priceBookVersion: (await tx.estimateVersion.findUniqueOrThrow({ where: { id: version.id }, select: { priceBookVersionId: true } })).priceBookVersionId }, o, tax, i));
    }
    auditCreate(uow, actor, "EstimateVersion", version.id, "estimate_version.options_saved", { options: options.map((o) => ({ optionId: o.optionId, totalMinor: o.totalMinor.toString() })) });
  }
  return { estimateId: estimate.id, ref, versionId: version.id, options: options.map(({ marginBps: _m, ...o }) => ({ ...o, subtotalMinor: o.subtotalMinor.toString(), discountMinor: o.discountMinor.toString(), estimatedTaxMinor: o.estimatedTaxMinor.toString(), totalMinor: o.totalMinor.toString() })) };
}
async function createEstimate(db, actor, args) {
  await authorizeOperation(db, actor, "estimate.create", PRESENT, args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "Agents draft estimates with estimate.draft.");
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "estimate.create", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    if (args.jobId && actor.kind === "user" && !OFFICE2.some((p) => can(actor, p))) await assertEstimateAccess(uow.tx, actor, { jobId: args.jobId, createdById: null, presentedBy: null });
    return createEstimateInTx(uow, actor, args, can(actor, "canWorkVisits") && !OFFICE2.some((p) => can(actor, p)) ? "technician" : "staff");
  });
  return { replay: result.replay, ...result.value };
}
async function draftEstimate(db, actor, args) {
  const tool = args.visitId ? "estimate.draft_from_capture" : "estimate.draft";
  await authorizeOperation(db, actor, tool, PRESENT, args);
  if (!args.options?.length) throw new DomainError(Codes.INVALID_INPUT, "A draft needs at least one option.", { field: "options" });
  const { idempotencyKey, now: _now, visitId, ...rest } = args;
  const result = await command(db, { name: tool, actor, idempotencyKey, params: { ...rest, visitId }, now: args.now }, async (uow) => {
    let jobId = args.jobId ?? null;
    if (visitId) {
      const visit = await uow.tx.visit.findUnique({ where: { id: visitId }, select: { jobId: true } });
      if (!visit?.jobId) throw new DomainError(Codes.NOT_FOUND, "Visit not found.", { field: "visitId" });
      jobId = visit.jobId;
    }
    if (jobId && actor.kind === "user") await assertEstimateAccess(uow.tx, actor, { jobId, createdById: null, presentedBy: null });
    const value = await createEstimateInTx(uow, actor, { ...rest, jobId, idempotencyKey }, actor.kind === "agent" ? "agent_draft" : "technician");
    await recordAgentAction(uow, actor, { tool, idempotencyKey, inputs: rest, output: value });
    return value;
  });
  return { replay: result.replay, ...result.value };
}
async function saveEstimateOption(db, actor, args) {
  await authorizeOperation(db, actor, "estimate.edit", PRESENT, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "estimate.save_option", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const row = await lockEstimateVersion(uow.tx, args.versionId, args.expectedVersion);
    requireStatus(row, ["draft"], "edited");
    const est = await loadEstimate(uow.tx, row.estimate);
    await assertEstimateAccess(uow.tx, actor, est);
    const count = await uow.tx.estimateOption.count({ where: { estimateVersionId: row.id } });
    if (!args.optionId && count >= 6) throw new DomainError(Codes.INVALID_INPUT, "An estimate shows at most six options.", { field: "optionId" });
    const option2 = await writeOption(uow, est, row, args, await taxContext(uow.tx, est, uow.now), count);
    await voidDiscountApproval(uow, actor, row, "Option changed after the discount was approved");
    const version = await casUpdate(uow, { model: "EstimateVersion", id: row.id, version: row.version, from: ["draft"], to: "draft", actor, eventType: "estimate_version.option_saved", audit: { optionId: option2.optionId, tier: args.tier, name: args.name, lines: args.lines.length, totalMinor: option2.totalMinor.toString() } });
    return { versionId: row.id, version, optionId: option2.optionId, totalMinor: option2.totalMinor.toString(), subtotalMinor: option2.subtotalMinor.toString(), discountMinor: option2.discountMinor.toString(), estimatedTaxMinor: option2.estimatedTaxMinor.toString() };
  });
  return { replay: result.replay, ...result.value };
}
async function removeEstimateOption(db, actor, args) {
  await authorizeOperation(db, actor, "estimate.edit", PRESENT, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "estimate.remove_option", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const row = await lockEstimateVersion(uow.tx, args.versionId, args.expectedVersion);
    requireStatus(row, ["draft"], "edited");
    await assertEstimateAccess(uow.tx, actor, await loadEstimate(uow.tx, row.estimate));
    const option2 = await uow.tx.estimateOption.findFirst({ where: { id: args.optionId, estimateVersionId: row.id }, select: { id: true } });
    if (!option2) throw new DomainError(Codes.NOT_FOUND, "That option is not on this estimate version.");
    await uow.tx.estimateLine.deleteMany({ where: { optionId: option2.id } });
    await uow.tx.estimateOption.delete({ where: { id: option2.id } });
    await voidDiscountApproval(uow, actor, row, "Option removed after the discount was approved");
    const version = await casUpdate(uow, { model: "EstimateVersion", id: row.id, version: row.version, from: ["draft"], to: "draft", actor, eventType: "estimate_version.option_removed", audit: { optionId: option2.id } });
    return { versionId: row.id, version };
  });
  return { replay: result.replay, ...result.value };
}
async function repriceEstimateVersion(db, actor, args) {
  await authorizeOperation(db, actor, "estimate.edit", PRESENT, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "estimate.reprice", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const row = await lockEstimateVersion(uow.tx, args.versionId, args.expectedVersion);
    requireStatus(row, ["draft"], "re-priced");
    const est = await loadEstimate(uow.tx, row.estimate);
    await assertEstimateAccess(uow.tx, actor, est);
    const repriced = await requoteOptionsInto(uow, est, row.id, { ...row, priceBookVersion: null });
    await voidDiscountApproval(uow, actor, row, "Re-priced after the discount was approved");
    const version = await casUpdate(uow, { model: "EstimateVersion", id: row.id, version: row.version, from: ["draft"], to: "draft", actor, eventType: "estimate_version.repriced", audit: { from: row.priceBookVersion, options: repriced } });
    return { versionId: row.id, version, options: repriced };
  });
  return { replay: result.replay, ...result.value };
}
async function requoteOptionsInto(uow, est, sourceVersionId, target) {
  const { tx } = uow;
  const options = await tx.estimateOption.findMany({ where: { estimateVersionId: sourceVersionId }, orderBy: { sortOrder: "asc" }, select: { id: true, tier: true, name: true, description: true, sortOrder: true, lines: { orderBy: { sortOrder: "asc" }, select: { itemKey: true, quantity: true, cancellationClass: true, description: true, memberPriced: true } } } });
  const member = options.some((o) => o.lines.some((l) => l.memberPriced)) && est.customerId ? !!await activePlanCode(tx, est.customerId, est.location?.id ?? null, uow.now) : false;
  if (sourceVersionId === target.id) {
    await tx.estimateLine.deleteMany({ where: { option: { estimateVersionId: target.id } } });
    await tx.estimateOption.deleteMany({ where: { estimateVersionId: target.id } });
  }
  await tx.estimateVersion.update({ where: { id: target.id }, data: { priceBookVersionId: null } });
  const tax = await taxContext(tx, est, uow.now);
  const out = [];
  for (const o of options) {
    const r = await writeOption(uow, est, { ...target, priceBookVersion: null }, {
      tier: o.tier,
      name: o.name,
      description: o.description,
      memberPricing: member && o.lines.some((l) => l.memberPriced),
      lines: o.lines.map((l) => ({ itemKey: l.itemKey, quantity: l.quantity.toString(), cancellationClass: l.cancellationClass, description: l.description }))
    }, tax, o.sortOrder);
    out.push({ optionId: r.optionId, totalMinor: r.totalMinor.toString() });
  }
  return out;
}
async function setEstimateDiscount(db, actor, args) {
  await authorizeOperation(db, actor, "estimate.discount", PRESENT, args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "Agents do not set discounts.");
  if (!Number.isInteger(args.discountBps) || args.discountBps < 0 || args.discountBps > 1e4) throw new DomainError(Codes.INVALID_INPUT, "Discount is 0 to 10000 basis points.", { field: "discountBps" });
  if (args.discountBps > 0 && !args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Say why the discount is given.", { field: "reason" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "estimate.discount", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const row = await lockEstimateVersion(tx, args.versionId, args.expectedVersion);
    requireStatus(row, ["draft"], "discounted");
    const est = await loadEstimate(tx, row.estimate);
    await assertEstimateAccess(tx, actor, est);
    await tx.estimateVersion.update({ where: { id: row.id }, data: { discountBps: args.discountBps, discountReason: args.reason?.trim() ?? "", discountApprovalId: null } });
    const tax = await taxContext(tx, est, uow.now);
    const options = await tx.estimateOption.findMany({ where: { estimateVersionId: row.id }, select: { id: true } });
    const totals = [];
    for (const o of options) totals.push(await recomputeOption(uow, o.id, args.discountBps, tax));
    const limit = await discountLimitBps(tx, actor);
    if (args.discountBps <= limit) {
      const version2 = await casUpdate(uow, { model: "EstimateVersion", id: row.id, version: row.version + 0, from: ["draft"], to: "draft", actor, eventType: "estimate_version.discounted", reason: args.reason ?? null, audit: { discountBps: args.discountBps, limitBps: limit } });
      return { versionId: row.id, version: version2, status: "draft", approvalRequestId: null };
    }
    const approval = await requestApproval(uow, actor, {
      action: "estimate.discount",
      targetList: "EstimateVersion",
      targetId: row.id,
      requiredPermission: "canApproveDiscounts",
      payload: { versionId: row.id, discountBps: args.discountBps, ...await discountBinding(tx, row.id, args.discountBps), options: totals.map((t) => ({ optionId: t.optionId, contentHash: t.contentHash })) },
      summary: `${est.ref}: ${args.discountBps / 100}% discount (limit ${limit / 100}%) \u2014 ${args.reason?.trim()}`
    });
    const version = await casUpdate(uow, { model: "EstimateVersion", id: row.id, version: row.version, from: ["draft"], to: "pending_approval", actor, eventType: "estimate_version.discount_requested", reason: args.reason ?? null, data: { discountApprovalId: approval.id }, audit: { discountBps: args.discountBps, limitBps: limit, approvalId: approval.id } });
    return { versionId: row.id, version, status: "pending_approval", approvalRequestId: approval.id };
  });
  return { replay: result.replay, ...result.value };
}
async function applyEstimateDiscount(uow, actor, request) {
  const row = await lockEstimateVersion(uow.tx, request.targetId);
  if (row.status !== "pending_approval" || row.discountApproval !== request.id || row.discountBps !== request.payload.discountBps) throw new DomainError(Codes.APPROVAL_MISMATCH, "The estimate changed after the discount was requested.");
  const hashes = await uow.tx.estimateOption.findMany({ where: { estimateVersionId: row.id }, select: { id: true, contentHash: true } });
  const expected = new Map(request.payload.options.map((o) => [o.optionId, o.contentHash]));
  if (hashes.length !== expected.size || hashes.some((h) => expected.get(h.id) !== h.contentHash)) throw new DomainError(Codes.APPROVAL_MISMATCH, "The options changed after the discount was requested.");
  await casUpdate(uow, { model: "EstimateVersion", id: row.id, version: row.version, from: ["pending_approval"], to: "draft", actor, eventType: "estimate_version.discount_approved", approverId: actorUserId(actor), metadata: { approvalRequestId: request.id } });
  return { versionId: row.id, status: "draft", discountBps: row.discountBps };
}
async function reopenEstimateVersion(db, actor, args) {
  await authorizeOperation(db, actor, "estimate.edit", PRESENT, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "estimate.reopen", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const row = await lockEstimateVersion(uow.tx, args.versionId, args.expectedVersion);
    requireStatus(row, ["pending_approval"], "reopened");
    await assertEstimateAccess(uow.tx, actor, await loadEstimate(uow.tx, row.estimate));
    if (row.discountApproval) {
      const req = await uow.tx.approvalRequest.findUnique({ where: { id: row.discountApproval }, select: { id: true, status: true, version: true } });
      if (req?.status === "pending") await casUpdate(uow, { model: "ApprovalRequest", id: req.id, version: req.version, from: ["pending"], to: "cancelled", actor, eventType: "approval.cancelled", reason: "Estimate reopened for editing" });
    }
    const version = await casUpdate(uow, { model: "EstimateVersion", id: row.id, version: row.version, from: ["pending_approval"], to: "draft", actor, eventType: "estimate_version.reopened", data: { discountApprovalId: null } });
    return { versionId: row.id, version, status: "draft" };
  });
  return { replay: result.replay, ...result.value };
}
async function presentEstimate(db, actor, args) {
  await authorizeOperation(db, actor, "estimate.present", PRESENT, args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "A person presents estimates; agents draft them.");
  const via = args.via ?? "in_person";
  if (!["in_person", "email", "printed"].includes(via)) throw new DomainError(Codes.INVALID_INPUT, "Present in person, by email, or printed.", { field: "via" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "estimate.present", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const row = await lockEstimateVersion(tx, args.versionId, args.expectedVersion);
    requireStatus(row, ["draft"], "presented");
    const est = await loadEstimate(tx, row.estimate);
    await assertEstimateAccess(tx, actor, est);
    const optionsOf = () => tx.estimateOption.findMany({ where: { estimateVersionId: row.id }, orderBy: { sortOrder: "asc" }, include: { lines: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } });
    let options = await optionsOf();
    if (!options.length || options.some((o) => !o.lines.length)) throw new DomainError(Codes.GUARD_FAILED, "Every option needs at least one line, and the estimate needs an option.", { reason: "empty_option" });
    const active = await activeVersionFor(tx, est.businessUnitId ?? est.job?.businessUnitId ?? null);
    const stale = row.priceBookVersion !== active.versionId || options.some((o) => o.lines.some((l) => l.snapshot.priceBookVersionId !== active.versionId));
    if (stale) throw new DomainError(Codes.GUARD_FAILED, "A new price book is active since this estimate was priced. Re-price it, then present.", { reason: "pricebook_changed" });
    if (options.some((o) => o.lines.some((l) => l.memberPriced)) && !(est.customerId && await activePlanCode(tx, est.customerId, est.location?.id ?? null, uow.now))) {
      await requoteOptionsInto(uow, est, row.id, row);
      options = await optionsOf();
    }
    const limit = await discountLimitBps(tx, actor);
    if (row.discountBps > limit) {
      const approval = row.discountApproval ? await tx.approvalRequest.findUnique({ where: { id: row.discountApproval }, select: { status: true, payload: true } }) : null;
      const ok = approval && approval.status === "approved" && approval.payload?.discountBps === row.discountBps;
      if (!ok) throw new DomainError(Codes.APPROVAL_REQUIRED, `A ${row.discountBps / 100}% discount is over your ${limit / 100}% limit and needs approval.`, { reason: "discount_over_limit" });
    }
    const tax = await taxContext(tx, est, uow.now);
    for (const o of options) await recomputeOption(uow, o.id, row.discountBps, tax);
    if (row.discountBps > limit) {
      const approval = await tx.approvalRequest.findUnique({ where: { id: row.discountApproval }, select: { payload: true } });
      const bound = approval?.payload;
      const now = await discountBinding(tx, row.id, row.discountBps);
      if (!bound?.bindingHash || bound.bindingHash !== now.bindingHash || bound.discountMinor !== now.discountMinor) {
        throw new DomainError(Codes.APPROVAL_REQUIRED, "The price or discount changed after it was approved. Request approval again.", { reason: "discount_approval_stale" });
      }
    }
    const fresh = await tx.estimateOption.findMany({ where: { estimateVersionId: row.id }, orderBy: { sortOrder: "asc" }, include: { lines: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } });
    const trades = new Set(fresh.flatMap((o) => o.lines.map((l) => l.trade)));
    const { company, block } = await sellerBlock(tx, est.businessUnitId, placeOfLocation(est.location).state, trades);
    const tz = est.location?.timeZone || company.homeTimeZone;
    const today = localDate({ timeZone: tz }, uow.now);
    const lastValidDay = addDays(today, company.estimateValidityDays);
    const validUntil = zonedInstant(tz, addDays(lastValidDay, 1), "00:00");
    const place = placeOfLocation(est.location);
    let hic = null;
    try {
      hic = (await resolvePolicyFromDb(tx, "home_improvement_contract", place, today)).rules;
    } catch (error) {
      if (!(error instanceof DomainError && error.code === Codes.POLICY_MISSING)) throw error;
    }
    const residential = est.location?.propertyClass === "residential";
    const employee = await tx.employee.findFirst({ where: { userId: actorUserId(actor) }, select: { id: true } });
    const snapshot = {
      ref: est.ref,
      versionNumber: row.versionNumber,
      title: est.title,
      presentedAt: uow.now.toISOString(),
      validUntil: lastValidDay,
      timeZone: tz,
      company: block,
      customer: { name: est.customer?.displayName ?? "" },
      location: est.location ? { address: addressLine(est.location) } : null,
      notes: args.notes?.trim() ?? "",
      discount: row.discountBps > 0 ? { bps: row.discountBps, reason: (await tx.estimateVersion.findUniqueOrThrow({ where: { id: row.id }, select: { discountReason: true } })).discountReason } : null,
      options: fresh.map((o) => ({
        id: o.id,
        tier: o.tier,
        name: o.name,
        description: o.description,
        contentHash: o.contentHash,
        monthlyPaymentDisplay: "",
        subtotalMinor: o.subtotalMinor.toString(),
        discountMinor: o.discountMinor.toString(),
        estimatedTaxMinor: o.estimatedTaxMinor.toString(),
        totalMinor: o.totalMinor.toString(),
        lines: o.lines.map((l) => ({ description: l.description, quantity: l.quantity.toString(), uom: l.uom, unitPriceMinor: l.unitPriceMinor.toString(), amountMinor: l.amountMinor.toString(), discountMinor: l.discountMinor.toString(), memberPriced: l.memberPriced, warrantyText: l.snapshot.warrantyText, isAddOn: l.isAddOn }))
      })),
      disclosures: {
        taxNote: "Sales tax shown is an estimate for this address; the invoice states the final amount.",
        homesteadWarning: residential && hic?.requiredFields.includes("homestead_warning") ? TX_HOMESTEAD_WARNING : null,
        lienDisclosure: residential && hic?.requiredFields.includes("lien_disclosure") ? TX_LIEN_DISCLOSURE : null,
        cancellationStatement: null
      },
      priceBookVersionId: active.versionId,
      contentHash: ""
    };
    snapshot.contentHash = payloadHash({ ...snapshot, contentHash: void 0 });
    const pdf = await storeRenderedPdf(uow, actor, {
      title: `${est.ref} v${row.versionNumber}`,
      kind: "estimate_pdf",
      subjectType: "EstimateVersion",
      subjectId: row.id,
      storageKey: `render:estimate-version/${row.id}`,
      bytes: renderEstimatePdf(snapshot, presentedLabel(snapshot))
    });
    const version = await casUpdate(uow, {
      model: "EstimateVersion",
      id: row.id,
      version: row.version,
      from: ["draft"],
      to: "presented",
      actor,
      eventType: "estimate_version.presented",
      data: { snapshot, contentHash: snapshot.contentHash, presentedAt: uow.now, presentedById: actorUserId(actor), presentedVia: via, validUntil, notes: snapshot.notes, pdfId: pdf.documentId },
      audit: { contentHash: snapshot.contentHash, via, validUntil: lastValidDay, options: fresh.map((o) => ({ id: o.id, totalMinor: o.totalMinor.toString(), contentHash: o.contentHash })), pdfSha256: pdf.sha256 }
    });
    await tx.estimate.update({ where: { id: est.id }, data: { currentVersionId: row.id, presentedById: employee?.id ?? void 0, version: { increment: 1 } } });
    if (est.opportunityId) await tx.opportunity.updateMany({ where: { id: est.opportunityId, stage: { in: ["open", "appointment_set"] } }, data: { stage: "estimate_presented", version: { increment: 1 } } });
    return { versionId: row.id, version, status: "presented", contentHash: snapshot.contentHash, documentId: pdf.documentId, validUntil: lastValidDay };
  });
  return { replay: result.replay, ...result.value };
}
function validateAuthorization(a, location) {
  if (!a?.signerName?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Who authorized it?", { field: "signerName" });
  if (!["signature_on_device", "verbal_recorded", "written_paper", "po_number"].includes(a.method)) throw new DomainError(Codes.INVALID_INPUT, "Authorization is a signature on the device, a recorded verbal approval, a signed paper copy, or a purchase order.", { field: "method" });
  if (a.method === "signature_on_device" && (a.signature === void 0 || a.signature === null || a.signature === "")) throw new DomainError(Codes.INVALID_INPUT, "Capture the signature.", { field: "signature" });
  if (a.method === "verbal_recorded" && (!a.callId || location !== "remote")) throw new DomainError(Codes.INVALID_INPUT, "A verbal approval is taken on a recorded call; link the call.", { field: "callId" });
  if (a.method === "po_number" && !a.poNumber?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Enter the purchase order number.", { field: "poNumber" });
  const role = a.signerRole ?? "owner";
  if (role === "tenant" && !a.ownerApproval?.trim()) throw new DomainError(Codes.GUARD_FAILED, "A tenant can authorize work only with the owner's approval; record how the owner approved.", { reason: "tenant_without_owner" });
  if (role === "property_manager" && a.method !== "po_number" && !a.ownerApproval?.trim()) throw new DomainError(Codes.GUARD_FAILED, "A property manager authorizes with a purchase order or the owner's recorded approval.", { reason: "pm_without_po" });
  return role;
}
async function sellEstimate(db, actor, args) {
  await authorizeOperation(db, actor, "estimate.sell", SELL3, args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "A person records a sale.");
  if (!SALE_LOCATIONS.includes(args.saleLocation)) throw new DomainError(Codes.INVALID_INPUT, `Sale location must be one of ${SALE_LOCATIONS.join(", ")}.`, { field: "saleLocation" });
  if (!["customer_request", "solicited"].includes(args.initiatedBy)) throw new DomainError(Codes.INVALID_INPUT, "Say whether the customer asked for this visit or it was solicited.", { field: "initiatedBy" });
  const signerRole = validateAuthorization(args.authorization, args.saleLocation);
  const deposit = args.depositMinor ? /^\d{1,13}$/.test(args.depositMinor) ? BigInt(args.depositMinor) : (() => {
    throw new DomainError(Codes.INVALID_INPUT, "Deposit is whole cents.", { field: "depositMinor" });
  })() : 0n;
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "estimate.sell", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const row = await lockEstimateVersion(tx, args.versionId, args.expectedVersion);
    requireStatus(row, ["presented"], "sold");
    if (row.validUntil && row.validUntil.getTime() <= uow.now.getTime()) throw new DomainError(Codes.GUARD_FAILED, "This estimate has expired. Re-quote it.", { reason: "expired" });
    const est = await loadEstimate(tx, row.estimate);
    await assertEstimateAccess(tx, actor, est);
    if (!est.jobId) throw new DomainError(Codes.GUARD_FAILED, "Attach the estimate to a job before selling it, so the work can be scheduled.", { reason: "no_job" });
    const option2 = await tx.estimateOption.findFirst({ where: { id: args.optionId, estimateVersionId: row.id }, include: { lines: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } });
    if (!option2) throw new DomainError(Codes.INVALID_INPUT, "Choose one of the presented options.", { field: "optionId" });
    if (args.authorization.signerContactId) {
      const contact = await tx.contact.findUnique({ where: { id: args.authorization.signerContactId }, select: { customerId: true } });
      if (contact?.customerId !== est.customerId) throw new DomainError(Codes.INVALID_INPUT, "The signer is not a contact of this customer.", { field: "signerContactId" });
    }
    if (args.authorization.callId && !await tx.call.findUnique({ where: { id: args.authorization.callId }, select: { id: true } })) throw new DomainError(Codes.NOT_FOUND, "Call not found.", { field: "callId" });
    const tz = est.location.timeZone;
    const place = placeOfLocation(est.location);
    if (deposit > 0n) {
      if (deposit > option2.totalMinor) throw new DomainError(Codes.INVALID_INPUT, "The deposit is more than the price.", { field: "depositMinor" });
      const hic = await resolvePolicyFromDb(tx, "home_improvement_contract", place, localDate({ timeZone: tz }, uow.now));
      const cap = depositCap(option2.totalMinor, hic.rules);
      if (cap !== null && deposit > cap) throw new DomainError(Codes.GUARD_FAILED, `The deposit is over the ${cap.toString()}\xA2 cap for this address.`, { reason: "deposit_over_cap", capMinor: cap.toString() });
    }
    const authorization = await tx.authorization.create({
      data: {
        subjectType: "EstimateVersion",
        subjectId: row.id,
        jobId: est.jobId,
        method: args.authorization.method,
        signerName: args.authorization.signerName.trim(),
        signerContactId: args.authorization.signerContactId ?? null,
        signerRole,
        signature: args.authorization.signature ?? void 0,
        callId: args.authorization.callId ?? null,
        poNumber: args.authorization.poNumber?.trim() ?? "",
        ip: args.authorization.ip ?? "",
        userAgent: args.authorization.userAgent ?? "",
        location: args.saleLocation,
        initiatedBy: args.initiatedBy,
        selectedLineIds: option2.lines.map((l) => l.id),
        depositMinor: deposit,
        contentHash: option2.contentHash,
        authorizedAt: uow.now,
        recordedById: actorUserId(actor)
      },
      select: { id: true }
    });
    if (deposit > 0n) {
      const ref = await nextReference(tx, "PMT", uow.now);
      const payment = await tx.payment.create({ data: { ref, jobId: est.jobId, customerId: est.customerId ?? null, authorizationId: authorization.id, kind: "deposit", method: args.depositMethod ?? "card", amountMinor: deposit, reference: args.depositReference?.trim() ?? "", receivedAt: uow.now, recordedById: actorUserId(actor) }, select: { id: true } });
      auditCreate(uow, actor, "Payment", payment.id, "payment.recorded", { ref, authorizationId: authorization.id, amountMinor: deposit.toString(), method: args.depositMethod ?? "card", kind: "deposit" });
    }
    auditCreate(uow, actor, "Authorization", authorization.id, "authorization.recorded", { subject: `EstimateVersion:${row.id}`, optionId: option2.id, method: args.authorization.method, signerRole, location: args.saleLocation, initiatedBy: args.initiatedBy, contentHash: option2.contentHash, ownerApproval: args.authorization.ownerApproval ?? null });
    const workLines = [];
    for (const l of option2.lines) {
      workLines.push(await tx.workLine.create({
        data: {
          jobId: est.jobId,
          source: "estimate_line",
          description: l.description,
          snapshot: { ...l.snapshot, estimateRef: est.ref, listAmountMinor: l.amountMinor.toString(), discountMinor: l.discountMinor.toString() },
          quantity: l.quantity,
          uom: l.uom,
          unitPriceMinor: l.unitPriceMinor,
          amountMinor: l.amountMinor - l.discountMinor,
          taxCategory: l.taxCategory,
          trade: l.trade,
          cancellationClass: l.cancellationClass,
          status: "planned",
          estimateLineId: l.id
        },
        select: { id: true, amountMinor: true, trade: true, cancellationClass: true, description: true }
      }));
    }
    const version = await casUpdate(uow, {
      model: "EstimateVersion",
      id: row.id,
      version: row.version,
      from: ["presented"],
      to: "sold",
      actor,
      eventType: "estimate_version.sold",
      data: { soldOptionId: option2.id, authorizationId: authorization.id, soldAt: uow.now, depositRequiredMinor: deposit, closedAt: uow.now },
      audit: { optionId: option2.id, totalMinor: option2.totalMinor.toString(), depositMinor: deposit.toString(), workLines: workLines.length }
    });
    await tx.estimate.update({ where: { id: est.id }, data: { status: "sold", soldVersionId: row.id, version: { increment: 1 } } });
    if (est.opportunityId) await tx.opportunity.updateMany({ where: { id: est.opportunityId }, data: { stage: "won", version: { increment: 1 } } });
    const rights = await evaluateSaleRights(uow, actor, {
      jobId: est.jobId,
      customerId: est.customerId,
      subjectType: "EstimateVersion",
      subjectId: row.id,
      estimateVersionId: row.id,
      changeOrderId: null,
      authorizationId: authorization.id,
      location: args.saleLocation,
      initiatedBy: args.initiatedBy,
      transactionAt: uow.now,
      serviceLocation: est.location,
      businessUnitId: est.businessUnitId,
      buyerName: est.customer?.displayName ?? "",
      language: est.customer?.primaryContact?.preferredLanguage || "en",
      lines: workLines.map((w) => ({ id: w.id, amountMinor: w.amountMinor, trade: w.trade, cancellationClass: w.cancellationClass, description: w.description })),
      exclusions: args.exclusions ?? [],
      emergencyWaiver: args.emergencyWaiver ?? null,
      acrContext: args.acrContext ?? []
    });
    return { versionId: row.id, version, status: "sold", authorizationId: authorization.id, workLineIds: workLines.map((w) => w.id), cancellation: rights };
  });
  return { replay: result.replay, ...result.value };
}
async function declineEstimate(db, actor, args) {
  await authorizeOperation(db, actor, "estimate.decline", PRESENT, args);
  if (!DECLINE_REASONS.includes(args.reason)) throw new DomainError(Codes.INVALID_INPUT, `Reason must be one of ${DECLINE_REASONS.join(", ")}.`, { field: "reason" });
  if (args.reason === "other" && !args.note?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Say why.", { field: "note" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "estimate.decline", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const row = await lockEstimateVersion(uow.tx, args.versionId, args.expectedVersion);
    requireStatus(row, ["presented"], "declined");
    const est = await loadEstimate(uow.tx, row.estimate);
    await assertEstimateAccess(uow.tx, actor, est);
    const version = await casUpdate(uow, { model: "EstimateVersion", id: row.id, version: row.version, from: ["presented"], to: "declined", actor, eventType: "estimate_version.declined", reason: args.note ?? null, data: { declineReason: args.reason, declineNote: args.note?.trim() ?? "", closedAt: uow.now } });
    await uow.tx.estimate.update({ where: { id: est.id }, data: { status: "declined", version: { increment: 1 } } });
    if (est.opportunityId && ["chose_competitor", "no_longer_needed"].includes(args.reason)) await uow.tx.opportunity.updateMany({ where: { id: est.opportunityId }, data: { stage: "lost", version: { increment: 1 } } });
    return { versionId: row.id, version, status: "declined" };
  });
  return { replay: result.replay, ...result.value };
}
async function expireDueEstimates(db, now = /* @__PURE__ */ new Date()) {
  const due = await db.estimateVersion.findMany({ where: { status: "presented", validUntil: { lte: now } }, select: { id: true }, take: 200 });
  let expired = 0;
  for (const { id } of due) {
    const actor = { kind: "system", name: "estimate-expiry" };
    const r = await command(db, { name: "estimate.expire", actor, idempotencyKey: `estimate-expire:${id}`, params: { versionId: id }, now }, async (uow) => {
      const row = await lockEstimateVersion(uow.tx, id);
      if (row.status !== "presented" || !row.validUntil || row.validUntil.getTime() > now.getTime()) return false;
      await casUpdate(uow, { model: "EstimateVersion", id, version: row.version, from: ["presented"], to: "expired", actor, eventType: "estimate_version.expired", data: { closedAt: uow.now } });
      await uow.tx.estimate.updateMany({ where: { id: row.estimate, status: "open", currentVersionId: id }, data: { status: "expired", version: { increment: 1 } } });
      return true;
    });
    if (r.value) expired += 1;
  }
  return { expired };
}
async function requoteInTx(uow, actor, versionId, expectedVersion, followup) {
  const { tx } = uow;
  const row = await lockEstimateVersion(tx, versionId, expectedVersion);
  requireStatus(row, followup ? ["declined", "expired"] : ["presented", "declined", "expired"], "re-quoted");
  const est = await loadEstimate(tx, row.estimate);
  if (actor.kind === "user") await assertEstimateAccess(tx, actor, est);
  const latest = await tx.estimateVersion.findFirst({ where: { estimateId: est.id }, orderBy: { versionNumber: "desc" }, select: { id: true, versionNumber: true } });
  if (latest?.id !== row.id) throw new DomainError(Codes.GUARD_FAILED, "A newer version of this estimate exists; re-quote that one.", { reason: "not_latest" });
  if (row.status === "presented") await casUpdate(uow, { model: "EstimateVersion", id: row.id, version: row.version, from: ["presented"], to: "superseded", actor, eventType: "estimate_version.superseded", data: { closedAt: uow.now } });
  const versionNumber = row.versionNumber + 1;
  const next = await tx.estimateVersion.create({ data: { estimateId: est.id, versionNumber, label: `Version ${versionNumber}`, status: "draft", supersedesId: row.id }, select: { id: true } });
  await tx.estimate.update({ where: { id: est.id }, data: { status: "open", currentVersionId: next.id, version: { increment: 1 } } });
  auditCreate(uow, actor, "EstimateVersion", next.id, "estimate_version.drafted", { estimateId: est.id, versionNumber, supersedes: row.id, followup });
  const target = await lockEstimateVersion(tx, next.id);
  const options = await requoteOptionsInto(uow, est, row.id, target);
  return { estimateId: est.id, ref: est.ref, versionId: next.id, versionNumber, options };
}
async function requoteEstimate(db, actor, args) {
  await authorizeOperation(db, actor, "estimate.requote", PRESENT, args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "Agents use estimate.draft_followup.");
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "estimate.requote", actor, idempotencyKey, params, now: args.now }, (uow) => requoteInTx(uow, actor, args.versionId, args.expectedVersion, false));
  return { replay: result.replay, ...result.value };
}
async function draftFollowupEstimate(db, actor, args) {
  await authorizeOperation(db, actor, "estimate.draft_followup", PRESENT, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "estimate.draft_followup", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const value = await requoteInTx(uow, actor, args.versionId, null, true);
    await recordAgentAction(uow, actor, { tool: "estimate.draft_followup", idempotencyKey, inputs: params, output: value });
    return value;
  });
  return { replay: result.replay, ...result.value };
}
async function discardEstimateVersion(db, actor, args) {
  await authorizeOperation(db, actor, "estimate.discard", PRESENT, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "estimate.discard", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const row = await lockEstimateVersion(uow.tx, args.versionId, args.expectedVersion);
    requireStatus(row, ["draft"], "discarded");
    const est = await loadEstimate(uow.tx, row.estimate);
    await assertEstimateAccess(uow.tx, actor, est);
    const version = await casUpdate(uow, { model: "EstimateVersion", id: row.id, version: row.version, from: ["draft"], to: "discarded", actor, eventType: "estimate_version.discarded", reason: args.reason ?? null, data: { closedAt: uow.now } });
    const previous = row.versionNumber > 1 ? await uow.tx.estimateVersion.findFirst({ where: { estimateId: est.id, versionNumber: row.versionNumber - 1 }, select: { id: true, status: true } }) : null;
    await uow.tx.estimate.update({ where: { id: est.id }, data: previous ? { currentVersionId: previous.id, status: previous.status === "declined" ? "declined" : previous.status === "expired" ? "expired" : "open", version: { increment: 1 } } : { status: "discarded", version: { increment: 1 } } });
    return { versionId: row.id, version, status: "discarded" };
  });
  return { replay: result.replay, ...result.value };
}
async function draftChangeOrder(db, actor, args) {
  await authorizeOperation(db, actor, "change_order.draft", PRESENT, args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "A person drafts change orders.");
  if (!args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Say why the scope changes.", { field: "reason" });
  if (!args.add?.length && !args.removeWorkLineIds?.length) throw new DomainError(Codes.INVALID_INPUT, "Add or remove at least one line.", { field: "add" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "change_order.draft", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const job = await tx.job.findUnique({ where: { id: args.jobId }, select: { id: true, status: true, businessUnitId: true } });
    if (!job) throw new DomainError(Codes.NOT_FOUND, "Job not found.");
    if (["cancelled", "closed", "completed"].includes(job.status)) throw new DomainError(Codes.GUARD_FAILED, `The job is ${job.status}.`, { reason: "job_closed" });
    await assertEstimateAccess(tx, actor, { jobId: job.id, createdById: null, presentedBy: null });
    const sold = await tx.estimate.findFirst({ where: { jobId: job.id, status: "sold" }, orderBy: { createdAt: "desc" }, select: { id: true } });
    const active = await activeVersionFor(tx, job.businessUnitId);
    const quoted = args.add?.length ? await quoteFromVersion(tx, active.versionId, args.add, false) : [];
    const removing = args.removeWorkLineIds?.length ? await tx.workLine.findMany({ where: { id: { in: args.removeWorkLineIds }, jobId: job.id }, select: { id: true, description: true, amountMinor: true, status: true } }) : [];
    if (removing.length !== (args.removeWorkLineIds?.length ?? 0)) throw new DomainError(Codes.INVALID_INPUT, "Some lines to remove are not on this job.", { field: "removeWorkLineIds" });
    const done = removing.find((w) => w.status !== "planned");
    if (done) throw new DomainError(Codes.GUARD_FAILED, `"${done.description}" is ${done.status}; only planned work can be removed.`, { reason: "line_not_planned" });
    const lines = {
      add: quoted.map((q) => ({ ...q, amountMinor: q.amountMinor.toString() })),
      remove: removing.map((w) => ({ workLineId: w.id, description: w.description, amountMinor: w.amountMinor.toString() }))
    };
    const delta = quoted.reduce((s, q) => s + q.amountMinor, 0n) - removing.reduce((s, w) => s + w.amountMinor, 0n);
    const ref = await nextReference(tx, "CO", uow.now);
    const co = await tx.changeOrder.create({ data: { ref, jobId: job.id, estimateId: sold?.id ?? null, priceBookVersionId: active.versionId, status: "draft", reason: args.reason.trim(), lines, deltaMinor: delta, createdById: actorUserId(actor) }, select: { id: true, version: true } });
    auditCreate(uow, actor, "ChangeOrder", co.id, "change_order.drafted", { ref, jobId: job.id, deltaMinor: delta.toString(), add: lines.add.length, remove: lines.remove.length });
    return { changeOrderId: co.id, ref, version: co.version, deltaMinor: delta.toString() };
  });
  return { replay: result.replay, ...result.value };
}
async function lockChangeOrder(tx, id, expectedVersion) {
  const [row] = await tx.$queryRaw`SELECT id, status, version, job, lines, "deltaMinor", "contentHash", ref, "priceBookVersion" FROM "ChangeOrder" WHERE id = ${id} FOR UPDATE`;
  if (!row) throw new DomainError(Codes.NOT_FOUND, "Change order not found.");
  if (row.version !== expectedVersion) throw new DomainError(Codes.STALE_STATE, "This change order changed since you loaded it. Reload and try again.", { currentStatus: row.status, currentVersion: row.version });
  return row;
}
async function presentChangeOrder(db, actor, args) {
  await authorizeOperation(db, actor, "change_order.present", PRESENT, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "change_order.present", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const row = await lockChangeOrder(uow.tx, args.changeOrderId, args.expectedVersion);
    requireStatus(row, ["draft"], "presented");
    await assertEstimateAccess(uow.tx, actor, { jobId: row.job, createdById: null, presentedBy: null });
    const job = await uow.tx.job.findUniqueOrThrow({ where: { id: row.job }, select: { businessUnitId: true } });
    const active = await activeVersionFor(uow.tx, job.businessUnitId);
    if (row.lines.add.length && row.priceBookVersion !== active.versionId) throw new DomainError(Codes.GUARD_FAILED, "A new price book is active since this change order was priced. Draft it again.", { reason: "pricebook_changed" });
    const contentHash = keyedPayloadHash({ changeOrderId: row.id, ref: row.ref, lines: row.lines, deltaMinor: row.deltaMinor.toString() });
    const version = await casUpdate(uow, { model: "ChangeOrder", id: row.id, version: row.version, from: ["draft"], to: "presented", actor, eventType: "change_order.presented", data: { contentHash, presentedAt: uow.now } });
    return { changeOrderId: row.id, version, status: "presented", contentHash };
  });
  return { replay: result.replay, ...result.value };
}
async function acceptChangeOrder(db, actor, args) {
  await authorizeOperation(db, actor, "change_order.accept", SELL3, args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "A person records a customer's approval.");
  const signerRole = validateAuthorization(args.authorization, args.saleLocation);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "change_order.accept", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const row = await lockChangeOrder(tx, args.changeOrderId, args.expectedVersion);
    requireStatus(row, ["presented"], "approved");
    await assertEstimateAccess(tx, actor, { jobId: row.job, createdById: null, presentedBy: null });
    const job = await tx.job.findUniqueOrThrow({ where: { id: row.job }, select: { id: true, customerId: true, businessUnitId: true, location: { select: { id: true, address1: true, address2: true, city: true, state: true, postalCode: true, timeZone: true, propertyClass: true } }, customer: { select: { displayName: true, primaryContact: { select: { preferredLanguage: true } } } } } });
    const authorization = await tx.authorization.create({
      data: {
        subjectType: "ChangeOrder",
        subjectId: row.id,
        jobId: row.job,
        method: args.authorization.method,
        signerName: args.authorization.signerName.trim(),
        signerContactId: args.authorization.signerContactId ?? null,
        signerRole,
        signature: args.authorization.signature ?? void 0,
        callId: args.authorization.callId ?? null,
        poNumber: args.authorization.poNumber?.trim() ?? "",
        ip: args.authorization.ip ?? "",
        userAgent: args.authorization.userAgent ?? "",
        location: args.saleLocation,
        initiatedBy: args.initiatedBy,
        selectedLineIds: [],
        depositMinor: 0n,
        contentHash: row.contentHash,
        authorizedAt: uow.now,
        recordedById: actorUserId(actor)
      },
      select: { id: true }
    });
    auditCreate(uow, actor, "Authorization", authorization.id, "authorization.recorded", { subject: `ChangeOrder:${row.id}`, method: args.authorization.method, signerRole, contentHash: row.contentHash });
    const added = [];
    for (const a of row.lines.add) {
      const { amountMinor, ...snap } = a;
      added.push(await tx.workLine.create({
        data: { jobId: row.job, source: "change_order", changeOrderId: row.id, description: snap.description, snapshot: { ...snap, changeOrderRef: row.ref }, quantity: snap.quantity, uom: snap.uom, unitPriceMinor: BigInt(snap.unitPriceMinor), amountMinor: BigInt(amountMinor), taxCategory: snap.taxCategory, trade: snap.trade, cancellationClass: snap.cancellationClass, status: "planned" },
        select: { id: true, amountMinor: true, trade: true, cancellationClass: true, description: true }
      }));
    }
    for (const r of row.lines.remove) {
      const w = await tx.workLine.findUniqueOrThrow({ where: { id: r.workLineId }, select: { id: true, version: true, status: true } });
      await casUpdate(uow, { model: "WorkLine", id: w.id, version: w.version, from: ["planned"], to: "removed", actor, eventType: "work_line.removed", metadata: { changeOrderId: row.id } });
    }
    const rights = added.length ? await evaluateSaleRights(uow, actor, {
      jobId: row.job,
      customerId: job.customerId,
      subjectType: "ChangeOrder",
      subjectId: row.id,
      estimateVersionId: null,
      changeOrderId: row.id,
      authorizationId: authorization.id,
      location: args.saleLocation,
      initiatedBy: args.initiatedBy,
      transactionAt: uow.now,
      serviceLocation: job.location,
      businessUnitId: job.businessUnitId,
      buyerName: job.customer?.displayName ?? "",
      language: job.customer?.primaryContact?.preferredLanguage || "en",
      lines: added.map((w) => ({ id: w.id, amountMinor: w.amountMinor, trade: w.trade, cancellationClass: w.cancellationClass, description: w.description })),
      exclusions: [],
      emergencyWaiver: args.emergencyWaiver ?? null,
      acrContext: args.acrContext ?? []
    }) : null;
    const version = await casUpdate(uow, { model: "ChangeOrder", id: row.id, version: row.version, from: ["presented"], to: "approved", actor, eventType: "change_order.approved", data: { authorizationId: authorization.id, decidedAt: uow.now, cancellationEvaluationId: rights?.evaluationId ?? null } });
    return { changeOrderId: row.id, version, status: "approved", workLineIds: added.map((w) => w.id), cancellation: rights };
  });
  return { replay: result.replay, ...result.value };
}
async function declineChangeOrder(db, actor, args) {
  await authorizeOperation(db, actor, "change_order.decline", PRESENT, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "change_order.decline", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const row = await lockChangeOrder(uow.tx, args.changeOrderId, args.expectedVersion);
    requireStatus(row, ["draft", "presented"], "declined");
    await assertEstimateAccess(uow.tx, actor, { jobId: row.job, createdById: null, presentedBy: null });
    const version = await casUpdate(uow, { model: "ChangeOrder", id: row.id, version: row.version, from: [row.status], to: "declined", actor, eventType: "change_order.declined", reason: args.reason ?? null, data: { decidedAt: uow.now } });
    return { changeOrderId: row.id, version, status: "declined" };
  });
  return { replay: result.replay, ...result.value };
}
async function estimateSummary(db, actor, args) {
  await authorizeOperation(db, actor, "estimate.summary", PRESENT, args);
  const est = await loadEstimate(db, args.estimateId);
  if (actor.kind === "user") await assertEstimateAccess(db, actor, est);
  const version = est.currentVersionId ? await db.estimateVersion.findUnique({ where: { id: est.currentVersionId }, select: { id: true, versionNumber: true, status: true, validUntil: true, declineReason: true, options: { orderBy: { sortOrder: "asc" }, select: { id: true, tier: true, name: true, totalMinor: true } } } }) : null;
  const out = { estimateId: est.id, ref: est.ref, title: est.title, status: est.status, version: version ? { ...version, options: version.options.map((o) => ({ ...o, totalMinor: o.totalMinor.toString() })) } : null };
  await recordAgentRead(db, actor, { tool: "estimate.summary", inputs: args, output: { ref: est.ref, status: est.status } });
  return out;
}

// features/keystone/services/salesAppliers.ts
registerApplier("pricebook.publish", (uow, actor, request) => applyPriceBookPublish(uow, actor, request));
registerApplier("estimate.discount", (uow, actor, request) => applyEstimateDiscount(uow, actor, request));

// features/keystone/seed/pricebookData.ts
init_decimal();
var usd2 = (dollars) => (BigInt(dollars) * 100n).toString();
var PRICE_BOOK = { name: "Summit standard price book", code: "SUMMIT-STD" };
var SUPPLIER = "Hill Country Supply";
var UNITS = [
  { code: "ea", name: "Each", kind: "count", maxDecimals: 0 },
  { code: "ft", name: "Foot", kind: "length", maxDecimals: 2 },
  { code: "lb", name: "Pound", kind: "weight", maxDecimals: 2 },
  { code: "hr", name: "Hour", kind: "time", maxDecimals: 2 },
  { code: "job", name: "Job", kind: "count", maxDecimals: 0 },
  { code: "pkg", name: "Package", kind: "package", maxDecimals: 0 }
];
var BU = { hvac: "seed_bu_hvac_service", install: "seed_bu_hvac_install", plumbing: "seed_bu_plumbing_service", electrical: "seed_bu_electrical" };
var LABOR_RATES = [
  { businessUnitId: null, hourlyMinor: usd2(150), afterHoursMultiplier: "1.5" },
  { businessUnitId: BU.hvac, hourlyMinor: usd2(158), afterHoursMultiplier: "1.5" },
  { businessUnitId: BU.install, hourlyMinor: usd2(135), afterHoursMultiplier: "1.5" },
  { businessUnitId: BU.plumbing, hourlyMinor: usd2(148), afterHoursMultiplier: "1.5" },
  { businessUnitId: BU.electrical, hourlyMinor: usd2(155), afterHoursMultiplier: "1.5" }
];
var MATERIAL_TIERS = [
  { fromCostMinor: "0", toCostMinor: "1000", multiplier: "2.5" },
  { fromCostMinor: "1000", toCostMinor: "5000", multiplier: "2" },
  { fromCostMinor: "5000", toCostMinor: "20000", multiplier: "1.75" },
  { fromCostMinor: "20000", toCostMinor: "100000", multiplier: "1.5" },
  { fromCostMinor: "100000", toCostMinor: null, multiplier: "1.35" }
];
var EQUIPMENT_TIERS = [
  { fromCostMinor: "0", toCostMinor: "100000", multiplier: "1.6" },
  { fromCostMinor: "100000", toCostMinor: "500000", multiplier: "1.45" },
  { fromCostMinor: "500000", toCostMinor: null, multiplier: "1.35" }
];
var MARKUP_TABLES = [
  { name: "Materials", appliesTo: "material", tiers: MATERIAL_TIERS },
  { name: "Equipment", appliesTo: "equipment", tiers: EQUIPMENT_TIERS }
];
var CATEGORIES = [
  ["hvac-diagnostic", "HVAC diagnostics", "hvac"],
  ["hvac-repair", "HVAC repairs", "hvac"],
  ["hvac-maintenance", "HVAC maintenance", "hvac"],
  ["hvac-ductwork", "Ductwork", "hvac"],
  ["hvac-iaq", "Indoor air quality", "hvac"],
  ["hvac-replacement", "HVAC system replacement", "hvac"],
  ["plumbing-drain", "Drains", "plumbing"],
  ["plumbing-repair", "Plumbing repairs", "plumbing"],
  ["plumbing-fixtures", "Fixtures", "plumbing"],
  ["plumbing-water-heater", "Water heaters", "plumbing"],
  ["plumbing-sewer", "Sewer", "plumbing"],
  ["plumbing-repipe", "Repiping", "plumbing"],
  ["plumbing-gas", "Gas lines", "plumbing"],
  ["plumbing-water-quality", "Water quality", "plumbing"],
  ["electrical-diagnostic", "Electrical diagnostics", "electrical"],
  ["electrical-repair", "Electrical repairs", "electrical"],
  ["electrical-panel", "Panels and service", "electrical"],
  ["electrical-lighting", "Lighting and fans", "electrical"],
  ["electrical-safety", "Safety devices", "electrical"],
  ["electrical-ev", "EV charging", "electrical"],
  ["fees", "Fees", "general"],
  ["materials", "Materials", "general"]
].map(([categoryKey, name, trade2], sortOrder) => ({ categoryKey, name, trade: trade2, sortOrder }));
var MATERIALS = [
  ["MAT-CAP-4555", "Dual run capacitor 45/5 \xB5F 440 V", "ea", 1850, "hvac"],
  ["MAT-CAP-355", "Dual run capacitor 35/5 \xB5F 440 V", "ea", 1640, "hvac"],
  ["MAT-CAP-10", "Single run capacitor 10 \xB5F 370 V", "ea", 920, "hvac"],
  ["MAT-HARDSTART", "Hard-start kit", "ea", 3480, "hvac"],
  ["MAT-CONTACTOR", "Contactor 2-pole 40 A", "ea", 1590, "hvac"],
  ["MAT-FAN-MOTOR-14", "Condenser fan motor 1/4 hp", "ea", 11200, "hvac"],
  ["MAT-FAN-MOTOR-13", "Condenser fan motor 1/3 hp", "ea", 12900, "hvac"],
  ["MAT-ECM-MOTOR", "Blower motor ECM 1/2 hp", "ea", 38500, "hvac"],
  ["MAT-PSC-MOTOR", "Blower motor PSC 1/2 hp", "ea", 14800, "hvac"],
  ["MAT-IGNITER", "Hot surface igniter", "ea", 2650, "hvac"],
  ["MAT-FLAME-SENSOR", "Flame sensor", "ea", 1180, "hvac"],
  ["MAT-PRESSURE-SW", "Draft inducer pressure switch", "ea", 3120, "hvac"],
  ["MAT-INDUCER", "Draft inducer motor", "ea", 18900, "hvac"],
  ["MAT-GAS-VALVE", "Furnace gas valve", "ea", 14200, "hvac"],
  ["MAT-CONTROL-BOARD", "Furnace control board", "ea", 21500, "hvac"],
  ["MAT-TXV", "Thermal expansion valve", "ea", 16800, "hvac"],
  ["MAT-FILTER-DRIER", "Liquid line filter drier", "ea", 1490, "hvac"],
  ["MAT-R410A", "R-410A refrigerant", "lb", 1650, "hvac"],
  ["MAT-R454B", "R-454B refrigerant", "lb", 2480, "hvac"],
  ["MAT-NITROGEN", "Nitrogen (pressure test)", "ea", 1200, "hvac"],
  ["MAT-FLOAT-SW", "Condensate float switch", "ea", 1550, "hvac"],
  ["MAT-COND-PUMP", "Condensate pump", "ea", 5900, "hvac"],
  ["MAT-PVC-34", "3/4 in PVC condensate pipe", "ft", 85, "hvac"],
  ["MAT-THERMOSTAT-PROG", "Programmable thermostat", "ea", 4800, "hvac"],
  ["MAT-THERMOSTAT-SMART", "Wi-Fi smart thermostat", "ea", 14900, "hvac"],
  ["MAT-FILTER-1IN", "Pleated filter 1 in MERV 8", "ea", 640, "hvac"],
  ["MAT-FILTER-4IN", "Media filter 4 in MERV 13", "ea", 3450, "hvac"],
  ["MAT-FLEX-DUCT-8", "Insulated flex duct 8 in", "ft", 310, "hvac"],
  ["MAT-FLEX-DUCT-6", "Insulated flex duct 6 in", "ft", 260, "hvac"],
  ["MAT-DUCT-MASTIC", "Duct mastic (1 gal)", "ea", 1850, "hvac"],
  ["MAT-REGISTER", "Supply register", "ea", 1100, "hvac"],
  ["MAT-UV-LAMP", "UV-C coil lamp", "ea", 9800, "hvac"],
  ["MAT-PAD", "Condenser pad", "ea", 4200, "hvac"],
  ["MAT-DISCONNECT", "AC disconnect 60 A", "ea", 2900, "electrical"],
  ["MAT-WHIP", "Flexible whip 3/4 in \xD7 6 ft", "ea", 2100, "electrical"],
  ["MAT-LINESET-3T", "Line set 3/8 \xD7 3/4 \xD7 25 ft", "ea", 18500, "hvac"],
  ["MAT-PEX-12", "PEX-A tubing 1/2 in", "ft", 62, "plumbing"],
  ["MAT-PEX-34", "PEX-A tubing 3/4 in", "ft", 108, "plumbing"],
  ["MAT-PEX-RING", "PEX expansion ring", "ea", 28, "plumbing"],
  ["MAT-PEX-TEE-12", "PEX tee 1/2 in", "ea", 290, "plumbing"],
  ["MAT-COPPER-12", "Type L copper 1/2 in", "ft", 540, "plumbing"],
  ["MAT-COPPER-34", "Type L copper 3/4 in", "ft", 860, "plumbing"],
  ["MAT-SHARKBITE-12", "Push-fit coupling 1/2 in", "ea", 880, "plumbing"],
  ["MAT-BALL-VALVE-34", "Full-port ball valve 3/4 in", "ea", 1790, "plumbing"],
  ["MAT-ANGLE-STOP", "Quarter-turn angle stop", "ea", 840, "plumbing"],
  ["MAT-SUPPLY-LINE", "Braided supply line", "ea", 690, "plumbing"],
  ["MAT-WAX-RING", "Toilet wax ring and bolts", "ea", 590, "plumbing"],
  ["MAT-FLAPPER", "Toilet flapper", "ea", 640, "plumbing"],
  ["MAT-FILL-VALVE", "Toilet fill valve", "ea", 1150, "plumbing"],
  ["MAT-PTRAP", "P-trap 1-1/2 in", "ea", 720, "plumbing"],
  ["MAT-ABS-3", "ABS drain pipe 3 in", "ft", 410, "plumbing"],
  ["MAT-PVC-4", "PVC sewer pipe 4 in", "ft", 520, "plumbing"],
  ["MAT-CLEANOUT", "Two-way cleanout 4 in", "ea", 4800, "plumbing"],
  ["MAT-HOSE-BIB", "Frost-free hose bib", "ea", 2650, "plumbing"],
  ["MAT-PRV", "Pressure reducing valve 3/4 in", "ea", 11800, "plumbing"],
  ["MAT-EXP-TANK", "Thermal expansion tank 2 gal", "ea", 4600, "plumbing"],
  ["MAT-T-AND-P", "Temperature and pressure relief valve", "ea", 2200, "plumbing"],
  ["MAT-ANODE", "Water heater anode rod", "ea", 3100, "plumbing"],
  ["MAT-WH-ELEMENT", "Water heater element 4500 W", "ea", 2350, "plumbing"],
  ["MAT-WH-THERMO", "Water heater thermostat", "ea", 2600, "plumbing"],
  ["MAT-THERMOCOUPLE", "Thermocouple", "ea", 1250, "plumbing"],
  ["MAT-GAS-FLEX", "Gas appliance connector", "ea", 2300, "plumbing"],
  ["MAT-CSST-12", "CSST gas line 1/2 in", "ft", 480, "plumbing"],
  ["MAT-DISPOSAL-12", "Garbage disposal 1/2 hp", "ea", 9800, "plumbing"],
  ["MAT-DISPOSAL-34", "Garbage disposal 3/4 hp", "ea", 16500, "plumbing"],
  ["MAT-FAUCET-KITCHEN", "Kitchen faucet (builder grade)", "ea", 12900, "plumbing"],
  ["MAT-FAUCET-LAV", "Lavatory faucet (builder grade)", "ea", 7400, "plumbing"],
  ["MAT-CARTRIDGE", "Shower valve cartridge", "ea", 3900, "plumbing"],
  ["MAT-TOILET", "Toilet, elongated, 1.28 gpf", "ea", 21500, "plumbing"],
  ["MAT-SUMP-PUMP", "Sump pump 1/3 hp", "ea", 14500, "plumbing"],
  ["MAT-WATER-FILTER", "Whole-home sediment filter", "ea", 18900, "plumbing"],
  ["MAT-SOFTENER", "Water softener 40k grain", "ea", 78e3, "plumbing"],
  ["MAT-RO", "Under-sink reverse osmosis system", "ea", 24500, "plumbing"],
  ["MAT-GFCI-20A", "GFCI receptacle 20 A", "ea", 1890, "electrical"],
  ["MAT-AFCI-BRK", "AFCI/GFCI dual-function breaker", "ea", 5400, "electrical"],
  ["MAT-BRK-20A", "Breaker 20 A single pole", "ea", 890, "electrical"],
  ["MAT-BRK-50A", "Breaker 50 A double pole", "ea", 2150, "electrical"],
  ["MAT-RECEPT", "Receptacle 15 A tamper resistant", "ea", 340, "electrical"],
  ["MAT-SWITCH", "Single-pole switch", "ea", 290, "electrical"],
  ["MAT-DIMMER", "LED dimmer switch", "ea", 2450, "electrical"],
  ["MAT-NM-12", "NM-B 12/2 cable", "ft", 105, "electrical"],
  ["MAT-NM-6", "NM-B 6/3 cable", "ft", 420, "electrical"],
  ["MAT-BOX", "Old-work device box", "ea", 210, "electrical"],
  ["MAT-SMOKE-CO", "Combination smoke/CO alarm (hardwired)", "ea", 4400, "electrical"],
  ["MAT-SURGE", "Whole-home surge protector", "ea", 12500, "electrical"],
  ["MAT-FAN-BOX", "Fan-rated ceiling box", "ea", 1450, "electrical"],
  ["MAT-LED-CAN", "LED wafer light 6 in", "ea", 1650, "electrical"],
  ["MAT-EV-RECEPT", "NEMA 14-50 receptacle", "ea", 2900, "electrical"],
  ["MAT-GROUND-ROD", "Ground rod and clamp", "ea", 2400, "electrical"]
];
var materials = MATERIALS.map(([itemKey, name, uom, cost, trade2]) => {
  const costMinor = BigInt(cost);
  const tier = MATERIAL_TIERS.find((t) => costMinor >= BigInt(t.fromCostMinor) && (t.toCostMinor === null || costMinor < BigInt(t.toCostMinor)));
  const price = roundMinor(dec(costMinor).times(dec(tier.multiplier)));
  return { since: 1, itemKey, kind: "material", categoryKey: "materials", name, uom, trade: trade2, costMinor: costMinor.toString(), unitPriceMinor: price.toString(), taxCategory: "material", cancellationClassDefault: "necessary_replacement_parts" };
});
function tasks(trade2, businessUnitId, categoryKey, rows) {
  return rows.map(([itemKey, name, laborHours, dollars, cls, description, since, v3], i) => ({
    since: since ?? 1,
    itemKey,
    kind: "service_task",
    categoryKey,
    name,
    trade: trade2,
    businessUnitId,
    laborHours,
    uom: "job",
    unitPriceMinor: usd2(dollars),
    customerDescription: description ?? `${name}. Flat rate, including labour and standard parts.`,
    taxCategory: "labor",
    cancellationClassDefault: cls ?? "requested_repair",
    sortOrder: i,
    ...v3 ? { v3UnitPriceMinor: usd2(v3) } : {}
  }));
}
var P = "necessary_replacement_parts";
var ADD = "additional_goods_services";
var HVAC = [
  ...tasks("hvac", BU.hvac, "hvac-diagnostic", [
    ["HVAC-DIAG", "HVAC diagnostic", "1", 89, void 0, "Full system diagnosis by a licensed technician; credited toward the repair if you go ahead today.", 1, 99],
    ["HVAC-DIAG-AH", "HVAC diagnostic, evenings and weekends", "1", 179],
    ["HVAC-SECOND-OPINION", "Second-opinion system evaluation", "1.5", 129],
    ["HVAC-LEAK-SEARCH", "Refrigerant leak search (electronic and bubble test)", "2", 395],
    ["HVAC-DYE-TEST", "Refrigerant UV dye leak test", "1.5", 285],
    ["HVAC-STATIC-TEST", "Static pressure and airflow test", "1", 149],
    ["HVAC-CO-TEST", "Combustion and carbon monoxide test", "1", 129],
    ["HVAC-DUCT-LEAK-TEST", "Duct leakage test", "2", 349]
  ]),
  ...tasks("hvac", BU.hvac, "hvac-repair", [
    ["HVAC-CAP-DUAL", "Replace dual run capacitor", "0.5", 245, P, void 0, 1, 259],
    ["HVAC-CAP-SINGLE", "Replace single run capacitor", "0.5", 195, P],
    ["HVAC-HARDSTART", "Install hard-start kit", "0.75", 345, P],
    ["HVAC-CONTACTOR", "Replace contactor", "0.75", 265, P, void 0, 1, 279],
    ["HVAC-COND-FAN", "Replace condenser fan motor", "1.5", 645, P, void 0, 1, 679],
    ["HVAC-BLOWER-PSC", "Replace blower motor (PSC)", "2", 795, P],
    ["HVAC-BLOWER-ECM", "Replace blower motor (ECM, variable speed)", "2.5", 1395, P],
    ["HVAC-IGNITER", "Replace furnace igniter", "0.75", 285, P, void 0, 1, 299],
    ["HVAC-FLAME-SENSOR", "Clean or replace flame sensor", "0.5", 175, P],
    ["HVAC-PRESSURE-SW", "Replace pressure switch", "1", 345, P],
    ["HVAC-INDUCER", "Replace draft inducer motor", "2", 945, P],
    ["HVAC-GAS-VALVE", "Replace furnace gas valve", "1.5", 745, P],
    ["HVAC-BOARD", "Replace furnace control board", "1.5", 895, P, void 0, 1, 945],
    ["HVAC-TXV", "Replace expansion valve (with recovery and evacuation)", "4", 1495, P],
    ["HVAC-DRIER", "Replace liquid line filter drier", "1.5", 425, P],
    ["HVAC-RECHARGE-410", "Refrigerant charge R-410A (per lb)", "0.25", 115, P, "Refrigerant added after leak check, per pound."],
    ["HVAC-RECHARGE-454", "Refrigerant charge R-454B (per lb)", "0.25", 135, P, "Refrigerant added after leak check, per pound.", 3],
    ["HVAC-LEAK-REPAIR-BRAZE", "Braze repair of accessible refrigerant leak", "2.5", 695],
    ["HVAC-EVAP-CLEAN", "Clean evaporator coil (in place)", "2", 395],
    ["HVAC-COND-CLEAN", "Clean condenser coil (chemical)", "1", 225],
    ["HVAC-DRAIN-CLEAR", "Clear condensate drain line", "0.75", 185],
    ["HVAC-FLOAT-SW", "Install condensate safety float switch", "0.75", 215, P],
    ["HVAC-COND-PUMP", "Replace condensate pump", "1", 395, P],
    ["HVAC-T-STAT-PROG", "Replace thermostat (programmable)", "1", 295, P],
    ["HVAC-T-STAT-SMART", "Upgrade to Wi-Fi smart thermostat", "1.25", 495, ADD],
    ["HVAC-DISCONNECT", "Replace AC disconnect and whip", "1.25", 395, P],
    ["HVAC-COMPRESSOR-WARRANTY", "Compressor replacement labour (parts under manufacturer warranty)", "6", 1895],
    ["HVAC-COIL-WARRANTY", "Evaporator coil replacement labour (parts under warranty)", "6", 1795],
    ["HVAC-REFRIG-RECOVERY", "Refrigerant recovery and disposal", "1", 245],
    ["HVAC-PAD-LEVEL", "Re-level condenser on new pad", "1", 295, P]
  ]),
  ...tasks("hvac", BU.hvac, "hvac-maintenance", [
    ["HVAC-TUNE-COOL", "Cooling tune-up", "1.5", 129, void 0, "21-point cooling tune-up: coil rinse, electrical tightening, refrigerant check and drain flush.", 1, 139],
    ["HVAC-TUNE-HEAT", "Heating tune-up", "1.5", 129, void 0, "Furnace safety inspection: burners, heat exchanger, flue, igniter and carbon monoxide test.", 1, 139],
    ["HVAC-TUNE-HP", "Heat pump tune-up", "1.75", 149],
    ["HVAC-FILTER-CHANGE", "Replace standard filter", "0.25", 39, P],
    ["HVAC-MEDIA-FILTER", "Replace 4 in media filter", "0.25", 95, P],
    ["HVAC-TUNE-COMMERCIAL-RTU", "Rooftop unit preventive maintenance (per unit)", "2", 245]
  ]),
  ...tasks("hvac", BU.hvac, "hvac-ductwork", [
    ["DUCT-SEAL", "Seal accessible ductwork with mastic", "4", 895, ADD],
    ["DUCT-RUN-6", "Add or replace 6 in supply run", "2", 495, ADD],
    ["DUCT-RUN-8", "Add or replace 8 in supply run", "2.25", 565, ADD],
    ["DUCT-RETURN", "Add return air drop", "4", 1195, ADD],
    ["DUCT-REPAIR", "Repair disconnected or crushed duct", "1.5", 345],
    ["DUCT-CLEAN", "Whole-home duct cleaning (up to 12 vents)", "4", 549, ADD],
    ["DUCT-REPLACE-ATTIC", "Replace attic duct system (single-storey, up to 2,000 sq ft)", "16", 6495, ADD]
  ]),
  ...tasks("hvac", BU.hvac, "hvac-iaq", [
    ["IAQ-UV", "Install UV-C coil purifier", "1.5", 895, ADD, "Ultraviolet lamp over the indoor coil to keep it free of mould and bacterial growth.", 2],
    ["IAQ-MEDIA-CABINET", "Install 4 in media filter cabinet", "2", 695, ADD, void 0, 2],
    ["IAQ-ELECTRONIC-AC", "Install electronic air cleaner", "2.5", 1695, ADD, void 0, 2],
    ["IAQ-HUMIDIFIER", "Install whole-home bypass humidifier", "3", 1295, ADD, void 0, 2],
    ["IAQ-DEHUMIDIFIER", "Install whole-home dehumidifier (70 pint)", "4", 2895, ADD, void 0, 2],
    ["IAQ-ERV", "Install energy recovery ventilator", "6", 3895, ADD, void 0, 2],
    ["IAQ-ZONE-2", "Add two-zone damper system", "6", 2695, ADD, void 0, 2]
  ])
];
var PLUMBING = [
  ...tasks("plumbing", BU.plumbing, "plumbing-drain", [
    ["DRAIN-SINK", "Clear sink or lavatory drain", "1", 189, void 0, "Clear one sink drain by cable from the trap or cleanout.", 1, 199],
    ["DRAIN-TUB", "Clear tub or shower drain", "1", 199, void 0, void 0, 1, 209],
    ["DRAIN-TOILET", "Clear toilet (auger)", "0.75", 169],
    ["DRAIN-TOILET-PULL", "Pull toilet and clear line", "1.5", 329],
    ["DRAIN-MAIN-CLEANOUT", "Clear main line from accessible cleanout", "1.5", 295, void 0, void 0, 1, 319],
    ["DRAIN-MAIN-ROOF", "Clear main line through roof vent", "2.5", 495],
    ["DRAIN-LAUNDRY", "Clear laundry standpipe", "1", 199],
    ["DRAIN-HYDROJET", "Hydro-jet main line (up to 100 ft)", "3", 695, ADD],
    ["DRAIN-CAMERA", "Sewer camera inspection with recording", "1", 299],
    ["DRAIN-LOCATE", "Locate and mark sewer line", "0.75", 175],
    ["DRAIN-ENZYME", "Monthly enzyme drain treatment (6-month supply)", "0.25", 129, ADD],
    ["DRAIN-PTRAP", "Replace P-trap", "0.75", 215, P]
  ]),
  ...tasks("plumbing", BU.plumbing, "plumbing-repair", [
    ["PLB-LEAK-LOCATE", "Locate hidden water leak (acoustic and thermal)", "2", 395],
    ["PLB-SLAB-LEAK-DETECT", "Slab leak detection", "2.5", 495],
    ["PLB-PIPE-REPAIR-12", "Repair 1/2 in water line (accessible)", "1.5", 345],
    ["PLB-PIPE-REPAIR-34", "Repair 3/4 in water line (accessible)", "1.75", 395],
    ["PLB-SLAB-REROUTE", "Re-route slab leak line through attic (single fixture group)", "8", 2895],
    ["PLB-ANGLE-STOP", "Replace angle stop and supply line", "0.75", 195, P],
    ["PLB-MAIN-VALVE", "Replace main shut-off valve", "2", 595, P],
    ["PLB-PRV", "Replace pressure reducing valve", "2", 745, P, void 0, 1, 785],
    ["PLB-EXP-TANK", "Install thermal expansion tank", "1", 395, P],
    ["PLB-TOILET-REBUILD", "Rebuild toilet tank (fill valve and flapper)", "1", 245, P],
    ["PLB-TOILET-RESET", "Reset toilet with new wax ring", "1", 265, P],
    ["PLB-CARTRIDGE", "Replace shower valve cartridge", "1", 295, P],
    ["PLB-SHOWER-VALVE", "Replace shower valve (open wall, tile not included)", "4", 1095],
    ["PLB-DISPOSAL-REPAIR", "Free jammed disposal and reset", "0.5", 149],
    ["PLB-ICE-LINE", "Install refrigerator ice-maker line", "1", 245, ADD],
    ["PLB-WASHER-BOX", "Replace washing machine valve box", "2.5", 645],
    ["PLB-SUMP", "Replace sump pump", "1.5", 645, P]
  ]),
  ...tasks("plumbing", BU.plumbing, "plumbing-fixtures", [
    ["FIX-FAUCET-KITCHEN", "Install kitchen faucet (customer or Summit supplied)", "1.25", 295],
    ["FIX-FAUCET-LAV", "Install lavatory faucet", "1", 245],
    ["FIX-TOILET", "Install new toilet (1.28 gpf, elongated)", "1.5", 645, ADD],
    ["FIX-DISPOSAL-12", "Install 1/2 hp garbage disposal", "1", 445, ADD],
    ["FIX-DISPOSAL-34", "Install 3/4 hp garbage disposal", "1", 595, ADD],
    ["FIX-DISHWASHER", "Connect dishwasher (water and drain)", "1.5", 295],
    ["FIX-HOSE-BIB-ADD", "Add new hose bib", "2.5", 495, ADD],
    ["FIX-TUB-SPOUT", "Replace tub spout", "0.5", 145]
  ]),
  ...tasks("plumbing", BU.plumbing, "plumbing-water-heater", [
    ["WH-FLUSH", "Flush water heater", "1", 189],
    ["WH-ANODE", "Replace anode rod", "1", 295, P],
    ["WH-TP-VALVE", "Replace temperature and pressure relief valve", "0.75", 245, P],
    ["WH-ELEMENT", "Replace electric element", "1", 295, P],
    ["WH-THERMOSTAT", "Replace electric thermostat", "1", 295, P],
    ["WH-THERMOCOUPLE", "Replace gas thermocouple", "0.75", 225, P],
    ["WH-GAS-CONTROL", "Replace gas control valve", "1.5", 595, P],
    ["WH-TANKLESS-DESCALE", "Descale tankless water heater", "1.5", 295],
    ["WH-PAN", "Install drain pan and line", "1.5", 345, ADD],
    ["WH-HAUL", "Remove and dispose of old water heater", "0.5", 125]
  ]),
  ...tasks("plumbing", BU.plumbing, "plumbing-gas", [
    ["GAS-LEAK-TEST", "Gas line pressure test", "1.5", 295],
    ["GAS-CONNECTOR", "Replace appliance gas connector", "0.75", 225, P],
    ["GAS-LINE-RUN", "Run new gas line (up to 25 ft CSST)", "4", 1095, ADD],
    ["GAS-SHUTOFF", "Replace gas shut-off valve", "1", 295, P]
  ]),
  ...tasks("plumbing", BU.plumbing, "plumbing-water-quality", [
    ["WQ-TEST", "Water quality test (hardness, chlorine, TDS)", "0.5", 0, void 0, "Free water test with any plumbing visit."],
    ["WQ-SEDIMENT", "Install whole-home sediment filter", "2.5", 895, ADD],
    ["WQ-SOFTENER", "Install water softener (40k grain)", "4", 2495, ADD],
    ["WQ-RO", "Install under-sink reverse osmosis", "2", 895, ADD]
  ])
];
var ELECTRICAL = [
  ...tasks("electrical", BU.electrical, "electrical-diagnostic", [
    ["ELE-DIAG", "Electrical diagnostic", "1", 99, void 0, "Trace and diagnose one electrical problem; credited toward the repair if you go ahead today."],
    ["ELE-SAFETY-INSPECT", "Whole-home electrical safety inspection", "2", 199],
    ["ELE-THERMAL-SCAN", "Panel thermal imaging scan", "0.75", 149]
  ]),
  ...tasks("electrical", BU.electrical, "electrical-repair", [
    ["ELE-RECEPT", "Replace receptacle", "0.5", 145, P, void 0, 1, 155],
    ["ELE-SWITCH", "Replace switch", "0.5", 135, P],
    ["ELE-DIMMER", "Install LED dimmer", "0.75", 195, ADD],
    ["ELE-BREAKER-20", "Replace 20 A breaker", "0.75", 225, P],
    ["ELE-BREAKER-50", "Replace 50 A double-pole breaker", "1", 295, P],
    ["ELE-LOOSE-NEUTRAL", "Repair loose neutral or connection in panel", "1.5", 345],
    ["ELE-CIRCUIT-TRACE", "Trace and repair open circuit", "2", 395],
    ["ELE-NEW-CIRCUIT-20", "Add dedicated 20 A circuit (up to 50 ft)", "3", 695, ADD],
    ["ELE-NEW-OUTLET", "Add new outlet on existing circuit", "1.5", 295, ADD],
    ["ELE-OUTDOOR-OUTLET", "Add weather-resistant outdoor outlet", "2", 395, ADD],
    ["ELE-DOORBELL", "Replace doorbell transformer", "1", 195, P],
    ["ELE-ALUMINUM-PIGTAIL", "Pigtail aluminum branch wiring (per device)", "0.5", 95]
  ]),
  ...tasks("electrical", BU.electrical, "electrical-panel", [
    ["PANEL-INSPECT", "Panel inspection and torque check", "1", 175],
    ["PANEL-SUBPANEL", "Install 100 A sub-panel", "8", 2495, ADD],
    ["PANEL-METER-BASE", "Replace meter base (utility coordination)", "6", 1895],
    ["PANEL-GROUNDING", "Upgrade grounding and bonding", "3", 795],
    ["PANEL-GENERATOR-INLET", "Install generator inlet and interlock", "4", 1295, ADD]
  ]),
  ...tasks("electrical", BU.electrical, "electrical-lighting", [
    ["LIGHT-FIXTURE", "Replace light fixture (customer supplied)", "1", 195],
    ["LIGHT-FAN", "Install ceiling fan on fan-rated box", "1.5", 295, ADD],
    ["LIGHT-FAN-BOX", "Install ceiling fan with new fan-rated box", "2", 395, ADD],
    ["LIGHT-CAN-4", "Install four LED wafer lights", "3", 795, ADD],
    ["LIGHT-CAN-6", "Install six LED wafer lights", "4", 1095, ADD],
    ["LIGHT-MOTION", "Install motion security light", "1.25", 295, ADD],
    ["LIGHT-LANDSCAPE-XFMR", "Replace landscape lighting transformer", "1", 345, P]
  ]),
  ...tasks("electrical", BU.electrical, "electrical-safety", [
    ["SAFE-GFCI", "Install GFCI receptacle", "0.75", 225, P],
    ["SAFE-AFCI", "Install AFCI/GFCI breaker", "0.75", 295, P],
    ["SAFE-SMOKE-CO", "Replace hardwired smoke/CO alarm", "0.5", 175, P],
    ["SAFE-SURGE", "Install whole-home surge protector", "1", 495, ADD, "Type 2 surge protective device at the panel; protects every circuit in the home.", 1, 525],
    ["SAFE-SMOKE-ALL", "Replace all hardwired smoke/CO alarms (up to 6)", "2", 795, ADD]
  ])
];
var COMMERCIAL2 = [
  ...tasks("hvac", BU.hvac, "hvac-maintenance", [
    ["COM-RTU-BELT", "Replace rooftop unit blower belt", "0.75", 165, P],
    ["COM-RTU-FILTERS", "Replace rooftop unit filters (per unit)", "0.5", 95, P],
    ["COM-RTU-COIL-CLEAN", "Clean rooftop condenser coil (per unit)", "1.5", 295],
    ["COM-RTU-ECON", "Economizer inspection and actuator test", "1", 195],
    ["COM-RTU-DIAG", "Commercial HVAC diagnostic (first hour)", "1", 189],
    ["COM-RTU-HOURLY", "Commercial HVAC labour (each additional hour)", "1", 165],
    ["COM-MINISPLIT-CLEAN", "Ductless mini-split deep clean (per head)", "1.5", 245],
    ["COM-ICE-MACHINE-DRAIN", "Clear ice machine drain and air gap", "1", 215]
  ]),
  ...tasks("plumbing", BU.plumbing, "plumbing-repair", [
    ["COM-BACKFLOW-TEST", "Annual backflow prevention assembly test", "0.75", 125],
    ["COM-BACKFLOW-REPAIR", "Rebuild backflow prevention assembly", "2", 495, P],
    ["COM-GREASE-TRAP-JET", "Hydro-jet grease line (up to 50 ft)", "2", 545],
    ["COM-FLUSH-VALVE", "Rebuild commercial flush valve", "0.75", 185, P],
    ["COM-MOP-SINK", "Replace mop sink faucet", "1.25", 345, P],
    ["COM-PLUMB-HOURLY", "Commercial plumbing labour (per hour)", "1", 165]
  ]),
  ...tasks("electrical", BU.electrical, "electrical-repair", [
    ["COM-EXIT-SIGN", "Replace exit sign with battery backup", "0.75", 195, P],
    ["COM-EMERG-LIGHT", "Replace emergency light unit", "0.75", 215, P],
    ["COM-LIGHT-RETROFIT", "LED retrofit of 2\xD74 troffer (per fixture)", "0.5", 145, ADD],
    ["COM-PARKING-LIGHT", "Parking lot light repair (lift included)", "2", 595],
    ["COM-ELEC-HOURLY", "Commercial electrical labour (per hour)", "1", 175],
    ["COM-PANEL-LABEL", "Trace and label panel directory", "2", 295],
    ["COM-IR-SCAN", "Commercial switchgear infrared scan", "2", 495]
  ])
];
var FEES = [
  { since: 1, itemKey: "FEE-TRIP", kind: "fee", categoryKey: "fees", name: "Service call", trade: "general", uom: "job", unitPriceMinor: usd2(79), taxCategory: "fee", customerDescription: "Trip and first look; credited toward any repair done today.", cancellationClassDefault: "requested_repair" },
  { since: 1, itemKey: "FEE-AFTER-HOURS", kind: "fee", categoryKey: "fees", name: "After-hours dispatch", trade: "general", uom: "job", unitPriceMinor: usd2(149), taxCategory: "fee", customerDescription: "Evenings, weekends and holidays.", cancellationClassDefault: "requested_repair" },
  { since: 1, itemKey: "FEE-PERMIT-MECH", kind: "fee", categoryKey: "fees", name: "Mechanical permit (City of Austin)", trade: "hvac", uom: "job", unitPriceMinor: usd2(195), costMinor: usd2(150), taxCategory: "permit_passthrough", customerDescription: "City permit and inspection scheduling.", cancellationClassDefault: "additional_goods_services" },
  { since: 1, itemKey: "FEE-PERMIT-PLUMB", kind: "fee", categoryKey: "fees", name: "Plumbing permit (City of Austin)", trade: "plumbing", uom: "job", unitPriceMinor: usd2(175), costMinor: usd2(130), taxCategory: "permit_passthrough", customerDescription: "City permit and inspection scheduling.", cancellationClassDefault: "additional_goods_services" },
  { since: 1, itemKey: "FEE-PERMIT-ELEC", kind: "fee", categoryKey: "fees", name: "Electrical permit (City of Austin)", trade: "electrical", uom: "job", unitPriceMinor: usd2(165), costMinor: usd2(120), taxCategory: "permit_passthrough", customerDescription: "City permit and inspection scheduling.", cancellationClassDefault: "additional_goods_services" },
  { since: 1, itemKey: "FEE-DISPOSAL", kind: "fee", categoryKey: "fees", name: "Equipment haul-away and disposal", trade: "general", uom: "job", unitPriceMinor: usd2(125), costMinor: usd2(40), taxCategory: "disposal", customerDescription: "Removal and lawful disposal of old equipment, including refrigerant recovery.", cancellationClassDefault: "additional_goods_services" },
  { since: 1, itemKey: "FEE-CRANE", kind: "fee", categoryKey: "fees", name: "Crane lift (rooftop equipment)", trade: "hvac", uom: "job", unitPriceMinor: usd2(1450), costMinor: usd2(1100), taxCategory: "fee", customerDescription: "Crane and operator for rooftop equipment.", cancellationClassDefault: "additional_goods_services" }
];
var FORMULA = [
  ["F-HOSE-BIB", "Replace hose bib (frost-free)", "plumbing", BU.plumbing, "plumbing-repair", "1.25", [["MAT-HOSE-BIB", "1"], ["MAT-PEX-12", "3"], ["MAT-PEX-RING", "2"]], P],
  ["F-SUPPLY-LINES", "Replace both supply lines and stops at one fixture", "plumbing", BU.plumbing, "plumbing-repair", "1", [["MAT-ANGLE-STOP", "2"], ["MAT-SUPPLY-LINE", "2"]], P],
  ["F-TOILET-FILL", "Replace toilet fill valve and flapper", "plumbing", BU.plumbing, "plumbing-repair", "0.75", [["MAT-FILL-VALVE", "1"], ["MAT-FLAPPER", "1"]], P],
  ["F-PRV-EXP", "Replace PRV and add expansion tank", "plumbing", BU.plumbing, "plumbing-repair", "2.5", [["MAT-PRV", "1"], ["MAT-EXP-TANK", "1"], ["MAT-COPPER-34", "4"]], P],
  ["F-GAS-RUN-10", "Run gas line to new appliance (10 ft)", "plumbing", BU.plumbing, "plumbing-gas", "2.5", [["MAT-CSST-12", "10"], ["MAT-GAS-FLEX", "1"]], ADD],
  ["F-DISPOSAL-12", "Replace garbage disposal 1/2 hp (installed)", "plumbing", BU.plumbing, "plumbing-fixtures", "1", [["MAT-DISPOSAL-12", "1"]], P],
  ["F-DISPOSAL-34", "Replace garbage disposal 3/4 hp (installed)", "plumbing", BU.plumbing, "plumbing-fixtures", "1", [["MAT-DISPOSAL-34", "1"]], ADD],
  ["F-CAP-DUAL-45", "Dual run capacitor 45/5 (installed)", "hvac", BU.hvac, "hvac-repair", "0.5", [["MAT-CAP-4555", "1"]], P],
  ["F-IGNITER", "Furnace igniter (installed)", "hvac", BU.hvac, "hvac-repair", "0.75", [["MAT-IGNITER", "1"]], P],
  ["F-FLOAT-PUMP", "Condensate pump with float switch (installed)", "hvac", BU.hvac, "hvac-repair", "1.25", [["MAT-COND-PUMP", "1"], ["MAT-FLOAT-SW", "1"], ["MAT-PVC-34", "10"]], P],
  ["F-SMART-TSTAT", "Smart thermostat (installed and configured)", "hvac", BU.hvac, "hvac-repair", "1.25", [["MAT-THERMOSTAT-SMART", "1"]], ADD],
  ["F-DUCT-RUN-8-25", "8 in supply run, 25 ft (installed)", "hvac", BU.hvac, "hvac-ductwork", "2", [["MAT-FLEX-DUCT-8", "25"], ["MAT-REGISTER", "1"], ["MAT-DUCT-MASTIC", "1"]], ADD],
  ["F-GFCI-2", "Two GFCI receptacles (installed)", "electrical", BU.electrical, "electrical-safety", "1", [["MAT-GFCI-20A", "2"]], P],
  ["F-CIRCUIT-20-50", "Dedicated 20 A circuit, 50 ft (formula)", "electrical", BU.electrical, "electrical-repair", "3", [["MAT-BRK-20A", "1"], ["MAT-NM-12", "50"], ["MAT-RECEPT", "1"], ["MAT-BOX", "1"]], ADD],
  ["F-SMOKE-CO-4", "Four hardwired smoke/CO alarms (installed)", "electrical", BU.electrical, "electrical-safety", "1.5", [["MAT-SMOKE-CO", "4"]], ADD],
  ["F-EV-1450-30", "NEMA 14-50 EV outlet, 30 ft run", "electrical", BU.electrical, "electrical-ev", "3.5", [["MAT-BRK-50A", "1"], ["MAT-NM-6", "30"], ["MAT-EV-RECEPT", "1"]], ADD]
];
var formula = FORMULA.map(([itemKey, name, trade2, businessUnitId, categoryKey, laborHours, mats, cls], i) => ({
  since: itemKey.startsWith("F-EV") ? 3 : 1,
  itemKey,
  kind: "service_task",
  pricingMethod: "formula",
  categoryKey,
  name,
  trade: trade2,
  businessUnitId,
  laborHours,
  uom: "job",
  unitPriceMinor: "0",
  materials: mats.map(([key2, quantity]) => ({ itemKey: key2, quantity })),
  customerDescription: `${name}. Price includes labour and the parts listed.`,
  taxCategory: "labor",
  cancellationClassDefault: cls ?? "requested_repair",
  sortOrder: 100 + i
}));
var EV = tasks("electrical", BU.electrical, "electrical-ev", [
  ["EV-L2-HARDWIRE", "Install Level 2 charger, hardwired (customer supplied, up to 30 ft)", "4", 1195, ADD, void 0, 3],
  ["EV-L2-OUTLET", "Install NEMA 14-50 outlet for Level 2 charging (up to 30 ft)", "3.5", 895, ADD, void 0, 3],
  ["EV-LOAD-CALC", "Load calculation for EV charging", "1", 149, void 0, void 0, 3],
  ["EV-LOAD-MANAGER", "Install EV load management device", "2", 795, ADD, void 0, 3]
]);
function ladder(ladderKey, trade2, businessUnitId, categoryKey, kind, rungs) {
  return rungs.map(([tier, itemKey, name, customerDescription, laborHours, cost, price, warrantyText], i) => ({
    since: 2,
    itemKey,
    kind,
    categoryKey,
    name,
    trade: trade2,
    businessUnitId,
    laborHours,
    uom: "job",
    costMinor: usd2(cost),
    unitPriceMinor: usd2(price),
    customerDescription,
    warrantyText,
    taxCategory: kind === "equipment" ? "equipment" : "labor",
    cancellationClassDefault: "additional_goods_services",
    ladderKey,
    tier,
    sortOrder: i
  }));
}
var LADDERS = [
  ...ladder("AC-FURNACE-3T", "hvac", BU.install, "hvac-replacement", "equipment", [
    ["good", "SYS-ACF-3T-GOOD", "3-ton AC and 80% furnace, single stage", "14.3 SEER2 air conditioner, 80% AFUE single-stage furnace, matched coil, new line set, pad, disconnect, programmable thermostat, permit and haul-away.", "12", 4850, 9895, "10-year parts, 2-year labour (with registration)."],
    ["better", "SYS-ACF-3T-BETTER", "3-ton AC and 96% furnace, two stage", "16 SEER2 two-stage air conditioner, 96% AFUE two-stage variable-speed furnace, matched coil, new line set, media filter cabinet, smart thermostat, permit and haul-away.", "14", 6900, 13495, "10-year parts, 5-year labour (with registration)."],
    ["best", "SYS-ACF-3T-BEST", "3-ton variable-speed AC and modulating furnace", "20 SEER2 variable-speed inverter air conditioner, 97% modulating furnace, communicating thermostat, UV-C coil purifier, permit and haul-away.", "16", 9800, 18995, "12-year parts, 10-year labour, 10-year unit replacement (with registration)."]
  ]),
  ...ladder("HEAT-PUMP-3T", "hvac", BU.install, "hvac-replacement", "equipment", [
    ["good", "SYS-HP-3T-GOOD", "3-ton heat pump split, single stage", "15 SEER2 / 7.8 HSPF2 heat pump, matched air handler with 10 kW heat strip, new line set, programmable thermostat, permit and haul-away.", "12", 5200, 10495, "10-year parts, 2-year labour (with registration)."],
    ["better", "SYS-HP-3T-BETTER", "3-ton heat pump split, two stage", "16.5 SEER2 / 8.5 HSPF2 two-stage heat pump, variable-speed air handler, smart thermostat, media filter cabinet, permit and haul-away.", "14", 7300, 14295, "10-year parts, 5-year labour (with registration)."],
    ["best", "SYS-HP-3T-BEST", "3-ton inverter heat pump, cold-climate rated", "21 SEER2 / 10 HSPF2 inverter heat pump, communicating air handler and thermostat, UV-C coil purifier, permit and haul-away.", "16", 10400, 19995, "12-year parts, 10-year labour, 10-year unit replacement (with registration)."]
  ]),
  ...ladder("WATER-HEATER", "plumbing", BU.plumbing, "plumbing-water-heater", "equipment", [
    ["good", "WH-50G-GAS-6", "50-gallon gas water heater, 6-year", "Atmospheric-vent 40,000 BTU tank, new gas connector, T&P valve and discharge, drain pan, expansion tank, permit and haul-away.", "4", 780, 2195, "6-year tank and parts, 1-year labour."],
    ["better", "WH-50G-GAS-12", "50-gallon gas water heater, 12-year", "Commercial-grade 50,000 BTU tank with dual anodes, new gas connector, T&P valve, drain pan, expansion tank, permit and haul-away.", "4.5", 1180, 2895, "12-year tank and parts, 3-year labour."],
    ["best", "WH-TANKLESS-199", "Tankless gas water heater, 199,000 BTU", "Condensing tankless water heater with recirculation-ready controls, new venting, gas line upsizing up to 20 ft, isolation valves, permit and haul-away of the old tank.", "9", 2150, 5495, "15-year heat exchanger, 5-year parts, 3-year labour."]
  ]),
  ...ladder("PANEL-200A", "electrical", BU.electrical, "electrical-panel", "service_task", [
    ["good", "PANEL-200A-GOOD", "200 A panel replacement", "Replace main panel with a 200 A 40-space panel, new breakers for existing circuits, grounding and bonding to code, permit and utility coordination.", "10", 1100, 3895, "5-year workmanship; manufacturer warranty on panel and breakers."],
    ["better", "PANEL-200A-BETTER", "200 A panel with surge and AFCI/GFCI protection", "Everything in the 200 A panel replacement plus whole-home surge protector and AFCI/GFCI breakers where code requires them.", "12", 1650, 5295, "10-year workmanship; manufacturer warranty on panel and breakers."],
    ["best", "PANEL-200A-BEST", "200 A smart panel with EV-ready circuit", "Smart panel with per-circuit monitoring and load management, whole-home surge protector, AFCI/GFCI protection, and a 50 A EV-ready circuit.", "14", 3900, 8995, "10-year workmanship; manufacturer warranty on panel and breakers."]
  ]),
  ...ladder("SEWER-LINE", "plumbing", BU.plumbing, "plumbing-sewer", "service_task", [
    ["good", "SEWER-SPOT-REPAIR", "Sewer spot repair (up to 10 ft, open trench)", "Excavate and replace up to 10 ft of the damaged section with SDR-35 PVC, camera verification, backfill and permit.", "12", 650, 3495, "2-year workmanship on the repaired section."],
    ["better", "SEWER-TRENCHLESS-LINER", "Trenchless sewer lining (up to 60 ft)", "Hydro-jet, then cured-in-place liner from cleanout to tap, new two-way cleanout, camera verification and permit.", "16", 3200, 9995, "10-year workmanship on the lined section."],
    ["best", "SEWER-REPLACE-FULL", "Full sewer line replacement (up to 60 ft)", "Replace the building sewer from foundation to tap with SDR-35 PVC by pipe-bursting or trench, new cleanout, camera verification and permit.", "24", 4200, 14995, "25-year workmanship on the new line."]
  ]),
  ...ladder("REPIPE", "plumbing", BU.plumbing, "plumbing-repipe", "service_task", [
    ["good", "REPIPE-PEX-2BA", "Whole-home PEX repipe (up to 2 bathrooms)", "Replace supply piping with PEX-A home runs through the attic, new stops at every fixture, pressure test and permit; drywall patches ready for paint.", "28", 1800, 6995, "10-year workmanship; 25-year manufacturer warranty on PEX-A."],
    ["better", "REPIPE-PEX-2BA-MANIFOLD", "PEX repipe with manifold and new main valve (up to 2 bathrooms)", "PEX-A repipe with a central manifold, new main shut-off, PRV and expansion tank, pressure test and permit; drywall repaired and textured.", "32", 2600, 8995, "15-year workmanship; 25-year manufacturer warranty on PEX-A."],
    ["best", "REPIPE-COPPER-2BA", "Whole-home Type L copper repipe (up to 2 bathrooms)", "Type L copper supply throughout with new main shut-off, PRV, expansion tank and stops, pressure test and permit; drywall repaired, textured and painted.", "40", 5200, 13995, "20-year workmanship."]
  ])
];
var CATALOG = [...materials, ...HVAC, ...PLUMBING, ...ELECTRICAL, ...COMMERCIAL2, ...FEES, ...formula, ...EV, ...LADDERS];
var itemsFor = (version) => {
  const strip = ({ since: _s, v3UnitPriceMinor: _v, ...item }) => item;
  const added = CATALOG.filter((i) => i.since === version).map(strip);
  const repriced = version === 3 ? CATALOG.filter((i) => i.since < 3 && i.v3UnitPriceMinor).map((i) => ({ ...strip(i), unitPriceMinor: i.v3UnitPriceMinor })) : [];
  return [...added, ...repriced];
};
function supplierCosts() {
  const pct = (key2) => key2.startsWith("MAT-COPPER") || key2.startsWith("MAT-PEX") ? 400 : key2.startsWith("MAT-BRK") ? -300 : 600;
  return MATERIALS.filter(([key2, , , , trade2]) => trade2 === "hvac" || key2.startsWith("MAT-COPPER") || key2.startsWith("MAT-PEX") || key2.startsWith("MAT-BRK")).map(([itemKey, , , cost]) => ({ itemKey, costMinor: roundMinor(dec(cost).times(dec(1e4 + pct(itemKey))).div(1e4)).toString() }));
}
var VERSION_LABELS = { 1: "Launch 2026", 2: "Spring 2026: replacement ladders and IAQ", 3: "Fall 2026: EV charging and price review" };

// features/keystone/seed/pricebook.ts
var chunks = (rows, size) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));
async function seedUnits(db, actor, key2) {
  const result = await command(db, { name: "pricebook.units", actor, idempotencyKey: key2, params: {} }, async (uow) => {
    const have = new Set((await uow.tx.unitOfMeasure.findMany({ select: { code: true } })).map((u) => u.code));
    const missing = UNITS.filter((u) => !have.has(u.code));
    if (missing.length) {
      await uow.tx.unitOfMeasure.createMany({ data: missing.map((u) => ({ ...u })) });
      auditCreate(uow, actor, "UnitOfMeasure", "seed", "unit_of_measure.created", { codes: missing.map((u) => u.code) }, { metadata: { seed: true } });
    }
    return { units: missing.length };
  });
  return result.value;
}
async function fillDraft(db, maker, prefix, draft, items, settings) {
  let version = draft.version;
  if (settings) {
    const saved = await saveDraftSettings(db, maker, {
      versionId: draft.versionId,
      expectedVersion: version,
      idempotencyKey: `${prefix}:settings`,
      categories: CATEGORIES,
      laborRates: LABOR_RATES,
      markupTables: MARKUP_TABLES
    });
    version = saved.version;
  }
  for (const [i, chunk] of chunks(items, 150).entries()) {
    const saved = await saveDraftItems(db, maker, { versionId: draft.versionId, items: chunk, expectedVersion: version, idempotencyKey: `${prefix}:items:${i}` });
    version = saved.version;
  }
  return version;
}
async function publish(db, maker, checker, prefix, versionId, expectedVersion, note) {
  const submitted = await submitPriceBookVersion(db, maker, { versionId, expectedVersion, note, idempotencyKey: `${prefix}:submit` });
  const request = await db.approvalRequest.findUniqueOrThrow({ where: { id: submitted.approvalRequestId }, select: { id: true, version: true, status: true } });
  if (request.status === "pending") await decideApprovalAs(db, checker, { requestId: request.id, decision: "approve", expectedVersion: request.version, idempotencyKey: `${prefix}:approve` });
  return submitted;
}
async function seedPriceBook(db, opts) {
  const prefix = opts.prefix ?? "seed:pricebook";
  const { maker, checker } = opts;
  const units = await seedUnits(db, maker, `${prefix}:units`);
  const existing = await db.priceBook.findFirst({ where: { code: PRICE_BOOK.code }, select: { id: true } });
  const created = existing ? null : await createPriceBook(db, maker, { ...PRICE_BOOK, idempotencyKey: `${prefix}:create` });
  const priceBookId = existing?.id ?? created.priceBookId;
  const versions = await db.priceBookVersion.findMany({ where: { priceBookId }, select: { id: true, versionNumber: true, status: true, version: true }, orderBy: { versionNumber: "asc" } });
  const v1 = versions.find((v) => v.versionNumber === 1);
  if (!checker) {
    if (v1.status === "draft") {
      const all2 = [1, 2, 3].flatMap((n) => itemsFor(n)).filter((item, i, rows) => rows.findLastIndex((r) => r.itemKey === item.itemKey) === i);
      const version = await fillDraft(db, maker, `${prefix}:v1`, { versionId: v1.id, version: v1.version }, all2, true);
      await submitPriceBookVersion(db, maker, { versionId: v1.id, expectedVersion: version, note: "Summit standard catalogue", idempotencyKey: `${prefix}:v1:submit` });
    }
    const now = await db.priceBookVersion.findFirst({ where: { priceBookId }, orderBy: { versionNumber: "desc" }, select: { versionNumber: true, status: true } });
    return { units: units.units, priceBookId, items: CATALOG.length, latestVersion: now?.versionNumber ?? null, status: now?.status ?? null };
  }
  if (v1.status === "draft") {
    const version = await fillDraft(db, maker, `${prefix}:v1`, { versionId: v1.id, version: v1.version }, itemsFor(1), true);
    await publish(db, maker, checker, `${prefix}:v1`, v1.id, version, VERSION_LABELS[1]);
  }
  for (const n of [2, 3]) {
    const have = await db.priceBookVersion.findFirst({ where: { priceBookId, versionNumber: n }, select: { id: true, status: true, version: true } });
    if (have && have.status !== "draft") continue;
    const draft = have ? { versionId: have.id, version: have.version } : await (async () => {
      const started = await startPriceBookDraft(db, maker, { priceBookId, label: VERSION_LABELS[n], idempotencyKey: `${prefix}:v${n}:draft` });
      const row = await db.priceBookVersion.findUniqueOrThrow({ where: { id: started.versionId }, select: { version: true } });
      return { versionId: started.versionId, version: row.version };
    })();
    const version = await fillDraft(db, maker, `${prefix}:v${n}`, draft, itemsFor(n), false);
    await publish(db, maker, checker, `${prefix}:v${n}`, draft.versionId, version, VERSION_LABELS[n]);
  }
  const v4 = await db.priceBookVersion.findFirst({ where: { priceBookId, versionNumber: 4 }, select: { id: true } });
  const imported = v4 ? null : await importSupplierCosts(db, maker, { priceBookId, supplier: SUPPLIER, costs: supplierCosts(), idempotencyKey: `${prefix}:v4:costs` });
  const book = await db.priceBook.findUniqueOrThrow({ where: { id: priceBookId }, select: { activeVersionId: true } });
  return { units: units.units, priceBookId, activeVersionId: book.activeVersionId, items: CATALOG.length, supplierDraft: imported?.versionId ?? v4?.id ?? null, costChanges: imported?.changes.length ?? null };
}

// features/keystone/mutations/setup.ts
async function loadCompanySetup(_root, args, context) {
  const actor = await actorFor(context);
  await authorizeOperation(context.prisma, actor, "loadCompanySetup", ["canManageOnboarding"]);
  const result = await command(context.prisma, { name: "setup.load_company", actor, idempotencyKey: args.idempotencyKey, params: {} }, async (uow) => {
    const created = await seedCompanyPlatform(uow, actor);
    await recordAgentAction(uow, actor, { tool: "loadCompanySetup", idempotencyKey: args.idempotencyKey, inputs: {}, output: created });
    return created;
  });
  return { replay: result.replay, created: result.value };
}
async function loadOperationsSetup(_root, args, context) {
  const actor = await actorFor(context);
  await authorizeOperation(context.prisma, actor, "loadOperationsSetup", ["canManageOnboarding"]);
  if (!await context.prisma.businessUnit.count({ where: { id: { startsWith: "seed_bu_" } } })) throw new DomainError(Codes.GUARD_FAILED, "Load the company first.", { reason: "company_missing" });
  const result = await command(context.prisma, { name: "setup.load_operations", actor, idempotencyKey: args.idempotencyKey, params: {} }, async (uow) => {
    const created = await seedOperations(uow, actor);
    await recordAgentAction(uow, actor, { tool: "loadOperationsSetup", idempotencyKey: args.idempotencyKey, inputs: {}, output: created });
    return created;
  });
  const systemActorForWindows = actor.kind === "agent" ? { kind: "system", name: "setup" } : actor;
  const windows = await materializeWindows(context.prisma, systemActorForWindows, { from: localDate({ timeZone: "America/Chicago" }, /* @__PURE__ */ new Date()), days: 21, idempotencyKey: `${args.idempotencyKey}:windows` });
  return { replay: result.replay, created: { ...result.value, windows: windows.created, shifts: windows.shifts } };
}
async function loadPriceBookSetup(_root, args, context) {
  const actor = await actorFor(context);
  await authorizeOperation(context.prisma, actor, "loadPriceBookSetup", ["canManageOnboarding"]);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "A person loads the price book.");
  if (!await context.prisma.businessUnit.count({ where: { id: { startsWith: "seed_bu_" } } })) throw new DomainError(Codes.GUARD_FAILED, "Load the company first.", { reason: "company_missing" });
  const created = await seedPriceBook(context.prisma, { maker: actor, checker: null, prefix: `setup:pricebook:${actor.kind === "user" ? actor.userId : "system"}` });
  return { replay: false, created };
}
var ONBOARDING = ["not_started", "in_progress", "completed", "dismissed"];
async function setCompanyOnboardingStatus(_root, args, context) {
  const actor = await actorFor(context);
  requirePermission(actor, "canManageOnboarding");
  if (!ONBOARDING.includes(args.status)) throw new DomainError(Codes.INVALID_INPUT, "Unknown onboarding status.", { field: "status" });
  const result = await command(context.prisma, { name: "company.onboarding_status", actor, idempotencyKey: args.idempotencyKey, params: { status: args.status, expectedVersion: args.expectedVersion } }, async (uow) => {
    const [company] = await uow.tx.$queryRaw`SELECT id, version, "onboardingStatus" FROM "CompanySettings" WHERE "singletonKey" = 'company' FOR UPDATE`;
    if (!company) throw new DomainError(Codes.NOT_FOUND, "Company settings are not set up yet.");
    if (company.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, "Company settings changed since you loaded them. Reload and try again.", { currentVersion: company.version });
    if (company.onboardingStatus === args.status) return { status: args.status, version: company.version };
    const updated = await uow.tx.companySettings.updateMany({ where: { id: company.id, version: company.version }, data: { onboardingStatus: args.status, version: { increment: 1 } } });
    if (updated.count !== 1) throw new DomainError(Codes.STALE_STATE, "Company settings changed since you loaded them. Reload and try again.");
    uow.audit({ eventType: "company.onboarding_status_changed", entityType: "CompanySettings", entityId: String(company.id), actorUserId: actor.kind === "user" ? actor.userId : null, before: { onboardingStatus: company.onboardingStatus, version: company.version }, after: { onboardingStatus: args.status, version: company.version + 1 } });
    return { status: args.status, version: company.version + 1 };
  });
  return { replay: result.replay, ...result.value };
}

// features/keystone/mutations/audit.ts
async function verifyAuditChain2(_root, _args, context) {
  const actor = await actorFor(context);
  await authorizeOperation(context.prisma, actor, "verifyAuditChain", ["canReadAudit"]);
  const result = await verifyAuditChain(context.prisma);
  return actorCanReadCost(actor) ? result : { ...result, lastHash: "" };
}

// features/keystone/mutations/policy.ts
init_errors();
async function resolvePolicyQuery(_root, args, context) {
  const actor = await actorFor(context);
  await authorizeOperation(context.prisma, actor, "policy.resolve", ["canAccessDashboard"], args);
  if (!POLICY_KINDS.includes(args.kind)) throw new DomainError(Codes.INVALID_INPUT, `Unknown policy kind ${args.kind}.`, { field: "kind" });
  return resolvePolicyFromDb(context.prisma, args.kind, { state: args.state, county: args.county, city: args.city, zip: args.zip, branchId: args.branchId }, args.on);
}

// features/keystone/services/maintenance.ts
async function runMaintenancePass(db, options = {}) {
  const clock = options.now ?? (() => /* @__PURE__ */ new Date());
  const holds = await expireHolds(db, clock());
  const priceBooks = await activateDuePriceBookVersions(db, clock());
  const estimates = await expireDueEstimates(db, clock());
  const notices = await expireCancellationNotices(db, clock());
  return { holds, priceBooks, estimates, notices };
}
var MIN_GAP_MS = 5e3;
var state = globalThis;
async function advanceTimedStates(db, options = {}) {
  const s = state.homeServicesAdvance ??= { at: 0, running: null };
  if (s.running) {
    await s.running.catch(() => void 0);
    if (!options.force) return null;
  }
  if (!options.force && Date.now() - s.at < MIN_GAP_MS) return null;
  const run = runMaintenancePass(db);
  s.running = run;
  try {
    const result = await run;
    s.at = Date.now();
    return result;
  } catch (error) {
    console.error(JSON.stringify({ component: "timed-states", status: "failed", error: error instanceof Error ? error.message.slice(0, 300) : "unknown error" }));
    return null;
  } finally {
    s.running = null;
  }
}

// features/keystone/services/dispatch.ts
var import_node_crypto8 = require("node:crypto");
init_actor();
init_db();
init_cas();
init_canonical();
init_decimal();
init_errors();

// features/keystone/domain/eligibility.ts
init_decimal();
function credentialCurrent(c, date) {
  return c.status === "verified" && (!c.expiresOn || c.expiresOn >= date);
}
function credentialCodes(c) {
  const codes = [];
  if (c.licenseClass) codes.push(c.licenseClass.startsWith("tx_") ? c.licenseClass : `tx_${c.licenseClass}`);
  if (c.kind === "epa_608" && c.epaType && c.epaType !== "none") codes.push(`epa608_${c.epaType}`);
  if (c.kind !== "state_trade_license" && c.kind !== "epa_608") codes.push(c.kind);
  return codes;
}
var isApprenticeCode = (code) => /apprentice/.test(code);
function evaluateEligibility(input) {
  const { date, requirement, rules: rules2, crew } = input;
  const perEmployee = {};
  const crewFindings = [];
  const blockCrew = (code, message, tag) => crewFindings.push({ code, severity: "block", message, tag });
  if (!crew.length) blockCrew("NO_CREW", "No technician is assigned.");
  if (requirement.licensingTags.length && !rules2) blockCrew("POLICY_UNRESOLVED", "No licensing policy applies here, so nobody can be cleared for this work.");
  const rulesFor = (tag) => rules2?.requirements.filter((r) => r.jobTag === tag) ?? [];
  for (const tag of requirement.licensingTags) {
    if (rules2 && !rulesFor(tag).length) blockCrew("UNKNOWN_JOB_TAG", `The licensing policy has no rule for ${tag}.`, tag);
  }
  for (const tag of requirement.licensingTags) {
    for (const rule2 of rulesFor(tag)) {
      if (!rule2.companyLicense) continue;
      const need = rule2.companyLicense;
      const ok = input.companyLicenses.some((l) => l.issuer === need.issuer && need.classes.includes(l.licenseClass) && (!need.endorsement || l.endorsements.includes(need.endorsement)) && (!l.expiresOn || l.expiresOn >= date));
      if (!ok) blockCrew("COMPANY_LICENSE_MISSING", `The company needs a current ${need.issuer} ${need.classes.join(" or ")} licence${need.endorsement ? ` with ${need.endorsement.replaceAll("_", " ")}` : ""} for ${tag.replaceAll("_", " ")}.`, tag);
      if (rule2.maxCoolingTons && requirement.jobCoolingTons && dec(requirement.jobCoolingTons).gt(dec(rule2.maxCoolingTons))) {
        blockCrew("TONNAGE_OVER_CLASS", `The system is ${requirement.jobCoolingTons} tons; this licence class covers up to ${rule2.maxCoolingTons}.`, tag);
      }
    }
  }
  if (requirement.maxCoolingTons && requirement.jobCoolingTons && dec(requirement.jobCoolingTons).gt(dec(requirement.maxCoolingTons))) {
    blockCrew("TONNAGE_OVER_JOB_TYPE", `The system is ${requirement.jobCoolingTons} tons; this job type is limited to ${requirement.maxCoolingTons}.`);
  }
  const supervisors = /* @__PURE__ */ new Set();
  const heldFor = /* @__PURE__ */ new Map();
  for (const member of crew) {
    const findings = [];
    const block = (code, message, tag) => findings.push({ code, severity: "block", employeeId: member.employeeId, message, tag });
    if (member.status !== "active") block("EMPLOYEE_NOT_ACTIVE", "This person is not active.");
    const current2 = member.credentials.filter((c) => credentialCurrent(c, date));
    const expired = member.credentials.filter((c) => c.status === "verified" && c.expiresOn && c.expiresOn < date);
    const codes = new Set(current2.flatMap(credentialCodes));
    for (const kind of requirement.requiredCredentialKinds) if (!current2.some((c) => c.kind === kind)) block("CREDENTIAL_MISSING", `Needs a current ${kind.replaceAll("_", " ")} credential.`);
    for (const tag of requirement.licensingTags) {
      for (const rule2 of rulesFor(tag)) {
        if (!rule2.individual) continue;
        const held = rule2.individual.anyOf.filter((code) => codes.has(code));
        heldFor.set(`${tag}:${member.employeeId}`, held);
        const supervises = rule2.individual.supervisionBy.filter((code) => codes.has(code));
        if (supervises.length) supervisors.add(`${tag}:${member.employeeId}`);
        if (!held.length) {
          const lapsed = expired.flatMap(credentialCodes).filter((code) => rule2.individual.anyOf.includes(code));
          block(lapsed.length ? "CREDENTIAL_EXPIRED" : "LICENSE_MISSING", lapsed.length ? `${lapsed.join(", ")} expired; renew before assigning ${tag.replaceAll("_", " ")} work.` : `Needs one of ${rule2.individual.anyOf.join(", ")} for ${tag.replaceAll("_", " ")}.`, tag);
        }
      }
    }
    perEmployee[member.employeeId] = { eligible: !findings.some((f) => f.severity === "block"), findings };
  }
  for (const tag of requirement.licensingTags) {
    for (const rule2 of rulesFor(tag)) {
      if (!rule2.individual?.supervisionBy.length) continue;
      const needsOnSite = crew.filter((m) => {
        const held = heldFor.get(`${tag}:${m.employeeId}`) ?? [];
        return held.length > 0 && held.every(isApprenticeCode);
      });
      if (!needsOnSite.length) continue;
      const present = crew.some((m) => supervisors.has(`${tag}:${m.employeeId}`) && perEmployee[m.employeeId]?.eligible);
      if (!present) blockCrew("SUPERVISOR_REQUIRED", `${needsOnSite.length === 1 ? "An apprentice" : "Apprentices"} on ${tag.replaceAll("_", " ")} work need a ${rule2.individual.supervisionBy.join(" or ")} on the visit.`, tag);
    }
  }
  if (requirement.requiresSupervisorOnJob && crew.length && !crew.some((m) => [...supervisors].some((s) => s.endsWith(`:${m.employeeId}`)))) {
    blockCrew("SUPERVISOR_REQUIRED", "This job type needs a licensed supervisor on the visit.");
  }
  const eligible = !crewFindings.some((f) => f.severity === "block") && Object.values(perEmployee).every((e) => e.eligible);
  return { eligible, perEmployee, crewFindings };
}

// features/keystone/domain/dispatch.ts
init_decimal();
var DISPATCH_MODEL = "hs-dispatch-v1";
var DISPATCH_FEATURES = ["eligibility", "drive_minutes", "skills", "continuity", "fairness"];
function rankCandidates(candidates) {
  const scored = candidates.map((c) => {
    const explanation = [];
    let score = 0;
    if (!c.eligible) explanation.push(`Not eligible: ${c.eligibilityCodes.join(", ") || "see findings"}`);
    if (!c.onShift) {
      score -= 400;
      explanation.push("Not on shift for this window");
    }
    if (c.overlaps > 0) {
      score -= 300 * c.overlaps;
      explanation.push(`${c.overlaps} overlapping visit${c.overlaps > 1 ? "s" : ""}`);
    }
    if (c.driveMinutes === null) {
      score -= 60;
      explanation.push("Drive time unknown");
    } else {
      score -= c.driveMinutes * 2;
      explanation.push(`About ${c.driveMinutes} min away`);
    }
    if (c.skillsRequired > 0) {
      score += Math.round(100 * c.skillsMatched / c.skillsRequired);
      explanation.push(`${c.skillsMatched} of ${c.skillsRequired} skills`);
    }
    if (c.priorVisitsHere > 0) {
      score += Math.min(3, c.priorVisitsHere) * 25;
      explanation.push(`Has been here ${c.priorVisitsHere} time${c.priorVisitsHere > 1 ? "s" : ""}`);
    }
    const tenths = loadTenths(c.assignedHoursToday);
    score -= tenths;
    explanation.push(`${Math.floor(tenths / 10)}.${tenths % 10} h already today`);
    return { ...c, score, explanation };
  });
  scored.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || (a.driveMinutes ?? 9999) - (b.driveMinutes ?? 9999) || a.employeeId.localeCompare(b.employeeId));
  return scored.map((c, i) => ({ ...c, rank: i + 1 }));
}
function loadTenths(hours) {
  return Number.parseInt(toScale(dec(hours).times(10), 0), 10);
}
var EARTH_KM = 6371;
var degrees = (value) => Number(String(value));
function driveMinutes(from, to) {
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return null;
  const rad = (v) => degrees(v) * Math.PI / 180;
  const [lat1, lng1, lat2, lng2] = [rad(from.lat), rad(from.lng), rad(to.lat), rad(to.lng)];
  const h = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2;
  const km = 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  return Math.max(1, Math.ceil(km * 1.35 * 60 / 45));
}

// features/keystone/services/dispatch.ts
var ACTIVE_VISIT = ["scheduled", "dispatched", "en_route", "on_site", "working", "paused"];
async function loadVisitContext(db, visitId) {
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      ref: true,
      status: true,
      version: true,
      plannedStart: true,
      plannedDurationMinutes: true,
      capacityHours: true,
      windowId: true,
      window: { select: { startsAt: true, endsAt: true, label: true, date: true } },
      assignments: { where: { active: true }, select: { id: true, employeeId: true, role: true } },
      job: { select: { id: true, ref: true, customerId: true, businessUnitId: true, status: true, version: true, location: { select: { id: true, lat: true, lng: true, state: true, postalCode: true, city: true, county: true, timeZone: true } }, jobType: { select: { id: true, name: true, requirements: { select: { licensingTags: true, requiredCredentialKinds: true, requiresSupervisorOnJob: true, maxCoolingTons: true, skills: { select: { id: true } } } } } } } }
    }
  });
  if (!visit) throw new DomainError(Codes.NOT_FOUND, "Visit not found.");
  return visit;
}
var requirementOf = (ctx) => {
  const r = ctx.job?.jobType?.requirements;
  return {
    licensingTags: r?.licensingTags ?? [],
    requiredCredentialKinds: r?.requiredCredentialKinds ?? [],
    requiresSupervisorOnJob: r?.requiresSupervisorOnJob ?? false,
    maxCoolingTons: r?.maxCoolingTons?.toString() ?? null,
    skillIds: r?.skills.map((s) => s.id) ?? []
  };
};
var placeOf = (ctx) => {
  const loc = ctx.job?.location;
  const state2 = loc?.state ? `US-${loc.state}` : "US-TX";
  return { state: state2, zip: loc?.postalCode ?? null, city: loc?.city ? `${state2}-${loc.city.toUpperCase().replace(/\s+/g, "-")}` : null };
};
async function loadCrew(db, employeeIds) {
  const rows = await db.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, displayName: true, status: true, dispatchable: true, lat: true, lng: true, user: { select: { id: true } }, skills: { select: { id: true } }, credentials: { select: { kind: true, trade: true, licenseClass: true, epaType: true, status: true, expiresOn: true } } }
  });
  return rows;
}
var toMember = (e, role) => ({
  employeeId: e.id,
  role,
  status: e.status,
  credentials: e.credentials.map((c) => ({ kind: c.kind, trade: c.trade, licenseClass: c.licenseClass, epaType: c.epaType, status: c.status, expiresOn: c.expiresOn ? c.expiresOn.toISOString().slice(0, 10) : null }))
});
async function licensingFor(db, ctx, date) {
  try {
    const resolved = await resolvePolicyFromDb(db, "licensing", placeOf(ctx), date);
    return { rules: resolved.rules, versionId: resolved.versionId };
  } catch (error) {
    if (error instanceof DomainError && (error.code === Codes.POLICY_MISSING || error.code === Codes.POLICY_AMBIGUOUS)) return { rules: null, versionId: null };
    throw error;
  }
}
async function companyLicenses(db, date) {
  const rows = await db.contractorLicense.findMany({ select: { issuer: true, licenseClass: true, endorsements: true, trade: true, expiresOn: true } });
  return rows.map((l) => ({ issuer: l.issuer, licenseClass: l.licenseClass, endorsements: l.endorsements ?? [], trade: l.trade, expiresOn: l.expiresOn ? l.expiresOn.toISOString().slice(0, 10) : null })).filter((l) => !l.expiresOn || l.expiresOn >= date);
}
var visitDate = (ctx) => ctx.window?.date ? ctx.window.date.toISOString().slice(0, 10) : localDate({ timeZone: ctx.job?.location?.timeZone || "America/Chicago" }, ctx.plannedStart ?? /* @__PURE__ */ new Date());
async function evaluateCrew(db, ctx, crew) {
  const date = visitDate(ctx);
  const [rows, licensing, licenses] = await Promise.all([loadCrew(db, crew.map((c) => c.employeeId)), licensingFor(db, ctx, date), companyLicenses(db, date)]);
  const missing = crew.filter((c) => !rows.some((r) => r.id === c.employeeId));
  if (missing.length) throw new DomainError(Codes.NOT_FOUND, "A selected technician was not found.", { field: "employeeIds" });
  const members = crew.map((c) => toMember(rows.find((r) => r.id === c.employeeId), c.role));
  const req = requirementOf(ctx);
  const result = evaluateEligibility({ date, requirement: { ...req, jobCoolingTons: null }, rules: licensing.rules, companyLicenses: licenses, crew: members });
  return { result, policyVersionId: licensing.versionId, rows, date };
}
var findingCodes = (result, employeeId) => [...result.crewFindings, ...employeeId ? result.perEmployee[employeeId]?.findings ?? [] : Object.values(result.perEmployee).flatMap((e) => e.findings)].map((f) => f.code);
async function overlapsFor(tx, employeeId, visitId, startsAt, endsAt) {
  const others = await tx.visitAssignment.findMany({
    where: { employeeId, active: true, visitId: { not: visitId }, visit: { status: { in: ACTIVE_VISIT }, window: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } } },
    select: { visit: { select: { id: true, ref: true, status: true } } }
  });
  return others.map((o) => o.visit);
}
async function assignVisit(db, actor, args) {
  await authorizeOperation(db, actor, "dispatch.apply", ["canDispatch"], args);
  const ids = [...new Set(args.employeeIds)];
  if (!ids.length || ids.length > 8) throw new DomainError(Codes.INVALID_INPUT, "Assign between one and eight people.", { field: "employeeIds" });
  const leadId = args.leadEmployeeId && ids.includes(args.leadEmployeeId) ? args.leadEmployeeId : ids[0];
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "dispatch.assign", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const ctx = await loadVisitContext(tx, args.visitId);
    const reassign = ctx.status !== "unassigned";
    if (actor.kind === "agent" && reassign) throw new DomainError(Codes.NOT_AUTHORIZED, "Agents can only assign unassigned visits. Ask a dispatcher to reassign.", { currentStatus: ctx.status });
    if (!["unassigned", "scheduled", "dispatched"].includes(ctx.status)) throw new DomainError(Codes.INVALID_TRANSITION, `A ${ctx.status.replaceAll("_", " ")} visit can't be reassigned.`, { currentStatus: ctx.status, currentVersion: ctx.version, to: "scheduled" });
    if (ctx.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, "This visit changed since you loaded it. Reload and try again.", { currentStatus: ctx.status, currentVersion: ctx.version });
    const startsAt = ctx.window?.startsAt ?? ctx.plannedStart;
    const endsAt = ctx.window?.endsAt ?? (ctx.plannedStart ? new Date(ctx.plannedStart.getTime() + (ctx.plannedDurationMinutes ?? 60) * 6e4) : null);
    if (!startsAt || !endsAt) throw new DomainError(Codes.GUARD_FAILED, "This visit has no arrival window yet.", { reason: "no_window" });
    const date = visitDate(ctx);
    for (const id of [...ids].sort()) await advisoryLock(tx, `tech-day:${id}:${date}`);
    const crew = ids.map((id) => ({ employeeId: id, role: id === leadId ? "lead" : "helper" }));
    const { result: eligibility, policyVersionId, rows } = await evaluateCrew(tx, ctx, crew);
    for (const e of rows) if (!e.dispatchable) eligibility.perEmployee[e.id] = { eligible: false, findings: [...eligibility.perEmployee[e.id]?.findings ?? [], { code: "NOT_DISPATCHABLE", severity: "block", employeeId: e.id, message: `${e.displayName} is not dispatchable.` }] };
    const evaluations = await tx.eligibilityEvaluation.createManyAndReturn({
      data: crew.map((c) => ({ visitId: ctx.id, employeeId: c.employeeId, policyVersionId, result: eligibility.perEmployee[c.employeeId]?.eligible && !eligibility.crewFindings.length ? "eligible" : "ineligible", findings: { member: eligibility.perEmployee[c.employeeId]?.findings ?? [], crew: eligibility.crewFindings }, evaluatedAt: uow.now })),
      select: { id: true, employeeId: true, result: true }
    });
    const blocked = evaluations.filter((e) => e.result !== "eligible");
    if (blocked.length) {
      throw new DomainError(Codes.NOT_ELIGIBLE, `Not eligible: ${[...new Set(findingCodes({ ...eligibility, perEmployee: Object.fromEntries(Object.entries(eligibility.perEmployee).filter(([k]) => blocked.some((b) => b.employeeId === k))) }))].join(", ")}`, { reason: "eligibility", problems: [...eligibility.crewFindings, ...Object.values(eligibility.perEmployee).flatMap((e) => e.findings)].map((f) => f.message) });
    }
    for (const id of ids) {
      const clashes = await overlapsFor(tx, id, ctx.id, startsAt, endsAt);
      const rolling = clashes.filter((c) => ["en_route", "on_site", "working", "paused"].includes(c.status));
      if (rolling.length) throw new DomainError(Codes.SCHEDULE_CONFLICT, `${rows.find((r) => r.id === id)?.displayName} is on another visit (${rolling[0].ref}).`, { reason: "active_visit" });
      if (clashes.length && !args.overrideReason) throw new DomainError(Codes.SCHEDULE_CONFLICT, `${rows.find((r) => r.id === id)?.displayName} already has ${clashes.map((c) => c.ref).join(", ")} in this window. Give an override reason to double-book.`, { reason: "overlap" });
    }
    const to = "scheduled";
    await casUpdate(uow, { model: "Visit", id: ctx.id, version: ctx.version, from: [ctx.status], to, actor, eventType: reassign ? "visit.reassigned" : "visit.assigned", reason: args.overrideReason ?? null, data: {}, audit: { employeeIds: ids, leadEmployeeId: leadId, recommendationId: args.recommendationId ?? null } });
    if (ctx.assignments.length) {
      await tx.visitAssignment.updateMany({ where: { visitId: ctx.id, active: true }, data: { active: false, endedAt: uow.now } });
    }
    await tx.visitAssignment.createMany({
      data: crew.map((c) => ({ visitId: ctx.id, employeeId: c.employeeId, role: c.role, assignedAt: uow.now, assignedById: actorUserId(actor), assignedByAgentId: actorAgentId(actor), recommendationId: args.recommendationId ?? null, overrideReason: args.overrideReason ?? "", eligibilityId: evaluations.find((e) => e.employeeId === c.employeeId)?.id ?? null, active: true }))
    });
    await tx.visitStatusEvent.create({ data: { visitId: ctx.id, actorUserId: actorUserId(actor), fromStatus: ctx.status, toStatus: to, kind: "transition", occurredAt: uow.now, idempotencyKey: `server:${idempotencyKey}`, note: reassign ? "reassigned" : "assigned" } });
    if (args.recommendationId) {
      const rec = await tx.dispatchRecommendation.findUnique({ where: { id: args.recommendationId }, select: { id: true, version: true, decision: true, rankedCandidates: true, visitId: true } });
      if (rec && rec.visitId === ctx.id && rec.decision === "proposed") {
        const top = (rec.rankedCandidates ?? [])[0]?.employeeId;
        const decision = top === leadId ? "applied" : "overridden";
        await casUpdate(uow, { model: "DispatchRecommendation", id: rec.id, version: rec.version, from: ["proposed"], to: decision, actor, eventType: `dispatch_recommendation.${decision}`, statusField: "decision", reason: args.overrideReason ?? null, data: { decidedById: actorUserId(actor), decidedAt: uow.now } });
      }
    }
    if (ctx.job && ctx.job.status === "booked") {
      await casUpdate(uow, { model: "Job", id: ctx.job.id, version: ctx.job.version, from: ["booked"], to: "scheduled", actor, eventType: "job.scheduled" });
    }
    const value = { visitId: ctx.id, status: to, version: ctx.version + 1, employeeIds: ids, leadEmployeeId: leadId, reassigned: reassign };
    await recordAgentAction(uow, actor, { tool: "dispatch.apply", idempotencyKey, inputs: params, output: value });
    return value;
  });
  return { replay: result.replay, ...result.value };
}
async function unassignVisit(db, actor, args) {
  await authorizeOperation(db, actor, "dispatch.unassign", ["canDispatch"], args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "Agents cannot unassign visits.");
  if (!args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Give a reason.", { field: "reason" });
  const result = await command(db, { name: "dispatch.unassign", actor, idempotencyKey: args.idempotencyKey, params: { visitId: args.visitId, expectedVersion: args.expectedVersion, reason: args.reason }, now: args.now }, async (uow) => {
    const row = await transition(uow, { model: "Visit", id: args.visitId, from: ["scheduled", "dispatched"], to: "unassigned", expectedVersion: args.expectedVersion, actor, eventType: "visit.unassigned", reason: args.reason });
    await uow.tx.visitAssignment.updateMany({ where: { visitId: args.visitId, active: true }, data: { active: false, endedAt: uow.now } });
    await uow.tx.visitStatusEvent.create({ data: { visitId: args.visitId, actorUserId: actorUserId(actor), fromStatus: "scheduled", toStatus: "unassigned", kind: "transition", occurredAt: uow.now, idempotencyKey: `server:${args.idempotencyKey}`, note: args.reason } });
    return { visitId: args.visitId, status: row.status, version: row.version };
  });
  return { replay: result.replay, ...result.value };
}
var VISIT_MOVES = {
  dispatched: { from: ["scheduled"], who: "dispatcher" },
  en_route: { from: ["dispatched", "scheduled"], who: "either" },
  on_site: { from: ["en_route"], who: "either" },
  working: { from: ["on_site", "paused"], who: "either" },
  paused: { from: ["working"], who: "either" },
  done: { from: ["working"], who: "either" },
  no_access: { from: ["en_route", "on_site"], who: "either" },
  cancelled: { from: ["unassigned", "scheduled", "dispatched", "en_route", "on_site"], who: "dispatcher" }
};
var ORDER = ["unassigned", "scheduled", "dispatched", "en_route", "on_site", "working", "paused", "done"];
async function setVisitStatus(db, actor, args) {
  const move = VISIT_MOVES[args.to];
  if (!move) throw new DomainError(Codes.INVALID_INPUT, `Unknown visit status ${args.to}.`, { field: "to" });
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "Agents do not change visit status.");
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "visit.status", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const ctx = await loadVisitContext(tx, args.visitId);
    const dispatcher = can(actor, "canDispatch");
    const userId = actorUserId(actor);
    const assigned = userId ? await tx.visitAssignment.count({ where: { visitId: ctx.id, active: true, employee: { user: { id: userId } } } }) : 0;
    const isTech = assigned > 0 && can(actor, "canWorkVisits");
    if (actor.kind === "user" && !(dispatcher || move.who !== "dispatcher" && isTech)) throw new DomainError(Codes.NOT_AUTHORIZED, move.who === "dispatcher" ? "This needs a dispatcher." : "Only the assigned technician or a dispatcher can do this.");
    if (args.to === "cancelled" && !args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Give a reason to cancel.", { field: "reason" });
    if (args.to === "no_access" && !args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Say what you tried (knocked, called, texted).", { field: "reason" });
    const deviceKey = args.deviceEventKey ? `device:${args.deviceEventKey}` : null;
    if (deviceKey) {
      const seen = await tx.visitStatusEvent.findUnique({ where: { idempotencyKey: deviceKey }, select: { id: true } });
      if (seen) return { visitId: ctx.id, status: ctx.status, version: ctx.version, duplicate: true };
    }
    const clientAt = args.clientRecordedAt ? new Date(args.clientRecordedAt) : null;
    if (clientAt && Number.isNaN(clientAt.getTime())) throw new DomainError(Codes.INVALID_INPUT, "clientRecordedAt is not a date.", { field: "clientRecordedAt" });
    const outOfOrder = !move.from.includes(ctx.status) && deviceKey && ORDER.indexOf(ctx.status) >= ORDER.indexOf(args.to) && ORDER.indexOf(args.to) >= 0;
    if (outOfOrder) {
      await tx.visitStatusEvent.create({ data: { visitId: ctx.id, actorUserId: userId, fromStatus: ctx.status, toStatus: args.to, kind: "correction", occurredAt: uow.now, clientRecordedAt: clientAt, idempotencyKey: deviceKey, lat: args.lat ?? null, lng: args.lng ?? null, note: "Arrived out of order; kept for review." } });
      await tx.visit.update({ where: { id: ctx.id }, data: { needsReview: true } });
      uow.audit({ eventType: "visit.status_correction", entityType: "Visit", entityId: ctx.id, actorUserId: userId, after: { reported: args.to, current: ctx.status, clientRecordedAt: args.clientRecordedAt ?? null } });
      return { visitId: ctx.id, status: ctx.status, version: ctx.version, correction: true };
    }
    if (args.expectedVersion !== void 0 && args.expectedVersion !== null && args.expectedVersion !== ctx.version) throw new DomainError(Codes.STALE_STATE, "This visit changed since you loaded it. Reload and try again.", { currentStatus: ctx.status, currentVersion: ctx.version });
    if (!move.from.includes(ctx.status)) throw new DomainError(Codes.INVALID_TRANSITION, `A ${ctx.status.replaceAll("_", " ")} visit can't move to ${args.to.replaceAll("_", " ")}.`, { currentStatus: ctx.status, currentVersion: ctx.version, to: args.to });
    if (["en_route", "on_site"].includes(ctx.status) && args.to === "cancelled" && !dispatcher) throw new DomainError(Codes.NOT_AUTHORIZED, "Only a dispatcher can cancel a visit that is under way.");
    if (args.to === "done") await assertChecklistsDone(tx, ctx.id);
    if (args.to === "working" && ctx.job) await assertCanStartWork(tx, ctx.job.id, uow.now);
    const data = {};
    if (args.to === "on_site") data.actualArrivalAt = clientAt ?? uow.now;
    if (args.to === "done") data.actualDoneAt = clientAt ?? uow.now;
    if (args.to === "cancelled") data.cancelReason = args.reason;
    const version = await casUpdate(uow, { model: "Visit", id: ctx.id, version: ctx.version, from: [ctx.status], to: args.to, actor, eventType: `visit.${args.to}`, reason: args.reason ?? null, data });
    await tx.visitStatusEvent.create({ data: { visitId: ctx.id, actorUserId: userId, fromStatus: ctx.status, toStatus: args.to, kind: "transition", occurredAt: uow.now, clientRecordedAt: clientAt, idempotencyKey: deviceKey ?? `server:${idempotencyKey}`, lat: args.lat ?? null, lng: args.lng ?? null, note: args.reason ?? "" } });
    if (args.to === "cancelled") await freeVisitCapacity(uow, ctx);
    if (ctx.job) await rollJob(uow, actor, ctx.job.id, args.to === "no_access" ? "access" : null);
    return { visitId: ctx.id, status: args.to, version };
  });
  return { replay: result.replay, ...result.value };
}
async function submitChecklist(db, actor, args) {
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "Agents do not fill in visit checklists.");
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "visit.checklist", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const visit = await tx.visit.findUnique({ where: { id: args.visitId }, select: { id: true, status: true, job: { select: { jobType: { select: { checklistTemplate: { select: { id: true, name: true, items: true, templateVersion: true } } } } } } } });
    if (!visit) throw new DomainError(Codes.NOT_FOUND, "Visit not found.");
    const userId = actorUserId(actor);
    const assigned = userId ? await tx.visitAssignment.count({ where: { visitId: visit.id, active: true, employee: { user: { id: userId } } } }) : 0;
    if (!(can(actor, "canDispatch") || assigned > 0 && can(actor, "canWorkVisits"))) throw new DomainError(Codes.NOT_AUTHORIZED, "Only the assigned technician or a dispatcher can do this.");
    if (!["on_site", "working", "paused"].includes(visit.status)) throw new DomainError(Codes.INVALID_TRANSITION, "Fill in the checklist on site.", { currentStatus: visit.status });
    const template = visit.job?.jobType?.checklistTemplate;
    if (!template) throw new DomainError(Codes.INVALID_INPUT, "This job type has no checklist.", { field: "visitId" });
    const items = Array.isArray(template.items) ? template.items : [];
    const answers = {};
    for (const item of items) {
      const value = args.answers?.[item.key];
      if (typeof value !== "string" || !value.trim()) throw new DomainError(Codes.INVALID_INPUT, `Answer "${item.label}".`, { field: item.key });
      answers[item.key] = value.trim().slice(0, 500);
    }
    const row = await tx.checklistResponse.create({ data: { visitId: visit.id, templateId: template.id, templateVersion: template.templateVersion, answers, completedById: userId, completedAt: uow.now }, select: { id: true } });
    auditCreate(uow, actor, "ChecklistResponse", row.id, "visit.checklist_completed", { visitId: visit.id, templateId: template.id, templateVersion: template.templateVersion });
    return { checklistResponseId: row.id, visitId: visit.id };
  });
  return { replay: result.replay, ...result.value };
}
async function assertChecklistsDone(tx, visitId) {
  const visit = await tx.visit.findUnique({ where: { id: visitId }, select: { job: { select: { jobType: { select: { checklistTemplate: { select: { id: true, required: true, name: true } } } } } } } });
  const template = visit?.job?.jobType?.checklistTemplate;
  if (!template?.required) return;
  const done = await tx.checklistResponse.count({ where: { visitId, templateId: template.id } });
  if (!done) throw new DomainError(Codes.GUARD_FAILED, `Finish the ${template.name} checklist first.`, { reason: "checklist_missing" });
}
async function freeVisitCapacity(uow, ctx) {
  if (!ctx.windowId) return;
  const usage = await uow.tx.capacityUsage.findMany({ where: { visitId: ctx.id }, select: { id: true, hours: true } });
  if (!usage.length) return;
  const total = toScale(decSum(usage.map((u) => u.hours.toString())), "qty");
  await uow.tx.$executeRaw`UPDATE "ArrivalWindow" SET "bookedHours" = GREATEST(0, "bookedHours" - ${total}::numeric), version = version + 1, "updatedAt" = now() WHERE id = ${ctx.windowId}`;
  await uow.tx.capacityUsage.deleteMany({ where: { visitId: ctx.id } });
}
async function rollJob(uow, actor, jobId, holdReason) {
  const job = await uow.tx.job.findUnique({ where: { id: jobId }, select: { id: true, status: true, version: true, visits: { select: { status: true } } } });
  if (!job) return;
  const statuses = job.visits.map((v) => v.status);
  if (holdReason && ["booked", "scheduled", "in_progress"].includes(job.status)) {
    await casUpdate(uow, { model: "Job", id: job.id, version: job.version, from: [job.status], to: "on_hold", actor, eventType: "job.on_hold", reason: holdReason, data: { holdReason, statusBeforeHold: job.status } });
    await uow.tx.task.create({ data: { kind: "job.no_access", title: `No access on ${job.id.slice(-6)}: call the customer and rebook`, subjectType: "Job", subjectId: job.id, status: "open", priority: "high", dueAt: new Date(uow.now.getTime() + 4 * 36e5), dedupeKey: `job.no_access:${job.id}:${job.version}` } });
    return;
  }
  if (job.status === "scheduled" && statuses.some((s) => ["working", "paused", "done"].includes(s))) {
    await casUpdate(uow, { model: "Job", id: job.id, version: job.version, from: ["scheduled"], to: "in_progress", actor, eventType: "job.in_progress" });
    return;
  }
  if (job.status === "booked" && statuses.some((s) => s !== "unassigned" && s !== "cancelled")) {
    await casUpdate(uow, { model: "Job", id: job.id, version: job.version, from: ["booked"], to: "scheduled", actor, eventType: "job.scheduled" });
  }
}
async function holdJob(db, actor, args) {
  await authorizeOperation(db, actor, "job.hold", ["canDispatch", "canBook"], args);
  const reasons = ["parts", "customer_decision", "financing", "permit", "authorization", "access", "other"];
  if (!reasons.includes(args.reason)) throw new DomainError(Codes.INVALID_INPUT, `Hold reason must be one of ${reasons.join(", ")}.`, { field: "reason" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.followUpOn)) throw new DomainError(Codes.INVALID_INPUT, "Pick a follow-up date.", { field: "followUpOn" });
  const result = await command(db, { name: "job.hold", actor, idempotencyKey: args.idempotencyKey, params: { jobId: args.jobId, expectedVersion: args.expectedVersion, reason: args.reason, followUpOn: args.followUpOn }, now: args.now }, async (uow) => {
    const row = await transition(uow, {
      model: "Job",
      id: args.jobId,
      from: ["booked", "scheduled", "in_progress"],
      to: "on_hold",
      expectedVersion: args.expectedVersion,
      actor,
      eventType: "job.on_hold",
      reason: args.reason,
      data: (row2) => ({ holdReason: args.reason, statusBeforeHold: row2.status, holdFollowUpOn: /* @__PURE__ */ new Date(`${args.followUpOn}T00:00:00Z`) })
    });
    await uow.tx.task.create({ data: { kind: "job.hold_follow_up", title: `Follow up on ${row.ref} (${args.reason.replaceAll("_", " ")})`, subjectType: "Job", subjectId: args.jobId, status: "open", priority: "normal", dueAt: /* @__PURE__ */ new Date(`${args.followUpOn}T15:00:00Z`), dedupeKey: `job.hold:${args.jobId}:${row.version}` } });
    return { jobId: args.jobId, status: row.status, version: row.version };
  });
  return { replay: result.replay, ...result.value };
}
async function releaseJobHold(db, actor, args) {
  await authorizeOperation(db, actor, "job.release_hold", ["canDispatch", "canBook"], args);
  const result = await command(db, { name: "job.release_hold", actor, idempotencyKey: args.idempotencyKey, params: { jobId: args.jobId, expectedVersion: args.expectedVersion }, now: args.now }, async (uow) => {
    const job = await uow.tx.job.findUnique({ where: { id: args.jobId }, select: { statusBeforeHold: true } });
    const back = job?.statusBeforeHold && ["booked", "scheduled", "in_progress"].includes(job.statusBeforeHold) ? job.statusBeforeHold : "booked";
    const row = await transition(uow, { model: "Job", id: args.jobId, from: ["on_hold"], to: back, expectedVersion: args.expectedVersion, actor, eventType: "job.hold_released", data: { holdReason: "", statusBeforeHold: "" } });
    return { jobId: args.jobId, status: row.status, version: row.version };
  });
  return { replay: result.replay, ...result.value };
}
async function cancelJob(db, actor, args) {
  await authorizeOperation(db, actor, "job.cancel", ["canDispatch", "canBook"], args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "Agents do not cancel jobs; hand the call to a person.");
  const reasons = ["customer_request", "duplicate", "no_access", "out_of_area", "scheduling", "weather", "other"];
  if (!reasons.includes(args.reason)) throw new DomainError(Codes.INVALID_INPUT, `Cancel reason must be one of ${reasons.join(", ")}.`, { field: "reason" });
  const result = await command(db, { name: "job.cancel", actor, idempotencyKey: args.idempotencyKey, params: { jobId: args.jobId, expectedVersion: args.expectedVersion, reason: args.reason }, now: args.now }, async (uow) => {
    const row = await transition(uow, { model: "Job", id: args.jobId, from: ["draft", "booked", "scheduled", "on_hold"], to: "cancelled", expectedVersion: args.expectedVersion, actor, eventType: "job.cancelled", reason: args.reason, data: { cancelReason: args.reason } });
    const visits = await uow.tx.visit.findMany({ where: { jobId: args.jobId, status: { notIn: ["done", "cancelled", "no_access"] } }, select: { id: true } });
    for (const v of visits) {
      const ctx = await loadVisitContext(uow.tx, v.id);
      if (["en_route", "on_site", "working", "paused"].includes(ctx.status)) throw new DomainError(Codes.GUARD_FAILED, `Visit ${ctx.ref} is under way. Finish or cancel it from the board first.`, { reason: "visit_active" });
      await casUpdate(uow, { model: "Visit", id: ctx.id, version: ctx.version, from: [ctx.status], to: "cancelled", actor, eventType: "visit.cancelled", reason: args.reason, data: { cancelReason: args.reason } });
      await uow.tx.visitAssignment.updateMany({ where: { visitId: ctx.id, active: true }, data: { active: false, endedAt: uow.now } });
      await uow.tx.visitStatusEvent.create({ data: { visitId: ctx.id, actorUserId: actorUserId(actor), fromStatus: ctx.status, toStatus: "cancelled", kind: "transition", occurredAt: uow.now, idempotencyKey: `server:${args.idempotencyKey}:${ctx.id}`, note: args.reason } });
      await freeVisitCapacity(uow, ctx);
    }
    return { jobId: args.jobId, status: row.status, version: row.version, visitsCancelled: visits.length };
  });
  return { replay: result.replay, ...result.value };
}
async function recommendDispatch(db, actor, args) {
  await authorizeOperation(db, actor, "dispatch.recommend", ["canDispatch", "canViewBoard"], args);
  const ctx = await loadVisitContext(db, args.visitId);
  if (!["unassigned", "scheduled"].includes(ctx.status)) throw new DomainError(Codes.INVALID_TRANSITION, `A ${ctx.status} visit is past recommending.`, { currentStatus: ctx.status });
  const date = visitDate(ctx);
  const startsAt = ctx.window?.startsAt ?? ctx.plannedStart ?? /* @__PURE__ */ new Date();
  const endsAt = ctx.window?.endsAt ?? new Date(startsAt.getTime() + 2 * 36e5);
  const req = requirementOf(ctx);
  const pool = await db.employee.findMany({
    where: { status: "active", dispatchable: true, kind: { in: ["technician", "apprentice"] }, ...ctx.job?.businessUnitId ? { businessUnits: { some: { id: ctx.job.businessUnitId } } } : {} },
    select: { id: true, displayName: true, lat: true, lng: true, skills: { select: { id: true } } },
    take: 40
  });
  const ids = pool.map((p) => p.id);
  const dayStart = /* @__PURE__ */ new Date(`${date}T00:00:00Z`);
  const [shifts, assignments, history] = await Promise.all([
    db.shift.findMany({ where: { employeeId: { in: ids }, date: dayStart }, select: { employeeId: true, startsAt: true, endsAt: true } }),
    db.visitAssignment.findMany({ where: { employeeId: { in: ids }, active: true, visit: { window: { date: dayStart }, status: { in: ACTIVE_VISIT } } }, select: { employeeId: true, visit: { select: { id: true, capacityHours: true, window: { select: { startsAt: true, endsAt: true } } } } } }),
    ctx.job?.location?.id ? db.visitAssignment.findMany({ where: { employeeId: { in: ids }, visit: { status: "done", job: { locationId: ctx.job.location.id } } }, select: { employeeId: true } }) : Promise.resolve([])
  ]);
  const [licensing, licenses, crewRows] = await Promise.all([licensingFor(db, ctx, date), companyLicenses(db, date), loadCrew(db, ids)]);
  const candidates = pool.map((p) => {
    const row = crewRows.find((r) => r.id === p.id);
    const solo = evaluateEligibility({ date, requirement: { ...req, jobCoolingTons: null }, rules: licensing.rules, companyLicenses: licenses, crew: [toMember(row, "lead")] });
    const mine = assignments.filter((a) => a.employeeId === p.id && a.visit?.id !== ctx.id);
    return {
      employeeId: p.id,
      name: p.displayName,
      eligible: solo.eligible,
      eligibilityCodes: [...new Set(findingCodes(solo))],
      driveMinutes: driveMinutes(p.lat ? { lat: p.lat.toString(), lng: p.lng?.toString() ?? null } : null, ctx.job?.location?.lat ? { lat: ctx.job.location.lat.toString(), lng: ctx.job.location.lng?.toString() ?? null } : null),
      skillsMatched: req.skillIds.filter((id) => p.skills.some((s) => s.id === id)).length,
      skillsRequired: req.skillIds.length,
      priorVisitsHere: history.filter((h) => h.employeeId === p.id).length,
      assignedHoursToday: toScale(decSum(mine.map((a) => a.visit?.capacityHours?.toString() ?? "0")), "qty"),
      onShift: shifts.some((s) => s.employeeId === p.id && s.startsAt <= startsAt && s.endsAt >= endsAt),
      overlaps: mine.filter((a) => a.visit?.window && a.visit.window.startsAt < endsAt && a.visit.window.endsAt > startsAt).length
    };
  });
  const ranked = rankCandidates(candidates).slice(0, 10);
  const features = { model: DISPATCH_MODEL, features: DISPATCH_FEATURES, date, window: ctx.window?.label ?? null, requirement: req, licensingVersionId: licensing.versionId };
  const inputsHash = (0, import_node_crypto8.createHash)("sha256").update(canonicalJson({ visitId: ctx.id, visitVersion: ctx.version, candidates })).digest("hex");
  const result = await command(db, { name: "dispatch.recommend", actor, idempotencyKey: args.idempotencyKey, params: { visitId: args.visitId }, now: args.now }, async (uow) => {
    const rec = await uow.tx.dispatchRecommendation.create({
      data: { visitId: ctx.id, rankedCandidates: ranked, inputsHash, features, modelRef: DISPATCH_MODEL, generatedById: actorAgentId(actor), requestedById: actorUserId(actor), decision: "proposed" },
      select: { id: true, version: true }
    });
    auditCreate(uow, actor, "DispatchRecommendation", rec.id, "dispatch_recommendation.proposed", { visitId: ctx.id, top: ranked.slice(0, 3).map((r) => ({ employeeId: r.employeeId, score: r.score, eligible: r.eligible })), inputsHash });
    const value = { recommendationId: rec.id, visitId: ctx.id, visitVersion: ctx.version, modelRef: DISPATCH_MODEL, candidates: ranked.map((r) => ({ employeeId: r.employeeId, name: r.name, rank: r.rank, eligible: r.eligible, score: r.score, explanation: r.explanation })) };
    await recordAgentAction(uow, actor, { tool: "dispatch.recommend", idempotencyKey: args.idempotencyKey, inputs: { visitId: args.visitId }, output: { recommendationId: rec.id } });
    return value;
  });
  return { replay: result.replay, ...result.value };
}
async function checkEligibility(db, actor, args) {
  await authorizeOperation(db, actor, "dispatch.eligibility", ["canDispatch", "canViewBoard"], args);
  const ctx = await loadVisitContext(db, args.visitId);
  const crew = args.employeeIds.map((id, i) => ({ employeeId: id, role: i === 0 ? "lead" : "helper" }));
  const { result, policyVersionId, date } = await evaluateCrew(db, ctx, crew);
  await recordAgentRead(db, actor, { tool: "dispatch.eligibility", inputs: args, output: { eligible: result.eligible } });
  return { eligible: result.eligible, date, policyVersionId, crewFindings: result.crewFindings, perEmployee: result.perEmployee };
}

// features/keystone/services/comms.ts
init_actor();
init_cas();
init_errors();
async function recordConsent(db, actor, args) {
  await authorizeOperation(db, actor, "consent.record", ["canManageCustomers", "canBook", "canSendMessages"], args);
  if (!CONSENT_PURPOSES.includes(args.purpose)) throw new DomainError(Codes.INVALID_INPUT, "Unknown consent purpose.", { field: "purpose" });
  if (!["grant", "revoke"].includes(args.action)) throw new DomainError(Codes.INVALID_INPUT, "Action must be grant or revoke.", { field: "action" });
  if (actor.kind === "agent" && args.action === "grant" && !["transactional_sms", "call_recording"].includes(args.purpose)) throw new DomainError(Codes.NOT_AUTHORIZED, "An agent can only record consent to booking texts. Marketing consent is collected in writing.");
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "consent.record", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    let pointId = args.contactPointId ?? null;
    if (!pointId && args.phone && args.customerId) {
      const hash = contactHash(normalizePhone(args.phone));
      pointId = (await uow.tx.contactPoint.findFirst({ where: { valueHash: hash, contact: { customerId: args.customerId } }, select: { id: true } }))?.id ?? null;
    }
    if (!pointId) throw new DomainError(Codes.NOT_FOUND, "No matching phone number or email on that customer.", { field: "contactPointId" });
    const row = await uow.tx.consentRecord.create({ data: { contactPointId: pointId, purpose: args.purpose, action: args.action, channel: args.channel, evidence: args.evidence ?? {}, wordingVersion: args.wordingVersion ?? "", recordedAt: uow.now, actorKind: actor.kind === "agent" ? "agent" : actor.kind === "user" ? "user" : "system", actorId: actorAgentId(actor) ?? actorUserId(actor) ?? "" }, select: { id: true } });
    auditCreate(uow, actor, "ConsentRecord", row.id, `consent.${args.action}`, { contactPointId: pointId, purpose: args.purpose, channel: args.channel });
    const value = { consentRecordId: row.id, contactPointId: pointId, purpose: args.purpose, action: args.action };
    await recordAgentAction(uow, actor, { tool: "consent.record", idempotencyKey, inputs: params, output: value });
    return value;
  });
  return { replay: result.replay, ...result.value };
}

// features/keystone/services/crm.ts
init_actor();
init_cas();
init_errors();

// features/keystone/lib/secretBox.ts
var import_node_crypto9 = require("node:crypto");
function key(version = 1) {
  const material = process.env.SECRET_BOX_KEY || process.env.SESSION_SECRET;
  if (!material) {
    if (process.env.NODE_ENV === "production") throw new Error("SECRET_BOX_KEY is not set");
    return (0, import_node_crypto9.createHash)("sha256").update("openfront-home-services:development-secret-box").digest();
  }
  return (0, import_node_crypto9.createHash)("sha256").update(`openfront-home-services:secret-box:v${version}:${material}`).digest();
}
async function sealSecret(tx, purpose, plaintext, createdById) {
  if (!plaintext || plaintext.length > 4096) throw new Error("Secret must be 1-4096 characters");
  const iv = (0, import_node_crypto9.randomBytes)(12);
  const cipher = (0, import_node_crypto9.createCipheriv)("aes-256-gcm", key(1), iv);
  cipher.setAAD(Buffer.from(purpose));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const row = await tx.secretBox.create({
    data: { purpose, ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64"), keyVersion: 1, ...createdById ? { createdById } : {} },
    select: { id: true }
  });
  return row.id;
}
async function openSecret(tx, id, purpose) {
  const row = await tx.secretBox.findUnique({ where: { id } });
  if (!row || row.purpose !== purpose) throw new Error("Secret not found");
  const decipher = (0, import_node_crypto9.createDecipheriv)("aes-256-gcm", key(row.keyVersion ?? 1), Buffer.from(row.iv, "base64"));
  decipher.setAAD(Buffer.from(purpose));
  decipher.setAuthTag(Buffer.from(row.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

// features/keystone/services/crm.ts
var DUPLICATE_WINDOW_MS = 30 * 6e4;
async function createCustomer(db, actor, args) {
  await authorizeOperation(db, actor, "customer.create", ["canManageCustomers", "canBook"], args);
  const phone = args.customer.phone ? normalizePhone(args.customer.phone) : null;
  const email = args.customer.email ? normalizeEmail(args.customer.email) : null;
  const geo2 = args.location ? await geocoder().geocode({ address1: args.location.address1, city: args.location.city, state: args.location.state ?? "TX", postalCode: args.location.postalCode }) : null;
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "customer.create", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const hashes = [phone, email].filter(Boolean).map((v) => contactHash(v));
    const matches2 = hashes.length ? await uow.tx.contactPoint.findMany({ where: { valueHash: { in: hashes } }, select: { contact: { select: { customerId: true } } }, take: 5 }) : [];
    const customer = await createCustomerInTx(uow, actor, { ...args.customer, phone, email }, { smsConsent: !!args.smsConsent, evidence: { source: "office" } });
    const location = args.location ? await createLocationInTx(uow, actor, customer.id, args.location, geo2) : null;
    return { customerId: customer.id, displayName: customer.displayName, locationId: location?.id ?? null, possibleDuplicates: [...new Set(matches2.map((m) => m.contact?.customerId).filter(Boolean))] };
  });
  return { replay: result.replay, ...result.value };
}
async function addLocation(db, actor, args) {
  await authorizeOperation(db, actor, "location.create", ["canManageCustomers", "canBook"], args);
  const geo2 = await geocoder().geocode({ address1: args.location.address1, city: args.location.city, state: args.location.state ?? "TX", postalCode: args.location.postalCode });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "location.create", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const customer = await uow.tx.customer.findUnique({ where: { id: args.customerId }, select: { id: true, mergedIntoId: true } });
    if (!customer || customer.mergedIntoId) throw new DomainError(Codes.NOT_FOUND, "Customer not found.", { field: "customerId" });
    const location = await createLocationInTx(uow, actor, customer.id, args.location, geo2);
    const area = await serviceAreaFor(uow.tx, null, location.postalCode);
    return { locationId: location.id, inServiceArea: !!area };
  });
  return { replay: result.replay, ...result.value };
}
async function addContactPoint(db, actor, args) {
  await authorizeOperation(db, actor, "contact_point.create", ["canManageCustomers", "canBook"], args);
  const value = args.kind === "email" ? normalizeEmail(args.value) : normalizePhone(args.value);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "contact_point.create", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const existing = await uow.tx.contactPoint.findFirst({ where: { contactId: args.contactId, kind: args.kind, value }, select: { id: true } });
    if (existing) return { contactPointId: existing.id, created: false };
    const row = await uow.tx.contactPoint.create({ data: { contactId: args.contactId, kind: args.kind, value, valueHash: contactHash(value), isPrimary: !!args.isPrimary, carrierLineType: "unknown" }, select: { id: true } });
    auditCreate(uow, actor, "ContactPoint", row.id, "contact_point.created", { contactId: args.contactId, kind: args.kind, masked: args.kind === "email" ? maskEmail(value) : maskPhone(value) });
    return { contactPointId: row.id, created: true };
  });
  return { replay: result.replay, ...result.value };
}
async function lookupCustomer(db, actor, args) {
  await authorizeOperation(db, actor, "customer.lookup", ["canBook", "canManageCustomers", "canReadCustomerPII"], args);
  const hashes = [];
  if (args.phone) hashes.push(contactHash(normalizePhone(args.phone)));
  if (args.email) hashes.push(contactHash(normalizeEmail(args.email)));
  if (!hashes.length && !(args.name && args.postalCode)) throw new DomainError(Codes.INVALID_INPUT, "Look up by phone, email, or name and ZIP.", { field: "phone" });
  const customers = await db.customer.findMany({
    where: {
      mergedIntoId: null,
      ...hashes.length ? { contacts: { some: { points: { some: { valueHash: { in: hashes } } } } } } : { displayName: { contains: args.name.trim(), mode: "insensitive" }, locations: { some: { postalCode: { startsWith: args.postalCode.trim().slice(0, 5) } } } }
    },
    take: 5,
    select: { id: true, ref: true, kind: true, displayName: true, doNotService: true, contacts: { take: 1, select: { firstName: true, lastName: true, points: { where: { kind: "mobile" }, take: 1, select: { value: true } } } }, locations: { where: { mergedIntoId: null }, take: 5, select: { id: true, address1: true, city: true, postalCode: true, serviceAreaId: true } } }
  });
  const full = actor.kind === "user" && can(actor, "canReadCustomerPII");
  const out = customers.map((c) => ({
    customerId: c.id,
    ref: c.ref,
    kind: c.kind,
    doNotService: c.doNotService,
    name: full ? c.displayName : maskName(c.contacts[0]?.firstName ?? c.displayName, c.contacts[0]?.lastName ?? ""),
    phone: full ? c.contacts[0]?.points[0]?.value ?? null : maskPhone(c.contacts[0]?.points[0]?.value ?? null),
    locations: c.locations.map((l) => ({ locationId: l.id, address: full ? l.address1 : maskAddress(l.address1), city: l.city, postalCode: l.postalCode, inServiceArea: !!l.serviceAreaId }))
  }));
  await recordAgentRead(db, actor, { tool: "customer.lookup", inputs: { byPhone: !!args.phone, byEmail: !!args.email, byName: !!args.name }, output: { matches: out.length } });
  return { matches: out };
}
async function customerHistory(db, actor, args) {
  await authorizeOperation(db, actor, "customer.history", ["canBook", "canManageCustomers", "canDispatch"], args);
  const jobs = await db.job.findMany({
    where: { customerId: args.customerId },
    orderBy: { createdAt: "desc" },
    take: Math.min(args.limit ?? 10, 25),
    select: { id: true, ref: true, status: true, summary: true, createdAt: true, jobType: { select: { name: true } }, location: { select: { id: true, city: true, postalCode: true } }, visits: { orderBy: { plannedStart: "desc" }, take: 1, select: { status: true, plannedStart: true, window: { select: { label: true, date: true } } } } }
  });
  const out = jobs.map((j) => ({ jobId: j.id, ref: j.ref, status: j.status, jobType: j.jobType?.name ?? null, summary: j.summary, createdAt: j.createdAt.toISOString(), location: j.location ? { locationId: j.location.id, city: j.location.city, postalCode: j.location.postalCode } : null, nextVisit: j.visits[0] ? { status: j.visits[0].status, date: j.visits[0].window?.date?.toISOString().slice(0, 10) ?? null, window: j.visits[0].window?.label ?? null } : null }));
  await recordAgentRead(db, actor, { tool: "customer.history", inputs: args, output: { jobs: out.length } });
  return { customerId: args.customerId, jobs: out };
}
async function lookupLocations(db, actor, args) {
  await authorizeOperation(db, actor, "location.lookup", ["canBook", "canManageCustomers", "canDispatch"], args);
  const rows = await db.serviceLocation.findMany({
    where: { customerId: args.customerId, mergedIntoId: null, ...args.postalCode ? { postalCode: { startsWith: args.postalCode.trim().slice(0, 5) } } : {} },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: { id: true, ref: true, address1: true, address2: true, city: true, state: true, postalCode: true, propertyClass: true, propertyType: true, serviceArea: { select: { name: true } }, accessSecrets: { where: { status: "active" }, select: { kind: true } }, jobs: { where: { status: { in: ["booked", "scheduled", "in_progress", "on_hold"] } }, select: { id: true } } }
  });
  const full = actor.kind === "user" && can(actor, "canReadCustomerPII");
  const out = rows.map((l) => ({
    locationId: l.id,
    ref: l.ref,
    address: full ? [l.address1, l.address2].filter(Boolean).join(", ") : maskAddress(l.address1),
    city: l.city,
    state: l.state,
    postalCode: l.postalCode,
    propertyClass: l.propertyClass,
    propertyType: l.propertyType,
    serviceArea: l.serviceArea?.name ?? null,
    inServiceArea: !!l.serviceArea,
    accessOnFile: [...new Set(l.accessSecrets.map((a) => a.kind))],
    openJobs: l.jobs.length
  }));
  await recordAgentRead(db, actor, { tool: "location.lookup", inputs: { customerId: args.customerId, byZip: !!args.postalCode }, output: { locations: out.length } });
  return { customerId: args.customerId, locations: out };
}
async function storeAccessSecret(db, actor, args) {
  await authorizeOperation(db, actor, "access_secret.store", ["canManageCustomers", "canBook"], {});
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "Agents never handle access codes.");
  if (!args.secret.trim()) throw new DomainError(Codes.INVALID_INPUT, "Enter the code.", { field: "secret" });
  const result = await command(db, { name: "access_secret.store", actor, idempotencyKey: args.idempotencyKey, params: { locationId: args.locationId, kind: args.kind, label: args.label ?? "" }, now: args.now }, async (uow) => {
    const ref = await sealSecret(uow.tx, "access_secret", args.secret.trim(), actorUserId(actor));
    const row = await uow.tx.accessSecret.create({ data: { locationId: args.locationId, kind: args.kind, label: args.label ?? "", secretRef: ref, status: "active" }, select: { id: true } });
    auditCreate(uow, actor, "AccessSecret", row.id, "access_secret.stored", { locationId: args.locationId, kind: args.kind });
    return { accessSecretId: row.id };
  });
  return { replay: result.replay, ...result.value };
}
async function revealAccessSecret(db, actor, args) {
  if (actor.kind !== "user") throw new DomainError(Codes.NOT_AUTHORIZED, "Only a signed-in person can see an access code.");
  const now = args.now ?? /* @__PURE__ */ new Date();
  const secret2 = await db.accessSecret.findUnique({ where: { id: args.accessSecretId }, select: { id: true, status: true, secretRef: true, locationId: true } });
  if (!secret2 || secret2.status !== "active") throw new DomainError(Codes.NOT_FOUND, "Access code not found.");
  const visit = await db.visit.findUnique({ where: { id: args.visitId }, select: { id: true, status: true, window: { select: { startsAt: true, endsAt: true } }, job: { select: { locationId: true } }, assignments: { where: { active: true }, select: { employee: { select: { userId: true } } } } } });
  if (!visit || visit.job?.locationId !== secret2.locationId) throw new DomainError(Codes.NOT_FOUND, "That code is not for this visit.");
  const assigned = visit.assignments.some((a) => a.employee?.userId === actor.userId);
  const office = can(actor, "canRevealAccessSecret");
  if (!assigned && !office) throw new DomainError(Codes.NOT_AUTHORIZED, "Only the assigned technician sees this code.");
  if (assigned && !office) {
    if (!["dispatched", "en_route", "on_site", "working", "paused"].includes(visit.status)) throw new DomainError(Codes.GUARD_FAILED, "The code opens once the visit is dispatched.", { reason: "not_dispatched" });
  }
  if (office && !args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Say why you need the code.", { field: "reason" });
  const plaintext = await runInTransaction(db, async (uow) => {
    const value = await openSecret(uow.tx, secret2.secretRef, "access_secret");
    const reveal = await uow.tx.accessSecretReveal.create({ data: { secretId: secret2.id, revealedToId: actor.userId, visitId: visit.id, revealedAt: now, expiresAt: new Date(now.getTime() + 15 * 6e4), reason: args.reason?.trim() || "assigned technician" }, select: { id: true } });
    auditCreate(uow, actor, "AccessSecretReveal", reveal.id, "access_secret.revealed", { secretId: secret2.id, visitId: visit.id, asOffice: !assigned });
    return value;
  }, { now });
  return { accessSecretId: secret2.id, value: plaintext, visibleUntil: new Date(now.getTime() + 15 * 6e4).toISOString() };
}
async function ingestLead(db, actor, args) {
  await authorizeOperation(db, actor, "lead.ingest", ["canManageLeads", "canBook"], args);
  const phone = args.phone ? normalizePhone(args.phone) : null;
  const email = args.email ? normalizeEmail(args.email) : null;
  if (!phone && !email) throw new DomainError(Codes.INVALID_INPUT, "A lead needs a phone number or an email.", { field: "phone" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "lead.ingest", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx, now } = uow;
    const dup = args.externalId ? await tx.lead.findFirst({ where: { source: args.source, externalId: args.externalId }, select: { id: true, ref: true } }) : await tx.lead.findFirst({ where: { createdAt: { gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS) }, status: { in: ["new", "contacted", "qualified"] }, OR: [...phone ? [{ phoneE164: phone }] : [], ...email ? [{ email }] : []] }, select: { id: true, ref: true } });
    if (dup) return { leadId: dup.id, ref: dup.ref, duplicate: true, customerId: null };
    const hashes = [phone, email].filter(Boolean).map((v) => contactHash(v));
    const match = await tx.contactPoint.findFirst({ where: { valueHash: { in: hashes } }, select: { contact: { select: { customerId: true } } } });
    const settings = await tx.companySettings.findFirst({ select: { features: true } });
    const slaMinutes = Number(settings?.features?.leadFirstResponseMinutes ?? 5);
    const ref = await nextReference(tx, "LEAD", now);
    const lead = await tx.lead.create({
      data: { ref, createdAt: now, source: args.source, externalId: args.externalId ?? "", campaignId: args.campaignId ?? null, trackingNumberId: args.trackingNumberId ?? null, customerId: match?.contact?.customerId ?? null, contactName: args.contactName ?? "", phoneE164: phone ?? "", email: email ?? "", requestedJobTypeId: args.requestedJobTypeId ?? null, summary: args.summary ?? "", status: "new", respondDueAt: new Date(now.getTime() + slaMinutes * 6e4) },
      select: { id: true, ref: true }
    });
    auditCreate(uow, actor, "Lead", lead.id, "lead.created", { ref, source: args.source, matchedCustomer: !!match, campaignId: args.campaignId ?? null });
    await recordAgentAction(uow, actor, { tool: "lead.ingest", idempotencyKey, inputs: params, output: { leadId: lead.id } });
    return { leadId: lead.id, ref: lead.ref, duplicate: false, customerId: match?.contact?.customerId ?? null };
  });
  return { replay: result.replay, ...result.value };
}
async function markLeadContacted(db, actor, args) {
  await authorizeOperation(db, actor, "lead.contact", ["canManageLeads", "canBook"], args);
  const result = await command(db, { name: "lead.contact", actor, idempotencyKey: args.idempotencyKey, params: { leadId: args.leadId, expectedVersion: args.expectedVersion }, now: args.now }, async (uow) => {
    const row = await transition(uow, { model: "Lead", id: args.leadId, from: ["new"], to: "contacted", expectedVersion: args.expectedVersion, actor, eventType: "lead.contacted", data: (r) => ({ firstResponseSeconds: Math.max(0, Math.round((uow.now.getTime() - r.createdAt.getTime()) / 1e3)) }) });
    return { leadId: args.leadId, status: row.status, version: row.version };
  });
  return { replay: result.replay, ...result.value };
}
async function qualifyLead(db, actor, args) {
  await authorizeOperation(db, actor, "lead.qualify", ["canManageLeads", "canBook"], args);
  const result = await command(db, { name: "lead.qualify", actor, idempotencyKey: args.idempotencyKey, params: { leadId: args.leadId, expectedVersion: args.expectedVersion, requestedJobTypeId: args.requestedJobTypeId, locationId: args.locationId ?? null, postalCode: args.postalCode ?? null }, now: args.now }, async (uow) => {
    const jobType = await uow.tx.jobType.findUnique({ where: { id: args.requestedJobTypeId }, select: { id: true, businessUnitId: true, active: true } });
    if (!jobType?.active) throw new DomainError(Codes.NOT_FOUND, "That job type is not offered.", { field: "requestedJobTypeId" });
    const zip = args.locationId ? (await uow.tx.serviceLocation.findUnique({ where: { id: args.locationId }, select: { postalCode: true } }))?.postalCode : args.postalCode;
    if (!zip) throw new DomainError(Codes.INVALID_INPUT, "Give the service address or ZIP.", { field: "postalCode" });
    if (!await serviceAreaFor(uow.tx, jobType.businessUnitId, zip)) throw new DomainError(Codes.OUT_OF_AREA, `ZIP ${zip} is outside the service area.`, { reason: "out_of_area" });
    const row = await transition(uow, { model: "Lead", id: args.leadId, from: ["new", "contacted"], to: "qualified", expectedVersion: args.expectedVersion, actor, eventType: "lead.qualified", data: { requestedJobTypeId: jobType.id, ...args.locationId ? { locationId: args.locationId } : {} } });
    return { leadId: args.leadId, status: row.status, version: row.version };
  });
  return { replay: result.replay, ...result.value };
}
async function loseLead(db, actor, args) {
  await authorizeOperation(db, actor, "lead.lose", ["canManageLeads", "canBook"], args);
  const reasons = ["price", "timing", "out_of_area", "no_answer", "competitor", "not_serviceable", "duplicate", "other"];
  if (!reasons.includes(args.reason)) throw new DomainError(Codes.INVALID_INPUT, `Reason must be one of ${reasons.join(", ")}.`, { field: "reason" });
  const result = await command(db, { name: "lead.lose", actor, idempotencyKey: args.idempotencyKey, params: { leadId: args.leadId, expectedVersion: args.expectedVersion, reason: args.reason }, now: args.now }, async (uow) => {
    const row = await transition(uow, { model: "Lead", id: args.leadId, from: ["new", "contacted", "qualified"], to: "lost", expectedVersion: args.expectedVersion, actor, eventType: "lead.lost", reason: args.reason, data: { lostReason: args.reason } });
    return { leadId: args.leadId, status: row.status, version: row.version };
  });
  return { replay: result.replay, ...result.value };
}
async function markLeadSpam(db, actor, args) {
  await authorizeOperation(db, actor, "lead.spam", ["canManageLeads"], args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "Only a person marks a lead as spam.");
  const result = await command(db, { name: "lead.spam", actor, idempotencyKey: args.idempotencyKey, params: { leadId: args.leadId, expectedVersion: args.expectedVersion }, now: args.now }, async (uow) => {
    const row = await transition(uow, { model: "Lead", id: args.leadId, from: ["new", "contacted", "qualified"], to: "spam", expectedVersion: args.expectedVersion, actor, eventType: "lead.spam" });
    return { leadId: args.leadId, status: row.status, version: row.version };
  });
  return { replay: result.replay, ...result.value };
}
async function mergeLead(db, actor, args) {
  await authorizeOperation(db, actor, "lead.merge", ["canManageLeads"], args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "Agents never merge records.");
  if (args.leadId === args.intoLeadId) throw new DomainError(Codes.INVALID_INPUT, "Pick a different lead to merge into.", { field: "intoLeadId" });
  const result = await command(db, { name: "lead.merge", actor, idempotencyKey: args.idempotencyKey, params: { leadId: args.leadId, expectedVersion: args.expectedVersion, intoLeadId: args.intoLeadId }, now: args.now }, async (uow) => {
    const target = await uow.tx.lead.findUnique({ where: { id: args.intoLeadId }, select: { status: true } });
    if (!target || ["merged", "spam"].includes(target.status)) throw new DomainError(Codes.GUARD_FAILED, "The lead to merge into is closed.", { reason: "target_closed" });
    const row = await transition(uow, { model: "Lead", id: args.leadId, from: ["new", "contacted", "qualified", "lost"], to: "merged", expectedVersion: args.expectedVersion, actor, eventType: "lead.merged", data: { mergedIntoId: args.intoLeadId } });
    return { leadId: args.leadId, status: row.status, version: row.version, mergedIntoId: args.intoLeadId };
  });
  return { replay: result.replay, ...result.value };
}
async function matchJobType(db, actor, args) {
  await authorizeOperation(db, actor, "jobtype.match", ["canBook"], args);
  const text20 = args.description.toLowerCase();
  const types = await db.jobType.findMany({ where: { active: true }, select: { id: true, code: true, name: true, trade: true, priority: true, keywords: true, emergencyPolicy: true, bookableByAi: true, bookingQuestions: true, businessUnitId: true } });
  const words = new Set(text20.split(/[^a-z0-9]+/).filter(Boolean));
  const scored = types.map((t) => {
    const keys = (t.keywords ?? []).map((k) => k.toLowerCase());
    const hits = keys.filter((k) => k.includes(" ") ? text20.includes(k) : words.has(k));
    const emergency = t.emergencyPolicy;
    const emergencyHits = (emergency?.keywords ?? []).filter((k) => text20.includes(k.toLowerCase()));
    return { jobTypeId: t.id, code: t.code, name: t.name, trade: t.trade, priority: t.priority, bookableByAi: t.bookableByAi, score: hits.length * 10 + emergencyHits.length * 25, matched: hits, emergency: emergencyHits.length ? { matched: emergencyHits, script: emergency?.script ?? "", page: !!emergency?.page } : null, questions: t.bookingQuestions ?? [], businessUnitId: t.businessUnitId };
  }).filter((t) => t.score > 0).sort((a, b) => b.score - a.score || a.code.localeCompare(b.code)).slice(0, 3);
  let inArea = null;
  if (args.postalCode && scored[0]) inArea = !!await serviceAreaFor(db, scored[0].businessUnitId, args.postalCode);
  await recordAgentRead(db, actor, { tool: "jobtype.match", inputs: { length: args.description.length, postalCode: args.postalCode ?? null }, output: { top: scored[0]?.code ?? null, emergency: !!scored[0]?.emergency } });
  return { matches: scored.map(({ businessUnitId: _bu, ...rest }) => rest), inArea, emergency: scored.find((s) => s.emergency)?.emergency ?? null };
}
async function handoffToHuman(db, actor, args) {
  await authorizeOperation(db, actor, "handoff.to_human", ["canBook"], args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "handoff.to_human", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const call = await uow.tx.call.findUnique({ where: { id: args.callId }, select: { id: true, status: true, version: true, fromMasked: true } });
    if (!call) throw new DomainError(Codes.NOT_FOUND, "Call not found.");
    if (["ai_answering", "ringing"].includes(call.status)) {
      await casUpdate(uow, { model: "Call", id: call.id, version: call.version, from: [call.status], to: "handoff_requested", actor, eventType: "call.handoff_requested", reason: args.reason, data: { summary: args.summary ?? "" } });
    }
    const task = await uow.tx.task.upsert({ where: { dedupeKey: `call.handoff:${call.id}` }, create: { kind: "call.handoff", title: `Caller ${call.fromMasked} needs a person: ${args.reason}`.slice(0, 200), detail: args.summary ?? "", subjectType: "Call", subjectId: call.id, status: "open", priority: "high", dueAt: new Date(uow.now.getTime() + 5 * 6e4), dedupeKey: `call.handoff:${call.id}` }, update: {}, select: { id: true } });
    const value = { callId: call.id, status: "handoff_requested", taskId: task.id };
    await recordAgentAction(uow, actor, { tool: "handoff.to_human", idempotencyKey, inputs: params, output: value });
    return value;
  });
  return { replay: result.replay, ...result.value };
}
async function pageOnCall(db, actor, args) {
  await authorizeOperation(db, actor, "page.on_call", ["canBook", "canDispatch"], args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "page.on_call", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const pageId = args.callId ?? `page-${idempotencyKey}`;
    if (args.callId) {
      const call = await uow.tx.call.findUnique({ where: { id: args.callId }, select: { id: true, version: true, status: true } });
      if (call) await uow.tx.call.update({ where: { id: call.id }, data: { emergency: { paged: true, summary: args.summary, at: uow.now.toISOString() }, disposition: "emergency_paged" } });
    }
    const onCall = await uow.tx.onCallRotation.findFirst({ where: { startsAt: { lte: uow.now }, endsAt: { gt: uow.now }, ...args.businessUnitId ? { businessUnitId: args.businessUnitId } : {} }, orderBy: { escalationOrder: "asc" }, select: { phoneE164: true, employee: { select: { displayName: true } } } });
    await uow.tx.task.upsert({ where: { dedupeKey: `page.on_call:${pageId}` }, create: { kind: "page.on_call", title: onCall ? `Emergency: ring ${onCall.employee?.displayName ?? "the on-call tech"} (${onCall.phoneE164})` : "Emergency call with nobody on call", detail: args.summary.slice(0, 300), subjectType: "Call", subjectId: pageId, status: "open", priority: "urgent", dedupeKey: `page.on_call:${pageId}` }, update: {} });
    uow.audit({ eventType: "call.on_call_paged", entityType: "Call", entityId: pageId, actorUserId: actorUserId(actor), actorAgentId: actorAgentId(actor), after: { businessUnitId: args.businessUnitId ?? null } });
    const value = { paged: true, pageId };
    await recordAgentAction(uow, actor, { tool: "page.on_call", idempotencyKey, inputs: params, output: value });
    return value;
  });
  return { replay: result.replay, ...result.value };
}
async function verifyCredential(db, actor, args) {
  await authorizeOperation(db, actor, "credential.verify", ["canManagePeople"], args);
  if (actor.kind !== "user") throw new DomainError(Codes.NOT_AUTHORIZED, "A person verifies credentials.");
  const result = await command(db, { name: "credential.verify", actor, idempotencyKey: args.idempotencyKey, params: { credentialId: args.credentialId, expectedVersion: args.expectedVersion }, now: args.now }, async (uow) => {
    const row = await transition(uow, {
      model: "Credential",
      id: args.credentialId,
      from: ["pending_verification", "expired"],
      to: "verified",
      expectedVersion: args.expectedVersion,
      actor,
      eventType: "credential.verified",
      guard: async (r) => {
        const own = await uow.tx.employee.findFirst({ where: { id: r.employeeId ?? "", userId: actor.userId }, select: { id: true } });
        if (own) throw new DomainError(Codes.NOT_AUTHORIZED, "You cannot verify your own credential.");
        if (!r.number.trim()) throw new DomainError(Codes.GUARD_FAILED, "Enter the license number first.", { reason: "number_missing" });
        if (r.expiresOn && r.expiresOn.getTime() < uow.now.getTime()) throw new DomainError(Codes.GUARD_FAILED, "This credential has expired. Record the renewal first.", { reason: "expired" });
      },
      data: { verifiedById: actor.userId, verifiedAt: uow.now }
    });
    return { credentialId: args.credentialId, status: row.status, version: row.version };
  });
  return { replay: result.replay, ...result.value };
}
async function revokeCredential(db, actor, args) {
  await authorizeOperation(db, actor, "credential.revoke", ["canManagePeople"], args);
  if (!args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Give a reason.", { field: "reason" });
  const result = await command(db, { name: "credential.revoke", actor, idempotencyKey: args.idempotencyKey, params: { credentialId: args.credentialId, expectedVersion: args.expectedVersion, reason: args.reason }, now: args.now }, async (uow) => {
    const row = await transition(uow, { model: "Credential", id: args.credentialId, from: ["pending_verification", "verified", "expired"], to: "revoked", expectedVersion: args.expectedVersion, actor, eventType: "credential.revoked", reason: args.reason });
    return { credentialId: args.credentialId, status: row.status, version: row.version };
  });
  return { replay: result.replay, ...result.value };
}

// features/keystone/mutations/phase1.ts
var graphql2 = String.raw;
var bind = (fn) => op(async (_root, args, context) => {
  const { now: _ignored, ...clean2 } = args;
  const actor = await actorFor(context);
  await advanceTimedStates(context.prisma);
  return fn(context.prisma, actor, clean2);
});
var phase1TypeDefs = graphql2`
  type Query {
    availableWindows(jobTypeId: ID!, postalCode: String!, from: String!, days: Int): JSON
    lookupCustomer(phone: String, email: String, name: String, postalCode: String): JSON
    customerHistory(customerId: ID!, limit: Int): JSON
    lookupLocations(customerId: ID!, postalCode: String): JSON
    matchJobType(description: String!, postalCode: String): JSON
    checkEligibility(visitId: ID!, employeeIds: [ID!]!): JSON
  }
  type Mutation {
    materializeWindows(from: String!, days: Int!, businessUnitIds: [ID!], idempotencyKey: String!): JSON
    holdWindow(windowId: ID!, jobTypeId: ID!, source: String!, minutes: Int, customerDraft: JSON, idempotencyKey: String!): JSON
    releaseHold(holdId: ID!, idempotencyKey: String!): JSON
    bookJob(holdId: ID, windowId: ID, jobTypeId: ID!, customerId: ID, locationId: ID, customer: JSON, location: JSON, summary: String, source: String, leadId: ID, smsConsent: Boolean, idempotencyKey: String!): JSON
    addCustomer(customer: JSON!, location: JSON, smsConsent: Boolean, idempotencyKey: String!): JSON
    addServiceLocation(customerId: ID!, location: JSON!, idempotencyKey: String!): JSON
    addContactPoint(contactId: ID!, kind: String!, value: String!, isPrimary: Boolean, idempotencyKey: String!): JSON
    storeAccessSecret(locationId: ID!, kind: String!, label: String, secret: String!, idempotencyKey: String!): JSON
    revealAccessSecret(accessSecretId: ID!, visitId: ID!, reason: String): JSON
    ingestLead(source: String!, externalId: String, campaignId: ID, contactName: String, phone: String, email: String, summary: String, requestedJobTypeId: ID, postalCode: String, idempotencyKey: String!): JSON
    markLeadContacted(leadId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    qualifyLead(leadId: ID!, expectedVersion: Int!, requestedJobTypeId: ID!, locationId: ID, postalCode: String, idempotencyKey: String!): JSON
    loseLead(leadId: ID!, expectedVersion: Int!, reason: String!, idempotencyKey: String!): JSON
    markLeadSpam(leadId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    mergeLead(leadId: ID!, expectedVersion: Int!, intoLeadId: ID!, idempotencyKey: String!): JSON
    recommendDispatch(visitId: ID!, idempotencyKey: String!): JSON
    assignVisit(visitId: ID!, expectedVersion: Int!, employeeIds: [ID!]!, leadEmployeeId: ID, recommendationId: ID, overrideReason: String, idempotencyKey: String!): JSON
    unassignVisit(visitId: ID!, expectedVersion: Int!, reason: String!, idempotencyKey: String!): JSON
    submitChecklist(visitId: ID!, answers: JSON!, idempotencyKey: String!): JSON
    setVisitStatus(visitId: ID!, to: String!, expectedVersion: Int, reason: String, clientRecordedAt: String, deviceEventKey: String, lat: String, lng: String, idempotencyKey: String!): JSON
    holdJob(jobId: ID!, expectedVersion: Int!, reason: String!, followUpOn: String!, idempotencyKey: String!): JSON
    releaseJobHold(jobId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    cancelJob(jobId: ID!, expectedVersion: Int!, reason: String!, idempotencyKey: String!): JSON
    recordConsent(contactPointId: ID, customerId: ID, phone: String, purpose: String!, action: String!, channel: String!, evidence: JSON, wordingVersion: String, idempotencyKey: String!): JSON
    handoffToHuman(callId: ID!, reason: String!, summary: String, idempotencyKey: String!): JSON
    pageOnCall(callId: ID, businessUnitId: ID, summary: String!, idempotencyKey: String!): JSON
    verifyCredential(credentialId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    revokeCredential(credentialId: ID!, expectedVersion: Int!, reason: String!, idempotencyKey: String!): JSON
  }
`;
var phase1Resolvers = {
  Query: {
    availableWindows: bind(availableWindows),
    lookupCustomer: bind(lookupCustomer),
    lookupLocations: bind(lookupLocations),
    customerHistory: bind(customerHistory),
    matchJobType: bind(matchJobType),
    checkEligibility: bind(checkEligibility)
  },
  Mutation: {
    materializeWindows: bind(materializeWindows),
    holdWindow: bind(holdWindow),
    releaseHold: bind(releaseHold),
    bookJob: bind(bookJob),
    addCustomer: bind(createCustomer),
    addServiceLocation: bind(addLocation),
    addContactPoint: bind(addContactPoint),
    storeAccessSecret: bind(storeAccessSecret),
    revealAccessSecret: bind(revealAccessSecret),
    ingestLead: bind(ingestLead),
    markLeadContacted: bind(markLeadContacted),
    qualifyLead: bind(qualifyLead),
    loseLead: bind(loseLead),
    markLeadSpam: bind(markLeadSpam),
    mergeLead: bind(mergeLead),
    recommendDispatch: bind(recommendDispatch),
    assignVisit: bind(assignVisit),
    unassignVisit: bind(unassignVisit),
    setVisitStatus: bind(setVisitStatus),
    submitChecklist: bind(submitChecklist),
    holdJob: bind(holdJob),
    releaseJobHold: bind(releaseJobHold),
    cancelJob: bind(cancelJob),
    recordConsent: bind(recordConsent),
    handoffToHuman: bind(handoffToHuman),
    pageOnCall: bind(pageOnCall),
    verifyCredential: bind(verifyCredential),
    revokeCredential: bind(revokeCredential)
  }
};

// features/keystone/mutations/phase2.ts
var graphql3 = String.raw;
var bind2 = (fn) => op(async (_root, args, context) => {
  const { now: _ignored, ...clean2 } = args;
  const actor = await actorFor(context);
  await advanceTimedStates(context.prisma);
  return fn(context.prisma, actor, clean2);
});
var phase2TypeDefs = graphql3`
  type Query {
    searchPriceBook(query: String, businessUnitId: ID, kind: String, limit: Int): JSON
    quotePriceBook(lines: JSON!, businessUnitId: ID, memberPricing: Boolean, discountBps: Int): JSON
    priceBookVersionReview(versionId: ID!): JSON
    estimateSummary(estimateId: ID!): JSON
  }
  type Mutation {
    refreshTimedStates(idempotencyKey: String!): JSON
    openPriceBook(name: String!, code: String!, businessUnitIds: [ID!], idempotencyKey: String!): JSON
    startPriceBookDraft(priceBookId: ID!, label: String, idempotencyKey: String!): JSON
    saveDraftItems(versionId: ID!, items: JSON!, expectedVersion: Int, idempotencyKey: String!): JSON
    removeDraftItems(versionId: ID!, itemKeys: [String!]!, expectedVersion: Int, idempotencyKey: String!): JSON
    saveDraftSettings(versionId: ID!, categories: JSON, laborRates: JSON, markupTables: JSON, memberPricingRules: JSON, expectedVersion: Int, idempotencyKey: String!): JSON
    submitPriceBookVersion(versionId: ID!, effectiveAt: String, expectedVersion: Int!, note: String, idempotencyKey: String!): JSON
    reopenPriceBookDraft(versionId: ID!, expectedVersion: Int!, reason: String, idempotencyKey: String!): JSON
    discardPriceBookVersion(versionId: ID!, expectedVersion: Int!, reason: String, idempotencyKey: String!): JSON
    importSupplierCosts(priceBookId: ID!, supplier: String!, costs: JSON!, idempotencyKey: String!): JSON

    openEstimate(jobId: ID, opportunityId: ID, customerId: ID, locationId: ID, businessUnitId: ID, title: String!, options: JSON, idempotencyKey: String!): JSON
    draftEstimate(jobId: ID, opportunityId: ID, customerId: ID, locationId: ID, businessUnitId: ID, title: String!, options: JSON!, idempotencyKey: String!): JSON
    draftEstimateFromCapture(visitId: ID!, title: String!, options: JSON!, idempotencyKey: String!): JSON
    draftFollowupEstimate(versionId: ID!, idempotencyKey: String!): JSON
    saveEstimateOption(versionId: ID!, optionId: ID, tier: String!, name: String!, description: String, memberPricing: Boolean, lines: JSON!, expectedVersion: Int, idempotencyKey: String!): JSON
    removeEstimateOption(versionId: ID!, optionId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    repriceEstimateVersion(versionId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    setEstimateDiscount(versionId: ID!, discountBps: Int!, reason: String, expectedVersion: Int!, idempotencyKey: String!): JSON
    reopenEstimateVersion(versionId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    presentEstimate(versionId: ID!, via: String, notes: String, expectedVersion: Int!, idempotencyKey: String!): JSON
    sellEstimate(versionId: ID!, optionId: ID!, expectedVersion: Int!, authorization: JSON!, saleLocation: String!, initiatedBy: String!, depositMinor: String, emergencyWaiver: JSON, acrContext: [String!], exclusions: [String!], idempotencyKey: String!): JSON
    declineEstimate(versionId: ID!, reason: String!, note: String, expectedVersion: Int!, idempotencyKey: String!): JSON
    requoteEstimate(versionId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    discardEstimateVersion(versionId: ID!, expectedVersion: Int!, reason: String, idempotencyKey: String!): JSON
    draftChangeOrder(jobId: ID!, reason: String!, add: JSON, removeWorkLineIds: [ID!], idempotencyKey: String!): JSON
    presentChangeOrder(changeOrderId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    acceptChangeOrder(changeOrderId: ID!, expectedVersion: Int!, authorization: JSON!, saleLocation: String!, initiatedBy: String!, emergencyWaiver: JSON, acrContext: [String!], idempotencyKey: String!): JSON
    declineChangeOrder(changeOrderId: ID!, expectedVersion: Int!, reason: String, idempotencyKey: String!): JSON

    deliverCancellationNotice(noticeId: ID!, method: String!, acknowledgedBy: String!, signature: JSON, messageId: ID, expectedVersion: Int!, idempotencyKey: String!): JSON
    waiveCancellationNotice(noticeId: ID!, waiver: JSON!, expectedVersion: Int!, idempotencyKey: String!): JSON
    recordBuyerCancellation(noticeId: ID!, via: String!, sentAt: String!, note: String, expectedVersion: Int!, idempotencyKey: String!): JSON
    markCancellationRefunded(noticeId: ID!, evidence: JSON!, expectedVersion: Int!, idempotencyKey: String!): JSON
    requestCancellationHoldOverride(noticeId: ID!, reason: String!, expectedVersion: Int!, idempotencyKey: String!): JSON
  }
`;
var phase2Resolvers = {
  Query: {
    searchPriceBook: bind2(searchPriceBook),
    quotePriceBook: bind2(quotePriceBook),
    priceBookVersionReview: bind2(priceBookVersionReview),
    estimateSummary: bind2(estimateSummary)
  },
  Mutation: {
    refreshTimedStates: op(async (_root, _args, context) => {
      await actorFor(context);
      return advanceTimedStates(context.prisma, { force: true });
    }),
    openPriceBook: bind2(createPriceBook),
    startPriceBookDraft: bind2(startPriceBookDraft),
    saveDraftItems: bind2(saveDraftItems),
    removeDraftItems: bind2(removeDraftItems),
    saveDraftSettings: bind2(saveDraftSettings),
    submitPriceBookVersion: bind2(submitPriceBookVersion),
    reopenPriceBookDraft: bind2(reopenPriceBookDraft),
    discardPriceBookVersion: bind2(discardPriceBookVersion),
    importSupplierCosts: bind2(importSupplierCosts),
    openEstimate: bind2(createEstimate),
    draftEstimate: bind2(draftEstimate),
    draftEstimateFromCapture: bind2(draftEstimate),
    draftFollowupEstimate: bind2(draftFollowupEstimate),
    saveEstimateOption: bind2(saveEstimateOption),
    removeEstimateOption: bind2(removeEstimateOption),
    repriceEstimateVersion: bind2(repriceEstimateVersion),
    setEstimateDiscount: bind2(setEstimateDiscount),
    reopenEstimateVersion: bind2(reopenEstimateVersion),
    presentEstimate: bind2(presentEstimate),
    sellEstimate: bind2(sellEstimate),
    declineEstimate: bind2(declineEstimate),
    requoteEstimate: bind2(requoteEstimate),
    discardEstimateVersion: bind2(discardEstimateVersion),
    draftChangeOrder: bind2(draftChangeOrder),
    presentChangeOrder: bind2(presentChangeOrder),
    acceptChangeOrder: bind2(acceptChangeOrder),
    declineChangeOrder: bind2(declineChangeOrder),
    deliverCancellationNotice: bind2(deliverCancellationNotice),
    waiveCancellationNotice: bind2(waiveCancellationNotice),
    recordBuyerCancellation: bind2(recordBuyerCancellation),
    markCancellationRefunded: bind2(markCancellationRefunded),
    requestCancellationHoldOverride: bind2(requestCancellationHoldOverride)
  }
};

// features/keystone/services/invoices.ts
init_actor();
init_approval();
init_cas();
init_errors();
var BILL = ["canManageInvoices", "canPostInvoices"];
var REVENUE_ACCOUNT = { labor: "4000", material: "4100", equipment: "4100", fee: "4300", disposal: "4300", permit_passthrough: "2300", warranty_reimbursed: "4200", membership: "4400", maintenance: "4400" };
var BILLABLE_JOB = ["work_complete", "awaiting_inspection", "completed", "closed"];
var mustReason = (text20, field = "reason") => {
  const v = String(text20 ?? "").trim();
  if (v.length < 3) throw new DomainError(Codes.INVALID_INPUT, "Say why, in a few words.", { field });
  return v;
};
var costOf = (snapshot) => {
  const raw = snapshot?.costMinor;
  return raw && /^\d+$/.test(raw) ? BigInt(raw) : 0n;
};
async function taxContext2(tx, loc, on) {
  if (!loc) throw new DomainError(Codes.GUARD_FAILED, "The job has no service address; sales tax depends on it.", { reason: "no_location" });
  const place = placeOfLocation(loc);
  const policy = await resolvePolicyFromDb(tx, "sales_tax", place, localDate({ timeZone: loc.timeZone }, on));
  const company = await tx.companySettings.findFirst({ select: { features: true } });
  const mode = company?.features?.contractTaxMode === "separated" ? "separated" : "lump_sum";
  return { propertyClass: loc.propertyClass, contractTaxMode: mode, cityCode: place.city, rules: policy.rules };
}
async function createInvoiceDraft(db, actor, args) {
  await authorizeOperation(db, actor, "invoice.draft", BILL, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "invoice.draft", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const job = await tx.job.findUnique({ where: { id: args.jobId }, select: { id: true, status: true, customerId: true, locationId: true, businessUnitId: true, poNumber: true, location: { select: { id: true } } } });
    if (!job) throw new DomainError(Codes.NOT_FOUND, "Job not found.");
    if (job.status === "cancelled") throw new DomainError(Codes.GUARD_FAILED, "A cancelled job is not invoiced.");
    const finished = BILLABLE_JOB.includes(job.status);
    const progressReason = args.progressReason?.trim() ?? "";
    if (!finished && progressReason.length < 3) throw new DomainError(Codes.GUARD_FAILED, "Work is not finished. Say why you are billing part of it now (progress billing).", { reason: "progress_reason_required" });
    if (!job.customerId) throw new DomainError(Codes.GUARD_FAILED, "The job has no customer to bill.");
    let payer = null;
    if (args.payerId) {
      payer = await tx.payerProfile.findUnique({ where: { id: args.payerId }, select: { id: true, kind: true, terms: true, poRequired: true } });
      if (!payer) throw new DomainError(Codes.NOT_FOUND, "Payer not found.");
    }
    if (args.authorizationId) {
      const auth = await tx.thirdPartyAuthorization.findUnique({ where: { id: args.authorizationId }, select: { jobId: true, status: true } });
      if (!auth || auth.jobId !== job.id) throw new DomainError(Codes.NOT_FOUND, "That authorization is not on this job.");
      if (auth.status !== "authorized") throw new DomainError(Codes.GUARD_FAILED, `The authorization is ${auth.status.replace(/_/g, " ")}, not authorized.`);
    }
    const poNumber = (args.poNumber ?? job.poNumber ?? "").trim();
    if (payer?.poRequired && !poNumber) throw new DomainError(Codes.GUARD_FAILED, `${payer.kind.replace(/_/g, " ")} payers need a PO number on the invoice.`, { reason: "po_required" });
    const already = await tx.invoiceLine.findMany({ where: { workLineId: { not: null }, invoice: { status: { notIn: ["discarded", "voided"] } } }, select: { workLineId: true } });
    const taken = new Set(already.map((l) => l.workLineId));
    const work = await tx.workLine.findMany({ where: { jobId: job.id, status: { in: ["planned", "completed"] }, ...args.workLineIds?.length ? { id: { in: args.workLineIds } } : {} }, orderBy: { createdAt: "asc" } });
    if (args.workLineIds?.length) {
      for (const id of args.workLineIds) if (!work.some((w) => w.id === id)) throw new DomainError(Codes.GUARD_FAILED, "A chosen work line is not billable (removed or cancelled).", { workLineId: id });
    }
    const open = work.filter((w) => !taken.has(w.id));
    if (args.workLineIds?.length && open.length !== work.length) throw new DomainError(Codes.GUARD_FAILED, "A chosen work line is already on another invoice.", { reason: "already_invoiced" });
    const lines = open.map((w) => ({
      workLineId: w.id,
      description: w.description,
      quantity: w.quantity.toFixed(),
      uom: w.uom,
      unitPriceMinor: w.unitPriceMinor,
      amountMinor: w.amountMinor,
      taxCategory: w.taxCategory,
      costMinor: costOf(w.snapshot)
    }));
    if (args.items?.length) {
      const active = await activeVersionFor(tx, job.businessUnitId);
      const quoted = await quoteFromVersion(tx, active.versionId, args.items.map((i) => ({ itemKey: i.itemKey, quantity: i.quantity, description: i.description })), false);
      for (const q of quoted) lines.push({ workLineId: null, description: q.description || q.name, quantity: q.quantity, uom: q.uom, unitPriceMinor: BigInt(q.unitPriceMinor), amountMinor: q.amountMinor, taxCategory: q.taxCategory, costMinor: BigInt(q.costMinor) });
    }
    if (!lines.length) throw new DomainError(Codes.GUARD_FAILED, "Nothing to bill: every work line is already invoiced.", { reason: "nothing_to_bill" });
    const subtotal = lines.reduce((a, l) => a + l.amountMinor, 0n);
    const discount = args.discountMinor ? BigInt(args.discountMinor) : 0n;
    if (discount < 0n || discount > subtotal) throw new DomainError(Codes.INVALID_INPUT, "The discount is between zero and the subtotal.", { field: "discountMinor" });
    if (discount > 0n && !can(actor, "canApproveCredits") && !can(actor, "canPostInvoices")) throw new DomainError(Codes.NOT_AUTHORIZED, "Giving a discount here needs the post-invoices permission.");
    const shares = discount > 0n ? allocateMinor(discount, lines.map((l) => l.amountMinor.toString())) : lines.map(() => 0n);
    const ref = await nextReference(tx, "INV", uow.now);
    const loc = await tx.serviceLocation.findUnique({ where: { id: job.locationId ?? "" }, select: { id: true, state: true, postalCode: true, city: true, timeZone: true, propertyClass: true } });
    const company = await tx.companySettings.findFirst({ select: { features: true } });
    const mode = company?.features?.contractTaxMode === "separated" ? "separated" : "lump_sum";
    const invoice = await tx.invoice.create({
      data: {
        ref,
        publicCode: publicCode("INV"),
        jobId: job.id,
        customerId: job.customerId,
        payerId: payer?.id ?? null,
        payerKind: payer?.kind ?? "customer",
        locationId: loc?.id ?? null,
        propertyClass: loc?.propertyClass ?? "residential",
        contractTaxMode: mode,
        status: "draft",
        poNumber,
        authorizationId: args.authorizationId ?? null,
        progressReason,
        subtotalMinor: subtotal,
        discountMinor: discount,
        taxMinor: 0n,
        totalMinor: subtotal - discount,
        balanceMinor: 0n
      },
      select: { id: true }
    });
    for (const [i, l] of lines.entries()) {
      await tx.invoiceLine.create({ data: { invoiceId: invoice.id, workLineId: l.workLineId, description: l.description, quantity: l.quantity, uom: l.uom, unitPriceMinor: l.unitPriceMinor, amountMinor: l.amountMinor, discountMinor: shares[i], taxCategory: l.taxCategory, costMinor: l.costMinor, revenueAccountCode: REVENUE_ACCOUNT[l.taxCategory] ?? "4000", sortOrder: i } });
    }
    auditCreate(uow, actor, "Invoice", invoice.id, "invoice.drafted", { ref, jobId: job.id, lines: lines.length, subtotalMinor: subtotal.toString(), progress: !finished });
    return { invoiceId: invoice.id, ref, subtotalMinor: subtotal.toString(), lines: lines.length };
  });
  return { replay: result.replay, ...result.value };
}
async function discardInvoiceDraft(db, actor, args) {
  await authorizeOperation(db, actor, "invoice.discard", BILL, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "invoice.discard", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const row = await lockInvoice(uow.tx, args.invoiceId);
    if (row.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, "This invoice changed since you loaded it. Reload and try again.", { currentStatus: row.status, currentVersion: row.version });
    const version = await casUpdate(uow, { model: "Invoice", id: row.id, version: row.version, from: ["draft"], to: "discarded", actor, eventType: "invoice.discarded", reason: args.reason ?? null });
    return { invoiceId: row.id, status: "discarded", version };
  });
  return { replay: result.replay, ...result.value };
}
async function postInvoice(db, actor, args) {
  await authorizeOperation(db, actor, "invoice.post", ["canPostInvoices"], args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "invoice.post", actor, idempotencyKey, params, now: args.now }, (uow) => postInvoiceInTx(uow, actor, args));
  return { replay: result.replay, ...result.value };
}
async function postInvoiceInTx(uow, actor, args) {
  {
    const { tx } = uow;
    const row = await lockInvoice(tx, args.invoiceId);
    if (row.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, "This invoice changed since you loaded it. Reload and try again.", { currentStatus: row.status, currentVersion: row.version });
    if (row.status !== "draft") throw new DomainError(Codes.INVALID_TRANSITION, `Invoice ${row.ref} is ${row.status}; only a draft is posted.`);
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: row.id }, include: { lines: { orderBy: { sortOrder: "asc" } }, payer: { select: { terms: true } } } });
    const today = await companyToday(tx, uow.now);
    const invoiceDate = args.invoiceDate ?? today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) || invoiceDate > today) throw new DomainError(Codes.INVALID_INPUT, "The invoice date is today or earlier.", { field: "invoiceDate" });
    const period = await arPeriodFor(tx, invoiceDate);
    const sum = invoice.lines.reduce((a, l) => a + l.amountMinor, 0n);
    const disc = invoice.lines.reduce((a, l) => a + l.discountMinor, 0n);
    if (sum !== invoice.subtotalMinor || disc !== invoice.discountMinor) throw new DomainError(Codes.GUARD_FAILED, "The invoice lines do not add up to its totals.", { reason: "totals_do_not_reconcile" });
    const loc = invoice.locationId ? await tx.serviceLocation.findUnique({ where: { id: invoice.locationId }, select: { state: true, postalCode: true, city: true, timeZone: true, propertyClass: true } }) : null;
    let taxed;
    let ctx;
    try {
      ctx = await taxContext2(tx, loc, uow.now);
      taxed = estimateSalesTax(invoice.lines.map((l) => ({ taxCategory: l.taxCategory, netMinor: l.amountMinor - l.discountMinor, costMinor: l.costMinor })), ctx);
    } catch (error) {
      if (error instanceof PricingError) throw new DomainError(Codes.GUARD_FAILED, error.message, { reason: "tax_unresolved" });
      throw error;
    }
    const cert = ctx.propertyClass !== "residential" && invoice.customerId ? (await tx.customer.findUnique({ where: { id: invoice.customerId }, select: { taxExemptCertificate: { select: { id: true, expiresAt: true } } } }))?.taxExemptCertificate ?? null : null;
    const certExpired = !!cert?.expiresAt && cert.expiresAt.toISOString().slice(0, 10) <= invoiceDate;
    const exemptCertificateId = cert && !certExpired ? cert.id : null;
    const exemptRefused = cert && certExpired ? { certificateId: cert.id, reason: "certificate_expired", expiresAt: cert.expiresAt.toISOString().slice(0, 10) } : null;
    if (exemptCertificateId) taxed = { ...taxed, taxMinor: 0n, rows: taxed.rows.map(() => ({ taxable: false, baseMinor: 0n })) };
    const baseWeights = taxed.rows.map((r) => r.baseMinor.toString());
    const shares = taxed.taxMinor > 0n && taxed.rows.some((r) => r.baseMinor > 0n) ? allocateMinor(taxed.taxMinor, baseWeights) : taxed.rows.map(() => 0n);
    for (const [i, l] of invoice.lines.entries()) {
      await tx.invoiceLine.update({ where: { id: l.id }, data: { taxable: taxed.rows[i].taxable, taxBaseMinor: taxed.rows[i].baseMinor, taxRate: taxed.rate, taxMinor: shares[i], taxJurisdictions: { state: ctx.rules.stateRate, localRateCode: taxed.localRateCode } } });
    }
    const total = invoice.subtotalMinor - invoice.discountMinor + taxed.taxMinor;
    if (invoice.authorizationId) {
      const auth = await tx.thirdPartyAuthorization.findUniqueOrThrow({ where: { id: invoice.authorizationId }, select: { authorizedAmountMinor: true, status: true } });
      if (auth.status !== "authorized") throw new DomainError(Codes.GUARD_FAILED, `The third-party authorization is ${auth.status.replace(/_/g, " ")}.`, { reason: "authorization_not_active" });
      const billed = await tx.invoice.aggregate({ where: { authorizationId: invoice.authorizationId, status: { in: ["posted", "partially_paid", "paid", "written_off"] } }, _sum: { totalMinor: true } });
      if ((billed._sum.totalMinor ?? 0n) + total > auth.authorizedAmountMinor) throw new DomainError(Codes.GUARD_FAILED, `That would bill ${money((billed._sum.totalMinor ?? 0n) + total)}; the payer authorized ${money(auth.authorizedAmountMinor)}.`, { reason: "over_authorized_amount" });
    }
    const job = invoice.jobId ? await tx.job.findUnique({ where: { id: invoice.jobId }, select: { nteMinor: true } }) : null;
    if (job?.nteMinor && job.nteMinor > 0n) {
      const billed = await tx.invoice.aggregate({ where: { jobId: invoice.jobId, id: { not: invoice.id }, status: { in: ["posted", "partially_paid", "paid", "written_off"] } }, _sum: { totalMinor: true } });
      if ((billed._sum.totalMinor ?? 0n) + total > job.nteMinor) throw new DomainError(Codes.GUARD_FAILED, `That would bill ${money((billed._sum.totalMinor ?? 0n) + total)} on this job; the not-to-exceed is ${money(job.nteMinor)}.`, { reason: "over_nte" });
    }
    const terms = TERMS_DAYS[invoice.payer?.terms ?? "due_on_receipt"] ?? 0;
    const dueDate = addDays(invoiceDate, terms);
    const taxResult = { rate: taxed.rate, localRateCode: taxed.localRateCode, propertyClass: ctx.propertyClass, contractTaxMode: ctx.contractTaxMode, taxMinor: taxed.taxMinor.toString(), exemptCertificateId, ...exemptRefused ? { exemptRefused } : {} };
    const snapshot = { ref: invoice.ref, lines: invoice.lines.map((l, i) => ({ id: l.id, description: l.description, quantity: l.quantity.toFixed(), uom: l.uom, unitPriceMinor: l.unitPriceMinor.toString(), amountMinor: l.amountMinor.toString(), discountMinor: l.discountMinor.toString(), taxMinor: shares[i].toString() })) };
    const posted = await tx.invoice.updateMany({
      where: { id: row.id, version: row.version, status: "draft" },
      data: { status: "posted", version: { increment: 1 }, invoiceDate: asDate(invoiceDate), dueDate: asDate(dueDate), arPeriodId: period.id, propertyClass: ctx.propertyClass, contractTaxMode: ctx.contractTaxMode, taxResult, snapshot, taxMinor: taxed.taxMinor, totalMinor: total, balanceMinor: total, postedAt: uow.now, postedById: actorUserId(actor) }
    });
    if (posted.count !== 1) throw new DomainError(Codes.STALE_STATE, "Invoice changed while posting. Reload and try again.");
    if (total > 0n) await postArEntry(uow, { invoice: row, kind: "invoice_posted", amountMinor: total, sourceType: "Invoice", sourceId: row.id });
    else await tx.invoice.update({ where: { id: row.id }, data: { status: "paid" } });
    uow.audit({ eventType: "invoice.posted", entityType: "Invoice", entityId: row.id, actorUserId: actorUserId(actor), after: { ref: invoice.ref, totalMinor: total.toString(), taxMinor: taxed.taxMinor.toString(), invoiceDate, dueDate } });
    return { invoiceId: row.id, ref: invoice.ref, totalMinor: total.toString(), taxMinor: taxed.taxMinor.toString(), dueDate };
  }
}
async function setCollectionsStatus(db, actor, args) {
  await authorizeOperation(db, actor, "invoice.collections", ["canManageInvoices", "canManageAccounting"], args);
  const allowed = ["current", "reminder_1", "reminder_2", "final_notice", "collections_agency", "lien_track", "resolved"];
  if (!allowed.includes(args.status)) throw new DomainError(Codes.INVALID_INPUT, `Status is one of ${allowed.join(", ")}.`, { field: "status" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "invoice.collections", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const row = await lockInvoice(uow.tx, args.invoiceId);
    if (!["posted", "partially_paid"].includes(row.status)) throw new DomainError(Codes.GUARD_FAILED, "Only an open invoice has a collections status.");
    await uow.tx.invoice.update({ where: { id: row.id }, data: { collectionsStatus: args.status } });
    auditCreate(uow, actor, "Invoice", row.id, "invoice.collections_status", { status: args.status });
    return { invoiceId: row.id, collectionsStatus: args.status };
  });
  return { replay: result.replay, ...result.value };
}
var MEMO_REASONS = ["pricing_error", "goodwill", "cancellation_right", "warranty", "recall", "duplicate", "other"];
async function postedMemoTotal(tx, invoiceId) {
  const sum = await tx.creditMemo.aggregate({ where: { invoiceId, status: { in: ["posted", "applied"] } }, _sum: { totalMinor: true } });
  return sum._sum.totalMinor ?? 0n;
}
async function postMemo(uow, actor, memoId, voidInvoice2) {
  const { tx } = uow;
  const memo = await tx.creditMemo.findUniqueOrThrow({ where: { id: memoId } });
  const invoice = await lockInvoice(tx, memo.invoiceId);
  if (!["posted", "partially_paid", "paid"].includes(invoice.status)) throw new DomainError(Codes.GUARD_FAILED, `Invoice ${invoice.ref} is ${invoice.status}; it takes no credit memo.`);
  if (await postedMemoTotal(tx, invoice.id) + memo.totalMinor > invoice.totalMinor) throw new DomainError(Codes.GUARD_FAILED, "Credit memos cannot add up to more than the invoice.", { reason: "memo_exceeds_invoice" });
  let appliedInvoice = 0n;
  let appliedCredit = 0n;
  if (memo.appliesTo === "customer_credit") {
    if (voidInvoice2) throw new DomainError(Codes.INVALID_INPUT, "A void reduces the balance; it does not issue credit.");
    if (!invoice.customerId) throw new DomainError(Codes.GUARD_FAILED, "The invoice has no customer to credit.");
    await tx.customerCreditEntry.create({ data: { customerId: invoice.customerId, kind: "issued", amountMinor: memo.totalMinor, sourceType: "CreditMemo", sourceId: memo.id } });
    appliedCredit = memo.totalMinor;
  } else {
    if (memo.totalMinor > invoice.balanceMinor) throw new DomainError(Codes.GUARD_FAILED, `The memo is ${money(memo.totalMinor)} but only ${money(invoice.balanceMinor)} is owed. Issue it as customer credit, or refund the payment.`, { reason: "memo_exceeds_balance" });
    await postArEntry(uow, { invoice, kind: "credit_memo", amountMinor: -memo.totalMinor, sourceType: "CreditMemo", sourceId: memo.id, note: memo.reason });
    await settleInvoice(uow, actor, invoice, -memo.totalMinor, "invoice.credit_memo_applied", { to: voidInvoice2 ? "voided" : void 0, reason: memo.note });
    appliedInvoice = memo.totalMinor;
  }
  const posted = await casUpdate(uow, { model: "CreditMemo", id: memo.id, version: memo.version, from: ["draft", "pending_approval"], to: "posted", actor, eventType: "credit_memo.posted", data: { postedAt: uow.now } });
  await casUpdate(uow, { model: "CreditMemo", id: memo.id, version: posted, from: ["posted"], to: "applied", actor, eventType: "credit_memo.applied", data: { appliedToInvoiceMinor: appliedInvoice, appliedToCreditMinor: appliedCredit } });
  return { memoId: memo.id, appliedToInvoiceMinor: appliedInvoice.toString(), appliedToCreditMinor: appliedCredit.toString() };
}
async function creditForRefund(uow, actor, a) {
  const ref = await nextReference(uow.tx, "CRM", uow.now);
  const memo = await uow.tx.creditMemo.create({ data: { ref, invoiceId: a.invoiceId, reason: "other", note: a.note.slice(0, 300), status: "draft", totalMinor: a.amountMinor, appliesTo: "invoice_balance", createdById: actorUserId(actor) }, select: { id: true } });
  auditCreate(uow, actor, "CreditMemo", memo.id, "credit_memo.created", { ref, invoiceId: a.invoiceId, amountMinor: a.amountMinor.toString(), forRefund: true });
  return { ...await postMemo(uow, actor, memo.id, false), ref };
}
async function memoThreshold(tx) {
  const c = await tx.companySettings.findFirst({ select: { refundApprovalThresholdMinor: true } });
  return c?.refundApprovalThresholdMinor ?? 50000n;
}
async function createMemo(uow, actor, a) {
  const { tx } = uow;
  const invoice = await lockInvoice(tx, a.invoiceId);
  if (!["posted", "partially_paid", "paid"].includes(invoice.status)) throw new DomainError(Codes.GUARD_FAILED, `Invoice ${invoice.ref} is ${invoice.status}; it takes no credit memo.`);
  if (a.amountMinor <= 0n) throw new DomainError(Codes.INVALID_INPUT, "The memo is for more than zero.", { field: "amountMinor" });
  const credited = await postedMemoTotal(tx, invoice.id);
  if (credited + a.amountMinor > invoice.totalMinor) throw new DomainError(Codes.GUARD_FAILED, "Credit memos cannot add up to more than the invoice.", { reason: "memo_exceeds_invoice" });
  const ref = await nextReference(tx, "CRM", uow.now);
  const needsApproval = credited + a.amountMinor > await memoThreshold(tx) || a.voidInvoice === true && invoice.status !== "posted";
  const memo = await tx.creditMemo.create({ data: { ref, invoiceId: invoice.id, reason: a.reason, note: a.note, status: needsApproval ? "pending_approval" : "draft", totalMinor: a.amountMinor, appliesTo: a.appliesTo, createdById: actorUserId(actor) }, select: { id: true } });
  auditCreate(uow, actor, "CreditMemo", memo.id, "credit_memo.created", { ref, invoiceId: invoice.id, amountMinor: a.amountMinor.toString(), void: a.voidInvoice });
  if (!needsApproval) return { ...await postMemo(uow, actor, memo.id, a.voidInvoice), ref, status: "applied", approvalRequestId: null };
  const approval = await requestApproval(uow, actor, {
    action: "credit.issue",
    targetList: "CreditMemo",
    targetId: memo.id,
    requiredPermission: "canApproveCredits",
    payload: { memoId: memo.id, invoiceId: invoice.id, amountMinor: a.amountMinor.toString(), appliesTo: a.appliesTo, void: a.voidInvoice },
    summary: `${ref}: ${a.voidInvoice ? "void" : "credit"} ${invoice.ref} for ${money(a.amountMinor)} \u2014 ${a.note}`
  });
  await tx.creditMemo.update({ where: { id: memo.id }, data: { approvalId: approval.id } });
  return { memoId: memo.id, ref, status: "pending_approval", approvalRequestId: approval.id };
}
registerApplier("credit.issue", async (uow, actor, request) => {
  const memo = await uow.tx.creditMemo.findUnique({ where: { id: request.targetId } });
  if (!memo || memo.status !== "pending_approval" || memo.approvalId !== request.id || memo.totalMinor.toString() !== request.payload.amountMinor || memo.invoiceId !== request.payload.invoiceId) throw new DomainError(Codes.APPROVAL_MISMATCH, "The credit memo changed after approval was requested.");
  return postMemo(uow, actor, memo.id, request.payload.void === true);
});
async function issueCreditMemo(db, actor, args) {
  await authorizeOperation(db, actor, "credit_memo.issue", ["canManageInvoices", "canPostInvoices"], args);
  if (!/^[1-9]\d{0,12}$/.test(args.amountMinor ?? "")) throw new DomainError(Codes.INVALID_INPUT, "Amount is whole cents, more than zero.", { field: "amountMinor" });
  if (!MEMO_REASONS.includes(args.reason)) throw new DomainError(Codes.INVALID_INPUT, `Reason is one of ${MEMO_REASONS.join(", ")}.`, { field: "reason" });
  const appliesTo = args.appliesTo === "customer_credit" ? "customer_credit" : "invoice_balance";
  const note = mustReason(args.note, "note");
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "credit_memo.issue", actor, idempotencyKey, params, now: args.now }, (uow) => createMemo(uow, actor, { invoiceId: args.invoiceId, amountMinor: BigInt(args.amountMinor), reason: args.reason, note, appliesTo, voidInvoice: false }));
  return { replay: result.replay, ...result.value };
}
async function voidInvoice(db, actor, args) {
  await authorizeOperation(db, actor, "invoice.void", ["canPostInvoices"], args);
  const note = mustReason(args.reason);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "invoice.void", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const inv = await lockInvoice(uow.tx, args.invoiceId);
    const allocations = await uow.tx.paymentAllocation.count({ where: { invoiceId: inv.id } });
    if (inv.status !== "posted" || allocations > 0 || inv.balanceMinor !== inv.totalMinor) throw new DomainError(Codes.GUARD_FAILED, "Only an invoice with no payments or credits can be voided. Credit it instead.", { reason: "not_voidable" });
    return createMemo(uow, actor, { invoiceId: inv.id, amountMinor: inv.totalMinor, reason: "duplicate", note, appliesTo: "invoice_balance", voidInvoice: true });
  });
  return { replay: result.replay, ...result.value };
}
async function requestWriteOff(db, actor, args) {
  await authorizeOperation(db, actor, "invoice.write_off_request", ["canManageInvoices", "canManageAccounting"], args);
  const reason = mustReason(args.reason);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "invoice.write_off_request", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const inv = await lockInvoice(uow.tx, args.invoiceId);
    if (!["posted", "partially_paid"].includes(inv.status) || inv.balanceMinor <= 0n) throw new DomainError(Codes.GUARD_FAILED, "Only an invoice with a balance is written off.");
    const pending = await uow.tx.approvalRequest.count({ where: { action: "invoice.write_off", targetId: inv.id, status: "pending" } });
    if (pending) throw new DomainError(Codes.GUARD_FAILED, "A write-off is already waiting for approval on this invoice.");
    const approval = await requestApproval(uow, actor, {
      action: "invoice.write_off",
      targetList: "Invoice",
      targetId: inv.id,
      requiredPermission: "canApproveWriteOff",
      payload: { invoiceId: inv.id, balanceMinor: inv.balanceMinor.toString(), version: inv.version },
      summary: `${inv.ref}: write off ${money(inv.balanceMinor)} \u2014 ${reason}`
    });
    auditCreate(uow, actor, "Invoice", inv.id, "invoice.write_off_requested", { approvalId: approval.id, balanceMinor: inv.balanceMinor.toString() }, { reason });
    return { invoiceId: inv.id, approvalRequestId: approval.id };
  });
  return { replay: result.replay, ...result.value };
}
registerApplier("invoice.write_off", async (uow, actor, request) => {
  const inv = await lockInvoice(uow.tx, request.targetId);
  if (!["posted", "partially_paid"].includes(inv.status) || inv.balanceMinor.toString() !== request.payload.balanceMinor || inv.version !== request.payload.version) throw new DomainError(Codes.APPROVAL_MISMATCH, "The invoice changed after the write-off was requested.");
  await postArEntry(uow, { invoice: inv, kind: "write_off", amountMinor: -inv.balanceMinor, sourceType: "ApprovalRequest", sourceId: request.id, note: "Written off" });
  await settleInvoice(uow, actor, inv, -inv.balanceMinor, "invoice.written_off", { to: "written_off" });
  return { invoiceId: inv.id, status: "written_off", writtenOffMinor: inv.balanceMinor.toString() };
});

// features/keystone/services/payments.ts
init_actor();
init_approval();
init_cas();
init_errors();
var TAKE = ["canTakePayments", "canManagePayments"];
var METHODS = ["card", "ach", "cash", "check", "other", "financing", "third_party", "customer_credit"];
var cents = (v, field) => {
  if (typeof v !== "string" || !/^[1-9]\d{0,12}$/.test(v)) throw new DomainError(Codes.INVALID_INPUT, "Amount is whole cents, more than zero.", { field });
  return BigInt(v);
};
var tenderGroup = (method) => method === "card" ? "card" : method === "ach" ? "ach" : method === "financing" ? "financing" : method === "third_party" ? "third_party" : "check_cash";
async function batchFor(uow, method, day3) {
  const group = tenderGroup(method);
  const date = asDate(day3);
  const existing = await uow.tx.paymentBatch.findFirst({ where: { businessDate: date, tenderGroup: group }, select: { id: true, status: true, expectedMinor: true, version: true } });
  if (existing) return existing;
  const ref = await nextReference(uow.tx, "PBT", uow.now);
  return uow.tx.paymentBatch.create({ data: { ref, businessDate: date, tenderGroup: group, status: "open" }, select: { id: true, status: true, expectedMinor: true, version: true } });
}
async function createPayment(uow, actor, a) {
  const day3 = await companyToday(uow.tx, a.receivedAt);
  await arPeriodFor(uow.tx, day3);
  const ref = await nextReference(uow.tx, "PMT", uow.now);
  const payment = await uow.tx.payment.create({
    data: { ref, jobId: a.jobId, customerId: a.customerId, payerId: a.payerId ?? null, kind: a.kind ?? "payment", method: a.method, amountMinor: a.amountMinor, feeMinor: a.feeMinor ?? 0n, reference: a.reference ?? "", checkNumber: a.checkNumber ?? "", receivedAt: a.receivedAt, recordedById: actorUserId(actor) },
    select: { id: true, ref: true }
  });
  const batch = await batchFor(uow, a.method, day3);
  if (batch.status !== "open") throw new DomainError(Codes.GUARD_FAILED, `The ${tenderGroup(a.method).replace("_", "/")} batch for ${day3} is ${batch.status}. Record it on today's date, or reopen nothing: closed batches are final.`, { reason: "batch_closed" });
  await uow.tx.paymentBatch.update({ where: { id: batch.id }, data: { expectedMinor: { increment: a.amountMinor - (a.feeMinor ?? 0n) }, feesMinor: { increment: a.feeMinor ?? 0n } } });
  return { ...payment, batchId: batch.id };
}
async function recordInvoicePayment(db, actor, args) {
  await authorizeOperation(db, actor, "payment.record_invoice", [...TAKE], args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "A person takes payments.");
  const amount = cents(args.amountMinor, "amountMinor");
  if (!METHODS.includes(args.method)) throw new DomainError(Codes.INVALID_INPUT, `Paid by one of ${METHODS.join(", ")}.`, { field: "method" });
  if (args.method === "customer_credit") throw new DomainError(Codes.INVALID_INPUT, "Use apply credit to pay with a customer credit.", { field: "method" });
  if (args.method === "check" && !args.checkNumber?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Enter the check number.", { field: "checkNumber" });
  const fee = args.feeMinor ? BigInt(args.feeMinor) : 0n;
  if (fee < 0n || fee >= amount) throw new DomainError(Codes.INVALID_INPUT, "The processing fee is less than the payment.", { field: "feeMinor" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "payment.record_invoice", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const invoice = await lockInvoice(tx, args.invoiceId);
    if (!["posted", "partially_paid"].includes(invoice.status)) throw new DomainError(Codes.GUARD_FAILED, `Invoice ${invoice.ref} is ${invoice.status}; it takes no payment.`, { status: invoice.status });
    const receivedAt = args.receivedAt ? new Date(args.receivedAt) : uow.now;
    if (Number.isNaN(receivedAt.getTime()) || receivedAt.getTime() > uow.now.getTime()) throw new DomainError(Codes.INVALID_INPUT, "When was it received? Not in the future.", { field: "receivedAt" });
    if (["card", "ach"].includes(args.method)) {
      const blocked = await tx.paymentAttempt.findFirst({ where: { invoiceId: invoice.id, status: "unknown", ...args.attemptId ? { id: { not: args.attemptId } } : {} }, select: { intentKey: true } });
      if (blocked) throw new DomainError(Codes.GUARD_FAILED, "An earlier card or ACH try on this invoice has an unknown outcome. Resolve it before taking another payment (I-M5).", { reason: "unknown_attempt", intentKey: blocked.intentKey });
    }
    let attempt = null;
    if (args.attemptId) {
      attempt = await lockRow(tx, "PaymentAttempt", args.attemptId);
      if (attempt.invoiceId !== invoice.id || attempt.amountMinor !== amount || !["pending", "unknown"].includes(attempt.status)) throw new DomainError(Codes.GUARD_FAILED, "That attempt does not match this payment.", { reason: "attempt_mismatch" });
    }
    const payment = await createPayment(uow, actor, { customerId: invoice.customerId, jobId: invoice.jobId, payerId: invoice.payerId, method: args.method, amountMinor: amount, feeMinor: fee, reference: args.reference?.trim(), checkNumber: args.checkNumber?.trim(), receivedAt });
    if (attempt) await casUpdate(uow, { model: "PaymentAttempt", id: attempt.id, version: attempt.version, from: ["pending", "unknown"], to: "succeeded", actor, eventType: "payment_attempt.succeeded", data: { paymentId: payment.id } });
    const apply = amount < invoice.balanceMinor ? amount : invoice.balanceMinor;
    await allocatePayment(uow, actor, invoice, payment.id, apply);
    const excess = amount - apply;
    if (excess > 0n && invoice.customerId) {
      await uow.tx.customerCreditEntry.create({ data: { customerId: invoice.customerId, kind: "issued", amountMinor: excess, sourceType: "Payment", sourceId: payment.id } });
      await uow.tx.paymentAllocation.create({ data: { paymentId: payment.id, invoiceId: null, kind: "apply", amountMinor: excess, reason: "overpayment to customer credit", createdById: actorUserId(actor) } });
    }
    auditCreate(uow, actor, "Payment", payment.id, "payment.recorded", { ref: payment.ref, invoiceId: invoice.id, amountMinor: amount.toString(), method: args.method, appliedMinor: apply.toString(), creditMinor: excess.toString() });
    return { paymentId: payment.id, ref: payment.ref, appliedMinor: apply.toString(), customerCreditMinor: excess.toString() };
  });
  return { replay: result.replay, ...result.value };
}
async function applyCustomerCredit(db, actor, args) {
  await authorizeOperation(db, actor, "credit.apply", [...TAKE], args);
  const amount = cents(args.amountMinor, "amountMinor");
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "credit.apply", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const invoice = await lockInvoice(tx, args.invoiceId);
    if (!invoice.customerId) throw new DomainError(Codes.GUARD_FAILED, "The invoice has no customer.");
    const balance = await tx.customerCreditEntry.aggregate({ where: { customerId: invoice.customerId }, _sum: { amountMinor: true } });
    const available = balance._sum.amountMinor ?? 0n;
    if (amount > available) throw new DomainError(Codes.GUARD_FAILED, `Only ${money(available)} of credit is available.`, { reason: "insufficient_credit" });
    const payment = await createPayment(uow, actor, { customerId: invoice.customerId, jobId: invoice.jobId, payerId: invoice.payerId, method: "customer_credit", amountMinor: amount, reference: "Customer credit", receivedAt: uow.now });
    await tx.customerCreditEntry.create({ data: { customerId: invoice.customerId, kind: "applied", amountMinor: -amount, sourceType: "Payment", sourceId: payment.id } });
    await allocatePayment(uow, actor, invoice, payment.id, amount);
    auditCreate(uow, actor, "Payment", payment.id, "credit.applied", { invoiceId: invoice.id, amountMinor: amount.toString() });
    return { paymentId: payment.id, ref: payment.ref };
  });
  return { replay: result.replay, ...result.value };
}
async function startPaymentAttempt(db, actor, args) {
  await authorizeOperation(db, actor, "payment.attempt_start", [...TAKE], args);
  const amount = cents(args.amountMinor, "amountMinor");
  if (!["card", "ach"].includes(args.method)) throw new DomainError(Codes.INVALID_INPUT, "A try is card or ACH.", { field: "method" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "payment.attempt_start", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const invoice = await lockInvoice(uow.tx, args.invoiceId);
    if (!["posted", "partially_paid"].includes(invoice.status)) throw new DomainError(Codes.GUARD_FAILED, `Invoice ${invoice.ref} is ${invoice.status}; it takes no payment.`);
    if (amount > invoice.balanceMinor) throw new DomainError(Codes.GUARD_FAILED, `That is more than the ${money(invoice.balanceMinor)} balance.`);
    if (await uow.tx.paymentAttempt.count({ where: { invoiceId: invoice.id, status: { in: ["pending", "unknown"] } } })) throw new DomainError(Codes.GUARD_FAILED, "A try on this invoice is still open. Finish or resolve it first.", { reason: "attempt_open" });
    const attempt = await uow.tx.paymentAttempt.create({ data: { intentKey: `${invoice.ref}-${idempotencyKey}`.slice(0, 120), invoiceId: invoice.id, customerId: invoice.customerId, amountMinor: amount, method: args.method, status: "pending", createdById: actorUserId(actor) }, select: { id: true, intentKey: true } });
    auditCreate(uow, actor, "PaymentAttempt", attempt.id, "payment_attempt.started", { invoiceId: invoice.id, amountMinor: amount.toString(), method: args.method });
    return { attemptId: attempt.id, intentKey: attempt.intentKey };
  });
  return { replay: result.replay, ...result.value };
}
async function markAttemptUnknown(db, actor, args) {
  await authorizeOperation(db, actor, "payment.attempt_unknown", [...TAKE], args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "payment.attempt_unknown", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const a = await lockRow(uow.tx, "PaymentAttempt", args.attemptId);
    if (a.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, "This try changed since you loaded it. Reload and try again.");
    const version = await casUpdate(uow, { model: "PaymentAttempt", id: a.id, version: a.version, from: ["pending"], to: "unknown", actor, eventType: "payment_attempt.unknown", reason: args.note ?? null, data: { failureNote: args.note?.trim() ?? "" } });
    return { attemptId: a.id, status: "unknown", version };
  });
  return { replay: result.replay, ...result.value };
}
async function resolveAttemptFailed(db, actor, args) {
  await authorizeOperation(db, actor, "payment.attempt_resolve", ["canManagePayments"], args);
  if (String(args.evidence ?? "").trim().length < 5) throw new DomainError(Codes.INVALID_INPUT, "Say what you checked (for example the processor dashboard and the time).", { field: "evidence" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "payment.attempt_resolve", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const a = await lockRow(uow.tx, "PaymentAttempt", args.attemptId);
    if (a.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, "This try changed since you loaded it. Reload and try again.");
    const version = await casUpdate(uow, { model: "PaymentAttempt", id: a.id, version: a.version, from: ["pending", "unknown"], to: "failed", actor, eventType: "payment_attempt.resolved_failed", reason: args.evidence, data: { resolutionNote: args.evidence.trim() } });
    return { attemptId: a.id, status: "failed", version };
  });
  return { replay: result.replay, ...result.value };
}
var REFUND_CREDIT = "Membership payment refunded:";
async function settleRefundedMembershipInvoice(db, actor, args) {
  await authorizeOperation(db, actor, "refund.settle_membership_invoice", ["canIssueRefunds"], args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "refund.settle_membership_invoice", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const invoice = await lockInvoice(tx, args.invoiceId);
    const charge = await tx.membershipBillingAttempt.findFirst({ where: { invoiceId: invoice.id, paymentId: { not: null } }, select: { paymentId: true, membershipId: true, termId: true } });
    if (!charge?.paymentId) throw new DomainError(Codes.GUARD_FAILED, "This is not a membership invoice paid by card.", { reason: "not_membership_invoice" });
    const refunds = await tx.refund.findMany({ where: { paymentId: charge.paymentId }, select: { amountMinor: true, reason: true } });
    const refunded = refunds.reduce((n, r) => n + r.amountMinor, 0n);
    if (!refunded) throw new DomainError(Codes.GUARD_FAILED, "Nothing has been refunded on this invoice.", { reason: "no_refund" });
    const credited = (await tx.creditMemo.aggregate({ where: { invoiceId: invoice.id, status: "applied", note: { startsWith: REFUND_CREDIT } }, _sum: { totalMinor: true } }))._sum.totalMinor ?? 0n;
    const owed = refunded - credited < invoice.balanceMinor ? refunded - credited : invoice.balanceMinor;
    const memo = owed > 0n ? await creditForRefund(uow, actor, { invoiceId: invoice.id, amountMinor: owed, note: `${REFUND_CREDIT} ${refunds[0]?.reason ?? "refund"}` }) : null;
    if (charge.membershipId) await closeTermForRefund(uow, actor, { membershipId: charge.membershipId, termId: charge.termId, reason: refunds[0]?.reason ?? "Refunded" });
    return { invoiceId: invoice.id, creditedMinor: owed > 0n ? owed.toString() : "0", memoRef: memo?.ref ?? null };
  });
  return { replay: result.replay, ...result.value };
}
async function writeRefund(uow, actor, a) {
  const { tx } = uow;
  const u = await unappliedOf(tx, a.paymentId);
  if (a.amountMinor > u.amountMinor - u.refunded) throw new DomainError(Codes.GUARD_FAILED, `At most ${money(u.amountMinor - u.refunded)} is left to refund on this payment.`, { reason: "refund_exceeds_payment" });
  const needBack = a.amountMinor - u.unapplied;
  const membershipCharge = await tx.membershipBillingAttempt.findFirst({ where: { paymentId: a.paymentId }, select: { invoiceId: true, membershipId: true, termId: true } });
  const customerId = (await tx.payment.findUniqueOrThrow({ where: { id: a.paymentId }, select: { customerId: true } })).customerId;
  if (needBack > 0n) {
    const credit = customerId ? (await tx.customerCreditEntry.aggregate({ where: { customerId, sourceType: "Payment", sourceId: a.paymentId }, _sum: { amountMinor: true } }))._sum.amountMinor ?? 0n : 0n;
    const fromCredit = credit < needBack ? credit : needBack;
    if (fromCredit > 0n && customerId) {
      await tx.customerCreditEntry.create({ data: { customerId, kind: "refunded", amountMinor: -fromCredit, sourceType: "Payment", sourceId: a.paymentId } });
      await tx.paymentAllocation.create({ data: { paymentId: a.paymentId, invoiceId: null, kind: "reverse", reversesId: (await tx.paymentAllocation.findFirst({ where: { paymentId: a.paymentId, invoiceId: null, kind: "apply" }, select: { id: true } }))?.id, amountMinor: fromCredit, reason: "refund of customer credit", createdById: actorUserId(actor) } });
    }
    const back = needBack - fromCredit;
    if (back > 0n) {
      const done = await reverseAllocations(uow, actor, a.paymentId, back, "refund_reopen", `Refund: ${a.reason}`);
      if (done !== back) throw new DomainError(Codes.GUARD_FAILED, "The refund is more than this payment has applied.");
      if (membershipCharge?.invoiceId) await creditForRefund(uow, actor, { invoiceId: membershipCharge.invoiceId, amountMinor: back, note: `${REFUND_CREDIT} ${a.reason}` });
    }
  }
  if (membershipCharge?.membershipId) await closeTermForRefund(uow, actor, { membershipId: membershipCharge.membershipId, termId: membershipCharge.termId, reason: a.reason });
  await arPeriodFor(tx, await companyToday(tx, uow.now));
  const ref = await nextReference(tx, "RFD", uow.now);
  const refund = await tx.refund.create({ data: { ref, paymentId: a.paymentId, method: a.method, amountMinor: a.amountMinor, reason: a.reason, approvalId: a.approvalId, reference: a.reference, refundedAt: uow.now, recordedById: actorUserId(actor) }, select: { id: true } });
  auditCreate(uow, actor, "Refund", refund.id, "refund.recorded", { ref, paymentId: a.paymentId, amountMinor: a.amountMinor.toString(), method: a.method, approvalId: a.approvalId });
  return { refundId: refund.id, ref };
}
async function requestRefund(db, actor, args) {
  await authorizeOperation(db, actor, "refund.issue", ["canIssueRefunds"], args);
  const amount = cents(args.amountMinor, "amountMinor");
  if (!["processor_refund", "check"].includes(args.method)) throw new DomainError(Codes.INVALID_INPUT, "Refund by processor refund or check.", { field: "method" });
  const reason = String(args.reason ?? "").trim();
  if (reason.length < 3) throw new DomainError(Codes.INVALID_INPUT, "Say why, in a few words.", { field: "reason" });
  const reference = String(args.reference ?? "").trim();
  if (!reference) throw new DomainError(Codes.INVALID_INPUT, "Enter the processor refund id or the check number.", { field: "reference" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "refund.issue", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    await lockRow(tx, "Payment", args.paymentId);
    const u = await unappliedOf(tx, args.paymentId);
    if (amount > u.amountMinor - u.refunded) throw new DomainError(Codes.GUARD_FAILED, `At most ${money(u.amountMinor - u.refunded)} is left to refund on this payment.`, { reason: "refund_exceeds_payment" });
    const settings = await tx.companySettings.findFirst({ select: { refundApprovalThresholdMinor: true } });
    if (u.refunded + amount <= (settings?.refundApprovalThresholdMinor ?? 50000n)) {
      return { status: "recorded", approvalRequestId: null, ...await writeRefund(uow, actor, { paymentId: args.paymentId, amountMinor: amount, method: args.method, reason, reference, approvalId: null }) };
    }
    const approval = await requestApproval(uow, actor, {
      action: "refund.issue",
      targetList: "Payment",
      targetId: args.paymentId,
      requiredPermission: "canApproveRefunds",
      payload: { paymentId: args.paymentId, amountMinor: amount.toString(), method: args.method, reason, reference },
      summary: `Refund ${money(amount)} by ${args.method === "check" ? "check" : "processor"} \u2014 ${reason}`
    });
    return { status: "pending_approval", approvalRequestId: approval.id };
  });
  return { replay: result.replay, ...result.value };
}
async function recordApprovedRefund(db, actor, args) {
  await authorizeOperation(db, actor, "refund.record_approved", ["canIssueRefunds"], args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "refund.record_approved", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { consumeApproval: consumeApproval2 } = await Promise.resolve().then(() => (init_approval(), approval_exports));
    const request = await uow.tx.approvalRequest.findUnique({ where: { id: args.approvalRequestId } });
    if (!request || request.action !== "refund.issue") throw new DomainError(Codes.NOT_FOUND, "Refund approval not found.");
    const payload = request.payload;
    await consumeApproval2(uow, { requestId: request.id, action: request.action, targetList: request.targetList, targetId: request.targetId, payload });
    await lockRow(uow.tx, "Payment", payload.paymentId);
    return { status: "recorded", ...await writeRefund(uow, actor, { paymentId: payload.paymentId, amountMinor: BigInt(payload.amountMinor), method: payload.method, reason: payload.reason, reference: payload.reference, approvalId: request.id }) };
  });
  return { replay: result.replay, ...result.value };
}
registerApplier("refund.issue", async () => ({ deferred: true }), { applyOnApprove: false });
async function closePaymentBatch(db, actor, args) {
  await authorizeOperation(db, actor, "payment_batch.close", ["canManagePayments", "canManageAccounting"], args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "payment_batch.close", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const b = await lockRow(uow.tx, "PaymentBatch", args.batchId);
    if (b.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, "This batch changed since you loaded it. Reload and try again.");
    const version = await casUpdate(uow, { model: "PaymentBatch", id: b.id, version: b.version, from: ["open"], to: "closed", actor, eventType: "payment_batch.closed", data: { closedById: actorUserId(actor), closedAt: uow.now } });
    return { batchId: b.id, status: "closed", version };
  });
  return { replay: result.replay, ...result.value };
}
async function reconcilePaymentBatch(db, actor, args) {
  await authorizeOperation(db, actor, "payment_batch.reconcile", ["canManagePayments", "canManageAccounting"], args);
  if (!/^\d{1,13}$/.test(args.depositedMinor ?? "")) throw new DomainError(Codes.INVALID_INPUT, "Deposit is whole cents.", { field: "depositedMinor" });
  if (!String(args.depositReference ?? "").trim()) throw new DomainError(Codes.INVALID_INPUT, "Enter the deposit or payout reference.", { field: "depositReference" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "payment_batch.reconcile", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const b = await lockRow(uow.tx, "PaymentBatch", args.batchId);
    if (b.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, "This batch changed since you loaded it. Reload and try again.");
    const deposited = BigInt(args.depositedMinor);
    const variance = deposited - b.expectedMinor;
    const version = await casUpdate(uow, { model: "PaymentBatch", id: b.id, version: b.version, from: ["closed"], to: "reconciled", actor, eventType: "payment_batch.reconciled", data: { depositedMinor: deposited, varianceMinor: variance, depositReference: args.depositReference.trim() }, audit: { varianceMinor: variance.toString() } });
    return { batchId: b.id, status: "reconciled", varianceMinor: variance.toString(), version };
  });
  return { replay: result.replay, ...result.value };
}

// features/keystone/services/financing.ts
init_actor();
init_approval();
init_cas();
init_errors();

// features/keystone/services/financingPayment.ts
init_actor();
init_errors();
async function createPaymentForFunding(uow, actor, a) {
  const { tx } = uow;
  const day3 = await companyToday(tx, a.receivedAt);
  await arPeriodFor(tx, day3);
  const ref = await nextReference(tx, "PMT", uow.now);
  const payment = await tx.payment.create({
    data: { ref, jobId: a.invoice.jobId, customerId: a.invoice.customerId, payerId: a.invoice.payerId, kind: "payment", method: "financing", amountMinor: a.gross, feeMinor: a.fee, reference: a.reference, receivedAt: a.receivedAt, recordedById: actorUserId(actor) },
    select: { id: true }
  });
  const date = asDate(day3);
  let batch = await tx.paymentBatch.findFirst({ where: { businessDate: date, tenderGroup: "financing" }, select: { id: true, status: true } });
  if (!batch) batch = await tx.paymentBatch.create({ data: { ref: await nextReference(tx, "PBT", uow.now), businessDate: date, tenderGroup: "financing", status: "open" }, select: { id: true, status: true } });
  if (batch.status !== "open") throw new DomainError(Codes.GUARD_FAILED, `The financing batch for ${day3} is ${batch.status}; record the payout on a day with an open batch.`, { reason: "batch_closed" });
  await tx.paymentBatch.update({ where: { id: batch.id }, data: { expectedMinor: { increment: a.gross - a.fee }, feesMinor: { increment: a.fee } } });
  return payment;
}

// features/keystone/services/financing.ts
var FIN = ["canOfferFinancing", "canManageInvoices"];
var cents2 = (v, field) => {
  if (typeof v !== "string" || !/^[1-9]\d{0,12}$/.test(v)) throw new DomainError(Codes.INVALID_INPUT, "Amount is whole cents, more than zero.", { field });
  return BigInt(v);
};
async function startFinancing(db, actor, args) {
  await authorizeOperation(db, actor, "financing.start", [...FIN], args);
  const amount = cents2(args.amountMinor, "amountMinor");
  if (args.consent !== true) throw new DomainError(Codes.GUARD_FAILED, "Record that the customer agreed to be sent to the partner's application first.", { reason: "consent_required" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "financing.start", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const program = await tx.financingProgram.findUnique({ where: { id: args.programId } });
    if (!program || !program.active) throw new DomainError(Codes.GUARD_FAILED, "That financing program is not offered.");
    if (amount < program.minMinor || amount > program.maxMinor) throw new DomainError(Codes.GUARD_FAILED, `This program covers ${money(program.minMinor)} to ${money(program.maxMinor)}.`, { reason: "outside_program_range" });
    const customer = await tx.customer.findUnique({ where: { id: args.customerId }, select: { id: true } });
    if (!customer) throw new DomainError(Codes.NOT_FOUND, "Customer not found.");
    if (args.invoiceId) {
      const inv = await tx.invoice.findUnique({ where: { id: args.invoiceId }, select: { customerId: true, balanceMinor: true, status: true } });
      if (!inv || inv.customerId !== customer.id) throw new DomainError(Codes.GUARD_FAILED, "That invoice is not this customer's.");
      if (amount > inv.balanceMinor) throw new DomainError(Codes.GUARD_FAILED, `That is more than the ${money(inv.balanceMinor)} still owed.`);
    }
    const ref = await nextReference(tx, "FIN", uow.now);
    const app = await tx.financingApplication.create({ data: { ref, customerId: customer.id, jobId: args.jobId ?? null, invoiceId: args.invoiceId ?? null, estimateVersionId: args.estimateVersionId ?? null, programId: program.id, amountMinor: amount, status: "started", consentRecordedAt: uow.now, createdById: actorUserId(actor) }, select: { id: true } });
    auditCreate(uow, actor, "FinancingApplication", app.id, "financing.started", { ref, amountMinor: amount.toString(), programId: program.id });
    return { applicationId: app.id, ref, applyUrl: program.applyUrl };
  });
  return { replay: result.replay, ...result.value };
}
var FLOW = {
  started: ["submitted", "cancelled"],
  submitted: ["approved", "declined", "needs_info", "cancelled"],
  needs_info: ["submitted", "declined", "cancelled"],
  approved: ["docs_signed", "declined", "expired", "cancelled"],
  docs_signed: ["awaiting_funding", "cancelled"],
  awaiting_funding: ["funded", "cancelled"]
};
async function recordFinancingStatus(db, actor, args) {
  await authorizeOperation(db, actor, "financing.record_status", [...FIN], args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "financing.record_status", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const app = await lockRow(uow.tx, "FinancingApplication", args.applicationId);
    if (app.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, "This application changed since you loaded it. Reload and try again.", { currentStatus: app.status, currentVersion: app.version });
    if (args.to === "funded") throw new DomainError(Codes.INVALID_INPUT, "Funding is recorded with the partner's payout reference.", { field: "to" });
    if (!(FLOW[app.status] ?? []).includes(args.to)) throw new DomainError(Codes.INVALID_TRANSITION, `Financing cannot go from ${app.status.replace(/_/g, " ")} to ${args.to.replace(/_/g, " ")}.`);
    if (args.to === "declined" && !args.note?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Note the reason the partner gave.", { field: "note" });
    if (args.to === "approved" && !args.offers) throw new DomainError(Codes.INVALID_INPUT, "Record the offers exactly as the partner showed them.", { field: "offers" });
    const data = {};
    if (args.partnerReference) data.partnerReference = args.partnerReference.trim();
    if (args.offers) data.offers = args.offers;
    if (args.selectedOffer) data.selectedOffer = args.selectedOffer;
    if (args.offerExpiresAt) data.offerExpiresAt = new Date(args.offerExpiresAt);
    if (args.to === "declined") data.declineNote = args.note.trim();
    const version = await casUpdate(uow, { model: "FinancingApplication", id: app.id, version: app.version, from: [app.status], to: args.to, actor, eventType: `financing.${args.to}`, reason: args.note ?? null, data, audit: { partnerReference: args.partnerReference ?? null } });
    return { applicationId: app.id, status: args.to, version };
  });
  return { replay: result.replay, ...result.value };
}
async function recordFinancingFunding(db, actor, args) {
  await authorizeOperation(db, actor, "financing.fund", ["canManagePayments", "canManageAccounting"], args);
  const gross = cents2(args.grossMinor, "grossMinor");
  const fee = args.feeMinor ? BigInt(args.feeMinor) : 0n;
  if (fee < 0n || fee >= gross) throw new DomainError(Codes.INVALID_INPUT, "The partner fee is less than the payout.", { field: "feeMinor" });
  if (!String(args.reference ?? "").trim()) throw new DomainError(Codes.INVALID_INPUT, "Enter the partner's payout reference.", { field: "reference" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "financing.fund", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const app = await lockRow(tx, "FinancingApplication", args.applicationId);
    if (app.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, "This application changed since you loaded it. Reload and try again.");
    if (app.status !== "awaiting_funding") throw new DomainError(Codes.GUARD_FAILED, `Funding is recorded once the loan is signed and awaiting funding; this one is ${app.status.replace(/_/g, " ")}.`);
    if (gross !== app.amountMinor) throw new DomainError(Codes.GUARD_FAILED, `The partner funded ${money(gross)} but the customer chose ${money(app.amountMinor)}.`, { reason: "amount_mismatch" });
    if (!app.invoiceId) throw new DomainError(Codes.GUARD_FAILED, "Link the financing to an invoice before recording funding.", { reason: "invoice_required" });
    const fundedAt = args.fundedAt ? new Date(args.fundedAt) : uow.now;
    if (Number.isNaN(fundedAt.getTime()) || fundedAt.getTime() > uow.now.getTime()) throw new DomainError(Codes.INVALID_INPUT, "When did the money arrive? Not in the future.", { field: "fundedAt" });
    if (app.jobId) {
      const open = await tx.cancellationNotice.findFirst({ where: { jobId: app.jobId, status: { in: ["issued", "delivered"] }, cancelBy: { gt: uow.now } }, select: { ref: true, cancelBy: true } });
      if (open) throw new DomainError(Codes.GUARD_FAILED, `The customer can still cancel this sale until ${open.cancelBy.toISOString().slice(0, 10)} (${open.ref}). Record funding after that.`, { reason: "cancel_window_open", cancelBy: open.cancelBy.toISOString() });
      const cancelled = await tx.cancellationNotice.findFirst({ where: { jobId: app.jobId, status: { in: ["cancelled_by_buyer", "refunded"] } }, select: { ref: true } });
      if (cancelled) throw new DomainError(Codes.GUARD_FAILED, `The customer cancelled this sale (${cancelled.ref}); do not record funding.`, { reason: "sale_cancelled" });
    }
    const invoice = await lockInvoice(tx, app.invoiceId);
    const payment = await createPaymentForFunding(uow, actor, { invoice, gross, fee, reference: args.reference.trim(), receivedAt: fundedAt });
    const funding = await tx.financingFunding.create({ data: { applicationId: app.id, grossMinor: gross, feeMinor: fee, reference: args.reference.trim(), fundedAt, paymentId: payment.id }, select: { id: true } });
    const apply = gross < invoice.balanceMinor ? gross : invoice.balanceMinor;
    await allocatePayment(uow, actor, invoice, payment.id, apply);
    const version = await casUpdate(uow, { model: "FinancingApplication", id: app.id, version: app.version, from: ["awaiting_funding"], to: "funded", actor, eventType: "financing.funded", data: {}, audit: { grossMinor: gross.toString(), feeMinor: fee.toString() } });
    auditCreate(uow, actor, "FinancingFunding", funding.id, "financing.funding_recorded", { applicationId: app.id, grossMinor: gross.toString(), feeMinor: fee.toString(), reference: args.reference, paymentId: payment.id });
    return { applicationId: app.id, status: "funded", version, paymentId: payment.id };
  });
  return { replay: result.replay, ...result.value };
}
async function saveFinancingProgram(db, actor, args) {
  await authorizeOperation(db, actor, "financing.program_save", ["canManageInvoices", "canManageAccounting"], args);
  const min = cents2(args.minMinor, "minMinor");
  const max = cents2(args.maxMinor, "maxMinor");
  if (max < min) throw new DomainError(Codes.INVALID_INPUT, "The maximum is at least the minimum.", { field: "maxMinor" });
  if (!String(args.name ?? "").trim()) throw new DomainError(Codes.INVALID_INPUT, "Name the program.", { field: "name" });
  if (args.applyUrl && !/^https:\/\//i.test(args.applyUrl)) throw new DomainError(Codes.INVALID_INPUT, "The application link is an https address.", { field: "applyUrl" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "financing.program_save", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const data = { name: args.name.trim(), partner: args.partner === "other" ? "other" : "wisetack", minMinor: min, maxMinor: max, termsNote: args.termsNote?.trim() ?? "", applyUrl: args.applyUrl?.trim() ?? "", active: args.active !== false };
    const row = args.programId ? await uow.tx.financingProgram.update({ where: { id: args.programId }, data, select: { id: true } }) : await uow.tx.financingProgram.create({ data, select: { id: true } });
    auditCreate(uow, actor, "FinancingProgram", row.id, args.programId ? "financing.program_updated" : "financing.program_created", { name: data.name });
    return { programId: row.id };
  });
  return { replay: result.replay, ...result.value };
}
async function recordThirdPartyAuthorization(db, actor, args) {
  await authorizeOperation(db, actor, "authorization.record", ["canManageInvoices"], args);
  const amount = cents2(args.authorizedAmountMinor, "authorizedAmountMinor");
  if (!["home_warranty", "po", "nte", "insurance"].includes(args.kind)) throw new DomainError(Codes.INVALID_INPUT, "Kind is home_warranty, po, nte or insurance.", { field: "kind" });
  if (!String(args.externalRef ?? "").trim()) throw new DomainError(Codes.INVALID_INPUT, "Enter the payer's authorization or PO number.", { field: "externalRef" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "authorization.record", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const [job, payer] = await Promise.all([tx.job.findUnique({ where: { id: args.jobId }, select: { id: true } }), tx.payerProfile.findUnique({ where: { id: args.payerId }, select: { id: true } })]);
    if (!job || !payer) throw new DomainError(Codes.NOT_FOUND, "Job or payer not found.");
    const prior = await tx.thirdPartyAuthorization.findFirst({ where: { jobId: job.id, payerId: payer.id, externalRef: args.externalRef.trim(), status: "authorized" } });
    if (prior) await casUpdate(uow, { model: "ThirdPartyAuthorization", id: prior.id, version: prior.version, from: ["authorized"], to: "revised", actor, eventType: "authorization.revised" });
    const row = await tx.thirdPartyAuthorization.create({ data: { jobId: job.id, payerId: payer.id, kind: args.kind, externalRef: args.externalRef.trim(), authorizedAmountMinor: amount, serviceFeeMinor: args.serviceFeeMinor ? BigInt(args.serviceFeeMinor) : 0n, status: "authorized", revisionOfId: prior?.id ?? null }, select: { id: true } });
    auditCreate(uow, actor, "ThirdPartyAuthorization", row.id, "authorization.recorded", { jobId: job.id, kind: args.kind, amountMinor: amount.toString(), revisionOf: prior?.id ?? null });
    return { authorizationId: row.id };
  });
  return { replay: result.replay, ...result.value };
}
async function savePayerProfile(db, actor, args) {
  await authorizeOperation(db, actor, "payer.save", ["canManageInvoices"], args);
  if (!String(args.name ?? "").trim()) throw new DomainError(Codes.INVALID_INPUT, "Name the payer.", { field: "name" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "payer.save", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const data = { name: args.name.trim(), kind: args.kind, terms: args.terms, poRequired: args.poRequired === true, billingContact: args.billingContact?.trim() ?? "", accountingCustomerRef: args.accountingCustomerRef?.trim() ?? "" };
    const row = args.payerId ? await uow.tx.payerProfile.update({ where: { id: args.payerId }, data, select: { id: true } }) : await uow.tx.payerProfile.create({ data, select: { id: true } });
    auditCreate(uow, actor, "PayerProfile", row.id, args.payerId ? "payer.updated" : "payer.created", { name: data.name, kind: data.kind, terms: data.terms });
    return { payerId: row.id };
  });
  return { replay: result.replay, ...result.value };
}
async function requestArPeriodClose(db, actor, args) {
  await authorizeOperation(db, actor, "ar_period.close_request", ["canCloseAr"], args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "ar_period.close_request", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const p = await lockRow(uow.tx, "ArPeriod", args.periodId);
    if (p.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, "This period changed since you loaded it. Reload and try again.");
    const drafts = await uow.tx.invoice.count({ where: { status: "draft", arPeriodId: p.id } });
    const openBatches = await uow.tx.paymentBatch.count({ where: { status: "open", businessDate: { gte: p.month, lt: new Date(Date.UTC(p.month.getUTCFullYear(), p.month.getUTCMonth() + 1, 1)) } } });
    if (openBatches) throw new DomainError(Codes.GUARD_FAILED, `${openBatches} payment batch${openBatches === 1 ? " is" : "es are"} still open in this month. Close them first.`, { reason: "open_batches" });
    const approval = await requestApproval(uow, actor, { action: "ar_period.close", targetList: "ArPeriod", targetId: p.id, requiredPermission: "canApproveArClose", payload: { periodId: p.id, month: p.month.toISOString().slice(0, 7), version: p.version + 1 }, summary: `Close AR period ${p.month.toISOString().slice(0, 7)}` });
    const version = await casUpdate(uow, { model: "ArPeriod", id: p.id, version: p.version, from: ["open"], to: "closing", actor, eventType: "ar_period.close_requested", data: { approvalId: approval.id } });
    return { periodId: p.id, status: "closing", version, approvalRequestId: approval.id };
  });
  return { replay: result.replay, ...result.value };
}
registerApplier("ar_period.close", async (uow, actor, request) => {
  const p = await lockRow(uow.tx, "ArPeriod", request.targetId);
  if (p.status !== "closing" || p.approvalId !== request.id || p.version !== request.payload.version) throw new DomainError(Codes.APPROVAL_MISMATCH, "The period changed after the close was requested.");
  await casUpdate(uow, { model: "ArPeriod", id: p.id, version: p.version, from: ["closing"], to: "closed", actor, eventType: "ar_period.closed", approverId: actorUserId(actor), data: { closedById: actorUserId(actor), closedAt: uow.now } });
  return { periodId: p.id, status: "closed" };
});
async function reopenArPeriod(db, actor, args) {
  await authorizeOperation(db, actor, "ar_period.reopen", ["canCloseAr"], args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "ar_period.reopen", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const p = await lockRow(uow.tx, "ArPeriod", args.periodId);
    if (p.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, "This period changed since you loaded it. Reload and try again.");
    if (p.approvalId) {
      const req = await uow.tx.approvalRequest.findUnique({ where: { id: p.approvalId }, select: { id: true, status: true, version: true } });
      if (req?.status === "pending") await casUpdate(uow, { model: "ApprovalRequest", id: req.id, version: req.version, from: ["pending"], to: "cancelled", actor, eventType: "approval.cancelled", reason: "AR period reopened" });
    }
    const version = await casUpdate(uow, { model: "ArPeriod", id: p.id, version: p.version, from: ["closing"], to: "open", actor, eventType: "ar_period.reopened", data: { approvalId: null } });
    return { periodId: p.id, status: "open", version };
  });
  return { replay: result.replay, ...result.value };
}

// features/keystone/services/accounting.ts
var import_node_crypto10 = require("node:crypto");
init_actor();
init_cas();
init_errors();

// features/keystone/services/accountingDates.ts
init_errors();
function assertDateRange(from, to) {
  try {
    assertDate(from);
    assertDate(to);
  } catch {
    throw new DomainError(Codes.INVALID_INPUT, "Dates are YYYY-MM-DD.", { field: "from" });
  }
  if (to < from) throw new DomainError(Codes.INVALID_INPUT, "The end date is on or after the start date.", { field: "to" });
  if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 400 * 864e5) throw new DomainError(Codes.INVALID_INPUT, "Export at most 400 days at a time.", { field: "to" });
}

// features/keystone/services/accounting.ts
var ACCOUNTS = {
  ar: "1200",
  cash: "1010",
  card: "1020",
  ach: "1030",
  financing: "1040",
  thirdParty: "1050",
  customerCredit: "2400",
  salesTax: "2200",
  refundClearing: "2500",
  fees: "6100",
  salesReturns: "4900",
  badDebt: "6900"
};
var TENDER_ACCOUNT = { cash: ACCOUNTS.cash, check: ACCOUNTS.cash, other: ACCOUNTS.cash, card: ACCOUNTS.card, ach: ACCOUNTS.ach, financing: ACCOUNTS.financing, third_party: ACCOUNTS.thirdParty, customer_credit: ACCOUNTS.customerCredit };
var dr = (base, account, amount, n) => ({ sourceKey: `${base.key}:${n}`, entryDate: base.entryDate, account, debitMinor: amount, creditMinor: 0n, memo: base.memo, docRef: base.docRef, customerRef: base.customerRef });
var cr = (base, account, amount, n) => ({ sourceKey: `${base.key}:${n}`, entryDate: base.entryDate, account, debitMinor: 0n, creditMinor: amount, memo: base.memo, docRef: base.docRef, customerRef: base.customerRef });
async function journalFor(tx, from, to, tz) {
  const lo = /* @__PURE__ */ new Date(`${from}T00:00:00Z`);
  lo.setUTCDate(lo.getUTCDate() - 1);
  const hi = /* @__PURE__ */ new Date(`${to}T00:00:00Z`);
  hi.setUTCDate(hi.getUTCDate() + 2);
  const inRange = (d) => {
    const day3 = localDate({ timeZone: tz }, d);
    return day3 >= from && day3 <= to ? day3 : null;
  };
  const lines = [];
  const customerRefOf = async (customerId, payerId) => {
    if (payerId) {
      const p = await tx.payerProfile.findUnique({ where: { id: payerId }, select: { accountingCustomerRef: true, name: true } });
      return p?.accountingCustomerRef || p?.name || "";
    }
    if (!customerId) return "";
    const c = await tx.customer.findUnique({ where: { id: customerId }, select: { ref: true } });
    return c?.ref ?? "";
  };
  const entries = await tx.arEntry.findMany({ where: { postedAt: { gte: lo, lt: hi } }, orderBy: [{ postedAt: "asc" }, { id: "asc" }], include: { invoice: { select: { ref: true, lines: { orderBy: { sortOrder: "asc" } } } } } });
  for (const e of entries) {
    const day3 = inRange(e.postedAt);
    if (!day3) continue;
    const base = { key: `ar:${e.id}`, entryDate: day3, memo: `${e.kind.replace(/_/g, " ")} ${e.invoice?.ref ?? ""}`.trim(), docRef: e.invoice?.ref ?? "", customerRef: await customerRefOf(e.customerId, e.payerId) };
    const amt = e.amountMinor < 0n ? -e.amountMinor : e.amountMinor;
    if (e.kind === "invoice_posted") {
      lines.push(dr(base, ACCOUNTS.ar, amt, 0));
      let n = 1;
      let tax = 0n;
      for (const l of e.invoice?.lines ?? []) {
        const net = l.amountMinor - l.discountMinor;
        if (net > 0n) lines.push(cr(base, l.revenueAccountCode || "4000", net, n++));
        tax += l.taxMinor;
      }
      if (tax > 0n) lines.push(cr(base, ACCOUNTS.salesTax, tax, n++));
    } else if (e.kind === "payment_applied" || e.kind === "payment_reversed" || e.kind === "refund_reopen") {
      const pay = e.sourceId ? await tx.payment.findUnique({ where: { id: e.sourceId }, select: { method: true } }) : null;
      const tender = e.kind === "refund_reopen" ? ACCOUNTS.refundClearing : TENDER_ACCOUNT[pay?.method ?? "other"] ?? ACCOUNTS.cash;
      if (e.kind === "payment_applied") {
        lines.push(dr(base, tender, amt, 0));
        lines.push(cr(base, ACCOUNTS.ar, amt, 1));
      } else if (e.kind === "refund_reopen") {
        lines.push(dr(base, ACCOUNTS.ar, amt, 0));
        lines.push(cr(base, tender, amt, 1));
      } else {
        lines.push(dr(base, ACCOUNTS.ar, amt, 0));
        lines.push(cr(base, tender, amt, 1));
      }
    } else if (e.kind === "credit_memo") {
      lines.push(dr(base, ACCOUNTS.salesReturns, amt, 0));
      lines.push(cr(base, ACCOUNTS.ar, amt, 1));
    } else if (e.kind === "write_off") {
      lines.push(dr(base, ACCOUNTS.badDebt, amt, 0));
      lines.push(cr(base, ACCOUNTS.ar, amt, 1));
    }
  }
  const payments = await tx.payment.findMany({ where: { receivedAt: { gte: lo, lt: hi } }, select: { id: true, ref: true, method: true, feeMinor: true, receivedAt: true, customerId: true, payerId: true } });
  for (const p of payments) {
    const day3 = inRange(p.receivedAt);
    if (!day3 || p.feeMinor === 0n) continue;
    const base = { key: `fee:${p.id}`, entryDate: day3, memo: `processing fee ${p.ref}`, docRef: p.ref, customerRef: await customerRefOf(p.customerId, p.payerId) };
    lines.push(dr(base, ACCOUNTS.fees, p.feeMinor, 0));
    lines.push(cr(base, TENDER_ACCOUNT[p.method] ?? ACCOUNTS.cash, p.feeMinor, 1));
  }
  const credits = await tx.customerCreditEntry.findMany({ where: { createdAt: { gte: lo, lt: hi } }, orderBy: { createdAt: "asc" } });
  for (const c of credits) {
    const day3 = inRange(c.createdAt);
    if (!day3) continue;
    const base = { key: `credit:${c.id}`, entryDate: day3, memo: `customer credit ${c.kind}`, docRef: c.sourceId, customerRef: await customerRefOf(c.customerId, null) };
    const amt = c.amountMinor < 0n ? -c.amountMinor : c.amountMinor;
    if (c.kind === "issued") {
      const src = c.sourceType === "Payment" ? await tx.payment.findUnique({ where: { id: c.sourceId }, select: { method: true } }) : null;
      lines.push(dr(base, src ? TENDER_ACCOUNT[src.method] ?? ACCOUNTS.cash : ACCOUNTS.salesReturns, amt, 0));
      lines.push(cr(base, ACCOUNTS.customerCredit, amt, 1));
    } else if (c.kind === "refunded") {
      lines.push(dr(base, ACCOUNTS.customerCredit, amt, 0));
      lines.push(cr(base, ACCOUNTS.refundClearing, amt, 1));
    }
  }
  const refunds = await tx.refund.findMany({ where: { refundedAt: { gte: lo, lt: hi } }, include: { payment: { select: { method: true, customerId: true, payerId: true } } } });
  for (const r of refunds) {
    const day3 = inRange(r.refundedAt);
    if (!day3) continue;
    const base = { key: `refund:${r.id}`, entryDate: day3, memo: `refund ${r.ref}`, docRef: r.ref, customerRef: await customerRefOf(r.payment?.customerId ?? null, r.payment?.payerId ?? null) };
    lines.push(dr(base, ACCOUNTS.refundClearing, r.amountMinor, 0));
    lines.push(cr(base, TENDER_ACCOUNT[r.payment?.method ?? "other"] ?? ACCOUNTS.cash, r.amountMinor, 1));
  }
  return lines;
}
async function createExportBatch(db, actor, args) {
  await authorizeOperation(db, actor, "accounting.export", ["canManageAccounting"], args);
  assertDateRange(args.from, args.to);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "accounting.export", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const company = await tx.companySettings.findFirst({ select: { homeTimeZone: true } });
    const all2 = await journalFor(tx, args.from, args.to, company?.homeTimeZone || "America/Chicago");
    const done = new Set((await tx.accountingExportLine.findMany({ where: { sourceKey: { in: all2.map((l) => l.sourceKey) } }, select: { sourceKey: true } })).map((l) => l.sourceKey));
    const fresh = all2.filter((l) => !done.has(l.sourceKey));
    if (!fresh.length) throw new DomainError(Codes.GUARD_FAILED, "Nothing new to export in that range.", { reason: "nothing_to_export" });
    const debit = fresh.reduce((a, l) => a + l.debitMinor, 0n);
    const credit = fresh.reduce((a, l) => a + l.creditMinor, 0n);
    if (debit !== credit) throw new DomainError(Codes.GUARD_FAILED, `The journal does not balance (debits ${debit}, credits ${credit}). Nothing was exported.`, { reason: "unbalanced" });
    const ref = await nextReference(tx, "EXP", uow.now);
    const sha = (0, import_node_crypto10.createHash)("sha256").update(fresh.map((l) => l.sourceKey).join("\n")).digest("hex");
    const batch = await tx.accountingExportBatch.create({ data: { ref, periodFrom: /* @__PURE__ */ new Date(`${args.from}T00:00:00Z`), periodTo: /* @__PURE__ */ new Date(`${args.to}T00:00:00Z`), status: "created", lineCount: fresh.length, debitMinor: debit, creditMinor: credit, sha256: sha, createdById: actorUserId(actor) }, select: { id: true } });
    await tx.accountingExportLine.createMany({ data: fresh.map((l, i) => ({ batchId: batch.id, sourceKey: l.sourceKey, entryDate: /* @__PURE__ */ new Date(`${l.entryDate}T00:00:00Z`), account: l.account, debitMinor: l.debitMinor, creditMinor: l.creditMinor, memo: l.memo, docRef: l.docRef, customerRef: l.customerRef, sortOrder: i })) });
    auditCreate(uow, actor, "AccountingExportBatch", batch.id, "accounting.exported", { ref, lines: fresh.length, debitMinor: debit.toString(), from: args.from, to: args.to });
    return { batchId: batch.id, ref, lineCount: fresh.length, debitMinor: debit.toString() };
  });
  return { replay: result.replay, ...result.value };
}

// features/keystone/mutations/phase3.ts
var graphql4 = String.raw;
var bind3 = (fn) => op(async (_root, args, context) => {
  const { now: _ignored, ...clean2 } = args;
  const actor = await actorFor(context);
  await advanceTimedStates(context.prisma);
  return fn(context.prisma, actor, clean2);
});
var phase3TypeDefs = graphql4`
  type Mutation {
    createInvoiceDraft(jobId: ID!, workLineIds: [ID!], items: JSON, payerId: ID, authorizationId: ID, poNumber: String, progressReason: String, discountMinor: String, idempotencyKey: String!): JSON
    discardInvoiceDraft(invoiceId: ID!, expectedVersion: Int!, reason: String, idempotencyKey: String!): JSON
    postInvoice(invoiceId: ID!, expectedVersion: Int!, invoiceDate: String, idempotencyKey: String!): JSON
    voidInvoice(invoiceId: ID!, reason: String!, idempotencyKey: String!): JSON
    issueCreditMemo(invoiceId: ID!, amountMinor: String!, reason: String!, note: String!, appliesTo: String, idempotencyKey: String!): JSON
    requestWriteOff(invoiceId: ID!, reason: String!, idempotencyKey: String!): JSON
    setCollectionsStatus(invoiceId: ID!, status: String!, idempotencyKey: String!): JSON

    recordInvoicePayment(invoiceId: ID!, amountMinor: String!, method: String!, reference: String, checkNumber: String, feeMinor: String, receivedAt: String, attemptId: ID, idempotencyKey: String!): JSON
    applyCustomerCredit(invoiceId: ID!, amountMinor: String!, idempotencyKey: String!): JSON
    startPaymentAttempt(invoiceId: ID!, amountMinor: String!, method: String!, idempotencyKey: String!): JSON
    markAttemptUnknown(attemptId: ID!, expectedVersion: Int!, note: String, idempotencyKey: String!): JSON
    resolveAttemptFailed(attemptId: ID!, expectedVersion: Int!, evidence: String!, idempotencyKey: String!): JSON
    requestRefund(paymentId: ID!, amountMinor: String!, method: String!, reason: String!, reference: String!, idempotencyKey: String!): JSON
    recordApprovedRefund(approvalRequestId: ID!, idempotencyKey: String!): JSON
    settleRefundedMembershipInvoice(invoiceId: ID!, idempotencyKey: String!): JSON
    closePaymentBatch(batchId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    reconcilePaymentBatch(batchId: ID!, expectedVersion: Int!, depositedMinor: String!, depositReference: String!, idempotencyKey: String!): JSON

    saveFinancingProgram(programId: ID, name: String!, partner: String, minMinor: String!, maxMinor: String!, termsNote: String, applyUrl: String, active: Boolean, idempotencyKey: String!): JSON
    startFinancing(customerId: ID!, programId: ID!, amountMinor: String!, jobId: ID, invoiceId: ID, estimateVersionId: ID, consent: Boolean!, idempotencyKey: String!): JSON
    recordFinancingStatus(applicationId: ID!, to: String!, expectedVersion: Int!, partnerReference: String, offers: JSON, selectedOffer: JSON, offerExpiresAt: String, note: String, idempotencyKey: String!): JSON
    recordFinancingFunding(applicationId: ID!, expectedVersion: Int!, grossMinor: String!, feeMinor: String, reference: String!, fundedAt: String, idempotencyKey: String!): JSON
    savePayerProfile(payerId: ID, name: String!, kind: String!, terms: String!, poRequired: Boolean, billingContact: String, accountingCustomerRef: String, idempotencyKey: String!): JSON
    recordThirdPartyAuthorization(jobId: ID!, payerId: ID!, kind: String!, externalRef: String!, authorizedAmountMinor: String!, serviceFeeMinor: String, idempotencyKey: String!): JSON

    requestArPeriodClose(periodId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    reopenArPeriod(periodId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    createExportBatch(from: String!, to: String!, idempotencyKey: String!): JSON
  }
`;
var phase3Resolvers = {
  Mutation: {
    createInvoiceDraft: bind3(createInvoiceDraft),
    discardInvoiceDraft: bind3(discardInvoiceDraft),
    postInvoice: bind3(postInvoice),
    voidInvoice: bind3(voidInvoice),
    issueCreditMemo: bind3(issueCreditMemo),
    requestWriteOff: bind3(requestWriteOff),
    setCollectionsStatus: bind3(setCollectionsStatus),
    recordInvoicePayment: bind3(recordInvoicePayment),
    applyCustomerCredit: bind3(applyCustomerCredit),
    startPaymentAttempt: bind3(startPaymentAttempt),
    markAttemptUnknown: bind3(markAttemptUnknown),
    resolveAttemptFailed: bind3(resolveAttemptFailed),
    requestRefund: bind3(requestRefund),
    recordApprovedRefund: bind3(recordApprovedRefund),
    settleRefundedMembershipInvoice: bind3(settleRefundedMembershipInvoice),
    closePaymentBatch: bind3(closePaymentBatch),
    reconcilePaymentBatch: bind3(reconcilePaymentBatch),
    saveFinancingProgram: bind3(saveFinancingProgram),
    startFinancing: bind3(startFinancing),
    recordFinancingStatus: bind3(recordFinancingStatus),
    recordFinancingFunding: bind3(recordFinancingFunding),
    savePayerProfile: bind3(savePayerProfile),
    recordThirdPartyAuthorization: bind3(recordThirdPartyAuthorization),
    requestArPeriodClose: bind3(requestArPeriodClose),
    reopenArPeriod: bind3(reopenArPeriod),
    createExportBatch: bind3(createExportBatch)
  }
};

// features/keystone/services/membershipBilling.ts
init_actor();
init_cas();
init_errors();

// features/keystone/lib/paymentAdapter.ts
var import_node_crypto11 = require("node:crypto");
var STRIPE = "https://api.stripe.com/v1";
var form = (values) => {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v !== void 0 && v !== "") body.set(k, v);
  return body;
};
var toResult = (intent) => {
  if (intent.status === "succeeded") return { outcome: "succeeded", providerRef: intent.id };
  if (intent.status === "processing") return { outcome: "unknown", providerRef: intent.id, note: "The processor is still working on this charge." };
  return { outcome: "failed", providerRef: intent.id, note: intent.last_payment_error?.message?.slice(0, 200) || `Charge ${intent.status.replace(/_/g, " ")}.` };
};
var StripeTestAdapter = class {
  constructor(secretKey, fetcher = fetch, timeoutMs = 2e4) {
    this.secretKey = secretKey;
    this.fetcher = fetcher;
    this.timeoutMs = timeoutMs;
    this.name = "stripe-test";
    if (!/^sk_test_/.test(secretKey) && !/^rk_test_/.test(secretKey)) throw new Error("Only a Stripe TEST key is accepted here.");
  }
  async call(path, init) {
    const headers = { Authorization: `Bearer ${this.secretKey}` };
    if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
    if (init.method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded";
    return this.fetcher(`${STRIPE}${path}`, { ...init, headers, signal: AbortSignal.timeout(this.timeoutMs) });
  }
  async charge(input) {
    const key2 = (0, import_node_crypto11.createHash)("sha256").update(input.providerKey).digest("hex").slice(0, 40);
    let response;
    try {
      response = await this.call("/payment_intents", {
        method: "POST",
        idempotencyKey: input.providerKey.slice(0, 255),
        body: form({
          amount: input.amountMinor.toString(),
          currency: (input.currency ?? "usd").toLowerCase(),
          payment_method: input.paymentMethodRef,
          customer: input.customerRef,
          confirm: "true",
          off_session: "true",
          description: input.description.slice(0, 250),
          "metadata[providerKey]": key2,
          ...Object.fromEntries(Object.entries(input.metadata ?? {}).map(([k, v]) => [`metadata[${k}]`, v]))
        })
      });
    } catch {
      return { outcome: "unknown", providerRef: "", note: "No answer from the processor. The card may or may not have been charged." };
    }
    const json16 = await response.json().catch(() => null);
    if (response.status >= 500 || !json16) return { outcome: "unknown", providerRef: "", note: "The processor answered with an error. The card may or may not have been charged." };
    if (json16.error) {
      const intent = json16.error.payment_intent;
      if (intent?.id) return { outcome: "failed", providerRef: intent.id, note: json16.error.message?.slice(0, 200) || "The card was declined." };
      if (response.status === 429 || json16.error.type === "api_connection_error") return { outcome: "unknown", providerRef: "", note: "The processor was busy. Nothing is known about this charge yet." };
      return { outcome: "failed", providerRef: "", note: json16.error.message?.slice(0, 200) || "The card was declined." };
    }
    return toResult(json16);
  }
  async lookup(providerKey) {
    const key2 = (0, import_node_crypto11.createHash)("sha256").update(providerKey).digest("hex").slice(0, 40);
    try {
      const response = await this.call(`/payment_intents/search?query=${encodeURIComponent(`metadata['providerKey']:'${key2}'`)}&limit=1`, { method: "GET" });
      const json16 = await response.json();
      if (!response.ok || json16.error) return { outcome: "unknown", providerRef: "", note: "The processor could not be asked right now." };
      const found = json16.data?.[0];
      return found ? toResult(found) : { outcome: "none" };
    } catch {
      return { outcome: "unknown", providerRef: "", note: "The processor could not be reached." };
    }
  }
};
var override = null;
var NotConfiguredAdapter = class {
  constructor() {
    this.name = "not-configured";
  }
  async charge() {
    return { outcome: "failed", providerRef: "", note: "Card charging is not set up on this server (no Stripe test key)." };
  }
  async lookup() {
    return { outcome: "none" };
  }
};
function paymentAdapter() {
  if (override) return override;
  const key2 = process.env.STRIPE_SECRET_KEY;
  return key2 ? new StripeTestAdapter(key2) : new NotConfiguredAdapter();
}

// features/keystone/services/membershipBilling.ts
var BILLING2 = ["canManageMemberships"];
var BILLABLE = ["pending_payment", "active", "past_due"];
var STALE_CHARGE_MS = 2 * 6e4;
var PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
var ymd2 = (d) => d ? d.toISOString().slice(0, 10) : "";
async function carriedOver(db, membershipIds) {
  const paid = /* @__PURE__ */ new Set();
  const from = /* @__PURE__ */ new Map();
  if (membershipIds.length) {
    const sellers = await db.membership.findMany({ where: { transferredToId: { in: membershipIds } }, select: { id: true, transferredToId: true, cancelEffectiveOn: true } });
    for (const s of sellers) {
      from.set(s.transferredToId, ymd2(s.cancelEffectiveOn));
      const rows = await db.membershipBillingAttempt.findMany({ where: { membershipId: s.id, status: "succeeded" }, select: { termNumber: true, slot: true } });
      for (const r of rows) paid.add(`${s.transferredToId}:${r.termNumber}:${r.slot}`);
    }
  }
  return (membershipId, termNumber, slot, dueOn) => paid.has(`${membershipId}:${termNumber}:${slot}`) || from.has(membershipId) && dueOn < from.get(membershipId);
}
var lastDayOf = (period) => `${period}-${String(daysInMonth(Number(period.slice(0, 4)), Number(period.slice(5, 7)))).padStart(2, "0")}`;
async function invoiceForAttempt(uow, actor, attempt) {
  const { tx } = uow;
  const m = await tx.membership.findUniqueOrThrow({ where: { id: attempt.membershipId ?? "" }, select: { id: true, ref: true, customerId: true, locationId: true, plan: { select: { name: true } } } });
  const term = await tx.membershipTerm.findFirstOrThrow({ where: { membershipId: m.id, termNumber: attempt.termNumber }, select: { priceMinor: true, slots: true, startsOn: true } });
  const ref = await nextReference(tx, "INV", uow.now);
  const label = term.slots > 1 ? `${m.plan?.name ?? "Membership"}, payment ${attempt.slot + 1} of ${term.slots}` : `${m.plan?.name ?? "Membership"}, ${term.startsOn?.getUTCFullYear()} term`;
  const invoice = await tx.invoice.create({
    data: {
      ref,
      publicCode: publicCode("INV"),
      customerId: m.customerId,
      locationId: m.locationId,
      payerKind: "customer",
      status: "draft",
      progressReason: "",
      subtotalMinor: term.priceMinor,
      discountMinor: 0n,
      taxMinor: 0n,
      totalMinor: term.priceMinor,
      balanceMinor: 0n
    },
    select: { id: true, version: true }
  });
  await tx.invoiceLine.create({ data: { invoiceId: invoice.id, workLineId: null, description: label, quantity: "1", uom: "ea", unitPriceMinor: term.priceMinor, amountMinor: term.priceMinor, discountMinor: 0n, taxCategory: "membership", costMinor: 0n, revenueAccountCode: "4400", sortOrder: 0 } });
  auditCreate(uow, actor, "Invoice", invoice.id, "invoice.drafted", { ref, membershipId: m.id, membershipRef: m.ref, slot: attempt.slot });
  const posted = await postInvoiceInTx(uow, actor, { invoiceId: invoice.id, expectedVersion: invoice.version });
  return { invoiceId: invoice.id, totalMinor: BigInt(posted.totalMinor) };
}
async function settleMembershipStatus(uow, actor, membershipId) {
  const { tx } = uow;
  const m = await tx.membership.findUniqueOrThrow({ where: { id: membershipId }, select: { id: true, status: true, version: true } });
  const open = await tx.membershipBillingAttempt.count({ where: { membershipId, status: { in: ["failed", "unknown"] } } });
  if (m.status === "pending_payment" || m.status === "past_due") {
    if (!open) await casUpdate(uow, { model: "Membership", id: m.id, version: m.version, from: [m.status], to: "active", actor, eventType: "membership.paid_up" });
  } else if (m.status === "active" && open) {
    await casUpdate(uow, { model: "Membership", id: m.id, version: m.version, from: ["active"], to: "past_due", actor, eventType: "membership.payment_failed" });
  }
}
async function finalizeSuccess(db, actor, attemptId, providerRef, now) {
  return runInTransaction(db, async (uow) => {
    const { tx } = uow;
    const attempt = await lockRow(tx, "MembershipBillingAttempt", attemptId);
    if (attempt.status === "succeeded") return "already_paid";
    if (!attempt.invoiceId) throw new DomainError(Codes.GUARD_FAILED, "This attempt has no invoice to pay.");
    const invoice = await lockInvoice(tx, attempt.invoiceId);
    const payment = await createPayment(uow, actor, { customerId: invoice.customerId, jobId: null, method: "card", amountMinor: invoice.balanceMinor, reference: providerRef, receivedAt: uow.now });
    await allocatePayment(uow, actor, invoice, payment.id, invoice.balanceMinor);
    await casUpdate(uow, { model: "MembershipBillingAttempt", id: attempt.id, version: attempt.version, from: ["charging", "unknown", "queued", "failed"], to: "succeeded", actor, eventType: "membership.charge_succeeded", data: { paymentId: payment.id, providerRef, failureNote: "" } });
    if (attempt.membershipId) await settleMembershipStatus(uow, actor, attempt.membershipId);
    return "charged";
  }, { now });
}
async function markStatus(db, actor, attemptId, to, note, providerRef, now) {
  return runInTransaction(db, async (uow) => {
    const attempt = await lockRow(uow.tx, "MembershipBillingAttempt", attemptId);
    if (attempt.status === "succeeded") return;
    await casUpdate(uow, { model: "MembershipBillingAttempt", id: attempt.id, version: attempt.version, from: [attempt.status], to, actor, eventType: `membership.charge_${to}`, reason: note, data: { failureNote: note.slice(0, 300), ...providerRef ? { providerRef } : {} } });
    if (attempt.membershipId) await settleMembershipStatus(uow, actor, attempt.membershipId);
  }, { now });
}
async function processAttempt(db, actor, attemptId, now, adapter = paymentAdapter(), opts = {}) {
  const seen = await db.membershipBillingAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { membership: { select: { status: true, paymentMethodRef: true, customer: { select: { ref: true } } } } } });
  if (seen.status === "succeeded") return "already_paid";
  if (!BILLABLE.includes(seen.membership?.status ?? "")) return "not_billable";
  if (seen.membershipId && (await carriedOver(db, [seen.membershipId]))(seen.membershipId, seen.termNumber, seen.slot, ymd2(seen.dueOn))) return "already_paid";
  let status = seen.status;
  const stale = status === "charging" && now.getTime() - seen.updatedAt.getTime() >= STALE_CHARGE_MS;
  if (status === "charging" && !stale) return "in_progress";
  if (status === "unknown" || stale) {
    const found = await adapter.lookup(seen.providerKey);
    if (found.outcome === "succeeded") return finalizeSuccess(db, actor, attemptId, found.providerRef, now);
    if (found.outcome === "unknown") {
      if (status !== "unknown") await markStatus(db, actor, attemptId, "unknown", found.note, "", now);
      return "unknown";
    }
    if (found.outcome === "failed") {
      await markStatus(db, actor, attemptId, "failed", found.note, found.providerRef, now);
      return "declined";
    } else {
      status = "retry_same_key";
    }
  }
  if (status === "failed" && !opts.newTry) return "declined";
  if (!seen.membership?.paymentMethodRef) return "no_card";
  const claim = await runInTransaction(db, async (uow) => {
    const a = await lockRow(uow.tx, "MembershipBillingAttempt", attemptId);
    const m = a.membershipId ? await lockRow(uow.tx, "Membership", a.membershipId) : null;
    if (!m || !BILLABLE.includes(m.status)) return { skip: "not_billable" };
    const reclaimable = a.status === "queued" || a.status === "failed" && opts.newTry === true || status === "retry_same_key" && ["unknown", "charging"].includes(a.status);
    if (!reclaimable) return { skip: a.status === "succeeded" ? "already_paid" : a.status === "failed" ? "declined" : "in_progress" };
    const generation = a.status === "failed" ? a.generation + 1 : a.generation;
    const providerKey = `${a.attemptKey}:g${generation}`;
    const invoice = a.invoiceId ? { invoiceId: a.invoiceId, totalMinor: (await lockInvoice(uow.tx, a.invoiceId)).balanceMinor } : await invoiceForAttempt(uow, actor, a);
    await uow.tx.membershipBillingAttempt.update({ where: { id: a.id }, data: { status: "charging", generation, providerKey, invoiceId: invoice.invoiceId, amountMinor: invoice.totalMinor, version: { increment: 1 } } });
    uow.audit({ eventType: "membership.charge_started", entityType: "MembershipBillingAttempt", entityId: a.id, actorUserId: actorUserId(actor), after: { generation, amountMinor: invoice.totalMinor.toString() } });
    return { skip: null, providerKey, amountMinor: invoice.totalMinor };
  }, { now });
  if (claim.skip) return claim.skip;
  let result;
  try {
    result = await adapter.charge({
      providerKey: claim.providerKey,
      amountMinor: claim.amountMinor,
      paymentMethodRef: seen.membership.paymentMethodRef,
      description: `Membership ${seen.termNumber}.${seen.slot + 1}`,
      metadata: { attempt: seen.attemptKey }
    });
  } catch {
    result = { outcome: "unknown", providerRef: "", note: "The connection dropped before an answer came back. The card may or may not have been charged." };
  }
  if (result.outcome === "succeeded") return finalizeSuccess(db, actor, attemptId, result.providerRef, now);
  if (result.outcome === "failed") {
    await markStatus(db, actor, attemptId, "failed", result.note, result.providerRef, now);
    return "declined";
  }
  await markStatus(db, actor, attemptId, "unknown", result.note, result.providerRef, now);
  return "unknown";
}
async function runMembershipBilling(db, actor, args, adapter = paymentAdapter()) {
  await authorizeOperation(db, actor, "membership.billing_run", BILLING2, args);
  if (!PERIOD.test(args.period ?? "")) throw new DomainError(Codes.INVALID_INPUT, "Choose a month to bill.", { field: "period" });
  const now = args.now ?? /* @__PURE__ */ new Date();
  const { idempotencyKey, now: _now, ...params } = args;
  const prepared = await command(db, { name: "membership.billing_run", actor, idempotencyKey, params, now }, async (uow) => {
    const { tx } = uow;
    const today = await companyToday(tx, uow.now);
    if (args.period > today.slice(0, 7)) throw new DomainError(Codes.GUARD_FAILED, "That month has not started. Bill this month or an earlier one.", { reason: "future_period" });
    const end = lastDayOf(args.period);
    const run = await tx.membershipBillingRun.create({ data: { ref: await nextReference(tx, "MBP", uow.now), period: args.period, idempotencyKey, status: "running", startedById: actorUserId(actor), startedAt: uow.now }, select: { id: true, ref: true } });
    const renewing = await tx.membership.findMany({ where: { autoRenew: true, status: { in: ["active", "past_due"] } }, select: { id: true, startsOn: true, planId: true, autoRenewConsentId: true, terms: { where: { status: "active" }, orderBy: { termNumber: "desc" }, take: 1, select: { termNumber: true, endsOn: true } } } });
    const skippedRenewals = [];
    for (const m of renewing) {
      const last = m.terms[0];
      if (!last?.endsOn) continue;
      const nextStart = addDays(last.endsOn.toISOString().slice(0, 10), 1);
      if (nextStart > end) continue;
      const told = await tx.renewalNotice.findFirst({ where: { membershipId: m.id, kind: "auto_renew_reminder", status: "contacted", term: { termNumber: last.termNumber } }, select: { createdAt: true } });
      const version = await tx.membershipPlanVersion.findFirst({ where: { planId: m.planId ?? "", status: "active" }, select: { renewalNoticeDays: true, autoRenew: true } });
      if (!version?.autoRenew) {
        skippedRenewals.push({ membershipId: m.id, reason: "The current plan no longer renews itself." });
        continue;
      }
      if (!told || told.createdAt.toISOString().slice(0, 10) > addDays(nextStart, -version.renewalNoticeDays)) {
        skippedRenewals.push({ membershipId: m.id, reason: "The customer has not been told about the renewal in time." });
        continue;
      }
      await renewInTx(uow, actor, m.id, today);
    }
    const members = await tx.membership.findMany({
      where: { status: { in: BILLABLE } },
      select: { id: true, startsOn: true, terms: { where: { status: "active" }, select: { id: true, termNumber: true, slots: true, billingFrequency: true, startsOn: true } }, planVersion: { select: { termMonths: true } } }
    });
    const carried = await carriedOver(tx, members.map((m) => m.id));
    const rows = [];
    for (const m of members) {
      const anchor = m.startsOn.toISOString().slice(0, 10);
      for (const t of m.terms) {
        const months = m.planVersion?.termMonths ?? 12;
        for (let k = 0; k < t.slots; k += 1) {
          const due2 = t.billingFrequency === "monthly" ? slotDueDay(anchor, months, t.termNumber, k) : t.startsOn.toISOString().slice(0, 10);
          if (due2 > end) continue;
          if (carried(m.id, t.termNumber, k, due2)) continue;
          rows.push({ attemptKey: `${m.id}:${t.termNumber}:${k}`, membershipId: m.id, termId: t.id, termNumber: t.termNumber, slot: k, dueOn: asDate(due2), runId: run.id });
        }
      }
    }
    if (rows.length) await tx.membershipBillingAttempt.createMany({ data: rows, skipDuplicates: true });
    auditCreate(uow, actor, "MembershipBillingRun", run.id, "membership.billing_run_started", { period: args.period, candidates: rows.length, skippedRenewals });
    return { runId: run.id, ref: run.ref };
  });
  const open = await db.membershipBillingAttempt.findMany({
    where: { dueOn: { lte: asDate(lastDayOf(args.period)) }, status: { not: "succeeded" }, membership: { status: { in: BILLABLE } } },
    orderBy: [{ dueOn: "asc" }, { attemptKey: "asc" }],
    select: { id: true, status: true, membershipId: true, termNumber: true, slot: true, dueOn: true }
  });
  const carriedNow = await carriedOver(db, [...new Set(open.map((a) => a.membershipId ?? ""))].filter(Boolean));
  const due = open.filter((a) => !carriedNow(a.membershipId ?? "", a.termNumber, a.slot, ymd2(a.dueOn)));
  const attempts = due.filter((a) => a.status !== "failed");
  const tally = { charged: 0, declined: due.length - attempts.length, unknown: 0, inProgress: 0, noCard: 0, already: 0 };
  const chargedIds = [];
  for (const a of attempts) {
    const outcome = await processAttempt(db, actor, a.id, now, adapter);
    if (outcome === "charged") {
      tally.charged += 1;
      chargedIds.push(a.id);
    } else if (outcome === "declined") tally.declined += 1;
    else if (outcome === "unknown") tally.unknown += 1;
    else if (outcome === "in_progress") tally.inProgress += 1;
    else if (outcome === "no_card") tally.noCard += 1;
    else tally.already += 1;
  }
  const paid = await db.membershipBillingAttempt.aggregate({ where: { id: { in: chargedIds }, status: "succeeded" }, _sum: { amountMinor: true } });
  const left = await db.membershipBillingAttempt.findMany({ where: { id: { in: due.map((a) => a.id) }, status: { not: "succeeded" } }, select: { id: true } });
  const remaining = left.length;
  await db.membershipBillingRun.update({
    where: { id: prepared.value.runId },
    data: { status: remaining === 0 ? "completed" : "partial", queuedCount: attempts.length, chargedCount: tally.charged, failedCount: tally.declined, unknownCount: tally.unknown, remainingCount: remaining, chargedMinor: paid._sum.amountMinor ?? 0n, completedAt: now }
  });
  return { runId: prepared.value.runId, ref: prepared.value.ref, period: args.period, status: remaining === 0 ? "completed" : "partial", queued: attempts.length, charged: tally.charged, declined: tally.declined, unknown: tally.unknown, inProgress: tally.inProgress, noCard: tally.noCard, remaining, chargedMinor: (paid._sum.amountMinor ?? 0n).toString(), replay: prepared.replay };
}
async function retryAttempt(db, actor, args, adapter = paymentAdapter()) {
  await authorizeOperation(db, actor, "membership.attempt_retry", BILLING2, args);
  const now = args.now ?? /* @__PURE__ */ new Date();
  const a = await db.membershipBillingAttempt.findUnique({ where: { id: args.attemptId }, select: { id: true, status: true, updatedAt: true, membership: { select: { id: true, status: true, location: { select: { timeZone: true } }, terms: { where: { status: "active" }, select: { endsOn: true } } } } } });
  if (!a?.membership) throw new DomainError(Codes.NOT_FOUND, "Payment not found.");
  const m = a.membership;
  const today = localDate({ timeZone: m.location?.timeZone ?? "America/Chicago" }, now);
  const lastEnd = m.terms.map((t) => ymd2(t.endsOn)).sort().pop() ?? "";
  const standing = !BILLABLE.includes(m.status) ? m.status : !lastEnd || lastEnd < today ? "expired" : m.status;
  if (!BILLABLE.includes(standing)) throw new DomainError(Codes.GUARD_FAILED, `This membership is ${standing.replace(/_/g, " ")}, so it is not charged.`, { reason: "membership_not_billable" });
  const reason = String(args.reason ?? "").trim();
  let newTry = false;
  if (a.status === "failed") {
    const cardChanged = await db.auditEvent.findFirst({ where: { entityType: "Membership", entityId: m.id, eventType: "membership.payment_method_set", at: { gt: a.updatedAt } }, select: { id: true } });
    if (!cardChanged && reason.length < 3) throw new DomainError(Codes.GUARD_FAILED, "Card declined: update the card, then Retry. To try the same card again, say why.", { reason: "card_not_updated" });
    newTry = true;
  }
  const outcome = await processAttempt(db, actor, args.attemptId, now, adapter, { newTry });
  if (newTry) await runInTransaction(db, async (uow) => {
    auditCreate(uow, actor, "MembershipBillingAttempt", a.id, "membership.charge_retried", { outcome }, { reason: reason || "Card updated" });
  }, { now });
  return { attemptId: args.attemptId, outcome };
}

// features/keystone/services/agreements.ts
init_actor();
init_cas();
init_errors();
var MANAGE2 = ["canManageMemberships"];
var SELL4 = ["canSellMemberships", "canManageMemberships"];
var ymd3 = (d) => d ? d.toISOString().slice(0, 10) : "";
var clean = (v, field, min, max) => {
  const s = String(v ?? "").trim();
  if (s.length < min || s.length > max) throw new DomainError(Codes.INVALID_INPUT, min ? "This is needed." : "Too long.", { field });
  return s;
};
async function recordRenewalNotice(db, actor, args) {
  await authorizeOperation(db, actor, "membership.renewal_notice", SELL4, args);
  if (!["drafted", "contacted", "dismissed"].includes(args.status)) throw new DomainError(Codes.INVALID_INPUT, "Choose what happened.", { field: "status" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "membership.renewal_notice", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const m = await tx.membership.findUnique({ where: { id: args.membershipId }, select: { id: true, autoRenew: true } });
    if (!m) throw new DomainError(Codes.NOT_FOUND, "Membership not found.");
    const term = await tx.membershipTerm.findFirst({ where: { membershipId: m.id, status: "active" }, orderBy: { termNumber: "desc" }, select: { id: true, endsOn: true, termNumber: true } });
    if (!term) throw new DomainError(Codes.GUARD_FAILED, "This membership has no current term.");
    const noticeKey = `${m.id}:${term.termNumber}:${m.autoRenew ? "auto_renew_reminder" : "renewal_coming"}`;
    const existing = await tx.renewalNotice.findUnique({ where: { noticeKey }, select: { id: true, status: true, version: true } });
    if (existing) {
      if (existing.status === args.status) return { noticeId: existing.id };
      await casUpdate(uow, { model: "RenewalNotice", id: existing.id, version: existing.version, from: [existing.status], to: args.status, actor, eventType: "membership.renewal_notice_updated" });
      return { noticeId: existing.id };
    }
    const row = await tx.renewalNotice.create({ data: { noticeKey, membershipId: m.id, termId: term.id, kind: m.autoRenew ? "auto_renew_reminder" : "renewal_coming", dueOn: term.endsOn, status: args.status, preparedById: actorUserId(actor) }, select: { id: true } });
    auditCreate(uow, actor, "RenewalNotice", row.id, "membership.renewal_notice_recorded", { membershipId: m.id, status: args.status });
    return { noticeId: row.id };
  });
  return { replay: result.replay, ...result.value };
}
async function saveAgreement(db, actor, args) {
  await authorizeOperation(db, actor, "agreement.save", MANAGE2, args);
  const name = clean(args.name, "name", 3, 120);
  const scope = clean(args.scope, "scope", 10, 800);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.startsOn ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(args.endsOn ?? "") || args.endsOn < args.startsOn) throw new DomainError(Codes.INVALID_INPUT, "The agreement runs from a start day to a later end day.", { field: "endsOn" });
  const months = [...new Set((args.visitMonths ?? []).map(Number))].sort((a, b) => a - b);
  if (!months.length || months.some((m) => !Number.isInteger(m) || m < 1 || m > 12)) throw new DomainError(Codes.INVALID_INPUT, "Pick the months a visit is due.", { field: "visitMonths" });
  const nte = args.nteMinor ? BigInt(args.nteMinor) : 0n;
  if (nte < 0n) throw new DomainError(Codes.INVALID_INPUT, "The not-to-exceed amount is zero or more.", { field: "nteMinor" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "agreement.save", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const location = await tx.serviceLocation.findUnique({ where: { id: args.locationId }, select: { id: true, customerId: true } });
    if (!location || location.customerId !== args.customerId) throw new DomainError(Codes.NOT_FOUND, "That address is not on this customer.", { field: "locationId" });
    if (args.payerId && !await tx.payerProfile.findUnique({ where: { id: args.payerId }, select: { id: true } })) throw new DomainError(Codes.NOT_FOUND, "Payer not found.", { field: "payerId" });
    const data = { name, customerId: args.customerId, locationId: location.id, payerId: args.payerId ?? null, startsOn: asDate(args.startsOn), endsOn: asDate(args.endsOn), scope, visitMonths: months, poNumber: args.poNumber?.trim() ?? "", nteMinor: nte };
    if (args.agreementId) {
      const a = await lockRow(tx, "ServiceAgreement", args.agreementId);
      if (a.status !== "draft") throw new DomainError(Codes.GUARD_FAILED, "Only a draft agreement is edited. End it and write a new one.", { reason: "not_draft" });
      await tx.serviceAgreement.update({ where: { id: a.id }, data });
      auditCreate(uow, actor, "ServiceAgreement", a.id, "agreement.edited", { name });
      return { agreementId: a.id };
    }
    const row = await tx.serviceAgreement.create({ data: { ...data, ref: await nextReference(tx, "AGR", uow.now), status: "draft" }, select: { id: true } });
    auditCreate(uow, actor, "ServiceAgreement", row.id, "agreement.created", { name });
    return { agreementId: row.id };
  });
  return { replay: result.replay, ...result.value };
}
async function activateAgreement(db, actor, args) {
  await authorizeOperation(db, actor, "agreement.activate", MANAGE2, args);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "agreement.activate", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const { tx } = uow;
    const a = await lockRow(tx, "ServiceAgreement", args.agreementId);
    if (a.status !== "draft") throw new DomainError(Codes.INVALID_TRANSITION, "Only a draft agreement is started.");
    const start = ymd3(a.startsOn), end = ymd3(a.endsOn);
    let made = 0;
    for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)); y += 1) {
      for (const m of a.visitMonths) {
        const from = `${y}-${String(m).padStart(2, "0")}-01`;
        const to = addDays(termEnd(from, 1, 1), 0);
        if (to < start || from > end) continue;
        await tx.recurringServiceEvent.create({ data: { eventKey: `${a.id}:${y}-${String(m).padStart(2, "0")}`, agreementId: a.id, code: "planned_maintenance", name: `${a.name}: ${new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" })} visit`, dueFrom: asDate(from < start ? start : from), dueBy: asDate(to > end ? end : to), status: "open" } });
        made += 1;
      }
    }
    if (!made) throw new DomainError(Codes.GUARD_FAILED, "None of the chosen months fall inside the agreement dates.", { reason: "no_visits" });
    await casUpdate(uow, { model: "ServiceAgreement", id: a.id, version: a.version, from: ["draft"], to: "active", actor, eventType: "agreement.activated", data: {}, audit: { visits: made } });
    return { agreementId: a.id, visits: made };
  });
  return { replay: result.replay, ...result.value };
}
async function endAgreement(db, actor, args) {
  await authorizeOperation(db, actor, "agreement.end", MANAGE2, args);
  const reason = clean(args.reason, "reason", 3, 300);
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "agreement.end", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const a = await lockRow(uow.tx, "ServiceAgreement", args.agreementId);
    await casUpdate(uow, { model: "ServiceAgreement", id: a.id, version: a.version, from: ["active", "draft"], to: "ended", actor, eventType: "agreement.ended", reason });
    await uow.tx.recurringServiceEvent.updateMany({ where: { agreementId: a.id, status: "open" }, data: { status: "skipped" } });
    return { agreementId: a.id };
  });
  return { replay: result.replay, ...result.value };
}
async function setDocumentExpiry(db, actor, args) {
  await authorizeOperation(db, actor, "document.set_expiry", ["canManageCustomers", "canManageInvoices", "canManageMemberships"], args);
  const reason = clean(args.reason, "reason", 3, 200);
  if (args.expiresOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(args.expiresOn ?? "")) throw new DomainError(Codes.INVALID_INPUT, "The expiry is a day, or empty for none.", { field: "expiresOn" });
  const { idempotencyKey, now: _now, ...params } = args;
  const result = await command(db, { name: "document.set_expiry", actor, idempotencyKey, params, now: args.now }, async (uow) => {
    const doc = await lockRow(uow.tx, "Document", args.documentId);
    const today = await companyToday(uow.tx, uow.now);
    if (args.expiresOn && args.expiresOn < addDays(today, -365)) throw new DomainError(Codes.INVALID_INPUT, "That expiry is more than a year ago.", { field: "expiresOn" });
    await uow.tx.document.update({ where: { id: doc.id }, data: { expiresAt: args.expiresOn ? asDate(args.expiresOn) : null } });
    uow.audit({ eventType: "document.expiry_set", entityType: "Document", entityId: doc.id, actorUserId: actorUserId(actor), reason, before: { expiresAt: ymd3(doc.expiresAt) || null }, after: { expiresAt: args.expiresOn } });
    return { documentId: doc.id, expiresOn: args.expiresOn };
  });
  return { replay: result.replay, ...result.value };
}

// features/keystone/mutations/phase4.ts
var graphql5 = String.raw;
var bind4 = (fn) => op(async (_root, args, context) => {
  const { now: _ignored, ...clean2 } = args;
  const actor = await actorFor(context);
  await advanceTimedStates(context.prisma);
  return fn(context.prisma, actor, clean2);
});
var phase4TypeDefs = graphql5`
  type Mutation {
    openMembershipPlan(name: String!, code: String!, description: String, draft: JSON, idempotencyKey: String!): JSON
    saveMembershipPlanDraft(planId: ID!, draft: JSON!, idempotencyKey: String!): JSON
    activateMembershipPlanVersion(versionId: ID!, idempotencyKey: String!): JSON
    retireMembershipPlan(planId: ID!, reason: String, idempotencyKey: String!): JSON

    sellMembership(customerId: ID!, locationId: ID!, planId: ID!, startsOn: String, channel: String, paymentMethodRef: String, paymentMethodLabel: String, autoRenew: Boolean, consent: JSON, idempotencyKey: String!): JSON
    updateMembershipPaymentMethod(membershipId: ID!, paymentMethodRef: String!, paymentMethodLabel: String!, idempotencyKey: String!): JSON
    renewMembership(membershipId: ID!, idempotencyKey: String!): JSON
    cancelMembership(membershipId: ID!, reason: String!, idempotencyKey: String!): JSON
    transferMembership(membershipId: ID!, newCustomerId: ID!, newLocationId: ID, idempotencyKey: String!): JSON
    bookMembershipVisit(eventId: ID!, jobRef: String!, idempotencyKey: String!): JSON
    releaseMembershipVisit(eventId: ID!, reason: String!, idempotencyKey: String!): JSON

    runMembershipBilling(period: String!, idempotencyKey: String!): JSON
    retryMembershipCharge(attemptId: ID!, reason: String, idempotencyKey: String!): JSON
    recordRenewalNotice(membershipId: ID!, status: String!, idempotencyKey: String!): JSON

    saveServiceAgreement(agreementId: ID, name: String!, customerId: ID!, locationId: ID!, payerId: ID, startsOn: String!, endsOn: String!, scope: String!, visitMonths: JSON!, poNumber: String, nteMinor: String, idempotencyKey: String!): JSON
    activateServiceAgreement(agreementId: ID!, idempotencyKey: String!): JSON
    endServiceAgreement(agreementId: ID!, reason: String!, idempotencyKey: String!): JSON
    setDocumentExpiry(documentId: ID!, expiresOn: String, reason: String!, idempotencyKey: String!): JSON
  }
`;
var phase4Resolvers = {
  Mutation: {
    openMembershipPlan: bind4(createPlan),
    saveMembershipPlanDraft: bind4(saveDraftVersion),
    activateMembershipPlanVersion: bind4(activatePlanVersion),
    retireMembershipPlan: bind4(retirePlan),
    sellMembership: bind4(sellMembership),
    updateMembershipPaymentMethod: bind4(updatePaymentMethod),
    renewMembership: bind4(renewMembership),
    cancelMembership: bind4(cancelMembership),
    transferMembership: bind4(transferMembership),
    bookMembershipVisit: bind4(bookVisit),
    releaseMembershipVisit: bind4(releaseVisit),
    runMembershipBilling: bind4((db, actor, a) => runMembershipBilling(db, actor, a)),
    retryMembershipCharge: bind4((db, actor, a) => retryAttempt(db, actor, a)),
    recordRenewalNotice: bind4(recordRenewalNotice),
    saveServiceAgreement: bind4(saveAgreement),
    activateServiceAgreement: bind4(activateAgreement),
    endServiceAgreement: bind4(endAgreement),
    setDocumentExpiry: bind4(setDocumentExpiry)
  }
};

// features/keystone/mutations/agentBinding.ts
init_actor();
init_errors();
init_cas();
var graphql6 = String.raw;
var UNUSABLE_PASSWORD_HASH3 = "$2a$10$3dITCbIvf5zFA.1U8KZDhOHC3EEexi3KYy5ysZK1cRF6LHMm0H.ya";
var agentBindingTypeDefs = graphql6`
  type Query { agentBindings: JSON }
  type Mutation {
    bindAgentApp(agentId: ID!, oauthAppId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    unbindAgentApp(agentId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
  }
`;
async function revokeAppTokens(tx, appId) {
  const app = await tx.oAuthApp.findUnique({ where: { id: appId }, select: { clientId: true } });
  if (!app) return 0;
  const result = await tx.oAuthToken.updateMany({ where: { clientId: app.clientId, isRevoked: "false" }, data: { isRevoked: "true" } });
  return result.count;
}
var agentBindingResolvers = {
  Query: {
    agentBindings: op(async (_root, _args, context) => {
      const actor = await actorFor(context);
      requirePermission(actor, "canManageAgents");
      const [agents, apps] = await Promise.all([
        context.prisma.agentIdentity.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, kind: true, status: true, killSwitch: true, version: true, owner: { select: { name: true } }, oauthApp: { select: { id: true, name: true, clientId: true, status: true } }, grants: { where: { status: "active", revokedAt: null }, select: { tool: true } } } }),
        context.prisma.oAuthApp.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, clientId: true, status: true, from_AgentIdentity_oauthApp: { select: { id: true } } } })
      ]);
      return {
        agents: agents.map((a) => ({ id: a.id, name: a.name, kind: a.kind, status: a.status, killSwitch: a.killSwitch, version: a.version, owner: a.owner?.name ?? null, app: a.oauthApp, grants: a.grants.length })),
        apps: apps.map((a) => ({ id: a.id, name: a.name, clientId: a.clientId, status: a.status, boundTo: a.from_AgentIdentity_oauthApp?.[0]?.id ?? null }))
      };
    })
  },
  Mutation: {
    bindAgentApp: op(async (_root, args, context) => {
      const actor = await actorFor(context);
      requirePermission(actor, "canManageAgents");
      const result = await command(context.prisma, { name: "agent.bind_app", actor, idempotencyKey: args.idempotencyKey, params: { agentId: args.agentId, oauthAppId: args.oauthAppId, expectedVersion: args.expectedVersion } }, async (uow) => {
        const { tx } = uow;
        const agent = await tx.agentIdentity.findUnique({ where: { id: args.agentId }, select: { id: true, name: true, version: true, oauthAppId: true } });
        if (!agent) throw new DomainError(Codes.NOT_FOUND, "Agent not found.");
        if (agent.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, "The agent changed since you loaded it. Reload and try again.", { currentVersion: agent.version });
        const app = await tx.oAuthApp.findUnique({ where: { id: args.oauthAppId }, select: { id: true, name: true } });
        if (!app) throw new DomainError(Codes.NOT_FOUND, "App not found.");
        const taken = await tx.agentIdentity.findFirst({ where: { oauthAppId: app.id, id: { not: agent.id } }, select: { name: true } });
        if (taken) throw new DomainError(Codes.GUARD_FAILED, `${app.name} is already connected to ${taken.name}.`, { reason: "app_already_bound" });
        const userId = agentUserId(agent.id);
        const existing = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
        if (existing) await tx.user.update({ where: { id: userId }, data: { roleId: AGENT_ROLE_ID } });
        else await tx.user.create({ data: { id: userId, name: `${agent.name} (agent)`, email: `agent-${agent.id}@agents.invalid`, password: UNUSABLE_PASSWORD_HASH3, kind: "staff", roleId: AGENT_ROLE_ID, title: "AI agent", onboardingStatus: "dismissed" } });
        const updated = await tx.agentIdentity.updateMany({ where: { id: agent.id, version: agent.version }, data: { oauthAppId: app.id, version: { increment: 1 } } });
        if (updated.count !== 1) throw new DomainError(Codes.STALE_STATE, "The agent changed since you loaded it. Reload and try again.");
        let revoked = await revokeAppTokens(tx, app.id);
        if (agent.oauthAppId && agent.oauthAppId !== app.id) revoked += await revokeAppTokens(tx, agent.oauthAppId);
        auditCreate(uow, actor, "AgentIdentity", agent.id, "agent.app_bound", { revokedTokens: revoked, agentId: agent.id, oauthAppId: app.id, previousAppId: agent.oauthAppId, role: AGENT_ROLE_ID, boundBy: actorUserId(actor) });
        return { agentId: agent.id, oauthAppId: app.id, version: agent.version + 1 };
      });
      return { replay: result.replay, ...result.value };
    }),
    unbindAgentApp: op(async (_root, args, context) => {
      const actor = await actorFor(context);
      requirePermission(actor, "canManageAgents");
      const result = await command(context.prisma, { name: "agent.unbind_app", actor, idempotencyKey: args.idempotencyKey, params: { agentId: args.agentId, expectedVersion: args.expectedVersion } }, async (uow) => {
        const { tx } = uow;
        const agent = await tx.agentIdentity.findUnique({ where: { id: args.agentId }, select: { id: true, version: true, oauthAppId: true } });
        if (!agent) throw new DomainError(Codes.NOT_FOUND, "Agent not found.");
        if (agent.version !== args.expectedVersion) throw new DomainError(Codes.STALE_STATE, "The agent changed since you loaded it. Reload and try again.", { currentVersion: agent.version });
        const updated = await tx.agentIdentity.updateMany({ where: { id: agent.id, version: agent.version }, data: { oauthAppId: null, version: { increment: 1 } } });
        if (updated.count !== 1) throw new DomainError(Codes.STALE_STATE, "The agent changed since you loaded it. Reload and try again.");
        const revoked = agent.oauthAppId ? await revokeAppTokens(tx, agent.oauthAppId) : 0;
        auditCreate(uow, actor, "AgentIdentity", agent.id, "agent.app_unbound", { revokedTokens: revoked, agentId: agent.id, previousAppId: agent.oauthAppId });
        return { agentId: agent.id, version: agent.version + 1 };
      });
      return { replay: result.replay, ...result.value };
    })
  }
};

// features/keystone/mutations/index.ts
var graphql7 = String.raw;
function extendGraphqlSchema(baseSchema) {
  const core = (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql7`
      scalar JSON
      type Query {
        redirectToInit: Boolean
        verifyAuditChain: JSON
        resolvePolicy(kind: String!, state: String, county: String, city: String, zip: String, branchId: ID, on: String!): JSON
      }
      input UserUpdateProfileInput { name: String, email: String, password: String, onboardingStatus: String }
      type Mutation {
        updateActiveUser(data: UserUpdateProfileInput!): User
        loadCompanySetup(idempotencyKey: String!): JSON
        loadOperationsSetup(idempotencyKey: String!): JSON
        loadPriceBookSetup(idempotencyKey: String!): JSON
        decideApprovalRequest(requestId: ID!, decision: String!, reason: String, expectedVersion: Int!, idempotencyKey: String!): JSON
        cancelApprovalRequest(requestId: ID!, expectedVersion: Int!, reason: String, idempotencyKey: String!): JSON
        requestCompanyControls(changes: JSON!, reason: String!, idempotencyKey: String!): JSON
        setCompanyOnboardingStatus(status: String!, expectedVersion: Int!, idempotencyKey: String!): JSON
      }
    `,
    resolvers: {
      Query: {
        redirectToInit: redirectToInit_default,
        verifyAuditChain: op(verifyAuditChain2),
        resolvePolicy: op(resolvePolicyQuery)
      },
      Mutation: {
        updateActiveUser: updateActiveUser_default,
        loadCompanySetup: op(loadCompanySetup),
        loadOperationsSetup: op(loadOperationsSetup),
        loadPriceBookSetup: op(loadPriceBookSetup),
        decideApprovalRequest: op(decideApprovalRequest),
        cancelApprovalRequest: op(cancelApprovalRequest),
        requestCompanyControls: op(requestCompanyControls),
        setCompanyOnboardingStatus: op(setCompanyOnboardingStatus)
      }
    }
  });
  return (0, import_schema.mergeSchemas)({ schemas: [core], typeDefs: [phase1TypeDefs, phase2TypeDefs, phase3TypeDefs, phase4TypeDefs, agentBindingTypeDefs], resolvers: [phase1Resolvers, phase2Resolvers, phase3Resolvers, phase4Resolvers, agentBindingResolvers] });
}

// features/keystone/lib/mail.ts
var import_nodemailer = require("nodemailer");
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  console.warn("SMTP_STORE_LINK not set. Please add SMTP_STORE_LINK to your environment variables for email links to work properly.");
  return "";
}
var transport = (0, import_nodemailer.createTransport)({
  // @ts-ignore
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});
function passwordResetEmail({ url }) {
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const buttonBackgroundColor = "#346df1";
  const buttonBorderColor = "#346df1";
  const buttonTextColor = "#ffffff";
  return `
    <body style="background: ${backgroundColor};">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">Reset Password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            If you did not request this email you can safely ignore it.
          </td>
        </tr>
      </table>
    </body>
  `;
}
async function sendPasswordResetEmail(resetToken, to, baseUrl) {
  const frontendUrl = baseUrl || getBaseUrlForEmails();
  const info = await transport.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: `${frontendUrl}/dashboard/reset?token=${resetToken}`
    })
  });
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`\u{1F4E7} Message Sent!  Preview it at ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
  }
}

// features/keystone/index.ts
init_access();

// features/keystone/prismaConstraints.ts
var COMPOUND_UNIQUES = {
  CalendarException: ['@@unique([calendarId, date], map: "CalendarException_calendar_date_key")'],
  ProviderObservation: [
    '@@unique([source, externalId], map: "ProviderObservation_source_external_key")',
    '@@unique([source, contentHash], map: "ProviderObservation_source_hash_key")'
  ],
  ExternalId: ['@@unique([system, subjectType, externalId], map: "ExternalId_system_subject_external_key")'],
  DocumentVersion: ['@@unique([documentId, versionNumber], map: "DocumentVersion_document_number_key")'],
  PolicyVersion: ['@@unique([packId, versionNumber], map: "PolicyVersion_pack_number_key")'],
  PolicyBinding: ['@@unique([packId, scope, scopeValue], map: "PolicyBinding_pack_scope_key")'],
  RoleLimit: ['@@unique([roleId, kind], map: "RoleLimit_role_kind_key")'],
  // Phase 1: CRM, booking and dispatch
  ContactPoint: ['@@unique([contactId, kind, value], map: "ContactPoint_contact_kind_value_key")'],
  ArrivalWindow: ['@@unique([businessUnitId, date, startsAt], map: "ArrivalWindow_bu_date_start_key")'],
  ArrivalWindowTemplate: ['@@unique([businessUnitId, weekday, startLocal], map: "ArrivalWindowTemplate_bu_day_start_key")'],
  ShiftTemplate: ['@@unique([employeeId, weekday], map: "ShiftTemplate_employee_day_key")'],
  Shift: ['@@unique([employeeId, date, kind], map: "Shift_employee_date_kind_key")'],
  CapacityPlan: ['@@unique([businessUnitId, date], map: "CapacityPlan_bu_date_key")'],
  Visit: ['@@index([status, plannedStart], map: "Visit_status_planned_idx")'],
  // Phase 2: price book, estimates and cancellation rights
  PriceBookVersion: ['@@unique([priceBookId, versionNumber], map: "PriceBookVersion_book_number_key")'],
  PriceBookItem: ['@@unique([priceBookVersionId, itemKey], map: "PriceBookItem_version_key_key")'],
  PriceBookCategory: ['@@unique([priceBookVersionId, categoryKey], map: "PriceBookCategory_version_key_key")'],
  EstimateVersion: ['@@unique([estimateId, versionNumber], map: "EstimateVersion_estimate_number_key")']
};
function addDatabaseConstraints(schema) {
  for (const [modelName, directives] of Object.entries(COMPOUND_UNIQUES)) {
    const pattern = new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`);
    const model = schema.match(pattern)?.[0];
    if (!model) throw new Error(`Generated Prisma schema is missing ${modelName}`);
    const missing = directives.filter((directive) => !model.includes(directive));
    if (!missing.length) continue;
    schema = schema.replace(model, model.replace(/\n\}$/, `
${missing.map((directive) => `  ${directive}`).join("\n")}
}`));
  }
  return schema;
}

// features/keystone/lib/keystonePrismaErrors.ts
var RAW_METHOD = /^\$(queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe|queryRawTyped|runCommandRaw)$/;
var clients = /* @__PURE__ */ new WeakMap();
var delegates = /* @__PURE__ */ new WeakMap();
function isKeystonePrismaError(value) {
  return value instanceof Error && value.extensions?.code === "KS_PRISMA_ERROR";
}
function rethrowKeystonePrismaError(value) {
  if (!isKeystonePrismaError(value)) return value;
  const prisma = value.extensions.prisma ?? {};
  throw Object.assign(value, { code: prisma.code, meta: prisma.meta, clientVersion: prisma.clientVersion });
}
function throwing(result) {
  if (!result || typeof result.then !== "function") return rethrowKeystonePrismaError(result);
  const settled = () => result.then(rethrowKeystonePrismaError);
  return new Proxy(result, {
    get(target, key2) {
      if (key2 === "then") return (ok, fail3) => settled().then(ok, fail3);
      if (key2 === "catch") return (fail3) => settled().catch(fail3);
      if (key2 === "finally") return (done) => settled().finally(done);
      const value = Reflect.get(target, key2, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}
function throwingDelegate(delegate) {
  const cached = delegates.get(delegate);
  if (cached) return cached;
  const wrapped = new Proxy(delegate, {
    get(target, key2) {
      const value = Reflect.get(target, key2, target);
      return typeof value === "function" ? (...args) => throwing(value.apply(target, args)) : value;
    }
  });
  delegates.set(delegate, wrapped);
  return wrapped;
}
function throwKeystonePrismaErrors(client) {
  const cached = clients.get(client);
  if (cached) return cached;
  const wrapped = new Proxy(client, {
    get(target, key2) {
      const value = Reflect.get(target, key2, target);
      if (key2 === "$transaction" && typeof value === "function") {
        return (work, ...options) => {
          if (typeof work === "function") return value.call(target, (tx) => work(throwKeystonePrismaErrors(tx)), ...options);
          return Promise.resolve(value.call(target, work, ...options)).then((results) => Array.isArray(results) ? results.map(rethrowKeystonePrismaError) : results);
        };
      }
      if (key2 === "$extends" && typeof value === "function") return (...args) => throwKeystonePrismaErrors(value.apply(target, args));
      if (typeof key2 === "string" && RAW_METHOD.test(key2) && typeof value === "function") return (...args) => throwing(value.apply(target, args));
      if (typeof value === "function") return value.bind(target);
      if (typeof key2 === "string" && !key2.startsWith("$") && value && typeof value === "object" && typeof value.findFirst === "function") return throwingDelegate(value);
      return value;
    }
  });
  clients.set(client, wrapped);
  return wrapped;
}

// features/keystone/index.ts
var databaseURL = process.env.DATABASE_URL || "file:./keystone.db";
var sessionConfig = {
  maxAge: 60 * 60 * 24 * 360,
  // How long they stay signed in?
  secret: process.env.SESSION_SECRET || "this secret should only be used in testing"
};
var {
  S3_BUCKET_NAME: bucketName = "keystone-test",
  S3_REGION: region = "ap-southeast-2",
  S3_ACCESS_KEY_ID: accessKeyId = "keystone",
  S3_SECRET_ACCESS_KEY: secretAccessKey = "keystone",
  S3_ENDPOINT: endpoint = "https://sfo3.digitaloceanspaces.com"
} = process.env;
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    itemData: {
      role: {
        create: {
          name: "Owner / Admin",
          // Every permission except break-glass, which is never granted by default.
          ...Object.fromEntries(permissionNames.filter((name) => name !== "canBreakGlass").map((name) => [name, true]))
        }
      }
    }
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail(args.token, args.identity);
    }
  },
  sessionData: `
    name
    email
    kind
    accessExpiresAt
    role {
      id
      name
      ${permissionNames.join("\n      ")}
    }
  `
});
var keystone_default = withAuth(
  (0, import_core21.config)({
    db: {
      provider: "postgresql",
      url: databaseURL,
      extendPrismaSchema: addDatabaseConstraints,
      // Keystone 6.5 returns failed Prisma queries instead of throwing; make them throw so transactions roll back.
      extendPrismaClient: throwKeystonePrismaErrors
    },
    lists: models,
    storage: {
      my_images: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        endpoint,
        signed: { expiry: 5e3 },
        forcePathStyle: true
      }
    },
    ui: {
      isAccessAllowed: ({ session }) => isSignedIn({ session }) && session?.data.role?.canAccessDashboard === true
    },
    // MCP OAuth bearer tokens resolve to the approving user; everything else is unchanged.
    session: withMcpBearerSessions((0, import_session2.statelessSessions)(sessionConfig)),
    graphql: {
      extendGraphqlSchema
    }
  })
);

// keystone.ts
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
