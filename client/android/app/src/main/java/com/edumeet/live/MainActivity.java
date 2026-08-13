package com.edumeet.live;

import android.app.PictureInPictureParams;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Rational;
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && ScreenSharePlugin.isSharingActive()) {
            try {
                setPictureInPictureParams(
                    new PictureInPictureParams.Builder()
                        .setAspectRatio(new Rational(16, 9))
                        .setAutoEnterEnabled(true)
                        .build()
                );
            } catch (Exception e) {
                // Non-fatal fallback for older builds
            }
        }
    }

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (ScreenSharePlugin.isSharingActive()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    PictureInPictureParams params = new PictureInPictureParams.Builder()
                        .setAspectRatio(new Rational(16, 9))
                        .build();
                    enterPictureInPictureMode(params);
                } catch (Exception e) {
                    android.util.Log.e("MainActivity", "Could not enter Picture-in-Picture mode:", e);
                }
            }
        }
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
