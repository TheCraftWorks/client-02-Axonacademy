package com.edumeet.live;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private final Handler keepAliveHandler = new Handler(Looper.getMainLooper());
    private final Runnable keepAliveRunnable = new Runnable() {
        @Override
        public void run() {
            if (ScreenSharePlugin.isSharingActive()) {
                keepWebViewAliveIfSharing();
                keepAliveHandler.postDelayed(this, 1000);
            }
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScreenSharePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        keepAliveHandler.removeCallbacks(keepAliveRunnable);
    }

    @Override
    public void onPause() {
        super.onPause();
        startKeepAliveLoop();
    }

    @Override
    public void onStop() {
        super.onStop();
        startKeepAliveLoop();
    }

    @Override
    public void onDestroy() {
        keepAliveHandler.removeCallbacks(keepAliveRunnable);
        super.onDestroy();
    }

    private void startKeepAliveLoop() {
        keepAliveHandler.removeCallbacks(keepAliveRunnable);
        if (ScreenSharePlugin.isSharingActive()) {
            keepWebViewAliveIfSharing();
            keepAliveHandler.postDelayed(keepAliveRunnable, 1000);
        }
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
