import {
    basicAuthentication,
    dashboardDisabledResponse,
    dashboardUnauthorizedResponse,
} from "../../utils/auth.js";
import { hasValidAdminSession, verifyAdminCredentials } from "../../utils/admin-session.js";
import { isEmptyBinding } from "../../utils/http.js";

async function errorHandling(context) {
    try {
      return await context.next();
    } catch (err) {
      return new Response(`${err.message}\n${err.stack}`, { status: 500 });
    }
  }

  async function authentication(context) {
    if (isEmptyBinding(context.env.img_url)) {
        return dashboardDisabledResponse();
    }

    if (isEmptyBinding(context.env.BASIC_USER)) {
        return context.next();
    }

    const pathname = new URL(context.request.url).pathname;
    if (pathname === '/api/manage/login') {
        return context.next();
    }

    if (await hasValidAdminSession(context.request, context.env)) {
        return context.next();
    }

    if (!context.request.headers.has('Authorization')) {
        return dashboardUnauthorizedResponse();
    }

    const credentials = basicAuthentication(context.request);
    if (credentials instanceof Response) {
        return credentials;
    }

    if (!await verifyAdminCredentials(context.env, credentials.user, credentials.pass)) {
        return dashboardUnauthorizedResponse('Invalid credentials.');
    }

    return context.next();
  }
  
  export const onRequest = [errorHandling, authentication];
