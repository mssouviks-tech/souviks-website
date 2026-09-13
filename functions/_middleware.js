/*
==========================================================
SOUVIKS WEBSITE
REQUEST MIDDLEWARE
==========================================================

Keeps agent infrastructure isolated from the main site
while preserving normal browser responses.
==========================================================
*/

import { handleAgentRequest } from "./agent/index.js";
import { handleMarkdownResponse } from "./agent/markdown.js";
import { handleAgentSkillsRequest } from "./agent/skills.js";

export async function onRequest(context) {
    const skillsResponse =
        await handleAgentSkillsRequest(
            context.request
        );

    if (skillsResponse) {
        return skillsResponse;
    }

    const agentResponse =
        await handleAgentRequest(
            context.request
        );

    if (agentResponse) {
        return agentResponse;
    }

    const response =
        await context.next();

    return handleMarkdownResponse(
        context.request,
        response
    );
}
