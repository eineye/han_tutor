package io.github.eineye.hangeulon;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The phone's "font size" setting would enlarge all app text and push screens wider than the phone.
        // The app sizes its own text for small screens, so keep the WebView at 100 %.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setTextZoom(100);
        }
    }
}
