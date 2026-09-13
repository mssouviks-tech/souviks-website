/*
==========================================================
SOUVIKS AGENT SKILLS DISCOVERY
==========================================================

Serves the Agent Skills Discovery v0.2.0 index and raw
SKILL.md artifacts under /.well-known/agent-skills/.
==========================================================
*/

const SKILL_ARTIFACTS = {
    "catalogue-discovery": {
        description:
            "Discover Souviks products, brands, categories, vehicle applications, and machine-readable catalogue resources.",
        path:
            "/.well-known/agent-skills/catalogue-discovery/SKILL.md"
    },
    "part-identification": {
        description:
            "Identify Souviks catalogue parts using part numbers, SKUs, product names, brands, categories, and related catalogue text.",
        path:
            "/.well-known/agent-skills/part-identification/SKILL.md"
    },
    "catalogue-navigation": {
        description:
            "Navigate Souviks product, brand, category, vehicle, search, and machine-readable catalogue resources.",
        path:
            "/.well-known/agent-skills/catalogue-navigation/SKILL.md"
    },
    "agent-protocol-discovery": {
        description:
            "Discover Souviks machine-readable agent interfaces, API catalogs, A2A, MCP, and authentication metadata.",
        path:
            "/.well-known/agent-skills/agent-protocol-discovery/SKILL.md"
    },
    "auth-guidance": {
        description:
            "Guide agents through Souviks user authentication and registration without treating website credentials as agent API credentials.",
        path:
            "/.well-known/agent-skills/auth-guidance/SKILL.md"
    }
};

function sha256Hex(text) {
    return crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(text)
    ).then((buffer) =>
        [...new Uint8Array(buffer)]
            .map((byte) =>
                byte.toString(16).padStart(2, "0")
            )
            .join("")
    );
}

async function skillIndexResponse() {
    const skills = [];

    for (const [name, metadata] of Object.entries(
        SKILL_ARTIFACTS
    )) {
        const response = await fetch(
            new URL(
                metadata.path,
                "https://www.souviks.co.in"
            ).href,
            {
                headers: {
                    Accept: "text/markdown"
                }
            }
        );

        if (!response.ok) {
            return new Response(
                JSON.stringify({
                    error:
                        "Unable to load skill artifact",
                    skill: name
                }),
                {
                    status: 502,
                    headers: {
                        "Content-Type":
                            "application/json; charset=utf-8",
                        "Cache-Control": "no-store"
                    }
                }
            );
        }

        const artifact =
            await response.text();

        const digest =
            await sha256Hex(artifact);

        skills.push({
            name,
            type: "skill-md",
            description:
                metadata.description,
            url: metadata.path,
            digest:
                "sha256:" + digest
        });
    }

    return new Response(
        JSON.stringify({
            "$schema":
                "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
            skills
        }),
        {
            status: 200,
            headers: {
                "Content-Type":
                    "application/json; charset=utf-8",
                "Cache-Control":
                    "public, max-age=300, s-maxage=300",
                "Access-Control-Allow-Origin": "*"
            }
        }
    );
}

export async function handleAgentSkillsRequest(
    request
) {
    const pathname =
        new URL(request.url).pathname;

    if (
        pathname !==
        "/.well-known/agent-skills/index.json"
    ) {
        return null;
    }

    if (
        request.method !== "GET" &&
        request.method !== "HEAD"
    ) {
        return new Response(
            null,
            {
                status: 405,
                headers: {
                    Allow: "GET, HEAD"
                }
            }
        );
    }

    const response =
        await skillIndexResponse();

    if (
        request.method === "HEAD"
    ) {
        return new Response(
            null,
            {
                status: response.status,
                headers: response.headers
            }
        );
    }

    return response;
}
