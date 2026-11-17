package ir.azmounbarg.app

import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import ir.cafebazaar.poolakey.Payment
import ir.cafebazaar.poolakey.Connection
import ir.cafebazaar.poolakey.config.PaymentConfiguration
import ir.cafebazaar.poolakey.config.SecurityCheck
import ir.cafebazaar.poolakey.entity.PurchaseInfo
import ir.cafebazaar.poolakey.request.PurchaseRequest

@CapacitorPlugin(name = "BazaarBilling")
class BazaarBillingPlugin : Plugin() {
    private var payment: Payment? = null
    private var connection: Connection? = null
    private var activeCall: PluginCall? = null

    // Receipt signatures and provider state are verified by the server before any entitlement.
    private fun withPayment(call: PluginCall, action: (Payment) -> Unit) {
        activity.runOnUiThread {
            if (activeCall != null) { call.reject("یک درخواست پرداخت در حال انجام است.", "BILLING_BUSY"); return@runOnUiThread }
            connection?.disconnect()
            activeCall = call
            val instance = Payment(context, PaymentConfiguration(SecurityCheck.Disable))
            payment = instance
            connection = instance.connect {
                connectionSucceed { action(instance) }
                connectionFailed { finish(call); call.reject("ارتباط با بازار برقرار نشد. نصب و ورود به بازار را بررسی کنید.", "BAZAAR_UNAVAILABLE") }
                disconnected { if (activeCall === call) { finish(call); call.reject("ارتباط با بازار قطع شد.", "BAZAAR_DISCONNECTED") } }
            }
        }
    }
    private fun finish(call: PluginCall) { if (activeCall === call) activeCall = null }
    private fun receipt(info: PurchaseInfo) = JSObject().apply {
        put("productId",info.productId); put("purchaseToken",info.purchaseToken)
        put("originalJson",info.originalJson); put("signature",info.dataSignature)
    }
    @PluginMethod fun products(call: PluginCall) {
        val ids = call.getArray("productIds")?.toList<String>() ?: emptyList()
        if (ids.isEmpty() || ids.size > 10) { call.reject("Invalid products"); return }
        withPayment(call) { pay -> pay.getSubscriptionSkuDetails(ids) {
            getSkuDetailsSucceed { products ->
                finish(call); call.resolve(JSObject().put("products", JSArray(products.map { item -> JSObject().apply {
                    put("productId",item.sku); put("price",item.price); put("title",item.title); put("description",item.description)
                } })))
            }
            getSkuDetailsFailed { finish(call); call.reject("دریافت قیمت‌های بازار انجام نشد.", "BAZAAR_PRODUCTS_UNAVAILABLE") }
        } }
    }
    @PluginMethod fun purchase(call: PluginCall) {
        val product = call.getString("productId") ?: run { call.reject("Missing product"); return }
        val payload = call.getString("payload") ?: run { call.reject("Missing purchase intent"); return }
        withPayment(call) { pay -> pay.subscribeProduct(activity.activityResultRegistry, PurchaseRequest(product, payload)) {
            purchaseSucceed { info -> finish(call); call.resolve(receipt(info)) }
            purchaseCanceled { finish(call); call.reject("خرید لغو شد.", "PURCHASE_CANCELLED") }
            purchaseFailed { finish(call); call.reject("خرید انجام نشد. بازیابی خرید را امتحان کنید.", "PURCHASE_FAILED") }
            failedToBeginFlow { finish(call); call.reject("صفحه پرداخت باز نشد.", "PURCHASE_FAILED") }
        } }
    }
    @PluginMethod fun restore(call: PluginCall) {
        withPayment(call) { pay -> pay.getSubscribedProducts {
            querySucceed { items -> finish(call); call.resolve(JSObject().put("purchases", JSArray(items.map { receipt(it) }))) }
            queryFailed { finish(call); call.reject("بازیابی اشتراک‌ها انجام نشد.", "RESTORE_FAILED") }
        } }
    }
    override fun handleOnDestroy() { activeCall?.reject("برنامه بسته شد؛ خرید را بازیابی کنید."); activeCall = null; connection?.disconnect() }
}
