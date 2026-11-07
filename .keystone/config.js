"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core17 = require("@keystone-6/core");
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

// features/keystone/access.ts
var permissionNames = [
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
var approvalPermissions = permissionNames.filter((name) => name.startsWith("canApprove") || name === "canBreakGlass");
var isSignedIn = ({ session }) => {
  if (!session) return false;
  const expires = session.data?.accessExpiresAt;
  return !expires || Date.parse(expires) > Date.now();
};
var hasPermission = (session, permission) => isSignedIn({ session }) && session?.data.role?.[permission] === true;
var permissions = Object.fromEntries(
  permissionNames.map((name) => [name, ({ session }) => hasPermission(session, name)])
);
var anyOf = (...names) => ({ session }) => names.some((name) => hasPermission(session, name));
var sys = () => false;
var rules = {
  canReadPeople: ({ session }) => !isSignedIn({ session }) ? false : session.data.role?.canSeeOtherPeople || session.data.role?.canManagePeople ? true : { id: { equals: session.itemId } },
  canUpdatePeople: ({ session }) => !isSignedIn({ session }) ? false : session.data.role?.canEditOtherPeople || session.data.role?.canManagePeople ? true : { id: { equals: session.itemId } }
};

// features/keystone/models/User.ts
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

// features/keystone/models/domainFields.ts
var import_fields6 = require("@keystone-6/core/fields");
var minor = (options = {}) => (0, import_fields6.bigInt)({
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
  OutboxMessage: () => OutboxMessage,
  ProviderObservation: () => ProviderObservation,
  ScheduledJob: () => ScheduledJob,
  SecretBox: () => SecretBox,
  Sequence: () => Sequence,
  Tag: () => Tag,
  Task: () => Task
});
var import_core8 = require("@keystone-6/core");
var import_fields8 = require("@keystone-6/core/fields");
var AuditEvent = (0, import_core8.list)({
  access: immutable("canReadAudit"),
  ui: { labelField: "eventType", listView: { initialColumns: ["seq", "at", "eventType", "entityType", "entityId", "actorUser"], initialSort: { field: "seq", direction: "DESC" } } },
  fields: {
    seq: (0, import_fields8.integer)({ isIndexed: "unique", validation: { isRequired: true }, ...readOnly }),
    eventKey: systemText({ indexed: "unique", required: true }),
    eventType: systemText({ indexed: true, required: true }),
    entityType: systemText({ indexed: true, required: true }),
    entityId: systemText({ indexed: true, required: true }),
    actorUser: (0, import_fields8.relationship)({ ref: "User", ...readOnly }),
    actorAgent: (0, import_fields8.relationship)({ ref: "AgentIdentity", ...readOnly }),
    approver: (0, import_fields8.relationship)({ ref: "User", ...readOnly }),
    reason: systemText(),
    before: (0, import_fields8.json)({ ...readOnly }),
    after: (0, import_fields8.json)({ ...readOnly }),
    metadata: (0, import_fields8.json)({ ...readOnly }),
    requestId: systemText(),
    prevHash: systemText({ required: true }),
    hash: systemText({ indexed: "unique", required: true }),
    at: (0, import_fields8.timestamp)({ validation: { isRequired: true }, defaultValue: { kind: "now" }, ...readOnly })
  }
});
var CommandReceipt = (0, import_core8.list)({
  access: serverOnly,
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    idempotencyKey: (0, import_fields8.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    command: (0, import_fields8.text)({ validation: { isRequired: true } }),
    principalKey: (0, import_fields8.text)({ validation: { isRequired: true } }),
    requestHash: (0, import_fields8.text)({ validation: { isRequired: true } }),
    requestParams: (0, import_fields8.json)(),
    responseCode: (0, import_fields8.text)(),
    responseBody: (0, import_fields8.json)(),
    recoveryPoint: (0, import_fields8.text)({ defaultValue: "completed" }),
    completedAt: (0, import_fields8.timestamp)({ defaultValue: { kind: "now" } }),
    ...trackingFields
  }
});
var OutboxMessage = (0, import_core8.list)({
  access: governed("canManageCompany"),
  ui: { listView: { initialColumns: ["topic", "status", "attempts", "nextAttemptAt", "aggregateType", "aggregateId"] } },
  fields: {
    topic: systemText({ indexed: true, required: true }),
    aggregateType: systemText({ required: true }),
    aggregateId: systemText({ indexed: true, required: true }),
    dedupeKey: systemText({ indexed: "unique", required: true }),
    partitionKey: systemText({ indexed: true }),
    payload: (0, import_fields8.json)({ ...readOnly }),
    status: lifecycle(["pending", "leased", "delivered", "failed", "dead"]),
    attempts: (0, import_fields8.integer)({ defaultValue: 0, ...readOnly }),
    nextAttemptAt: (0, import_fields8.timestamp)({ defaultValue: { kind: "now" }, ...readOnly }),
    leaseOwner: systemText(),
    leaseExpiresAt: (0, import_fields8.timestamp)({ ...readOnly }),
    fencingToken: (0, import_fields8.integer)({ defaultValue: 0, ...readOnly }),
    lastError: systemText(),
    deliveredAt: (0, import_fields8.timestamp)({ ...readOnly }),
    ...trackingFields
  }
});
var ProviderObservation = (0, import_core8.list)({
  access: governed("canManageIntegrations"),
  ui: { labelField: "externalId", listView: { initialColumns: ["source", "kind", "externalId", "signatureVerified", "receivedAt", "appliedAt"] } },
  fields: {
    source: systemText({ indexed: true, required: true }),
    kind: systemText({ required: true }),
    connection: (0, import_fields8.relationship)({ ref: "IntegrationConnection", ...readOnly }),
    externalId: systemText({ required: true }),
    contentHash: systemText({ required: true }),
    signatureVerified: (0, import_fields8.checkbox)({ defaultValue: false, ...readOnly }),
    payload: (0, import_fields8.json)({ ...readOnly }),
    correlation: (0, import_fields8.json)({ ...readOnly }),
    receivedAt: (0, import_fields8.timestamp)({ defaultValue: { kind: "now" }, ...readOnly }),
    appliedAt: (0, import_fields8.timestamp)({ ...readOnly }),
    ...trackingFields
  }
});
var Lease = (0, import_core8.list)({
  access: serverOnly,
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    key: (0, import_fields8.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    owner: (0, import_fields8.text)({ validation: { isRequired: true } }),
    fencingToken: (0, import_fields8.integer)({ defaultValue: 0, validation: { isRequired: true } }),
    expiresAt: (0, import_fields8.timestamp)({ validation: { isRequired: true } }),
    ...trackingFields
  }
});
var Sequence = (0, import_core8.list)({
  access: serverOnly,
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    key: (0, import_fields8.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    nextValue: (0, import_fields8.integer)({ defaultValue: 1, validation: { isRequired: true } })
  }
});
var ScheduledJob = (0, import_core8.list)({
  access: governed("canManageCompany"),
  ui: { labelField: "key", listView: { initialColumns: ["kind", "key", "dueAt", "status", "attempts"] } },
  fields: {
    kind: systemText({ indexed: true, required: true }),
    key: systemText({ indexed: "unique", required: true }),
    dueAt: (0, import_fields8.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    intervalSeconds: (0, import_fields8.integer)({ ...readOnly, ui: { ...readOnly.ui, description: "Set for recurring jobs; empty for one-shot timers." } }),
    payload: (0, import_fields8.json)({ ...readOnly }),
    status: lifecycle(["pending", "running", "done", "failed", "cancelled"]),
    attempts: (0, import_fields8.integer)({ defaultValue: 0, ...readOnly }),
    lastRunAt: (0, import_fields8.timestamp)({ ...readOnly }),
    lastError: systemText(),
    version: versionField(),
    ...trackingFields
  }
});
var Notification = (0, import_core8.list)({
  access: {
    operation: { query: permissions.canAccessDashboard, create: () => false, update: permissions.canAccessDashboard, delete: () => false },
    filter: {
      query: ({ session }) => session ? { recipient: { id: { equals: session.itemId } } } : false,
      update: ({ session }) => session ? { recipient: { id: { equals: session.itemId } } } : false
    }
  },
  fields: {
    recipient: (0, import_fields8.relationship)({ ref: "User", ...readOnly }),
    channel: choice(["in_app", "email"], "in_app"),
    template: systemText({ required: true }),
    payload: (0, import_fields8.json)({ ...readOnly }),
    status: lifecycle(["pending", "sent", "failed"]),
    sentAt: (0, import_fields8.timestamp)({ ...readOnly }),
    readAt: (0, import_fields8.timestamp)(),
    ...trackingFields
  }
});
var BusinessCalendar = (0, import_core8.list)({
  access: managed("signedIn", "canManageCompany"),
  ui: { labelField: "code", listView: { initialColumns: ["code", "name", "kind", "timeZone", "coverageThrough"] } },
  fields: {
    code: (0, import_fields8.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    name: (0, import_fields8.text)(),
    kind: choice(["legal_business_days", "company_hours"], "company_hours"),
    timeZone: (0, import_fields8.text)({ validation: { isRequired: true }, defaultValue: "America/Chicago" }),
    weekendDays: (0, import_fields8.json)({ defaultValue: [0], ui: { description: "Non-business weekdays, 0 = Sunday. The federal business-day calendar excludes Sundays only (16 CFR 429.0(f))." } }),
    regularOpen: (0, import_fields8.text)({ defaultValue: "08:00", ui: { description: "HH:mm local (company hours only)." } }),
    regularClose: (0, import_fields8.text)({ defaultValue: "17:00", ui: { description: "HH:mm local (company hours only)." } }),
    composedOf: (0, import_fields8.relationship)({ ref: "BusinessCalendar", many: true, ui: { description: "Closed whenever any of these is closed (a company calendar includes the federal holidays)." } }),
    exceptions: (0, import_fields8.relationship)({ ref: "CalendarException.calendar", many: true }),
    coverageThrough: (0, import_fields8.calendarDay)({ ui: { description: "Dates past this fail closed: no deadline is computed on a guess." } }),
    source: (0, import_fields8.text)({ ui: { description: "Where the holiday table came from and when it was checked." } }),
    ...trackingFields
  }
});
var CalendarException = (0, import_core8.list)({
  access: managed("signedIn", "canManageCompany"),
  ui: { labelField: "date", listView: { initialColumns: ["calendar", "date", "kind", "note"] } },
  fields: {
    calendar: (0, import_fields8.relationship)({ ref: "BusinessCalendar.exceptions" }),
    date: (0, import_fields8.calendarDay)({ validation: { isRequired: true } }),
    kind: choice(["holiday", "closure", "special_open"], "holiday"),
    openAt: (0, import_fields8.text)(),
    closeAt: (0, import_fields8.text)(),
    note: (0, import_fields8.text)(),
    ...trackingFields
  }
});
var ApprovalPolicy = (0, import_core8.list)({
  access: { operation: { query: permissions.canAccessDashboard, create: () => false, update: () => false, delete: () => false } },
  ui: { labelField: "action" },
  fields: {
    action: (0, import_fields8.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    description: (0, import_fields8.text)(),
    requiredPermission: (0, import_fields8.text)({ validation: { isRequired: true } }),
    minApprovals: (0, import_fields8.integer)({ defaultValue: 1, validation: { min: 1 } }),
    thresholdMinor: minor(),
    expiresAfterMinutes: (0, import_fields8.integer)({ defaultValue: 1440 }),
    ...trackingFields
  }
});
var ApprovalRequest = (0, import_core8.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "action", listView: { initialColumns: ["action", "status", "targetList", "requestedBy", "createdAt", "expiresAt"] } },
  fields: {
    action: systemText({ indexed: true, required: true }),
    summary: systemText(),
    targetList: systemText({ required: true }),
    targetId: systemText({ indexed: true, required: true }),
    payload: (0, import_fields8.json)({ ...readOnly }),
    payloadHash: systemText({ required: true }),
    requiredPermission: systemText({ required: true }),
    requestedBy: (0, import_fields8.relationship)({ ref: "User", ...readOnly }),
    requestedByAgent: (0, import_fields8.relationship)({ ref: "AgentIdentity", ...readOnly }),
    status: lifecycle(["pending", "approved", "rejected", "expired", "cancelled"]),
    expiresAt: (0, import_fields8.timestamp)({ ...readOnly }),
    consumedAt: (0, import_fields8.timestamp)({ ...readOnly, ui: { ...readOnly.ui, description: "When the approved action was carried out. An approval is used once." } }),
    decisions: (0, import_fields8.relationship)({ ref: "ApprovalDecision.request", many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var ApprovalDecision = (0, import_core8.list)({
  access: immutable("canAccessDashboard"),
  fields: {
    request: (0, import_fields8.relationship)({ ref: "ApprovalRequest.decisions", ...readOnly }),
    decidedBy: (0, import_fields8.relationship)({ ref: "User", ...readOnly }),
    decision: (0, import_fields8.select)({ type: "string", options: ["approve", "reject"].map((value) => ({ label: value, value })), validation: { isRequired: true }, ...readOnly }),
    reason: systemText(),
    at: (0, import_fields8.timestamp)({ defaultValue: { kind: "now" }, ...readOnly })
  }
});
var Task = (0, import_core8.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "title", listView: { initialColumns: ["title", "kind", "status", "priority", "dueAt", "assignee", "role"] } },
  fields: {
    kind: systemText({ indexed: true, required: true }),
    title: systemText({ required: true }),
    detail: systemText(),
    subjectType: systemText(),
    subjectId: systemText({ indexed: true }),
    dueAt: (0, import_fields8.timestamp)({ ...readOnly }),
    assignee: (0, import_fields8.relationship)({ ref: "User", ...readOnly }),
    role: (0, import_fields8.relationship)({ ref: "Role", ...readOnly }),
    status: lifecycle(["open", "in_progress", "done", "cancelled"]),
    priority: (0, import_fields8.select)({ type: "string", options: ["low", "normal", "high", "urgent"].map((value) => ({ label: value, value })), defaultValue: "normal", validation: { isRequired: true }, ...readOnly }),
    dedupeKey: systemText({ indexed: "unique" }),
    resolution: systemText(),
    closedAt: (0, import_fields8.timestamp)({ ...readOnly }),
    closedBy: (0, import_fields8.relationship)({ ref: "User", ...readOnly }),
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
var Document = (0, import_core8.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "title", listView: { initialColumns: ["title", "kind", "visibility", "subjectType", "subjectId", "createdAt"] } },
  fields: {
    title: systemText({ required: true }),
    kind: (0, import_fields8.select)({ type: "string", options: DOCUMENT_KINDS.map((value) => ({ label: value.replaceAll("_", " "), value })), defaultValue: "other", validation: { isRequired: true }, ...readOnly }),
    visibility: (0, import_fields8.select)({ type: "string", options: ["internal", "customer"].map((value) => ({ label: value, value })), defaultValue: "internal", validation: { isRequired: true }, ...readOnly }),
    subjectType: systemText(),
    subjectId: systemText({ indexed: true }),
    versions: (0, import_fields8.relationship)({ ref: "DocumentVersion.document", many: true, ...readOnly }),
    retentionUntil: (0, import_fields8.calendarDay)({ ...readOnly }),
    ...trackingFields
  }
});
var DocumentVersion = (0, import_core8.list)({
  access: immutable("canAccessDashboard"),
  ui: { labelField: "sha256" },
  fields: {
    document: (0, import_fields8.relationship)({ ref: "Document.versions", ...readOnly }),
    versionNumber: (0, import_fields8.integer)({ validation: { isRequired: true, min: 1 }, ...readOnly }),
    storageKey: systemText({ required: true }),
    sha256: systemText({ required: true }),
    mimeType: systemText({ required: true }),
    sizeBytes: (0, import_fields8.integer)({ ...readOnly }),
    createdBy: (0, import_fields8.relationship)({ ref: "User", ...readOnly }),
    ...trackingFields
  }
});
var Media = (0, import_core8.list)({
  access: governed("canAccessDashboard"),
  graphql: { plural: "MediaItems" },
  ui: { labelField: "storageKey", listView: { initialColumns: ["kind", "subjectType", "subjectId", "capturedAt", "visibility"] } },
  fields: {
    subjectType: systemText({ required: true }),
    subjectId: systemText({ indexed: true, required: true }),
    kind: (0, import_fields8.select)({ type: "string", options: ["photo", "video", "scan_3d", "audio", "recording"].map((value) => ({ label: value.replaceAll("_", " "), value })), defaultValue: "photo", validation: { isRequired: true }, ...readOnly }),
    storageKey: systemText({ required: true }),
    sha256: systemText({ required: true }),
    mimeType: systemText(),
    capturedAt: (0, import_fields8.timestamp)({ ...readOnly }),
    capturedBy: (0, import_fields8.relationship)({ ref: "User", ...readOnly }),
    visibility: (0, import_fields8.select)({ type: "string", options: ["internal", "customer"].map((value) => ({ label: value, value })), defaultValue: "internal", validation: { isRequired: true }, ...readOnly }),
    ...trackingFields
  }
});
var Note = (0, import_core8.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "body", listView: { initialColumns: ["subjectType", "subjectId", "visibility", "author", "pinned", "createdAt"] } },
  fields: {
    subjectType: systemText({ required: true }),
    subjectId: systemText({ indexed: true, required: true }),
    body: systemText({ required: true }),
    visibility: (0, import_fields8.select)({ type: "string", options: ["internal", "tech", "customer"].map((value) => ({ label: value, value })), defaultValue: "internal", validation: { isRequired: true }, ...readOnly }),
    author: (0, import_fields8.relationship)({ ref: "User", ...readOnly }),
    pinned: (0, import_fields8.checkbox)({ defaultValue: false, ...readOnly }),
    ...trackingFields
  }
});
var Tag = (0, import_core8.list)({
  access: managed("canAccessDashboard", ["canManageCustomers", "canManageCompany"]),
  ui: { labelField: "name" },
  fields: {
    name: (0, import_fields8.text)({ isIndexed: "unique", validation: { isRequired: true, length: { max: 60 } } }),
    color: choice(["slate", "blue", "green", "amber", "red", "violet"], "slate"),
    ...trackingFields
  }
});
var ExternalId = (0, import_core8.list)({
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
var SecretBox = (0, import_core8.list)({
  access: serverOnly,
  graphql: { omit: true },
  ui: { isHidden: true },
  fields: {
    purpose: (0, import_fields8.select)({ type: "string", options: ["integration_credential", "access_secret", "webhook_secret"].map((value) => ({ label: value, value })), validation: { isRequired: true } }),
    ciphertext: (0, import_fields8.text)({ validation: { isRequired: true } }),
    iv: (0, import_fields8.text)({ validation: { isRequired: true } }),
    authTag: (0, import_fields8.text)({ validation: { isRequired: true } }),
    keyVersion: (0, import_fields8.integer)({ defaultValue: 1 }),
    createdBy: (0, import_fields8.relationship)({ ref: "User" }),
    rotatedAt: (0, import_fields8.timestamp)(),
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
var import_core9 = require("@keystone-6/core");
var import_fields9 = require("@keystone-6/core/fields");
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
var PolicyPack = (0, import_core9.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "code", listView: { initialColumns: ["code", "name", "kind", "jurisdictionCode"] } },
  fields: {
    code: systemText({ indexed: "unique", required: true }),
    name: systemText({ required: true }),
    kind: fixedChoice(POLICY_KINDS),
    jurisdictionCode: systemText({ required: true }),
    description: systemText(),
    versions: (0, import_fields9.relationship)({ ref: "PolicyVersion.pack", many: true, ...readOnly }),
    bindings: (0, import_fields9.relationship)({ ref: "PolicyBinding.pack", many: true, ...readOnly }),
    ...trackingFields
  }
});
var PolicyVersion = (0, import_core9.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "contentHash", listView: { initialColumns: ["pack", "versionNumber", "status", "effectiveFrom", "effectiveTo", "verifiedAt"] } },
  fields: {
    pack: (0, import_fields9.relationship)({ ref: "PolicyPack.versions", ...readOnly }),
    versionNumber: (0, import_fields9.integer)({ validation: { isRequired: true, min: 1 }, ...readOnly }),
    effectiveFrom: (0, import_fields9.calendarDay)({ validation: { isRequired: true }, ...readOnly }),
    effectiveTo: (0, import_fields9.calendarDay)({ ...readOnly, ui: { ...readOnly.ui, description: "Exclusive. Empty means open-ended." } }),
    rules: (0, import_fields9.json)({ ...readOnly, ui: { ...readOnly.ui, description: "Validated against the Zod schema for the pack kind (domain/policySchemas.ts)." } }),
    sourceRefs: (0, import_fields9.json)({ ...readOnly, ui: { ...readOnly.ui, description: 'Citations for every rule, e.g. "16 CFR 429.1(a)".' } }),
    verifiedBy: (0, import_fields9.text)({ ...readOnly }),
    verifiedAt: (0, import_fields9.timestamp)({ ...readOnly }),
    status: lifecycle(["draft", "pending_approval", "active", "retired"]),
    approval: (0, import_fields9.relationship)({ ref: "ApprovalRequest", ...readOnly }),
    contentHash: systemText({ required: true }),
    version: versionField(),
    ...trackingFields
  }
});
var PolicyBinding = (0, import_core9.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "scopeValue", listView: { initialColumns: ["pack", "scope", "scopeValue", "priority", "status"] } },
  fields: {
    pack: (0, import_fields9.relationship)({ ref: "PolicyPack.bindings", ...readOnly }),
    scope: fixedChoice(["company", "branch", "state", "county", "city", "zip"]),
    scopeValue: systemText({ required: true }),
    branch: (0, import_fields9.relationship)({ ref: "Branch.policyBindings", ...readOnly }),
    priority: (0, import_fields9.integer)({ defaultValue: 0, ...readOnly }),
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
var import_core10 = require("@keystone-6/core");
var import_fields10 = require("@keystone-6/core/fields");
var AGENT_AUTONOMY = ["disabled", "propose_only", "auto_within_policy"];
var AgentIdentity = (0, import_core10.list)({
  access: { operation: { query: permissions.canAccessDashboard, create: () => false, update: () => false, delete: () => false } },
  ui: { labelField: "name", listView: { initialColumns: ["name", "kind", "status", "killSwitch", "owner"] } },
  fields: {
    name: (0, import_fields10.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    kind: choice(["llm_agent", "rules_engine", "external_mcp_client"], "llm_agent"),
    provider: (0, import_fields10.text)(),
    modelRef: (0, import_fields10.text)(),
    owner: (0, import_fields10.relationship)({ ref: "User" }),
    oauthApp: (0, import_fields10.relationship)({ ref: "OAuthApp" }),
    status: lifecycle(["active", "paused", "revoked"]),
    killSwitch: (0, import_fields10.checkbox)({ defaultValue: false, ...readOnly, ui: { ...readOnly.ui, description: "When on, every tool call is refused before it runs." } }),
    limits: (0, import_fields10.json)({ ...readOnly, ui: { ...readOnly.ui, description: 'Rate and amount limits, e.g. {"actionsPerHour":120}.' } }),
    grants: (0, import_fields10.relationship)({ ref: "AgentScopeGrant.agent", many: true, ...readOnly }),
    runs: (0, import_fields10.relationship)({ ref: "AgentRun.agent", many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var AgentScopeGrant = (0, import_core10.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "tool", listView: { initialColumns: ["agent", "tool", "autonomy", "status", "effectiveFrom", "revokedAt"] } },
  fields: {
    agent: (0, import_fields10.relationship)({ ref: "AgentIdentity.grants", ...readOnly }),
    tool: systemText({ indexed: true, required: true }),
    autonomy: fixedChoice(AGENT_AUTONOMY),
    constraints: (0, import_fields10.json)({ ...readOnly, ui: { ...readOnly.ui, description: 'Limits, e.g. {"businessUnits":["HVAC-SVC"],"maxQuoteMinor":"250000"}.' } }),
    status: lifecycle(["requested", "active", "revoked"]),
    grantedBy: (0, import_fields10.relationship)({ ref: "User", ...readOnly }),
    approval: (0, import_fields10.relationship)({ ref: "ApprovalRequest", ...readOnly }),
    effectiveFrom: (0, import_fields10.timestamp)({ ...readOnly }),
    revokedAt: (0, import_fields10.timestamp)({ ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var AgentRun = (0, import_core10.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "trigger", listView: { initialColumns: ["agent", "trigger", "status", "startedAt", "endedAt"] } },
  fields: {
    agent: (0, import_fields10.relationship)({ ref: "AgentIdentity.runs", ...readOnly }),
    trigger: fixedChoice(["inbound_call", "inbound_sms", "schedule", "user_request", "webhook"]),
    callRef: systemText({ indexed: true }),
    startedAt: (0, import_fields10.timestamp)({ defaultValue: { kind: "now" }, ...readOnly }),
    endedAt: (0, import_fields10.timestamp)({ ...readOnly }),
    status: lifecycle(["started", "completed", "failed", "aborted"]),
    tokenUsage: (0, import_fields10.json)({ ...readOnly }),
    costMinor: minor(),
    actions: (0, import_fields10.relationship)({ ref: "AgentAction.run", many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var AgentAction = (0, import_core10.list)({
  access: governed("canAccessDashboard"),
  ui: { labelField: "tool", listView: { initialColumns: ["tool", "status", "run", "createdAt"] } },
  fields: {
    run: (0, import_fields10.relationship)({ ref: "AgentRun.actions", ...readOnly }),
    agent: (0, import_fields10.relationship)({ ref: "AgentIdentity", ...readOnly }),
    tool: systemText({ indexed: true, required: true }),
    idempotencyKey: systemText({ indexed: "unique", required: true }),
    inputsHash: systemText({ required: true }),
    inputsProvenance: (0, import_fields10.json)({ ...readOnly }),
    output: (0, import_fields10.json)({ ...readOnly }),
    reasoningSummary: systemText(),
    status: lifecycle(["proposed", "awaiting_approval", "approved", "rejected", "applied", "failed", "expired"]),
    approval: (0, import_fields10.relationship)({ ref: "ApprovalRequest", ...readOnly }),
    appliedEffects: (0, import_fields10.json)({ ...readOnly }),
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
var import_core11 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");
var EMPLOYEE_KINDS = ["technician", "csr", "dispatcher", "sales", "manager", "warehouse", "office", "apprentice"];
var Employee = (0, import_core11.list)({
  access: managed("signedIn", "canManagePeople"),
  ui: { labelField: "displayName", listView: { initialColumns: ["displayName", "kind", "homeBranch", "employmentType", "status"] } },
  fields: {
    user: (0, import_fields11.relationship)({ ref: "User" }),
    firstName: (0, import_fields11.text)({ validation: { isRequired: true } }),
    lastName: (0, import_fields11.text)({ validation: { isRequired: true } }),
    displayName: (0, import_fields11.text)({ validation: { isRequired: true } }),
    employeeNumber: (0, import_fields11.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    homeBranch: (0, import_fields11.relationship)({ ref: "Branch" }),
    businessUnits: (0, import_fields11.relationship)({ ref: "BusinessUnit", many: true }),
    kind: choice(EMPLOYEE_KINDS, "technician"),
    employmentType: choice(["w2_hourly", "w2_salaried_exempt", "w2_salaried_nonexempt", "contractor_1099"], "w2_hourly"),
    hireDate: (0, import_fields11.calendarDay)(),
    terminationDate: (0, import_fields11.calendarDay)(),
    skills: (0, import_fields11.relationship)({ ref: "Skill", many: true }),
    credentials: (0, import_fields11.relationship)({ ref: "Credential.employee", many: true, ...readOnly }),
    phoneE164: (0, import_fields11.text)({ validation: { match: { regex: /^(\+[1-9]\d{7,14})?$/, explanation: "E.164, like +15125550123" } } }),
    email: (0, import_fields11.text)(),
    lat: geo({ description: "Start-of-day latitude (home or shop), used for drive estimates." }),
    lng: geo({ description: "Start-of-day longitude." }),
    dispatchable: (0, import_fields11.checkbox)({ defaultValue: true, ui: { description: "Shown on the dispatch board." } }),
    status: choice(["active", "on_leave", "terminated"], "active"),
    ...trackingFields
  }
});
var CREDENTIAL_KINDS = ["state_trade_license", "epa_608", "nate", "manufacturer", "backflow", "osha", "driver_license", "other"];
var EPA_TYPES = ["none", "type_i", "type_ii", "type_iii", "universal"];
var Credential = (0, import_core11.list)({
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
    employee: (0, import_fields11.relationship)({ ref: "Employee.credentials" }),
    kind: choice(CREDENTIAL_KINDS, "state_trade_license"),
    trade: choice(["hvac", "plumbing", "electrical", "general"], "general"),
    jurisdictionCode: (0, import_fields11.text)({ defaultValue: "US-TX", validation: { match: { regex: /^([A-Z]{2}(-[A-Z0-9]{2,})*)?$/, explanation: "Like US-TX" } } }),
    issuer: (0, import_fields11.text)({ ui: { description: "TDLR, TSBPE, EPA-approved certifying organisation, NATE\u2026" } }),
    number: (0, import_fields11.text)(),
    licenseClass: (0, import_fields11.text)({ ui: { description: "Texas class code: acr_certified_technician, acr_registered_technician, plumber_apprentice, tradesman_plumber, journeyman_plumber, master_plumber, electrical_apprentice, journeyman_electrician, master_electrician, residential_wireman." } }),
    epaType: choice(EPA_TYPES, "none"),
    endorsements: (0, import_fields11.json)({ defaultValue: [] }),
    issuedOn: (0, import_fields11.calendarDay)(),
    expiresOn: (0, import_fields11.calendarDay)({ ui: { description: "An expired credential stops new assignments only (I-P2)." } }),
    evidence: (0, import_fields11.relationship)({ ref: "Document" }),
    verifiedBy: (0, import_fields11.relationship)({ ref: "User", ...readOnly }),
    verifiedAt: (0, import_fields11.timestamp)({ ...readOnly }),
    status: lifecycle(["pending_verification", "verified", "expired", "revoked"]),
    version: versionField(),
    ...trackingFields
  }
});
var Skill = (0, import_core11.list)({
  access: managed("signedIn", "canManagePeople"),
  ui: { labelField: "name" },
  fields: {
    code: (0, import_fields11.text)({ isIndexed: "unique", validation: { isRequired: true, match: { regex: /^[a-z0-9_]{2,40}$/, explanation: "lower_snake_case" } } }),
    name: (0, import_fields11.text)({ validation: { isRequired: true } }),
    trade: choice(["hvac", "plumbing", "electrical", "general"], "general"),
    ...trackingFields
  }
});
var JobTypeRequirement = (0, import_core11.list)({
  access: managed("signedIn", "canManageCompany"),
  ui: { labelField: "name" },
  fields: {
    name: (0, import_fields11.text)({ validation: { isRequired: true } }),
    licensingTags: (0, import_fields11.json)({ defaultValue: [], ui: { description: 'Job tags in the licensing policy pack, e.g. ["acr_service","refrigerant_handling"].' } }),
    requiredCredentialKinds: (0, import_fields11.json)({ defaultValue: [], ui: { description: 'Extra credential kinds every assigned tech must hold, e.g. ["backflow"].' } }),
    requiresSupervisorOnJob: (0, import_fields11.checkbox)({ defaultValue: false }),
    maxCoolingTons: qty(),
    maxHeatingBtuh: (0, import_fields11.integer)(),
    skills: (0, import_fields11.relationship)({ ref: "Skill", many: true }),
    ...trackingFields
  }
});
var EligibilityEvaluation = (0, import_core11.list)({
  access: immutable(["canDispatch", "canViewBoard", "canManagePeople"]),
  ui: { labelField: "result", listView: { initialColumns: ["visit", "employee", "result", "evaluatedAt"] } },
  fields: {
    visit: (0, import_fields11.relationship)({ ref: "Visit", ...readOnly }),
    employee: (0, import_fields11.relationship)({ ref: "Employee", ...readOnly }),
    policyVersion: (0, import_fields11.relationship)({ ref: "PolicyVersion", ...readOnly }),
    result: fixedChoice(["eligible", "ineligible", "override"]),
    findings: (0, import_fields11.json)({ ...readOnly }),
    evaluatedAt: (0, import_fields11.timestamp)({ ...readOnly }),
    overrideApproval: (0, import_fields11.relationship)({ ref: "ApprovalRequest", ...readOnly }),
    ...trackingFields
  }
});
var Crew = (0, import_core11.list)({
  access: managed("signedIn", ["canDispatch", "canManagePeople"]),
  ui: { labelField: "name" },
  fields: {
    name: (0, import_fields11.text)({ validation: { isRequired: true } }),
    lead: (0, import_fields11.relationship)({ ref: "Employee" }),
    members: (0, import_fields11.relationship)({ ref: "Employee", many: true }),
    businessUnit: (0, import_fields11.relationship)({ ref: "BusinessUnit" }),
    ...trackingFields
  }
});
var LOCAL_TIME = { regex: /^([01]\d|2[0-3]):[0-5]\d$/, explanation: "HH:MM, 24-hour" };
var ShiftTemplate = (0, import_core11.list)({
  access: managed("signedIn", ["canDispatch", "canManagePeople"]),
  ui: { labelField: "startLocal", listView: { initialColumns: ["employee", "weekday", "startLocal", "endLocal"] } },
  fields: {
    employee: (0, import_fields11.relationship)({ ref: "Employee" }),
    weekday: (0, import_fields11.integer)({ validation: { isRequired: true, min: 0, max: 6 }, ui: { description: "0 = Sunday" } }),
    startLocal: (0, import_fields11.text)({ validation: { isRequired: true, match: LOCAL_TIME } }),
    endLocal: (0, import_fields11.text)({ validation: { isRequired: true, match: LOCAL_TIME } }),
    ...trackingFields
  }
});
var Shift = (0, import_core11.list)({
  access: governed(["canDispatch", "canViewBoard", "canManagePeople", "canWorkVisits"]),
  ui: { labelField: "date", listView: { initialColumns: ["employee", "date", "startsAt", "endsAt", "kind"] } },
  fields: {
    employee: (0, import_fields11.relationship)({ ref: "Employee", ...readOnly }),
    date: (0, import_fields11.calendarDay)({ validation: { isRequired: true }, ...readOnly }),
    startsAt: (0, import_fields11.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    endsAt: (0, import_fields11.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    kind: fixedChoice(["regular", "on_call", "overtime"]),
    ...trackingFields
  }
});
var OnCallRotation = (0, import_core11.list)({
  access: managed("signedIn", ["canDispatch", "canManagePeople"]),
  ui: { labelField: "phoneE164", listView: { initialColumns: ["businessUnit", "employee", "startsAt", "endsAt", "escalationOrder"] } },
  fields: {
    businessUnit: (0, import_fields11.relationship)({ ref: "BusinessUnit" }),
    employee: (0, import_fields11.relationship)({ ref: "Employee" }),
    startsAt: (0, import_fields11.timestamp)({ validation: { isRequired: true } }),
    endsAt: (0, import_fields11.timestamp)({ validation: { isRequired: true } }),
    phoneE164: (0, import_fields11.text)({ validation: { isRequired: true, match: { regex: /^\+[1-9]\d{7,14}$/, explanation: "E.164" } } }),
    escalationOrder: (0, import_fields11.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1, max: 9 } }),
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
var import_core12 = require("@keystone-6/core");
var import_fields12 = require("@keystone-6/core/fields");

// features/keystone/models/scope.ts
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
var Customer = (0, import_core12.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: permissions.canManageCustomers, delete: sys },
    filter: { query: scoped(techCustomer) }
  },
  ui: { labelField: "displayName", listView: { initialColumns: ["ref", "displayName", "kind", "doNotService", "createdAt"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    kind: choice(["residential", "commercial"], "residential"),
    displayName: (0, import_fields12.text)({ validation: { isRequired: true } }),
    organizationName: (0, import_fields12.text)(),
    primaryContact: (0, import_fields12.relationship)({ ref: "Contact" }),
    contacts: (0, import_fields12.relationship)({ ref: "Contact.customer", many: true, ...readOnly }),
    locations: (0, import_fields12.relationship)({ ref: "ServiceLocation.customer", many: true, ...readOnly }),
    jobs: (0, import_fields12.relationship)({ ref: "Job.customer", many: true, ...readOnly }),
    billingLine1: (0, import_fields12.text)(),
    billingLine2: (0, import_fields12.text)(),
    billingCity: (0, import_fields12.text)(),
    billingRegion: (0, import_fields12.text)(),
    billingPostalCode: (0, import_fields12.text)(),
    taxExemptCertificate: (0, import_fields12.relationship)({ ref: "Document" }),
    tags: (0, import_fields12.relationship)({ ref: "Tag", many: true }),
    doNotService: (0, import_fields12.checkbox)({ defaultValue: false }),
    doNotServiceReason: (0, import_fields12.text)(),
    mergedInto: (0, import_fields12.relationship)({ ref: "Customer", ...readOnly }),
    source: (0, import_fields12.relationship)({ ref: "Campaign", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var Contact = (0, import_core12.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: permissions.canManageCustomers, delete: sys },
    filter: { query: scoped((userId) => ({ customer: techCustomer(userId) })) }
  },
  ui: { labelField: "lastName", listView: { initialColumns: ["firstName", "lastName", "role", "customer"] } },
  fields: {
    customer: (0, import_fields12.relationship)({ ref: "Customer.contacts", ...readOnly }),
    firstName: (0, import_fields12.text)(),
    lastName: (0, import_fields12.text)(),
    role: choice(["owner", "spouse", "tenant", "property_manager", "billing", "site_contact", "other"], "owner"),
    points: (0, import_fields12.relationship)({ ref: "ContactPoint.contact", many: true, ...readOnly }),
    preferredLanguage: (0, import_fields12.text)({ defaultValue: "en" }),
    ...trackingFields
  }
});
var ContactPoint = (0, import_core12.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: sys, delete: sys },
    filter: { query: scoped((userId) => ({ contact: { customer: techCustomer(userId) } })) }
  },
  ui: { labelField: "kind", listView: { initialColumns: ["contact", "kind", "value", "isPrimary", "carrierLineType"] } },
  fields: {
    contact: (0, import_fields12.relationship)({ ref: "Contact.points", ...readOnly }),
    kind: fixedChoice(["mobile", "landline", "email"]),
    value: (0, import_fields12.text)({ validation: { isRequired: true }, access: { read: piiRead, create: () => false, update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    valueHash: systemText({ indexed: true, required: true }),
    verifiedAt: (0, import_fields12.timestamp)({ ...readOnly }),
    isPrimary: (0, import_fields12.checkbox)({ defaultValue: false, ...readOnly }),
    carrierLineType: fixedChoice(["unknown", "mobile", "landline", "voip"]),
    consents: (0, import_fields12.relationship)({ ref: "ConsentRecord.contactPoint", many: true, ...readOnly }),
    ...trackingFields
  }
});
var CONSENT_PURPOSES = ["transactional_sms", "transactional_voice", "marketing_sms", "marketing_email", "marketing_voice", "ai_voice_outbound", "call_recording", "auto_renewal"];
var ConsentRecord = (0, import_core12.list)({
  access: immutable(["canManageCustomers", "canBook", "canSendMessages", "canDispatch"]),
  ui: { labelField: "purpose", listView: { initialColumns: ["contactPoint", "purpose", "action", "channel", "recordedAt"] } },
  fields: {
    contactPoint: (0, import_fields12.relationship)({ ref: "ContactPoint.consents", ...readOnly }),
    purpose: fixedChoice(CONSENT_PURPOSES),
    action: fixedChoice(["grant", "revoke"]),
    channel: fixedChoice(["web_form", "portal", "phone", "sms_keyword", "paper", "in_person", "import"]),
    evidence: (0, import_fields12.json)({ ...readOnly }),
    wordingVersion: systemText(),
    policyVersion: (0, import_fields12.relationship)({ ref: "PolicyVersion", ...readOnly }),
    recordedAt: (0, import_fields12.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    actorKind: fixedChoice(["user", "agent", "system", "customer", "webhook"]),
    actorId: systemText(),
    ...trackingFields
  }
});
var DncEntry = (0, import_core12.list)({
  access: immutable(["canManageCustomers", "canSendMessages", "canManageCampaigns"]),
  ui: { labelField: "valueHash", listView: { initialColumns: ["kind", "source", "addedAt"] } },
  fields: {
    valueHash: systemText({ indexed: true, required: true }),
    kind: fixedChoice(["internal", "national_cache"]),
    source: systemText(),
    addedAt: (0, import_fields12.timestamp)({ ...readOnly }),
    ...trackingFields
  }
});
var ServiceLocation = (0, import_core12.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: permissions.canManageCustomers, delete: sys },
    filter: { query: scoped(techLocation) }
  },
  ui: { labelField: "address1", listView: { initialColumns: ["ref", "address1", "city", "postalCode", "customer", "serviceArea", "geocodeQuality"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    customer: (0, import_fields12.relationship)({ ref: "Customer.locations", ...readOnly }),
    address1: (0, import_fields12.text)({ validation: { isRequired: true } }),
    address2: (0, import_fields12.text)(),
    city: (0, import_fields12.text)({ validation: { isRequired: true } }),
    state: (0, import_fields12.text)({ defaultValue: "TX", validation: { isRequired: true, match: { regex: /^[A-Z]{2}$/, explanation: "Two-letter state code" } } }),
    county: (0, import_fields12.text)(),
    postalCode: (0, import_fields12.text)({ validation: { isRequired: true, match: { regex: /^\d{5}(-\d{4})?$/, explanation: "ZIP or ZIP+4" } } }),
    country: (0, import_fields12.text)({ defaultValue: "US" }),
    lat: geo({ ...readOnly }),
    lng: geo({ ...readOnly }),
    geocodeQuality: fixedChoice(["rooftop", "interpolated", "zip", "failed"]),
    timeZone: systemText({ required: true }),
    serviceArea: (0, import_fields12.relationship)({ ref: "ServiceArea", ...readOnly }),
    propertyClass: choice(["residential", "nonresidential", "multiple_use"], "residential"),
    propertyType: choice(["single_family", "townhome", "condo", "multifamily", "mobile_home", "commercial"], "single_family"),
    yearBuilt: (0, import_fields12.integer)({ validation: { min: 1800, max: 2100 } }),
    squareFeet: (0, import_fields12.integer)({ validation: { min: 0 } }),
    contacts: (0, import_fields12.relationship)({ ref: "LocationContact.location", many: true, ...readOnly }),
    accessSecrets: (0, import_fields12.relationship)({ ref: "AccessSecret.location", many: true, ...readOnly }),
    jobs: (0, import_fields12.relationship)({ ref: "Job.location", many: true, ...readOnly }),
    mergedInto: (0, import_fields12.relationship)({ ref: "ServiceLocation", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var LocationOwnership = (0, import_core12.list)({
  access: immutable(["canManageCustomers", "canBook"]),
  ui: { labelField: "reason" },
  fields: {
    location: (0, import_fields12.relationship)({ ref: "ServiceLocation", ...readOnly }),
    customer: (0, import_fields12.relationship)({ ref: "Customer", ...readOnly }),
    from: (0, import_fields12.calendarDay)({ ...readOnly }),
    to: (0, import_fields12.calendarDay)({ ...readOnly }),
    reason: fixedChoice(["purchase", "sale", "tenant_change", "import", "created"]),
    ...trackingFields
  }
});
var LocationContact = (0, import_core12.list)({
  access: governed(["canManageCustomers", "canBook", "canDispatch"]),
  ui: { labelField: "role" },
  fields: {
    location: (0, import_fields12.relationship)({ ref: "ServiceLocation.contacts", ...readOnly }),
    contact: (0, import_fields12.relationship)({ ref: "Contact", ...readOnly }),
    role: fixedChoice(["owner", "tenant", "property_manager", "site_contact"]),
    canAuthorizeWork: (0, import_fields12.checkbox)({ defaultValue: true, ...readOnly }),
    nteMinor: minor({ description: "Not-to-exceed this contact may authorise, in cents." }),
    ...trackingFields
  }
});
var AccessSecret = (0, import_core12.list)({
  access: {
    operation: { query: anyOf("canManageCustomers", "canDispatch", "canRevealAccessSecret"), create: sys, update: sys, delete: sys },
    filter: { query: ({ session }) => isSignedIn({ session }) ? true : false }
  },
  ui: { labelField: "label", listView: { initialColumns: ["location", "kind", "label", "status"] } },
  fields: {
    location: (0, import_fields12.relationship)({ ref: "ServiceLocation.accessSecrets", ...readOnly }),
    kind: fixedChoice(["gate_code", "lockbox", "alarm", "garage", "pet", "other"]),
    label: systemText({ required: true }),
    secretRef: (0, import_fields12.text)({ access: { read: () => false, create: () => false, update: () => false }, ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" } } }),
    status: lifecycle(["active", "retired"]),
    reveals: (0, import_fields12.relationship)({ ref: "AccessSecretReveal.secret", many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var AccessSecretReveal = (0, import_core12.list)({
  access: immutable(["canManageCustomers", "canReadAudit"]),
  ui: { labelField: "revealedAt", listView: { initialColumns: ["secret", "revealedTo", "visit", "revealedAt", "expiresAt"] } },
  fields: {
    secret: (0, import_fields12.relationship)({ ref: "AccessSecret.reveals", ...readOnly }),
    revealedTo: (0, import_fields12.relationship)({ ref: "User", ...readOnly }),
    visit: (0, import_fields12.relationship)({ ref: "Visit", ...readOnly }),
    revealedAt: (0, import_fields12.timestamp)({ ...readOnly }),
    expiresAt: (0, import_fields12.timestamp)({ ...readOnly }),
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
var import_core13 = require("@keystone-6/core");
var import_fields13 = require("@keystone-6/core/fields");
var CAMPAIGN_CHANNELS = ["google_lsa", "google_ads", "seo", "direct_mail", "referral", "yard_sign", "truck_wrap", "tv_radio", "marketplace", "repeat", "tech_generated", "other"];
var Campaign = (0, import_core13.list)({
  access: managed(["canManageCampaigns", "canManageLeads", "canBook"], "canManageCampaigns"),
  ui: { labelField: "name", listView: { initialColumns: ["name", "channel", "active"] } },
  fields: {
    name: (0, import_fields13.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    channel: choice(CAMPAIGN_CHANNELS, "other"),
    monthlyCostMinor: minor({ defaultValue: 0n, description: "Planned monthly spend in cents (actuals arrive with the accounting export)." }),
    active: (0, import_fields13.checkbox)({ defaultValue: true }),
    trackingNumbers: (0, import_fields13.relationship)({ ref: "TrackingNumber.campaign", many: true }),
    ...trackingFields
  }
});
var TrackingNumber = (0, import_core13.list)({
  access: managed(["canManageCampaigns", "canManageLeads", "canBook"], "canManageCampaigns"),
  ui: { labelField: "phoneE164", listView: { initialColumns: ["phoneE164", "campaign", "provider", "businessUnit"] } },
  fields: {
    phoneE164: (0, import_fields13.text)({ isIndexed: "unique", validation: { isRequired: true, match: { regex: /^\+[1-9]\d{7,14}$/, explanation: "E.164" } } }),
    campaign: (0, import_fields13.relationship)({ ref: "Campaign.trackingNumbers" }),
    provider: (0, import_fields13.text)({ defaultValue: "manual" }),
    forwardTo: (0, import_fields13.text)(),
    businessUnit: (0, import_fields13.relationship)({ ref: "BusinessUnit" }),
    ...trackingFields
  }
});
var LEAD_SOURCES = ["call", "sms", "web_form", "online_booking", "lsa", "marketplace", "tech_generated", "membership", "import", "ai_agent"];
var LEAD_STATUSES = ["new", "contacted", "qualified", "booked", "converted", "lost", "spam", "merged"];
var LOST_REASONS = ["price", "timing", "out_of_area", "no_answer", "competitor", "not_serviceable", "duplicate", "other"];
var Lead = (0, import_core13.list)({
  access: governed(["canManageLeads", "canBook"]),
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "contactName", "source", "status", "requestedJobType", "createdAt"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    source: fixedChoice(LEAD_SOURCES),
    campaign: (0, import_fields13.relationship)({ ref: "Campaign", ...readOnly }),
    trackingNumber: (0, import_fields13.relationship)({ ref: "TrackingNumber", ...readOnly }),
    externalId: systemText(),
    customer: (0, import_fields13.relationship)({ ref: "Customer", ...readOnly }),
    location: (0, import_fields13.relationship)({ ref: "ServiceLocation", ...readOnly }),
    contactName: systemText(),
    phoneE164: (0, import_fields13.text)({ access: { read: anyOf("canReadCustomerPII", "canBook", "canManageLeads"), create: () => false, update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    email: (0, import_fields13.text)({ access: { read: anyOf("canReadCustomerPII", "canBook", "canManageLeads"), create: () => false, update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    requestedJobType: (0, import_fields13.relationship)({ ref: "JobType", ...readOnly }),
    summary: systemText(),
    status: lifecycle(LEAD_STATUSES),
    lostReason: fixedChoice(["", ...LOST_REASONS]),
    firstResponseSeconds: (0, import_fields13.integer)({ ...readOnly }),
    respondDueAt: (0, import_fields13.timestamp)({ ...readOnly }),
    job: (0, import_fields13.relationship)({ ref: "Job", ...readOnly }),
    mergedInto: (0, import_fields13.relationship)({ ref: "Lead", ...readOnly }),
    assignedTo: (0, import_fields13.relationship)({ ref: "User", ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var Conversation = (0, import_core13.list)({
  access: governed(["canManageLeads", "canBook", "canSendMessages", "canDispatch"]),
  ui: { labelField: "channel", listView: { initialColumns: ["customer", "channel", "status", "updatedAt"] } },
  fields: {
    customer: (0, import_fields13.relationship)({ ref: "Customer", ...readOnly }),
    contactPoint: (0, import_fields13.relationship)({ ref: "ContactPoint", ...readOnly }),
    channel: fixedChoice(["voice", "sms", "email", "chat"]),
    status: lifecycle(["open", "waiting_customer", "waiting_staff", "closed"]),
    assignedTo: (0, import_fields13.relationship)({ ref: "User", ...readOnly }),
    lead: (0, import_fields13.relationship)({ ref: "Lead", ...readOnly }),
    job: (0, import_fields13.relationship)({ ref: "Job", ...readOnly }),
    calls: (0, import_fields13.relationship)({ ref: "Call.conversation", many: true, ...readOnly }),
    messages: (0, import_fields13.relationship)({ ref: "Message.conversation", many: true, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var CALL_DISPOSITIONS = ["", "booked", "not_booked", "existing_job", "spam", "emergency_paged", "transferred"];
var Call = (0, import_core13.list)({
  access: governed(["canManageLeads", "canBook", "canDispatch"]),
  ui: { labelField: "providerCallId", listView: { initialColumns: ["startedAt", "direction", "fromMasked", "answeredBy", "disposition", "status"] } },
  fields: {
    conversation: (0, import_fields13.relationship)({ ref: "Conversation.calls", ...readOnly }),
    direction: fixedChoice(["inbound", "outbound"]),
    providerCallId: systemText({ indexed: "unique", required: true }),
    provider: systemText(),
    from: (0, import_fields13.text)({ access: { read: anyOf("canReadCustomerPII", "canBook"), create: () => false, update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    fromMasked: systemText(),
    to: systemText(),
    trackingNumber: (0, import_fields13.relationship)({ ref: "TrackingNumber", ...readOnly }),
    startedAt: (0, import_fields13.timestamp)({ ...readOnly }),
    endedAt: (0, import_fields13.timestamp)({ ...readOnly }),
    durationSeconds: (0, import_fields13.integer)({ ...readOnly }),
    answeredBy: fixedChoice(["human", "ai_agent", "voicemail", "ivr"]),
    agentRun: (0, import_fields13.relationship)({ ref: "AgentRun", ...readOnly }),
    recording: (0, import_fields13.relationship)({ ref: "Media", ...readOnly }),
    transcript: (0, import_fields13.json)({ ...readOnly, ui: { ...readOnly.ui, description: "Turns as [{speaker, text, at}]. Card numbers are never spoken on our calls (payment links only)." } }),
    recordingDisclosurePlayed: (0, import_fields13.checkbox)({ defaultValue: false, ...readOnly }),
    emergency: (0, import_fields13.json)({ ...readOnly }),
    summary: systemText(),
    disposition: fixedChoice(CALL_DISPOSITIONS),
    bookable: (0, import_fields13.checkbox)({ defaultValue: false, ...readOnly }),
    lead: (0, import_fields13.relationship)({ ref: "Lead", ...readOnly }),
    job: (0, import_fields13.relationship)({ ref: "Job", ...readOnly }),
    status: lifecycle(["ringing", "ai_answering", "human_answering", "handoff_requested", "completed"]),
    version: versionField(),
    ...trackingFields
  }
});
var MESSAGE_BLOCK_REASONS = ["", "no_consent", "dnc", "quiet_hours", "unregistered_10dlc", "opted_out", "policy_unresolved"];
var Message = (0, import_core13.list)({
  access: governed(["canSendMessages", "canBook", "canDispatch", "canManageLeads"]),
  ui: { labelField: "template", listView: { initialColumns: ["createdAt", "direction", "purpose", "template", "status", "blockedReason"] } },
  fields: {
    conversation: (0, import_fields13.relationship)({ ref: "Conversation.messages", ...readOnly }),
    contactPoint: (0, import_fields13.relationship)({ ref: "ContactPoint", ...readOnly }),
    direction: fixedChoice(["inbound", "outbound"]),
    channel: fixedChoice(["sms", "email"]),
    purpose: fixedChoice(["transactional", "marketing", "internal"]),
    consentPurpose: systemText(),
    template: systemText(),
    body: (0, import_fields13.text)({ access: { read: anyOf("canSendMessages", "canBook", "canDispatch", "canManageLeads"), create: () => false, update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    status: lifecycle(["queued", "sending", "blocked", "sent", "manual", "delivered", "failed", "undeliverable", "received"]),
    blockedReason: fixedChoice(MESSAGE_BLOCK_REASONS),
    guardFindings: (0, import_fields13.json)({ ...readOnly }),
    providerMessageId: systemText({ indexed: true }),
    job: (0, import_fields13.relationship)({ ref: "Job", ...readOnly }),
    visit: (0, import_fields13.relationship)({ ref: "Visit", ...readOnly }),
    sentAt: (0, import_fields13.timestamp)({ ...readOnly }),
    deliveredAt: (0, import_fields13.timestamp)({ ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var Opportunity = (0, import_core13.list)({
  access: governed(["canManageLeads", "canBook", "canPresentEstimates"]),
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "customer", "kind", "stage", "estimatedValueMinor"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    customer: (0, import_fields13.relationship)({ ref: "Customer", ...readOnly }),
    location: (0, import_fields13.relationship)({ ref: "ServiceLocation", ...readOnly }),
    kind: fixedChoice(["replacement", "repair_followup", "membership", "commercial_bid", "upgrade"]),
    source: fixedChoice(["tech_generated", "estimate_followup", "agent_scan", "membership_visit", "inbound"]),
    generatedBy: (0, import_fields13.relationship)({ ref: "Employee", ...readOnly }),
    estimatedValueMinor: minor(),
    reasons: (0, import_fields13.json)({ ...readOnly }),
    stage: lifecycle(["open", "appointment_set", "estimate_presented", "won", "lost"]),
    assignedTo: (0, import_fields13.relationship)({ ref: "Employee", ...readOnly }),
    lead: (0, import_fields13.relationship)({ ref: "Lead", ...readOnly }),
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
var import_core14 = require("@keystone-6/core");
var import_fields14 = require("@keystone-6/core/fields");
var JOB_PRIORITIES = ["emergency", "urgent", "standard", "maintenance"];
var JobType = (0, import_core14.list)({
  access: managed("signedIn", "canManageCompany"),
  ui: { labelField: "name", listView: { initialColumns: ["code", "name", "businessUnit", "priority", "capacityHours", "bookableByAi"] } },
  fields: {
    code: (0, import_fields14.text)({ isIndexed: "unique", validation: { isRequired: true, match: { regex: /^[A-Z0-9-]{3,24}$/, explanation: "Like HVAC-NOCOOL" } } }),
    name: (0, import_fields14.text)({ validation: { isRequired: true } }),
    businessUnit: (0, import_fields14.relationship)({ ref: "BusinessUnit" }),
    trade: choice(["hvac", "plumbing", "electrical"], "hvac"),
    priority: choice(JOB_PRIORITIES, "standard"),
    defaultDurationMinutes: (0, import_fields14.integer)({ defaultValue: 90, validation: { isRequired: true, min: 15, max: 1440 } }),
    capacityHours: qty({ required: true, description: "Tech-hours one booking uses from a window (I-B1)." }),
    crewSize: (0, import_fields14.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1, max: 12 } }),
    requirements: (0, import_fields14.relationship)({ ref: "JobTypeRequirement" }),
    keywords: (0, import_fields14.json)({ defaultValue: [], ui: { description: "Words a caller uses for this problem; jobtype.match ranks by them." } }),
    bookableOnline: (0, import_fields14.checkbox)({ defaultValue: false }),
    bookableByAi: (0, import_fields14.checkbox)({ defaultValue: false }),
    emergencyPolicy: (0, import_fields14.json)({ ui: { description: '{"keywords":[...],"script":"\u2026","page":true}. A match makes the AI CSR give the script and page on-call (SM\xA717).' } }),
    checklistTemplate: (0, import_fields14.relationship)({ ref: "ChecklistTemplate" }),
    refrigerantWork: (0, import_fields14.checkbox)({ defaultValue: false }),
    permitLikely: (0, import_fields14.checkbox)({ defaultValue: false }),
    bookingQuestions: (0, import_fields14.json)({ defaultValue: [] }),
    active: (0, import_fields14.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var LOCAL_TIME2 = { regex: /^([01]\d|2[0-3]):[0-5]\d$/, explanation: "HH:MM, 24-hour" };
var ArrivalWindowTemplate = (0, import_core14.list)({
  access: managed("signedIn", ["canManageCompany", "canDispatch"]),
  ui: { labelField: "label", listView: { initialColumns: ["businessUnit", "weekday", "label", "startLocal", "endLocal", "capacityHours", "active"] } },
  fields: {
    businessUnit: (0, import_fields14.relationship)({ ref: "BusinessUnit" }),
    weekday: (0, import_fields14.integer)({ validation: { isRequired: true, min: 0, max: 6 }, ui: { description: "0 = Sunday" } }),
    startLocal: (0, import_fields14.text)({ validation: { isRequired: true, match: LOCAL_TIME2 } }),
    endLocal: (0, import_fields14.text)({ validation: { isRequired: true, match: LOCAL_TIME2 } }),
    label: (0, import_fields14.text)({ validation: { isRequired: true } }),
    capacityHours: qty({ required: true, description: "Tech-hours sold into this window before the plan factor." }),
    capacityFactor: rate({ description: "Multiplier for the window (1.000000 = as planned)." }),
    active: (0, import_fields14.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var ArrivalWindow = (0, import_core14.list)({
  access: governed(["canBook", "canDispatch", "canViewBoard", "canWorkVisits"]),
  ui: { labelField: "label", listView: { initialColumns: ["businessUnit", "date", "label", "capacityHours", "bookedHours", "closed"] } },
  fields: {
    businessUnit: (0, import_fields14.relationship)({ ref: "BusinessUnit", ...readOnly }),
    template: (0, import_fields14.relationship)({ ref: "ArrivalWindowTemplate", ...readOnly }),
    date: (0, import_fields14.calendarDay)({ validation: { isRequired: true }, ...readOnly }),
    startsAt: (0, import_fields14.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    endsAt: (0, import_fields14.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    label: systemText({ required: true }),
    capacityHours: qty({ required: true }),
    bookedHours: qty({ required: true }),
    closed: (0, import_fields14.checkbox)({ defaultValue: false, ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var CapacityPlan = (0, import_core14.list)({
  access: governed(["canBook", "canDispatch", "canViewBoard"]),
  ui: { labelField: "date" },
  fields: {
    businessUnit: (0, import_fields14.relationship)({ ref: "BusinessUnit", ...readOnly }),
    date: (0, import_fields14.calendarDay)({ validation: { isRequired: true }, ...readOnly }),
    techHoursAvailable: qty({ required: true }),
    reservedEmergencyHours: qty({ required: true }),
    ...trackingFields
  }
});
var CapacityUsage = (0, import_core14.list)({
  access: governed(["canBook", "canDispatch", "canViewBoard"]),
  ui: { labelField: "kind", listView: { initialColumns: ["window", "kind", "hours", "createdAt"] } },
  fields: {
    window: (0, import_fields14.relationship)({ ref: "ArrivalWindow", ...readOnly }),
    kind: fixedChoice(["hold", "visit"]),
    hold: (0, import_fields14.relationship)({ ref: "BookingHold", ...readOnly }),
    visit: (0, import_fields14.relationship)({ ref: "Visit", ...readOnly }),
    hours: qty({ required: true }),
    ...trackingFields
  }
});
var CapacityOverride = (0, import_core14.list)({
  access: governed(["canBook", "canDispatch", "canViewBoard"]),
  ui: { labelField: "reason" },
  fields: {
    window: (0, import_fields14.relationship)({ ref: "ArrivalWindow", ...readOnly }),
    addHours: qty({ required: true }),
    reason: systemText({ required: true }),
    requestedBy: (0, import_fields14.relationship)({ ref: "User", ...readOnly }),
    approval: (0, import_fields14.relationship)({ ref: "ApprovalRequest", ...readOnly }),
    ...trackingFields
  }
});
var BookingHold = (0, import_core14.list)({
  access: governed(["canBook", "canDispatch", "canViewBoard"]),
  ui: { labelField: "publicCode", listView: { initialColumns: ["publicCode", "window", "jobType", "source", "status", "expiresAt"] } },
  fields: {
    publicCode: systemText({ indexed: "unique", required: true }),
    window: (0, import_fields14.relationship)({ ref: "ArrivalWindow", ...readOnly }),
    jobType: (0, import_fields14.relationship)({ ref: "JobType", ...readOnly }),
    hours: qty({ required: true }),
    source: fixedChoice(["csr", "online", "ai_agent"]),
    heldByUser: (0, import_fields14.relationship)({ ref: "User", ...readOnly }),
    heldByAgent: (0, import_fields14.relationship)({ ref: "AgentIdentity", ...readOnly }),
    customerDraft: (0, import_fields14.json)({ ...readOnly }),
    expiresAt: (0, import_fields14.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    status: lifecycle(["held", "converted", "released", "expired"]),
    job: (0, import_fields14.relationship)({ ref: "Job", ...readOnly }),
    visit: (0, import_fields14.relationship)({ ref: "Visit", ...readOnly }),
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
var import_core15 = require("@keystone-6/core");
var import_fields15 = require("@keystone-6/core/fields");
var JOB_STATUSES = ["draft", "booked", "scheduled", "in_progress", "on_hold", "work_complete", "awaiting_inspection", "completed", "closed", "cancelled"];
var JOB_HOLD_REASONS = ["", "parts", "customer_decision", "financing", "permit", "authorization", "access", "other"];
var JOB_CANCEL_REASONS = ["", "customer_request", "duplicate", "no_access", "out_of_area", "scheduling", "weather", "other"];
var Job = (0, import_core15.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: anyOf("canBook", "canDispatch"), delete: sys },
    filter: { query: scoped((userId) => jobFilter(userId)) }
  },
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "customer", "jobType", "priority", "status", "createdAt"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    publicCode: systemText({ indexed: "unique", required: true }),
    customer: (0, import_fields15.relationship)({ ref: "Customer.jobs", ...readOnly }),
    location: (0, import_fields15.relationship)({ ref: "ServiceLocation.jobs", ...readOnly }),
    businessUnit: (0, import_fields15.relationship)({ ref: "BusinessUnit", ...readOnly }),
    jobType: (0, import_fields15.relationship)({ ref: "JobType", ...readOnly }),
    priority: fixedChoice(["emergency", "urgent", "standard", "maintenance"]),
    status: lifecycle(JOB_STATUSES),
    statusBeforeHold: systemText(),
    holdReason: fixedChoice(JOB_HOLD_REASONS),
    holdFollowUpOn: (0, import_fields15.calendarDay)({ ...readOnly }),
    cancelReason: fixedChoice(JOB_CANCEL_REASONS),
    summary: (0, import_fields15.text)({ ui: { description: "What the customer reported, in their words." } }),
    source: fixedChoice(["csr", "online", "ai_agent", "tech_generated", "membership", "import"]),
    lead: (0, import_fields15.relationship)({ ref: "Lead", ...readOnly }),
    recallOf: (0, import_fields15.relationship)({ ref: "Job", ...readOnly }),
    payers: (0, import_fields15.relationship)({ ref: "JobPayer.job", many: true, ...readOnly }),
    poNumber: (0, import_fields15.text)(),
    nteMinor: minor({ description: "Not-to-exceed authorised by the payer, in cents." }),
    visits: (0, import_fields15.relationship)({ ref: "Visit.job", many: true, ...readOnly }),
    workLines: (0, import_fields15.relationship)({ ref: "WorkLine.job", many: true, ...readOnly }),
    bookedBy: (0, import_fields15.relationship)({ ref: "User", ...readOnly }),
    bookedByAgent: (0, import_fields15.relationship)({ ref: "AgentIdentity", ...readOnly }),
    tags: (0, import_fields15.relationship)({ ref: "Tag", many: true }),
    completedAt: (0, import_fields15.timestamp)({ ...readOnly }),
    closedAt: (0, import_fields15.timestamp)({ ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var JobPayer = (0, import_core15.list)({
  access: governed(["canBook", "canDispatch", "canManageInvoices"]),
  ui: { labelField: "payerKind" },
  fields: {
    job: (0, import_fields15.relationship)({ ref: "Job.payers", ...readOnly }),
    payerKind: fixedChoice(["customer", "home_warranty", "commercial_payer", "manufacturer"]),
    payerCustomer: (0, import_fields15.relationship)({ ref: "Customer", ...readOnly }),
    authorizationRef: systemText(),
    sharePolicy: fixedChoice(["all", "up_to_authorized", "specific_lines"]),
    ...trackingFields
  }
});
var VISIT_STATUSES = ["unassigned", "scheduled", "dispatched", "en_route", "on_site", "working", "paused", "done", "cancelled", "no_access"];
var Visit = (0, import_core15.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: sys, delete: sys },
    filter: { query: scoped(visitFilter) }
  },
  ui: { labelField: "ref", listView: { initialColumns: ["ref", "job", "window", "plannedStart", "status"] } },
  fields: {
    ref: systemText({ indexed: "unique", required: true }),
    job: (0, import_fields15.relationship)({ ref: "Job.visits", ...readOnly }),
    window: (0, import_fields15.relationship)({ ref: "ArrivalWindow", ...readOnly }),
    plannedStart: (0, import_fields15.timestamp)({ ...readOnly }),
    plannedDurationMinutes: (0, import_fields15.integer)({ ...readOnly }),
    capacityHours: qty({ required: true }),
    status: lifecycle(VISIT_STATUSES),
    cancelReason: systemText(),
    assignments: (0, import_fields15.relationship)({ ref: "VisitAssignment.visit", many: true, ...readOnly }),
    statusEvents: (0, import_fields15.relationship)({ ref: "VisitStatusEvent.visit", many: true, ...readOnly }),
    actualArrivalAt: (0, import_fields15.timestamp)({ ...readOnly }),
    actualDoneAt: (0, import_fields15.timestamp)({ ...readOnly }),
    etaMinutes: (0, import_fields15.integer)({ ...readOnly }),
    customerSummaryDraft: systemText(),
    needsReview: (0, import_fields15.checkbox)({ defaultValue: false, ...readOnly, ui: { ...readOnly.ui, description: "An out-of-order device event arrived; a dispatcher should look (I-D3)." } }),
    version: versionField(),
    ...trackingFields
  }
});
var VisitAssignment = (0, import_core15.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: sys, delete: sys },
    filter: { query: scoped((userId) => ({ employee: { user: { id: { equals: userId } } } })) }
  },
  ui: { labelField: "role", listView: { initialColumns: ["visit", "employee", "role", "active", "assignedAt"] } },
  fields: {
    visit: (0, import_fields15.relationship)({ ref: "Visit.assignments", ...readOnly }),
    employee: (0, import_fields15.relationship)({ ref: "Employee", ...readOnly }),
    role: fixedChoice(["lead", "helper", "sales", "apprentice"]),
    assignedAt: (0, import_fields15.timestamp)({ ...readOnly }),
    assignedBy: (0, import_fields15.relationship)({ ref: "User", ...readOnly }),
    assignedByAgent: (0, import_fields15.relationship)({ ref: "AgentIdentity", ...readOnly }),
    recommendation: (0, import_fields15.relationship)({ ref: "DispatchRecommendation", ...readOnly }),
    overrideReason: fixedChoice(["", "customer_request", "skill", "continuity", "geography", "fairness", "other"]),
    eligibility: (0, import_fields15.relationship)({ ref: "EligibilityEvaluation", ...readOnly }),
    active: (0, import_fields15.checkbox)({ defaultValue: true, ...readOnly }),
    endedAt: (0, import_fields15.timestamp)({ ...readOnly }),
    ...trackingFields
  }
});
var VisitStatusEvent = (0, import_core15.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: sys, delete: sys },
    filter: { query: scoped((userId) => ({ visit: visitFilter(userId) })) }
  },
  ui: { labelField: "toStatus", listView: { initialColumns: ["visit", "fromStatus", "toStatus", "kind", "occurredAt", "clientRecordedAt"] } },
  fields: {
    visit: (0, import_fields15.relationship)({ ref: "Visit.statusEvents", ...readOnly }),
    employee: (0, import_fields15.relationship)({ ref: "Employee", ...readOnly }),
    actorUser: (0, import_fields15.relationship)({ ref: "User", ...readOnly }),
    fromStatus: systemText({ required: true }),
    toStatus: systemText({ required: true }),
    kind: fixedChoice(["transition", "correction"]),
    occurredAt: (0, import_fields15.timestamp)({ validation: { isRequired: true }, ...readOnly }),
    clientRecordedAt: (0, import_fields15.timestamp)({ ...readOnly }),
    idempotencyKey: systemText({ indexed: "unique", required: true }),
    lat: geo({ ...readOnly }),
    lng: geo({ ...readOnly }),
    deviceId: systemText(),
    note: systemText(),
    ...trackingFields
  }
});
var DispatchRecommendation = (0, import_core15.list)({
  access: immutable(["canDispatch", "canViewBoard"]),
  ui: { labelField: "decision", listView: { initialColumns: ["visit", "decision", "modelRef", "createdAt"] } },
  fields: {
    visit: (0, import_fields15.relationship)({ ref: "Visit", ...readOnly }),
    rankedCandidates: (0, import_fields15.json)({ ...readOnly }),
    inputsHash: systemText({ required: true }),
    features: (0, import_fields15.json)({ ...readOnly, ui: { ...readOnly.ui, description: "The scoring features used. Revenue prediction is not one of them until reviewed." } }),
    modelRef: systemText({ required: true }),
    generatedBy: (0, import_fields15.relationship)({ ref: "AgentIdentity", ...readOnly }),
    requestedBy: (0, import_fields15.relationship)({ ref: "User", ...readOnly }),
    decision: lifecycle(["proposed", "applied", "overridden", "expired"]),
    decidedBy: (0, import_fields15.relationship)({ ref: "User", ...readOnly }),
    decidedAt: (0, import_fields15.timestamp)({ ...readOnly }),
    version: versionField(),
    ...trackingFields
  }
});
var ChecklistTemplate = (0, import_core15.list)({
  access: managed("signedIn", ["canManageCompany", "canDispatch"]),
  ui: { labelField: "name" },
  fields: {
    name: (0, import_fields15.text)({ validation: { isRequired: true } }),
    items: (0, import_fields15.json)({ defaultValue: [], ui: { description: '[{"key":"static_pressure","label":"Total static pressure","type":"reading","unit":"inWC","required":true}]' } }),
    templateVersion: (0, import_fields15.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1 } }),
    required: (0, import_fields15.checkbox)({ defaultValue: true }),
    ...trackingFields
  }
});
var ChecklistResponse = (0, import_core15.list)({
  access: {
    operation: { query: officeOrTech(), create: sys, update: sys, delete: sys },
    filter: { query: scoped((userId) => ({ visit: visitFilter(userId) })) }
  },
  ui: { labelField: "completedAt" },
  fields: {
    visit: (0, import_fields15.relationship)({ ref: "Visit", ...readOnly }),
    template: (0, import_fields15.relationship)({ ref: "ChecklistTemplate", ...readOnly }),
    templateVersion: (0, import_fields15.integer)({ ...readOnly }),
    answers: (0, import_fields15.json)({ ...readOnly }),
    completedBy: (0, import_fields15.relationship)({ ref: "User", ...readOnly }),
    completedAt: (0, import_fields15.timestamp)({ ...readOnly }),
    ...trackingFields
  }
});
var WorkLine = (0, import_core15.list)({
  access: {
    operation: { query: officeOrTech(["canManageInvoices"]), create: sys, update: sys, delete: sys },
    filter: { query: scoped((userId) => ({ job: jobFilter(userId) }), ["canManageInvoices"]) }
  },
  ui: { labelField: "description", listView: { initialColumns: ["job", "description", "quantity", "unitPriceMinor", "amountMinor", "status"] } },
  fields: {
    job: (0, import_fields15.relationship)({ ref: "Job.workLines", ...readOnly }),
    source: fixedChoice(["estimate_line", "pricebook", "manual", "change_order", "membership_benefit"]),
    description: systemText({ required: true }),
    snapshot: (0, import_fields15.json)({ ...readOnly }),
    quantity: qty({ required: true }),
    uom: systemText(),
    unitPriceMinor: minor({ defaultValue: 0n }),
    amountMinor: minor({ defaultValue: 0n }),
    taxCategory: fixedChoice(["labor", "material", "equipment", "fee", "disposal", "permit_passthrough", "warranty_reimbursed", "membership", "maintenance"]),
    trade: fixedChoice(["hvac", "plumbing", "electrical", "general"]),
    cancellationClass: fixedChoice(["requested_repair", "necessary_replacement_parts", "additional_goods_services"]),
    status: lifecycle(["planned", "completed", "removed", "cancelled_by_buyer"]),
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
  ...listsOf(jobs_exports)
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

// features/keystone/lib/errors.ts
var DomainError = class extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
};
var isDomainError = (error) => error instanceof DomainError;
var Codes = {
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

// features/keystone/mutations/op.ts
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
var principalKey = (actor) => actor.kind === "user" ? `user:${actor.userId}` : actor.kind === "agent" ? `agent:${actor.agentId}` : `system:${actor.name}`;
var actorUserId = (actor) => actor.kind === "user" ? actor.userId : null;
var actorAgentId = (actor) => actor.kind === "agent" ? actor.agentId : null;

// features/keystone/lib/agentGate.ts
var import_node_crypto3 = require("node:crypto");

// features/keystone/lib/canonical.ts
var import_node_crypto2 = require("node:crypto");

// features/keystone/lib/decimal.ts
var import_decimal = __toESM(require("decimal.js"));
var Decimal = import_decimal.default.clone({
  precision: 60,
  rounding: import_decimal.default.ROUND_HALF_UP,
  toExpNeg: -40,
  toExpPos: 60
});
var Scale = { qty: 4, rate: 6, geo: 6 };
var DECIMAL_TEXT = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
function dec(value) {
  if (value instanceof Decimal) return value;
  if (typeof value === "bigint") return new Decimal(value.toString());
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error(`Refusing float ${value}: pass the exact decimal as a string`);
    return new Decimal(value);
  }
  const text15 = String(value).trim();
  if (!DECIMAL_TEXT.test(text15)) throw new Error(`Not a decimal number: ${JSON.stringify(text15).slice(0, 40)}`);
  return new Decimal(text15);
}
function toScale(value, scale, rounding = Decimal.ROUND_HALF_UP) {
  const places = typeof scale === "number" ? scale : Scale[scale];
  return dec(value).toDecimalPlaces(places, rounding).toFixed(places);
}
var plain = (value) => dec(value).toFixed();
var ZERO = new Decimal(0);
var ONE = new Decimal(1);
var BPS = new Decimal(1e4);
var decSum = (values) => values.map(dec).reduce((a, b) => a.plus(b), ZERO);

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
var canonicalJson = (value) => JSON.stringify(canonicalize(value));
var sha256 = (text15) => (0, import_node_crypto2.createHash)("sha256").update(text15).digest("hex");
var payloadHash = (value) => sha256(canonicalJson(value));
var toJsonValue = (value) => canonicalize(value);

// features/keystone/lib/agentGate.ts
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
    where: { oauthApp: { clientId: { equals: marker.clientId } } },
    select: { id: true, name: true, status: true, killSwitch: true, ownerId: true, grants: { where: { status: "active", autonomy: { not: "disabled" }, revokedAt: null }, select: { tool: true } } }
  });
  if (!agent) return person;
  if (agent.status !== "active" || agent.killSwitch) throw new DomainError(Codes.AGENT_DISABLED, `The agent ${agent.name} is ${agent.killSwitch ? "stopped by its kill switch" : agent.status}.`);
  return { kind: "agent", agentId: agent.id, ownerUserId: agent.ownerId, name: agent.name, scopes: new Set(agent.grants.map((g) => g.tool)) };
}

// features/keystone/lib/db.ts
async function advisoryLock(tx, key2) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key2}, 0))`;
}
var MODEL_NAME = /^[A-Z][A-Za-z0-9]*$/;
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
var TRANSACTION_OPTIONS = {
  get maxWait() {
    return Number.parseInt(process.env.HS_TX_MAX_WAIT_MS ?? "", 10) || 15e3;
  },
  timeout: 6e4
};

// features/keystone/lib/idempotency.ts
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
var auditHash = (prevHash, row) => sha256(`${prevHash}
${canonicalJson(auditHashBody(row))}`);
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
      const hash = auditHash(prevHash, {
        ...row,
        reason: row.reason || null,
        requestId: row.requestId || null,
        actorUserId: row.actorUserId ?? null,
        actorAgentId: row.actorAgentId ?? null,
        approverId: row.approverId ?? null
      });
      if (hash !== row.hash) return { ok: false, count, lastSeq: row.seq - 1, lastHash: prevHash, brokenAtSeq: row.seq, problem: "content does not match its hash" };
      prevHash = row.hash;
      expectedSeq += 1;
      count += 1;
    }
  }
  return { ok: true, count, lastSeq: expectedSeq - 1, lastHash: prevHash };
}

// features/keystone/lib/unitOfWork.ts
var UnitOfWork = class {
  constructor(tx, now, requestId) {
    this.tx = tx;
    this.now = now;
    this.requestId = requestId;
    this.audits = [];
    this.outbox = [];
  }
  audit(event) {
    this.audits.push({ requestId: this.requestId, ...event });
  }
  emit(message) {
    this.outbox.push(message);
  }
  pendingAuditCount() {
    return this.audits.length;
  }
};
async function flushOutbox(tx, messages, now) {
  for (const message of messages) {
    const payload = toJsonValue(message.payload);
    const dedupeKey = message.dedupeKey ?? `${message.topic}:${message.aggregateType}:${message.aggregateId}:${sha256(canonicalJson(payload))}`;
    await tx.outboxMessage.upsert({
      where: { dedupeKey },
      create: {
        topic: message.topic,
        aggregateType: message.aggregateType,
        aggregateId: message.aggregateId,
        dedupeKey,
        payload,
        status: "pending",
        nextAttemptAt: message.availableAt ?? now,
        partitionKey: message.partitionKey ?? ""
      },
      update: {}
    });
  }
}
async function runInTransaction(db, work, options = {}) {
  return db.$transaction(async (tx) => {
    const uow = new UnitOfWork(tx, options.now ?? /* @__PURE__ */ new Date(), options.requestId ?? null);
    const result = await work(uow);
    await flushOutbox(tx, uow.outbox, uow.now);
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
function covered(calendar, date) {
  if (date > calendar.coverageThrough) throw new Error(`${calendar.code} has no verified schedule for ${date}`);
}
function isBusinessDay(calendar, date) {
  assertDate(date);
  covered(calendar, date);
  return !calendar.weekendDays.includes(weekday(date)) && !calendar.holidays.has(date);
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

// features/keystone/lib/cas.ts
var COLUMN = /^[a-z][A-Za-z0-9]*$/;
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
    /** Cancel until midnight of this business day after the transaction. */
    businessDays: import_zod.z.number().int().min(1).max(15),
    calendar: import_zod.z.string().min(1),
    /** Situations where the right does not arise; evaluated per sold line. */
    exclusions: import_zod.z.array(import_zod.z.object({ code: import_zod.z.string(), description: import_zod.z.string(), perLine: import_zod.z.boolean().default(false) })),
    /** Trade-specific exemptions, e.g. the Texas ACR exemption for consumer-initiated transactions. */
    exemptions: import_zod.z.array(import_zod.z.object({ code: import_zod.z.string(), trades: import_zod.z.array(trade).min(1), when: import_zod.z.enum(["consumer_initiated"]), except: import_zod.z.array(import_zod.z.string()).default([]) })).default([]),
    emergencyWaiver: import_zod.z.object({ allowed: import_zod.z.boolean(), handwritten: import_zod.z.boolean(), signedAndDated: import_zod.z.boolean() }),
    noticeTemplate: import_zod.z.string().min(1)
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
  { id: "seed_role_owner", name: "Owner", description: "Everything except break-glass. Break-glass is never on a default role.", permissions: all(["canBreakGlass"]) },
  { id: "seed_role_gm", name: "General Manager", description: "Runs the shop day to day and approves money and policy changes.", permissions: all(["canBreakGlass", "canManageRoles", "canRunPayroll"]) },
  { id: "seed_role_csr", name: "CSR", description: "Answers calls, books jobs, takes payments and sells memberships.", permissions: [...BASE, "canManageCustomers", "canReadCustomerPII", "canManageLeads", "canBook", "canViewBoard", "canTakePayments", "canSellMemberships", "canOfferFinancing", "canSendMessages"] },
  { id: "seed_role_dispatcher", name: "Dispatcher", description: "Owns the board: assigns, reassigns and overbooks within limits.", permissions: [...BASE, "canManageCustomers", "canReadCustomerPII", "canRevealAccessSecret", "canBook", "canOverbook", "canDispatch", "canViewBoard", "canSendMessages"] },
  { id: "seed_role_technician", name: "Technician", description: "Works assigned visits in the field app: estimates, payments, equipment and refrigerant entries.", permissions: ["canAccessDashboard", "canWorkVisits", "canRevealAccessSecret", "canPresentEstimates", "canSellEstimates", "canTakePayments", "canOfferFinancing", "canSellMemberships", "canManageEquipment", "canManageRefrigerant"] },
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
  { id: "seed_user_whitfield", name: "Dana Whitfield", email: "dana.whitfield@example.com", title: "Owner", phone: "+15125550101", roleId: "seed_role_owner" },
  { id: "seed_user_ortega", name: "Marcus Ortega", email: "marcus.ortega@example.com", title: "General Manager", phone: "+15125550102", roleId: "seed_role_gm" },
  { id: "seed_user_raman", name: "Priya Raman", email: "priya.raman@example.com", title: "Customer Service Representative", phone: "+15125550103", roleId: "seed_role_csr" },
  { id: "seed_user_mendoza", name: "Luis Mendoza", email: "luis.mendoza@example.com", title: "Customer Service Representative", phone: "+15125550104", roleId: "seed_role_csr" },
  { id: "seed_user_tran", name: "Kelsey Tran", email: "kelsey.tran@example.com", title: "Customer Service Representative", phone: "+15125550105", roleId: "seed_role_csr" },
  { id: "seed_user_brooks", name: "Andre Brooks", email: "andre.brooks@example.com", title: "Dispatcher", phone: "+15125550106", roleId: "seed_role_dispatcher" },
  { id: "seed_user_reyes", name: "Tom\xE1s Reyes", email: "tomas.reyes@example.com", title: "Warehouse Lead", phone: "+15125550107", roleId: "seed_role_warehouse" },
  { id: "seed_user_cole", name: "Hannah Cole", email: "hannah.cole@example.com", title: "Accountant", phone: "+15125550108", roleId: "seed_role_accounting" },
  { id: "seed_user_kim", name: "Rachel Kim", email: "rachel.kim@example.com", title: "Comfort Advisor", phone: "+15125550109", roleId: "seed_role_comfort_advisor" }
];
var BRAND = { id: "seed_brand_summit", name: "Summit Plumbing & Air", phone: "+15125550100", email: "service@example.com", website: "https://summit.example.com" };
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
var ECFR_429 = "https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-429";
var TX_601 = "https://statutes.capitol.texas.gov/Docs/BC/htm/BC.601.htm";
var TX_1302 = "https://statutes.capitol.texas.gov/Docs/OC/htm/OC.1302.htm";
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
    const rows = await tx.approvalPolicy.createManyAndReturn({ data: newPolicies.map((policy) => ({ action: policy.action, description: policy.description, requiredPermission: policy.requiredPermission, minApprovals: 1, expiresAfterMinutes: policy.expiresAfterMinutes, thresholdMinor: policy.thresholdMinor ?? null })), select: { id: true, action: true, requiredPermission: true } });
    for (const row of rows) auditCreate(uow, actor, "ApprovalPolicy", row.id, "approval_policy.created", { action: row.action, requiredPermission: row.requiredPermission }, { metadata: { seed: true } });
    created.approvalPolicies = rows.length;
  }
  for (const pack of POLICY_PACKS) {
    const parsed2 = parsePolicyRules(pack.kind, pack.version.rules);
    if (!parsed2.success) throw new Error(`Seed policy ${pack.code} does not match its schema: ${parsed2.error.issues[0]?.message}`);
  }
  const havePacks = new Set((await tx.policyPack.findMany({ where: { id: { in: POLICY_PACKS.map((p) => p.id) } }, select: { id: true } })).map((r) => r.id));
  const haveVersions = new Set((await tx.policyVersion.findMany({ where: { id: { in: POLICY_PACKS.map((p) => p.version.id) } }, select: { id: true } })).map((r) => r.id));
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
  const bindings = POLICY_PACKS.filter((p) => !haveBindings.has(p.binding.id));
  if (bindings.length) {
    await tx.policyBinding.createMany({ data: bindings.map((pack) => ({ id: pack.binding.id, packId: pack.id, scope: pack.binding.scope, scopeValue: pack.binding.scopeValue, priority: pack.binding.priority, status: "active" })) });
    for (const pack of bindings) auditCreate(uow, actor, "PolicyBinding", pack.binding.id, "policy_binding.created", pack.binding, { metadata: { seed: true } });
    created.policyBindings = bindings.length;
  }
  return created;
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
  return verifyAuditChain(context.prisma);
}

// features/keystone/lib/separationOfDuties.ts
var SELF_APPROVAL_MESSAGE = "You can't approve your own request.";
var AGENT_APPROVAL_MESSAGE = "An agent can propose but never approve.";
function assertCanDecide(actor, requesterUserId, requesterAgentOwnerId, strictAgentOwner = true) {
  if (actor.kind !== "user") throw new DomainError(Codes.AGENT_CANNOT_APPROVE, AGENT_APPROVAL_MESSAGE);
  if (requesterUserId && requesterUserId === actor.userId) throw new DomainError(Codes.SELF_APPROVAL, SELF_APPROVAL_MESSAGE);
  if (strictAgentOwner && requesterAgentOwnerId && requesterAgentOwnerId === actor.userId) throw new DomainError(Codes.SELF_APPROVAL, "You can't approve a proposal made by your own agent.");
}

// features/keystone/lib/approval.ts
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
  uow.emit({ topic: "notify.approval", aggregateType: "ApprovalRequest", aggregateId: created.id, payload: { action: input.action, requiredPermission }, dedupeKey: `notify.approval:${created.id}` });
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

// features/keystone/lib/approvalAppliers.ts
var appliers = /* @__PURE__ */ new Map();
function registerApplier(action, apply, options = {}) {
  if (appliers.has(action)) throw new Error(`Applier for ${action} already registered`);
  appliers.set(action, { apply, applyOnApprove: options.applyOnApprove ?? true });
}
function applierFor(action) {
  return appliers.get(action) ?? null;
}

// features/keystone/lib/companyControls.ts
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
  const actor = await actorFor(context);
  requirePermission(actor, "canAccessDashboard");
  if (args.decision !== "approve" && args.decision !== "reject") throw new DomainError(Codes.INVALID_INPUT, "Decision must be approve or reject.");
  if (args.decision === "reject" && !args.reason?.trim()) throw new DomainError(Codes.INVALID_INPUT, "Say why you are rejecting it.", { field: "reason" });
  const result = await command(context.prisma, { name: "approval.decide", actor, idempotencyKey: args.idempotencyKey, params: { requestId: args.requestId, decision: args.decision, reason: args.reason ?? "", expectedVersion: args.expectedVersion } }, async (uow) => {
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

// features/keystone/domain/policy.ts
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

// features/keystone/mutations/policy.ts
async function resolvePolicyQuery(_root, args, context) {
  const actor = await actorFor(context);
  await authorizeOperation(context.prisma, actor, "policy.resolve", ["canAccessDashboard"], args);
  if (!POLICY_KINDS.includes(args.kind)) throw new DomainError(Codes.INVALID_INPUT, `Unknown policy kind ${args.kind}.`, { field: "kind" });
  return resolvePolicyFromDb(context.prisma, args.kind, { state: args.state, county: args.county, city: args.city, zip: args.zip, branchId: args.branchId }, args.on);
}

// features/keystone/lib/sequence.ts
var import_node_crypto5 = require("node:crypto");
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
  const bytes = (0, import_node_crypto5.randomBytes)(groups * 4);
  const chars = Array.from(bytes, (byte) => CROCKFORD[byte % 32]);
  const parts = Array.from({ length: groups }, (_, i) => chars.slice(i * 4, i * 4 + 4).join(""));
  return `${prefix}-${parts.join("-")}`;
}

// features/keystone/domain/capacity.ts
function windowsForDate(templates, date, timeZone, isOpen) {
  assertDate(date);
  if (!isOpen(date)) return [];
  const day2 = weekday(date);
  return templates.filter((t) => t.active && t.weekday === day2).map((t) => {
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

// features/keystone/domain/contact.ts
var import_node_crypto6 = require("node:crypto");
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
var contactHash = (normalized) => (0, import_node_crypto6.createHash)("sha256").update(`contact:${normalized}`).digest("hex");
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
async function loadBranchCalendar(db, businessUnitId) {
  const bu = await db.businessUnit.findUnique({ where: { id: businessUnitId }, select: { id: true, capacityEnabled: true, branch: { select: { timeZone: true, calendar: { select: { code: true, weekendDays: true, coverageThrough: true, exceptions: { where: { kind: { in: ["holiday", "closure"] } }, select: { date: true } }, composedOf: { select: { code: true, exceptions: { select: { date: true } } } } } } } } } });
  if (!bu) throw new DomainError(Codes.NOT_FOUND, "Business unit not found.");
  const timeZone = bu.branch?.timeZone ?? "America/Chicago";
  const cal = bu.branch?.calendar;
  const spec = cal ? { code: cal.code, timeZone, weekendDays: cal.weekendDays ?? [0], holidays: new Set(cal.exceptions.map((e) => e.date.toISOString().slice(0, 10))), coverageThrough: cal.coverageThrough ? cal.coverageThrough.toISOString().slice(0, 10) : US_FEDERAL.coverageThrough } : { code: "DEFAULT", timeZone, weekendDays: [0], holidays: new Set(FEDERAL_HOLIDAYS.map((h) => h.date)), coverageThrough: US_FEDERAL.coverageThrough };
  const isOpen = (date) => date <= spec.coverageThrough && isBusinessDay(spec, date);
  return { timeZone, isOpen, capacityEnabled: bu.capacityEnabled };
}
async function materializeWindows(db, actor, args) {
  await authorizeOperation(db, actor, "capacity.materialize", ["canDispatch", "canManageCompany"], args);
  if (!Number.isSafeInteger(args.days) || args.days < 1 || args.days > 120) throw new DomainError(Codes.INVALID_INPUT, "Materialise between 1 and 120 days.", { field: "days" });
  const templates = await db.arrivalWindowTemplate.findMany({ where: { active: true, ...args.businessUnitIds?.length ? { businessUnitId: { in: args.businessUnitIds } } : {} } });
  const byBu = /* @__PURE__ */ new Map();
  for (const t of templates) if (t.businessUnitId) byBu.set(t.businessUnitId, [...byBu.get(t.businessUnitId) ?? [], t]);
  const planned = [];
  for (const [buId, list14] of byBu) {
    const branch = await loadBranchCalendar(db, buId);
    if (!branch.capacityEnabled) continue;
    const specs = list14.map((t) => ({ id: t.id, businessUnitId: buId, weekday: t.weekday, startLocal: t.startLocal, endLocal: t.endLocal, label: t.label, capacityHours: t.capacityHours.toString(), capacityFactor: t.capacityFactor?.toString() ?? null, active: t.active }));
    for (const date of dateRange(args.from, args.days)) {
      for (const w of windowsForDate(specs, date, branch.timeZone, branch.isOpen)) {
        planned.push({ businessUnitId: buId, templateId: w.templateId, date: /* @__PURE__ */ new Date(`${date}T00:00:00Z`), startsAt: w.startsAt, endsAt: w.endsAt, label: w.label, capacityHours: w.capacityHours, bookedHours: "0" });
      }
    }
  }
  const result = await command(db, { name: "capacity.materialize", actor, idempotencyKey: args.idempotencyKey, params: args }, async (uow) => {
    const created = planned.length ? await uow.tx.arrivalWindow.createMany({ data: planned, skipDuplicates: true }) : { count: 0 };
    uow.audit({ eventType: "capacity.windows_materialized", entityType: "ArrivalWindow", entityId: `${args.from}+${args.days}`, actorUserId: actorUserId(actor), actorAgentId: actorAgentId(actor), after: { planned: planned.length, created: created.count } });
    await recordAgentAction(uow, actor, { tool: "capacity.materialize", idempotencyKey: args.idempotencyKey, inputs: args, output: { created: created.count } });
    return { planned: planned.length, created: created.count };
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
    const messageId = await queueTransactionalSms(uow, actor, { customerId: customer.id, jobId: job.id, visitId: visit.id, template: "booking_confirmation", body: `Summit Plumbing & Air: you're booked for ${jobType.name} on ${window2.date.toISOString().slice(0, 10)}, arrival ${window2.label}. Ref ${job.publicCode}. Reply STOP to opt out.` });
    const value = { jobId: job.id, ref: job.ref, publicCode: job.publicCode, visitId: visit.id, windowId: window2.id, window: window2.label, date: window2.date.toISOString().slice(0, 10), startsAt: window2.startsAt.toISOString(), endsAt: window2.endsAt.toISOString(), customerId: customer.id, locationId: location.id, confirmationMessageId: messageId };
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
async function queueTransactionalSms(uow, actor, spec) {
  const point = await uow.tx.contactPoint.findFirst({ where: { kind: "mobile", contact: { customerId: spec.customerId } }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { id: true } });
  if (!point) return null;
  const message = await uow.tx.message.create({
    data: { contactPointId: point.id, direction: "outbound", channel: "sms", purpose: "transactional", consentPurpose: "transactional_sms", template: spec.template, body: spec.body, status: "queued", jobId: spec.jobId ?? null, visitId: spec.visitId ?? null },
    select: { id: true }
  });
  auditCreate(uow, actor, "Message", message.id, "message.queued", { template: spec.template, purpose: "transactional", jobId: spec.jobId ?? null });
  uow.emit({ topic: "message.send", aggregateType: "Message", aggregateId: message.id, payload: { messageId: message.id }, dedupeKey: `message.send:${message.id}`, partitionKey: "messaging" });
  return message.id;
}

// features/keystone/services/dispatch.ts
var import_node_crypto7 = require("node:crypto");

// features/keystone/domain/eligibility.ts
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
  const state = loc?.state ? `US-${loc.state}` : "US-TX";
  return { state, zip: loc?.postalCode ?? null, city: loc?.city ? `${state}-${loc.city.toUpperCase().replace(/\s+/g, "-")}` : null };
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
    uow.emit({ topic: "notify.tech_assignment", aggregateType: "Visit", aggregateId: ctx.id, payload: { visitId: ctx.id, employeeIds: ids, reassign }, partitionKey: "messaging" });
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
    const data = {};
    if (args.to === "on_site") data.actualArrivalAt = clientAt ?? uow.now;
    if (args.to === "done") data.actualDoneAt = clientAt ?? uow.now;
    if (args.to === "cancelled") data.cancelReason = args.reason;
    const version = await casUpdate(uow, { model: "Visit", id: ctx.id, version: ctx.version, from: [ctx.status], to: args.to, actor, eventType: `visit.${args.to}`, reason: args.reason ?? null, data });
    await tx.visitStatusEvent.create({ data: { visitId: ctx.id, actorUserId: userId, fromStatus: ctx.status, toStatus: args.to, kind: "transition", occurredAt: uow.now, clientRecordedAt: clientAt, idempotencyKey: deviceKey ?? `server:${idempotencyKey}`, lat: args.lat ?? null, lng: args.lng ?? null, note: args.reason ?? "" } });
    if (args.to === "cancelled") await freeVisitCapacity(uow, ctx);
    if (args.to === "dispatched") uow.emit({ topic: "push.dispatch", aggregateType: "Visit", aggregateId: ctx.id, payload: { visitId: ctx.id }, partitionKey: "messaging" });
    if (args.to === "en_route" && ctx.job?.customerId) {
      const tech = await tx.visitAssignment.findFirst({ where: { visitId: ctx.id, active: true, role: "lead" }, select: { employee: { select: { firstName: true } } } });
      await queueTransactionalSms(uow, actor, { customerId: ctx.job.customerId, jobId: ctx.job.id, visitId: ctx.id, template: "on_the_way", body: `Summit Plumbing & Air: ${tech?.employee?.firstName || "Your technician"} is on the way for your ${ctx.window?.label ?? ""} appointment. Reply STOP to opt out.` });
    }
    if (ctx.job) await rollJob(uow, actor, ctx.job.id, args.to === "no_access" ? "access" : null);
    return { visitId: ctx.id, status: args.to, version };
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
  const inputsHash = (0, import_node_crypto7.createHash)("sha256").update(canonicalJson({ visitId: ctx.id, visitVersion: ctx.version, candidates })).digest("hex");
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
async function requeueMessage(db, actor, args) {
  await authorizeOperation(db, actor, "message.requeue", ["canSendMessages", "canDispatch"], args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "Only a person can re-send a blocked message.");
  const result = await command(db, { name: "message.requeue", actor, idempotencyKey: args.idempotencyKey, params: { messageId: args.messageId, expectedVersion: args.expectedVersion }, now: args.now }, async (uow) => {
    const version = await casUpdate(uow, { model: "Message", id: args.messageId, version: args.expectedVersion, from: ["blocked", "failed"], to: "queued", actor, eventType: "message.requeued", data: { blockedReason: "" } });
    uow.emit({ topic: "message.send", aggregateType: "Message", aggregateId: args.messageId, payload: { messageId: args.messageId }, dedupeKey: `message.send:${args.messageId}:${version}`, partitionKey: "messaging" });
    return { messageId: args.messageId, status: "queued", version };
  });
  return { replay: result.replay, ...result.value };
}
async function markMessageSent(db, actor, args) {
  await authorizeOperation(db, actor, "message.mark_sent", ["canSendMessages", "canDispatch", "canBook"], args);
  if (actor.kind === "agent") throw new DomainError(Codes.NOT_AUTHORIZED, "Only a person can confirm a hand-sent text.");
  const result = await command(db, { name: "message.mark_sent", actor, idempotencyKey: args.idempotencyKey, params: { messageId: args.messageId, expectedVersion: args.expectedVersion }, now: args.now }, async (uow) => {
    const version = await casUpdate(uow, { model: "Message", id: args.messageId, version: args.expectedVersion, from: ["manual"], to: "sent", actor, eventType: "message.sent_by_hand", data: { sentAt: uow.now } });
    return { messageId: args.messageId, status: "sent", version };
  });
  return { replay: result.replay, ...result.value };
}

// features/keystone/lib/secretBox.ts
var import_node_crypto8 = require("node:crypto");
function key(version = 1) {
  const material = process.env.SECRET_BOX_KEY || process.env.SESSION_SECRET;
  if (!material) {
    if (process.env.NODE_ENV === "production") throw new Error("SECRET_BOX_KEY is not set");
    return (0, import_node_crypto8.createHash)("sha256").update("openfront-home-services:development-secret-box").digest();
  }
  return (0, import_node_crypto8.createHash)("sha256").update(`openfront-home-services:secret-box:v${version}:${material}`).digest();
}
async function sealSecret(tx, purpose, plaintext, createdById) {
  if (!plaintext || plaintext.length > 4096) throw new Error("Secret must be 1-4096 characters");
  const iv = (0, import_node_crypto8.randomBytes)(12);
  const cipher = (0, import_node_crypto8.createCipheriv)("aes-256-gcm", key(1), iv);
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
  const decipher = (0, import_node_crypto8.createDecipheriv)("aes-256-gcm", key(row.keyVersion ?? 1), Buffer.from(row.iv, "base64"));
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
      data: { ref, source: args.source, externalId: args.externalId ?? "", campaignId: args.campaignId ?? null, trackingNumberId: args.trackingNumberId ?? null, customerId: match?.contact?.customerId ?? null, contactName: args.contactName ?? "", phoneE164: phone ?? "", email: email ?? "", requestedJobTypeId: args.requestedJobTypeId ?? null, summary: args.summary ?? "", status: "new", respondDueAt: new Date(now.getTime() + slaMinutes * 6e4) },
      select: { id: true, ref: true }
    });
    auditCreate(uow, actor, "Lead", lead.id, "lead.created", { ref, source: args.source, matchedCustomer: !!match, campaignId: args.campaignId ?? null });
    uow.emit({ topic: "lead.first_response_due", aggregateType: "Lead", aggregateId: lead.id, payload: { leadId: lead.id }, availableAt: new Date(now.getTime() + slaMinutes * 6e4), dedupeKey: `lead.sla:${lead.id}` });
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
    if (row.source === "lsa" && row.externalId) uow.emit({ topic: "lsa.dispute", aggregateType: "Lead", aggregateId: args.leadId, payload: { leadId: args.leadId, externalId: row.externalId }, dedupeKey: `lsa.dispute:${args.leadId}` });
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
  const text15 = args.description.toLowerCase();
  const types = await db.jobType.findMany({ where: { active: true }, select: { id: true, code: true, name: true, trade: true, priority: true, keywords: true, emergencyPolicy: true, bookableByAi: true, bookingQuestions: true, businessUnitId: true } });
  const words = new Set(text15.split(/[^a-z0-9]+/).filter(Boolean));
  const scored = types.map((t) => {
    const keys = (t.keywords ?? []).map((k) => k.toLowerCase());
    const hits = keys.filter((k) => k.includes(" ") ? text15.includes(k) : words.has(k));
    const emergency = t.emergencyPolicy;
    const emergencyHits = (emergency?.keywords ?? []).filter((k) => text15.includes(k.toLowerCase()));
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
    uow.emit({ topic: "page.on_call", aggregateType: "Call", aggregateId: pageId, payload: { pageId, businessUnitId: args.businessUnitId ?? null, summary: args.summary.slice(0, 300) }, dedupeKey: `page.on_call:${pageId}`, partitionKey: "paging" });
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
var graphql = String.raw;
var bind = (fn) => op(async (_root, args, context) => {
  const { now: _ignored, ...clean } = args;
  return fn(context.prisma, await actorFor(context), clean);
});
var phase1TypeDefs = graphql`
  type Query {
    availableWindows(jobTypeId: ID!, postalCode: String!, from: String!, days: Int): JSON
    lookupCustomer(phone: String, email: String, name: String, postalCode: String): JSON
    customerHistory(customerId: ID!, limit: Int): JSON
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
    setVisitStatus(visitId: ID!, to: String!, expectedVersion: Int, reason: String, clientRecordedAt: String, deviceEventKey: String, lat: String, lng: String, idempotencyKey: String!): JSON
    holdJob(jobId: ID!, expectedVersion: Int!, reason: String!, followUpOn: String!, idempotencyKey: String!): JSON
    releaseJobHold(jobId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    cancelJob(jobId: ID!, expectedVersion: Int!, reason: String!, idempotencyKey: String!): JSON
    recordConsent(contactPointId: ID, customerId: ID, phone: String, purpose: String!, action: String!, channel: String!, evidence: JSON, wordingVersion: String, idempotencyKey: String!): JSON
    requeueMessage(messageId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
    markMessageSent(messageId: ID!, expectedVersion: Int!, idempotencyKey: String!): JSON
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
    holdJob: bind(holdJob),
    releaseJobHold: bind(releaseJobHold),
    cancelJob: bind(cancelJob),
    recordConsent: bind(recordConsent),
    requeueMessage: bind(requeueMessage),
    markMessageSent: bind(markMessageSent),
    handoffToHuman: bind(handoffToHuman),
    pageOnCall: bind(pageOnCall),
    verifyCredential: bind(verifyCredential),
    revokeCredential: bind(revokeCredential)
  }
};

// features/keystone/mutations/index.ts
var graphql2 = String.raw;
function extendGraphqlSchema(baseSchema) {
  const core = (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql2`
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
        decideApprovalRequest: op(decideApprovalRequest),
        cancelApprovalRequest: op(cancelApprovalRequest),
        requestCompanyControls: op(requestCompanyControls),
        setCompanyOnboardingStatus: op(setCompanyOnboardingStatus)
      }
    }
  });
  return (0, import_schema.mergeSchemas)({ schemas: [core], typeDefs: phase1TypeDefs, resolvers: phase1Resolvers });
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
  Visit: ['@@index([status, plannedStart], map: "Visit_status_planned_idx")']
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
  (0, import_core17.config)({
    db: {
      provider: "postgresql",
      url: databaseURL,
      extendPrismaSchema: addDatabaseConstraints
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
