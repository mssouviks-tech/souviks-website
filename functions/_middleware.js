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

export async function onRequest(context) {
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
