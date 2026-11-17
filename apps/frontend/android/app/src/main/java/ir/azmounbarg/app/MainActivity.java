package ir.azmounbarg.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SecureSessionPlugin.class);
        registerPlugin(NativeFilesPlugin.class);
        registerPlugin(BazaarBillingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
