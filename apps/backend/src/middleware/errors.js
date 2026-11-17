export const fail = (status, message, code = "REQUEST_FAILED") =>
  Object.assign(new Error(message), { status, code });
