import { fail } from "../../middleware/errors.js";
import { mobileSession } from "./mobile.js";
export function requireAuth(db) {
  return async (req, res, next) => {
    try {
      if (req.get("authorization")) {
        const mobile = await mobileSession(db, req);
        req.user = mobile.user;
        req.mobileSession = mobile.row;
        return next();
      }
      if (!req.session.userId)
        throw fail(401, "ابتدا وارد حساب شوید.", "AUTH_REQUIRED");
      const user = await db
        .collection("users")
        .findOne({ id: req.session.userId });
      if (!user || req.session.version !== user.session_version)
        throw fail(401, "نشست شما پایان یافته است.", "SESSION_EXPIRED");
      if (["suspended", "deleting"].includes(user.status))
        throw fail(403, "حساب تعلیق شده است.", "ACCOUNT_SUSPENDED");
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
