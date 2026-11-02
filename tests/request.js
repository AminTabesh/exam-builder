import { inject } from "light-my-request";
import assert from "node:assert/strict";
// Exercise the Express HTTP stack without opening a listening socket.
export default function request(app) {
  return agent(app);
}
function agent(app) {
  const cookies = new Map();
  const client = {};
  for (const method of ["get", "post", "put", "delete"])
    client[method] = (url) => {
      const headers = {};
      let payload;
      const chain = {
        send(body) {
          payload = body;
          return chain;
        },
        set(key, value) {
          headers[key] = value;
          return chain;
        },
        async expect(status) {
          if (cookies.size)
            headers.cookie = [...cookies]
              .map(([key, value]) => key + "=" + value)
              .join("; ");
          const response = await inject(app, {
            method: method.toUpperCase(),
            url,
            headers,
            payload,
          });
          for (const cookie of [response.headers["set-cookie"] || []].flat()) {
            const [pair] = cookie.split(";");
            const [key, ...value] = pair.split("=");
            cookies.set(key, value.join("="));
          }
          let body;
          try {
            body = JSON.parse(response.payload);
          } catch {
            body = response.payload;
          }
          if (status !== undefined)
            assert.equal(
              response.statusCode,
              status,
              `${method.toUpperCase()} ${url}: ${response.payload}`,
            );
          return {
            body,
            headers: response.headers,
            status: response.statusCode,
          };
        },
      };
      return chain;
    };
  return client;
}
request.agent = agent;
