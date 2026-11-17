package ir.azmounbarg.app;

import android.app.Activity;
import android.content.Intent;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

@CapacitorPlugin(name = "NativeFiles")
public class NativeFilesPlugin extends Plugin {
    @PluginMethod public void savePdf(PluginCall call) {
        if (call.getString("data") == null) { call.reject("Missing PDF"); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("application/pdf");
        intent.putExtra(Intent.EXTRA_TITLE,call.getString("filename","exam.pdf"));
        startActivityForResult(call,intent,"documentCreated");
    }
    @ActivityCallback private void documentCreated(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.resolve(new JSObject().put("cancelled",true)); return;
        }
        getBridge().execute(() -> {
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(result.getData().getData())) {
                if (stream == null) throw new Exception("No stream");
                stream.write(Base64.decode(call.getString("data"),Base64.DEFAULT));
                call.resolve(new JSObject().put("saved",true));
            } catch (Exception e) { call.reject("فایل ذخیره نشد؛ فضای دستگاه را بررسی کنید."); }
        });
    }
}
