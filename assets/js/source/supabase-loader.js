/* Souviks lazy Supabase SDK loader.
 * The existing global supabaseClient API is preserved through a proxy.
 * The CDN SDK is downloaded only when an application operation needs it.
 */
(() => {
  "use strict";

  const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  let configuration = null;
  let sdkPromise = null;
  let clientPromise = null;
  let realClient = null;

  function loadSdk() {
    const current = window["supabase"];
    if (
      current &&
      current.__souviksLazyLoader !== true &&
      typeof current.createClient === "function"
    ) {
      return Promise.resolve(current);
    }
    if (sdkPromise) return sdkPromise;

    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = true;
      script.src = SDK_URL;
      script.dataset.souviksSupabaseSdk = "true";
      script.onload = () => {
        const sdk = window["supabase"];
        if (
          sdk &&
          sdk.__souviksLazyLoader !== true &&
          typeof sdk.createClient === "function"
        ) {
          resolve(sdk);
        } else {
          sdkPromise = null;
          script.remove();
          reject(new Error("Supabase SDK loaded without its client factory."));
        }
      };
      script.onerror = () => {
        sdkPromise = null;
        script.remove();
        reject(new Error("Unable to load the Supabase SDK."));
      };
      document.head.appendChild(script);
    });

    return sdkPromise;
  }

  function ensureClient() {
    if (realClient) return Promise.resolve(realClient);
    if (clientPromise) return clientPromise;
    if (!configuration) {
      return Promise.reject(new Error("Supabase client has not been configured."));
    }

    clientPromise = loadSdk()
      .then((sdk) => {
        realClient = sdk.createClient(
          configuration.url,
          configuration.key,
          configuration.options,
        );
        try {
          document.dispatchEvent(
            new CustomEvent("souviks:supabase-client-ready"),
          );
        } catch {
          // The event is advisory; the client itself remains available.
        }
        return realClient;
      })
      .catch((error) => {
        clientPromise = null;
        throw error;
      });

    return clientPromise;
  }

  function queryProxy(valuePromise) {
    // Supabase PostgREST builders are thenable. Keep each intermediate value
    // inside a plain box so Promise resolution does not execute the query
    // before the caller has finished chaining select/filter/single methods.
    const unwrap = () => valuePromise.then((box) => box.value);

    return new Proxy(Object.create(null), {
      get(_target, property) {
        if (property === "then") {
          const promise = unwrap();
          return promise.then.bind(promise);
        }
        if (property === "catch") {
          const promise = unwrap();
          return promise.catch.bind(promise);
        }
        if (property === "finally") {
          const promise = unwrap();
          return promise.finally.bind(promise);
        }
        if (property === Symbol.toStringTag) return "SupabaseLazyQuery";
        if (typeof property === "symbol") return undefined;

        return (...args) =>
          queryProxy(
            valuePromise.then((box) => {
              const builder = box.value;
              const operation = builder?.[property];
              if (typeof operation !== "function") {
                throw new TypeError(
                  "Unsupported Supabase query operation: " + String(property),
                );
              }
              return { value: operation.apply(builder, args) };
            }),
          );
      },
    });
  }

  function serviceProxy(serviceName) {
    return new Proxy(Object.create(null), {
      get(_target, property) {
        if (property === "then") return undefined;
        if (property === Symbol.toStringTag) return "SupabaseLazyService";
        if (typeof property === "symbol") return undefined;

        // Reading supabaseClient.auth/functions/storage is inert. The SDK
        // loads only when an actual method on that service is invoked.
        return (...args) =>
          queryProxy(
            ensureClient().then((client) => {
              const service = client?.[serviceName];
              const operation = service?.[property];
              if (typeof operation !== "function") {
                throw new TypeError(
                  "Unsupported Supabase service operation: " +
                    String(property),
                );
              }
              return { value: operation.apply(service, args) };
            }),
          );
      },
    });
  }

  function createLazyClient(url, key, options) {
    if (configuration) {
      if (
        configuration.url !== url ||
        configuration.key !== key
      ) {
        throw new Error("A second Supabase configuration was requested.");
      }
    } else {
      configuration = { url, key, options };
    }

    return new Proxy(Object.create(null), {
      get(_target, property) {
        if (property === "__souviksLazyClient") return true;
        if (property === "then") return undefined;
        if (property === Symbol.toStringTag) return "SupabaseLazyClient";
        if (typeof property === "symbol") return undefined;

        if (property === "from") {
          return (...args) =>
            queryProxy(ensureClient().then((client) => ({ value: client.from(...args) })));
        }
        if (property === "rpc") {
          return (...args) =>
            queryProxy(ensureClient().then((client) => ({ value: client.rpc(...args) })));
        }
        if (
          property === "auth" ||
          property === "functions" ||
          property === "storage"
        ) {
          return serviceProxy(property);
        }

        return (...args) =>
          queryProxy(
            ensureClient().then((client) => {
              const operation = client?.[property];
              if (typeof operation !== "function") {
                throw new TypeError(
                  "Unsupported Supabase client operation: " +
                    String(property),
                );
              }
              return { value: operation.apply(client, args) };
            }),
          );
      },
    });
  }

  async function fetchPublicTable(table, query = {}) {
    if (!configuration) {
      throw new Error("Supabase client has not been configured.");
    }

    const tableName = String(table || "").trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
      throw new TypeError("Invalid Supabase public table name.");
    }
    if (!query || typeof query !== "object" || Array.isArray(query)) {
      throw new TypeError("Supabase public table filters must be an object.");
    }

    const endpoint = new URL("/rest/v1/" + tableName, configuration.url);
    for (const [name, value] of Object.entries(query)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new TypeError("Invalid Supabase public query parameter.");
      }
      if (value !== undefined && value !== null) {
        endpoint.searchParams.set(name, String(value));
      }
    }

    // Public, read-only PostgREST access does not need the 48 KB Supabase SDK.
    // New sb_publishable keys are API keys, not JWTs: send them on apikey only.
    // Postgres RLS still controls which rows the anonymous role can read.
    const response = await fetch(endpoint.href, {
      method: "GET",
      credentials: "omit",
      headers: {
        apikey: configuration.key,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        "Supabase public table read failed (HTTP " + response.status + ").",
      );
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      throw new TypeError("Supabase public table response was not an array.");
    }
    return rows;
  }

  function hasPersistedSessionOrCallback() {
    try {
      if (
        window.localStorage.getItem(
          "sb-kjxrfmujzdxatpgegqcs-auth-token",
        )
      ) {
        return true;
      }
    } catch {
      // Private browsing and hardened storage may deny access.
    }

    try {
      const url = new URL(window.location.href);
      return (
        url.searchParams.has("code") ||
        /(?:^|[&#])(access_token|refresh_token|error)=/.test(
          window.location.hash,
        )
      );
    } catch {
      return false;
    }
  }

  window.SouviksSupabase = Object.freeze({
    createClient: createLazyClient,
    ensureClient,
    loadSdk,
    fetchPublicTable,
    hasPersistedSessionOrCallback,
  });
})();
