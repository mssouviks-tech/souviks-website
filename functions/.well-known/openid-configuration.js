const UPSTREAM =
    "https://kjxrfmujzdxatpgegqcs.supabase.co/auth/v1/.well-known/openid-configuration";

export async function onRequest({ request }) {
    try {
        const upstreamResponse = await fetch(UPSTREAM, {
            headers: {
                Accept: "application/json"
            }
        });

        if (!upstreamResponse.ok) {
            return new Response(
                JSON.stringify({
                    error: "OAuth discovery upstream unavailable"
                }),
                {
                    status: 502,
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                        "Cache-Control": "no-store"
                    }
                }
            );
        }

        const data = await upstreamResponse.json();

        const required = [
            "issuer",
            "authorization_endpoint",
            "token_endpoint",
            "jwks_uri",
            "grant_types_supported",
            "response_types_supported"
        ];

        const missing = required.filter(
            (field) =>
                data[field] === undefined ||
                data[field] === null ||
                data[field] === ""
        );

        if (missing.length > 0) {
            return new Response(
                JSON.stringify({
                    error: "OAuth discovery metadata incomplete",
                    missing
                }),
                {
                    status: 502,
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                        "Cache-Control": "no-store"
                    }
                }
            );
        }

        const headers = new Headers({
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=300, s-maxage=300",
            "Access-Control-Allow-Origin": "*"
        });

        return new Response(JSON.stringify(data), {
            status: 200,
            headers
        });
    } catch (error) {
        console.error("[Souviks OAuth Discovery]", error);

        return new Response(
            JSON.stringify({
                error: "Unable to retrieve OAuth discovery metadata"
            }),
            {
                status: 502,
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Cache-Control": "no-store"
                }
            }
        );
    }
}
