#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
const loaderSource = fs.readFileSync(
  path.join(ROOT, "assets/js/supabase-loader.js"),
  "utf8",
);
const readableLoaderSource = fs.readFileSync(
  path.join(ROOT, "assets/js/source/supabase-loader.js"),
  "utf8",
);
assert.ok(readableLoaderSource.length > loaderSource.length * 1.2, "Supabase loader runtime must be minified from its readable source.");

async function main() {
  const injectedScripts = [];
  const operations = [];
  let createClientCount = 0;
  let observedConfig = null;

  const document = {
    head: {
      appendChild(script) {
        injectedScripts.push(script);
      },
    },
    createElement(tag) {
      assert.equal(tag, "script");
      return {
        dataset: {},
        remove() {
          const index = injectedScripts.indexOf(this);
          if (index >= 0) injectedScripts.splice(index, 1);
        },
      };
    },
    dispatchEvent() {},
  };

  const window = {
    localStorage: { getItem: () => null },
    location: { href: "https://www.souviks.co.in/en/" },
  };

  const sandbox = {
    window,
    document,
    URL,
    Promise,
    Proxy,
    Object,
    Error,
    TypeError,
    Set,
    CustomEvent: class CustomEvent {
      constructor(type) {
        this.type = type;
      }
    },
  };

  vm.runInNewContext(loaderSource, sandbox, {
    filename: "supabase-loader.js",
    timeout: 1000,
  });

  assert.equal(
    window.SouviksSupabase.hasPersistedSessionOrCallback(),
    false,
    "a guest without stored auth state must not initialize Supabase auth",
  );

  const config = {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  };
  const client = window.SouviksSupabase.createClient(
    "https://project.supabase.co",
    "sb_publishable_test",
    config,
  );

  assert.equal(
    injectedScripts.length,
    0,
    "creating the compatibility client must not download the SDK",
  );
  const authService = client.auth;
  const functionsService = client.functions;
  assert.equal(
    injectedScripts.length,
    0,
    "reading service namespaces must not download the SDK",
  );

  const queryResult = client
    .from("product_reviews")
    .select("id,reviewer_name")
    .eq("status", "approved")
    .maybeSingle();

  assert.equal(
    operations.some((operation) => operation[0] === "execute"),
    false,
    "chaining methods on a thenable PostgREST builder must not execute the query early",
  );
  assert.equal(injectedScripts.length, 1, "first data access must request the SDK");
  const script = injectedScripts[0];
  assert.equal(script.async, true, "SDK script must be asynchronous");
  assert.match(script.src, /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2/);

  const builder = {
    select(columns) {
      operations.push(["select", columns]);
      return this;
    },
    eq(column, value) {
      operations.push(["eq", column, value]);
      return this;
    },
    maybeSingle() {
      operations.push(["maybeSingle"]);
      return this;
    },
    then(resolve, reject) {
      operations.push(["execute"]);
      return Promise.resolve({
        data: { id: "review-1", reviewer_name: "Souviks Customer" },
        error: null,
      }).then(resolve, reject);
    },
  };

  const auth = {
    async getUser() {
      operations.push(["auth.getUser"]);
      return { data: { user: null }, error: null };
    },
    onAuthStateChange(callback) {
      operations.push(["auth.onAuthStateChange", typeof callback]);
      return {
        data: {
          subscription: {
            unsubscribe() {
              operations.push(["auth.unsubscribe"]);
            },
          },
        },
      };
    },
  };

  const functions = {
    async invoke(name, options) {
      operations.push(["functions.invoke", name, options?.body]);
      return { data: { ok: true }, error: null };
    },
  };

  window.supabase = {
    createClient(url, key, options) {
      createClientCount += 1;
      observedConfig = { url, key, options };
      return {
        from(table) {
          operations.push(["from", table]);
          return builder;
        },
        auth,
        functions,
        rpc(name, args) {
          operations.push(["rpc", name, args]);
          return Promise.resolve({ data: { ok: true }, error: null });
        },
      };
    },
  };
  script.onload();

  const result = await queryResult;
  assert.equal(result.data.id, "review-1");
  assert.equal(
    operations.filter((operation) => operation[0] === "execute").length,
    1,
    "the thenable PostgREST builder must execute exactly once when awaited",
  );
  assert.deepEqual(
    operations.slice(0, 3).map((operation) => operation[0]),
    ["from", "select", "eq"],
  );
  assert.equal(createClientCount, 1, "the real Supabase client must be created once");
  assert.equal(observedConfig.url, "https://project.supabase.co");
  assert.equal(observedConfig.key, "sb_publishable_test");
  assert.equal(observedConfig.options, config, "auth persistence options must be preserved");

  const userResult = await authService.getUser();
  assert.equal(userResult.data.user, null);
  const rpcResult = await client.rpc("record_website_lead_details", {
    p_lead_reference: "lead-1",
  });
  assert.equal(rpcResult.data.ok, true);
  const functionResult = await functionsService.invoke("cashfree-create-order", {
    body: { items: [] },
  });
  assert.equal(functionResult.data.ok, true);
  assert.equal(
    createClientCount,
    1,
    "auth, RPC and Edge Function operations must reuse the same client",
  );

  const callbackWindow = {
    localStorage: { getItem: () => null },
    location: { href: "https://www.souviks.co.in/en/login?code=oauth-code" },
  };
  const callbackSandbox = {
    window: callbackWindow,
    document,
    URL,
    Promise,
    Proxy,
    Object,
    Error,
    TypeError,
    Set,
    CustomEvent: sandbox.CustomEvent,
  };
  vm.runInNewContext(loaderSource, callbackSandbox, {
    filename: "supabase-loader-callback.js",
    timeout: 1000,
  });
  assert.equal(
    callbackWindow.SouviksSupabase.hasPersistedSessionOrCallback(),
    true,
    "OAuth callback URLs must trigger persisted-session initialization",
  );

  const catalogueCoreSource = fs.readFileSync(
    path.join(ROOT, "assets/js/catalogue-core.js"),
    "utf8",
  );
  const documentListeners = new Map();
  const windowListeners = new Map();
  let currentUser = null;
  let persistedSession = false;
  let savedAuthCalls = 0;
  let savedProductQueries = 0;

  const savedDocument = {
    addEventListener(type, callback) {
      documentListeners.set(type, callback);
    },
    querySelectorAll() {
      return [];
    },
  };
  const savedWindow = {
    SouviksSupabase: {
      hasPersistedSessionOrCallback: () => persistedSession,
    },
    addEventListener(type, callback) {
      windowListeners.set(type, callback);
    },
  };
  const savedSupabaseClient = {
    auth: {
      async getUser() {
        savedAuthCalls += 1;
        return { data: { user: currentUser }, error: null };
      },
    },
    from(table) {
      assert.equal(table, "saved_products");
      savedProductQueries += 1;
      return {
        select(columns) {
          assert.equal(columns, "product_id");
          return this;
        },
        eq(column, value) {
          assert.equal(column, "user_id");
          assert.equal(value, "regression-saved-user");
          return Promise.resolve({
            data: [{ product_id: "saved-product" }],
            error: null,
          });
        },
      };
    },
  };
  const savedProductsSandbox = {
    window: savedWindow,
    document: savedDocument,
    supabaseClient: savedSupabaseClient,
    SouviksErrors: { log() {} },
  };

  vm.runInNewContext(catalogueCoreSource, savedProductsSandbox, {
    filename: "catalogue-core.js",
    timeout: 1000,
  });

  assert.equal(
    documentListeners.has("DOMContentLoaded"),
    false,
    "catalogue startup must not schedule an unconditional SavedProducts auth check",
  );
  assert.equal(
    savedAuthCalls,
    0,
    "anonymous homepage/listing startup must not call Supabase auth.getUser",
  );
  assert.equal(
    savedProductQueries,
    0,
    "anonymous startup must not query saved_products",
  );

  const savedAuthStateListener = documentListeners.get("souviks:auth-state");
  assert.equal(
    typeof savedAuthStateListener,
    "function",
    "saved products must subscribe to the shared authenticated-session lifecycle",
  );

  currentUser = { id: "regression-saved-user" };
  persistedSession = true;
  savedAuthStateListener({
    detail: {
      event: "INITIAL_SESSION",
      session: { user: currentUser },
    },
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(
    savedAuthCalls,
    1,
    "a confirmed authenticated session must initialize saved products",
  );
  assert.equal(
    savedProductQueries,
    1,
    "a confirmed authenticated session must hydrate saved-product IDs",
  );
  assert.equal(
    savedWindow.SavedProducts.state.savedIds.has("saved-product"),
    true,
    "saved-product state must be hydrated for the signed-in user",
  );

  savedAuthStateListener({
    detail: { event: "SIGNED_OUT", session: null },
  });
  assert.equal(
    savedWindow.SavedProducts.state.user,
    null,
    "sign-out events must clear the saved-products user",
  );
  assert.equal(
    savedWindow.SavedProducts.state.savedIds.size,
    0,
    "sign-out events must clear saved-product IDs",
  );

  persistedSession = false;
  windowListeners.get("storage")({
    key: "sb-kjxrfmujzdxatpgegqcs-auth-token",
    newValue: null,
  });
  assert.equal(
    savedWindow.SavedProducts.state.savedIds.size,
    0,
    "cross-tab session removal must clear saved-product state",
  );

  console.log(
    "[Supabase lazy-loader contract] PASS — no eager SDK download, async on-demand load, query/auth/RPC/Edge Function compatibility, singleton client, and callback detection.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
