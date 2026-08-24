import { createApiHandler } from "../src/handler.js";

const handler = createApiHandler();

export default {
  fetch(request) {
    return handler(request);
  }
};
