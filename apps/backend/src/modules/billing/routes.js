import { plans } from "./catalog.js";
export function billingRoutes(app, auth, billing) {
  const mockAllowed = () => process.env.NODE_ENV !== "production";
  app.get("/api/billing/capabilities", (req, res) =>
    res.json({ mock: mockAllowed(), bazaar: !!process.env.BAZAAR_API_TOKEN }),
  );
  app.get("/api/plans", (req, res) => res.json(plans));
  app.get("/api/billing", auth, async (req, res) =>
    res.json(await billing.status(req.user.id)),
  );
  app.post("/api/billing/checkout", auth, async (req, res) => {
    if (!mockAllowed())
      return res
        .status(503)
        .json({
          code: "CHECKOUT_UNAVAILABLE",
          error: "خرید وب در حال حاضر در دسترس نیست.",
        });
    return res
      .status(201)
      .json(
        await billing.checkout(
          req.user.id,
          req.body.planId,
          req.body.idempotencyKey,
        ),
      );
  });
  app.get("/api/billing/orders/:id", auth, async (req, res) =>
    res.json(await billing.ownedOrder(req.user.id, req.params.id)),
  );
  // This explicitly simulated provider endpoint is replaced by a signed provider callback for real payments.
  app.post("/api/billing/orders/:id/mock-confirm", auth, async (req, res) => {
    if (!mockAllowed())
      return res
        .status(404)
        .json({ code: "NOT_FOUND", error: "مسیر پیدا نشد." });
    res.json(await billing.confirm(req.user.id, req.params.id));
  });
}
