# Bazaar compliance matrix — 2026-11-15

This is implementation evidence and remaining release work, not a guarantee of marketplace acceptance. Rules apply to content linked from the app as well as the binary. Recheck the console at submission.

| Rule / official source | Implementation evidence | Validation / release condition |
| --- | --- | --- |
| [Quality](https://developers.cafebazaar.ir/fa/app-publish-guidelines/rules/quality) | Shared bottom navigation, focused question editing, explicit reorder, full-screen phone dialogs, preview fit/zoom/kind/pages, readable controls, safe areas; local draft preservation | Phone tests at 360/390/430px; desktop regressions. Android keyboard, rotation, accessibility and device restart remain device gates. |
| [Privacy](https://developers.cafebazaar.ir/fa/app-publish-guidelines/rules/privacy) | `/privacy` before OTP; explicit checkbox, versioned consent when signing in; account-scoped IDB and warning before discarding pending work; Groq consent before generation | Operator must confirm actual support, retention, backup and provider practices before publication. No invented deletion deadline is promised. |
| [Security](https://developers.cafebazaar.ir/fa/app-publish-guidelines/rules/security) | HTTPS bundled shell, restricted navigation, seven-day opaque hashed server sessions, Keystore AES-GCM credential storage, no backup/cleartext, system file pickers, no SMS/location/contacts permissions; private API `no-store` | Native session/origin tests pass. Keystore, save/share, process recovery require Android installation tests. Updates are store-distributed. |
| [Payment](https://developers.cafebazaar.ir/fa/app-publish-guidelines/rules/payment) | Poolakey subscription bridge; provider prices; signed receipts and account binding; idempotent monthly entitlements; restore/cancel; periodic reconciliation; production mock routes disabled | Signed local receipt and outage tests pass. Real products, price parity, test purchase, renewal/refund and API credentials still required. |
| [Copyright](https://developers.cafebazaar.ir/fa/app-publish-guidelines/rules/copyright) | Included OFL notices; upload permission confirmation; signing script requires font evidence | Dana and B Nazanin rights are not evidenced by this repository. Resolve or substitute licensed fonts before distribution. |
| [Content](https://developers.cafebazaar.ir/fa/app-publish-guidelines/rules/content) | Exams remain owner-private; no public feed; terms prohibit unlawful content; AI outputs reviewed before insertion; support route for reporting | Review bundled examples, screenshots and actual generation behavior against content rules. A private authoring tool does not establish provider output compliance. |
| [Listing claims](https://developers.cafebazaar.ir/fa/app-publish-guidelines/rules/deceptive-behavior) | App name and book logo align across launcher/web; offline and online boundaries disclosed; paid limits visible | Use genuine Android screenshots. Configure support contact, reviewer access, age/category details and accurate published copy. |

Minimum permissions: INTERNET, ACCESS_NETWORK_STATE and Bazaar billing; package visibility is limited to Bazaar. Android plugin manifests must be inspected in the final merged manifest before upload.

## Store listing draft

**Name:** آزمون‌برگ

**Short description:** طراحی آزمون فارسی، سؤال‌های ریاضی و برگه PDF برای مدرسان

**Description:** آزمون‌های مدرسه و دانشگاه را با سؤال‌های چندگزینه‌ای، جای خالی، تشریحی و وصل‌کردنی طراحی کنید. فرمول، شکل و نمودار اضافه کنید و قالب برگه را انتخاب کنید. فایل دانش‌آموز و پاسخ‌نامه مدرس به‌صورت PDF جداگانه آماده می‌شوند. آزمون‌های دانلودشده را بدون اینترنت ویرایش کنید؛ برای همگام‌سازی، ورود، ساخت آزمون تازه، تولید سؤال هوشمند، خرید و ساخت PDF به اینترنت نیاز دارید. طرح رایگان شامل سه آزمون در طول عمر حساب و خروجی تا دو صفحه است. طرح‌های پولی با اشتراک ماهانه و تمدید خودکار بازار ارائه می‌شوند؛ تمدید را می‌توانید لغو کنید. تولید هوشمند به طرح مربوط و ظرفیت سرویس نیاز دارد. نتیجه هوش مصنوعی را پیش از استفاده بررسی کنید. اندروید ۷ یا بالاتر لازم است.

**Reviewer instructions:** Sign in using the production email OTP delivery channel. Confirm actual provider inbox delivery before submission; do not use a hidden production OTP bypass. Supply a reviewer access arrangement through the Bazaar console. Exercise the free sample, formula/drawing editors and both PDFs; test paid features with Bazaar test subscriptions. Do not include user data, secrets or private exam screenshots in the listing.
