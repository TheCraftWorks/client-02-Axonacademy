package com.edumeet.live;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScreenSharePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onPause() {
        super.onPause();
        keepWebViewAliveIfSharing();
    }

    @Override
    public void onStop() {
        super.onStop();
        keepWebViewAliveIfSharing();
    }

    private void keepWebViewAliveIfSharing() {
        if (ScreenSharePlugin.isSharingActive()) {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().onResume();
                getBridge().getWebView().resumeTimers();
            }
        }
    }
}
