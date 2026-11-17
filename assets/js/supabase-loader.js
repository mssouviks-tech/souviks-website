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

  function queryProxy(promise) {
    return new Proxy(Object.create(null), {
      get(_target, property) {
        if (property === "then") return promise.then.bind(promise);
        if (property === "catch") return promise.catch.bind(promise);
        if (property === "finally") return promise.finally.bind(promise);
        if (property === Symbol.toStringTag) return "SupabaseLazyQuery";
        if (typeof property === "symbol") return undefined;

        return (...args) =>
          queryProxy(
            promise.then((builder) => {
              const operation = builder?.[property];
              if (typeof operation !== "function") {
                throw new TypeError(
                  "Unsupported Supabase query operation: " + String(property),
                );
              }
              return operation.apply(builder, args);
            }),
          );
      },
    });
  }

  function serviceProxy(servicePromise) {
    return new Proxy(Object.create(null), {
      get(_target, property) {
        if (property === "then") return undefined;
        if (property === Symbol.toStringTag) return "SupabaseLazyService";
        if (typeof property === "symbol") return undefined;

        if (property === "from") {
          return (...args) =>
            queryProxy(
              servicePromise.then((service) => service.from(...args)),
            );
        }

        return (...args) =>
          queryProxy(
            servicePromise.then((service) => {
              const operation = service?.[property];
              if (typeof operation !== "function") {
                throw new TypeError(
                  "Unsupported Supabase service operation: " +
                    String(property),
                );
              }
              return operation.apply(service, args);
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
            queryProxy(ensureClient().then((client) => client.from(...args)));
        }
        if (property === "rpc") {
          return (...args) =>
            queryProxy(ensureClient().then((client) => client.rpc(...args)));
        }
        if (
          property === "auth" ||
          property === "functions" ||
          property === "storage"
        ) {
          return serviceProxy(
            ensureClient().then((client) => client[property]),
          );
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
              return operation.apply(client, args);
            }),
          );
      },
    });
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

  const shim = {};
  shim.__souviksLazyLoader = true;
  shim["createClient"] = createLazyClient;
  window["supabase"] = shim;

  window.SouviksSupabase = Object.freeze({
    ensureClient,
    loadSdk,
    hasPersistedSessionOrCallback,
  });
})();
