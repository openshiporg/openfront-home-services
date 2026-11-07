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
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
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
var import_core12 = require("@keystone-6/core");
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
  ...options.description ? { ui: { description: options.description } } : {}
});
var qty = exact(18, 4);
var rate = exact(12, 6);
var geo = exact(9, 6);
var bps = (defaultValue) => (0, import_fields6.integer)({ ...defaultValue !== void 0 ? { defaultValue } : {}, validation: { isRequired: defaultValue !== void 0 } });
var option = (value) => ({ label: value.replaceAll("_", " ").replaceAll(".", " \xB7 "), value });
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
var fixedChoice = (values) => (0, import_fields6.select)({
  type: "string",
  options: values.map(option),
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
  ...listsOf(agents_exports)
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
  if (Object.keys(data || {}).some((key) => !allowed.has(key))) throw new Error("Unsupported profile field");
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
  AGENT_DISABLED: "AGENT_DISABLED"
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
      const details = Object.fromEntries(Object.entries(error.details).filter(([key]) => SAFE_DETAIL_KEYS.has(key)));
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
var DECIMAL_TEXT = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
function dec(value) {
  if (value instanceof Decimal) return value;
  if (typeof value === "bigint") return new Decimal(value.toString());
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error(`Refusing float ${value}: pass the exact decimal as a string`);
    return new Decimal(value);
  }
  const text10 = String(value).trim();
  if (!DECIMAL_TEXT.test(text10)) throw new Error(`Not a decimal number: ${JSON.stringify(text10).slice(0, 40)}`);
  return new Decimal(text10);
}
var plain = (value) => dec(value).toFixed();
var ZERO = new Decimal(0);
var ONE = new Decimal(1);
var BPS = new Decimal(1e4);

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
      Object.entries(value).filter(([, entry]) => entry !== void 0).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  throw new Error(`Canonical JSON cannot hold a ${typeof value}`);
}
var canonicalJson = (value) => JSON.stringify(canonicalize(value));
var sha256 = (text10) => (0, import_node_crypto2.createHash)("sha256").update(text10).digest("hex");
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
async function advisoryLock(tx, key) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
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
var TRANSACTION_OPTIONS = { maxWait: 15e3, timeout: 6e4 };

// features/keystone/lib/idempotency.ts
var IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,200}$/;
function assertIdempotencyKey(key) {
  if (typeof key !== "string" || !key.trim()) throw new DomainError(Codes.IDEMPOTENCY_KEY_REQUIRED, "An idempotency key is required.");
  if (!IDEMPOTENCY_KEY.test(key)) throw new DomainError(Codes.INVALID_INPUT, "The idempotency key must be 8 to 200 letters, digits or . _ : -");
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
  for (const license of LICENSES) {
    if (await tx.contractorLicense.findUnique({ where: { id: license.id } })) continue;
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
  for (const area of SERVICE_AREAS) {
    if (await tx.serviceArea.findUnique({ where: { id: area.id } })) continue;
    await tx.serviceArea.create({ data: { id: area.id, name: area.name, kind: "zip_list", zips: [...area.zips], travelZone: area.travelZone, branch: { connect: { id: BRANCH.id } } } });
    auditCreate(uow, actor, "ServiceArea", area.id, "service_area.created", { name: area.name, zips: area.zips.length }, { metadata: { seed: true } });
    created.serviceAreas += 1;
  }
  for (const bu of BUSINESS_UNITS) {
    if (await tx.businessUnit.findUnique({ where: { id: bu.id } })) continue;
    await tx.businessUnit.create({ data: { ...bu, brand: { connect: { id: BRAND.id } }, branch: { connect: { id: BRANCH.id } }, serviceAreas: { connect: SERVICE_AREAS.map((a) => ({ id: a.id })) } } });
    auditCreate(uow, actor, "BusinessUnit", bu.id, "business_unit.created", bu, { metadata: { seed: true } });
    created.businessUnits += 1;
  }
  const havePolicies = new Set((await tx.approvalPolicy.findMany({ select: { action: true } })).map((p) => p.action));
  for (const policy of APPROVAL_POLICIES.filter((p) => !havePolicies.has(p.action))) {
    const row = await tx.approvalPolicy.create({ data: { action: policy.action, description: policy.description, requiredPermission: policy.requiredPermission, minApprovals: 1, expiresAfterMinutes: policy.expiresAfterMinutes, thresholdMinor: policy.thresholdMinor ?? null } });
    auditCreate(uow, actor, "ApprovalPolicy", row.id, "approval_policy.created", { action: policy.action, requiredPermission: policy.requiredPermission }, { metadata: { seed: true } });
    created.approvalPolicies += 1;
  }
  for (const pack of POLICY_PACKS) {
    const parsed2 = parsePolicyRules(pack.kind, pack.version.rules);
    if (!parsed2.success) throw new Error(`Seed policy ${pack.code} does not match its schema: ${parsed2.error.issues[0]?.message}`);
    if (!await tx.policyPack.findUnique({ where: { code: pack.code } })) {
      await tx.policyPack.create({ data: { id: pack.id, code: pack.code, name: pack.name, kind: pack.kind, jurisdictionCode: pack.jurisdictionCode, description: pack.description } });
      auditCreate(uow, actor, "PolicyPack", pack.id, "policy_pack.created", { code: pack.code, kind: pack.kind }, { metadata: { seed: true } });
      created.policyPacks += 1;
    }
    if (!await tx.policyVersion.findUnique({ where: { id: pack.version.id } })) {
      const contentHash = payloadHash({ rules: pack.version.rules, sourceRefs: pack.version.sourceRefs });
      await tx.policyVersion.create({
        data: {
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
        }
      });
      auditCreate(uow, actor, "PolicyVersion", pack.version.id, "policy_version.activated", { pack: pack.code, versionNumber: 1, contentHash }, { metadata: { seed: true }, reason: "Initial verified policy load" });
      created.policyVersions += 1;
    }
    if (!await tx.policyBinding.findUnique({ where: { id: pack.binding.id } })) {
      await tx.policyBinding.create({ data: { id: pack.binding.id, packId: pack.id, scope: pack.binding.scope, scopeValue: pack.binding.scopeValue, priority: pack.binding.priority, status: "active" } });
      auditCreate(uow, actor, "PolicyBinding", pack.binding.id, "policy_binding.created", pack.binding, { metadata: { seed: true } });
      created.policyBindings += 1;
    }
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
  for (const key of keys) if (!CONTROL_KEYS.includes(key)) throw new DomainError(Codes.INVALID_INPUT, `${key} is not a company control.`, { field: key });
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

// features/keystone/mutations/index.ts
var graphql = String.raw;
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql`
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
  RoleLimit: ['@@unique([roleId, kind], map: "RoleLimit_role_kind_key")']
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
  (0, import_core12.config)({
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
