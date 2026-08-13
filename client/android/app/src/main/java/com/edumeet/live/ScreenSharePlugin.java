package com.edumeet.live;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.util.Base64;
import android.util.DisplayMetrics;
import androidx.activity.result.ActivityResult;
import android.net.wifi.WifiManager;
import java.util.concurrent.atomic.AtomicBoolean;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import android.Manifest;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

@CapacitorPlugin(
    name = "ScreenSharePlugin",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class ScreenSharePlugin extends Plugin {
    private MediaProjectionManager mediaProjectionManager;
    private MediaProjection mediaProjection;
    private MediaProjection.Callback mediaProjectionCallback;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    
    private ScreenShareService screenShareService;
    private boolean isServiceBound = false;
    private static volatile boolean isSharing = false;
    
    public static boolean isSharingActive() {
        return isSharing;
    }
    
    private HandlerThread handlerThread;
    private Handler backgroundHandler;
    private android.os.PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    private ServiceConnection serviceConnection = null;
    private final AtomicBoolean isProcessingFrame = new AtomicBoolean(false);

    private String lastBase64Frame = null;
    private Runnable heartbeatRunnable = null;
    private volatile long lastRealFrameTime = 0;

    @PluginMethod
    public void startScreenShare(PluginCall call) {
        if (isSharing) {
            call.resolve();
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("notifications") != PermissionState.GRANTED) {
                requestPermissionForAlias("notifications", call, "notificationsPermsCallback");
                return;
            }
        }

        proceedStartScreenShare(call);
    }

    @PermissionCallback
    private void notificationsPermsCallback(PluginCall call) {
        // Even if permission is denied, we can still proceed with screen share,
        // but it is highly recommended to have it. Let's proceed anyway to not block the user.
        proceedStartScreenShare(call);
    }

    private void proceedStartScreenShare(PluginCall call) {
        Context context = getContext();
        mediaProjectionManager = (MediaProjectionManager) context.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        
        if (mediaProjectionManager != null) {
            Intent intent = mediaProjectionManager.createScreenCaptureIntent();
            startActivityForResult(call, intent, "handleScreenCaptureResult");
        } else {
            call.reject("MediaProjectionManager not available");
        }
    }

    @ActivityCallback
    private void handleScreenCaptureResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            final Intent data = result.getData();
            final int resultCode = result.getResultCode();

            Intent serviceIntent = new Intent(getContext(), ScreenShareService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }

            serviceConnection = new ServiceConnection() {
                @Override
                public void onServiceConnected(ComponentName name, IBinder service) {
                    ScreenShareService.LocalBinder binder = (ScreenShareService.LocalBinder) service;
                    screenShareService = binder.getService();
                    isServiceBound = true;

                    mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, data);
                    screenShareService.setMediaProjection(mediaProjection);

                    screenShareService.setOnStopListener(new ScreenShareService.OnStopListener() {
                        @Override
                        public void onStop() {
                            if (getActivity() != null) {
                                getActivity().runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        stopCapture();
                                    }
                                });
                            } else {
                                stopCapture();
                            }
                        }
                    });

                    startCapturePipeline(call);
                }

                @Override
                public void onServiceDisconnected(ComponentName name) {
                    isServiceBound = false;
                    screenShareService = null;
                }
            };
            getContext().bindService(serviceIntent, serviceConnection, Context.BIND_AUTO_CREATE);
        } else {
            call.reject("Permission denied or cancelled by user");
        }
    }

    private void startCapturePipeline(PluginCall call) {
        try {
            android.os.PowerManager pm = (android.os.PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (pm != null && (wakeLock == null || !wakeLock.isHeld())) {
                wakeLock = pm.newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "EduMeet:ScreenShareWakeLock");
                wakeLock.acquire();
            }

            WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null && (wifiLock == null || !wifiLock.isHeld())) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "EduMeet:ScreenShareWifiLock");
                wifiLock.acquire();
            }

            DisplayMetrics metrics = new DisplayMetrics();
            getActivity().getWindowManager().getDefaultDisplay().getRealMetrics(metrics);
            final int screenWidth = metrics.widthPixels > 0 ? metrics.widthPixels : 1080;
            final int screenHeight = metrics.heightPixels > 0 ? metrics.heightPixels : 1920;
            final int screenDensity = metrics.densityDpi > 0 ? metrics.densityDpi : DisplayMetrics.DENSITY_DEFAULT;

            final int capWidth = 720;
            final int capHeight = Math.max(16, (screenHeight * capWidth) / screenWidth);

            handlerThread = new HandlerThread("ScreenShareBackgroundThread");
            handlerThread.start();
            backgroundHandler = new Handler(handlerThread.getLooper());

            if (mediaProjection != null) {
                mediaProjectionCallback = new MediaProjection.Callback() {
                    @Override
                    public void onStop() {
                        super.onStop();
                        Activity activity = getActivity();
                        if (activity != null) {
                            activity.runOnUiThread(() -> stopCapture());
                        } else {
                            stopCapture();
                        }
                    }
                };
                mediaProjection.registerCallback(mediaProjectionCallback, backgroundHandler);
            }

            imageReader = ImageReader.newInstance(capWidth, capHeight, PixelFormat.RGBA_8888, 2);
            
            virtualDisplay = mediaProjection.createVirtualDisplay(
                    "ScreenShareDisplay",
                    capWidth, capHeight, screenDensity,
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                    imageReader.getSurface(),
                    null, backgroundHandler
            );

            imageReader.setOnImageAvailableListener(new ImageReader.OnImageAvailableListener() {
                private long lastFrameTime = 0;
                
                @Override
                public void onImageAvailable(ImageReader reader) {
                    if (isProcessingFrame.get()) {
                        try {
                            Image stale = reader.acquireLatestImage();
                            if (stale != null) stale.close();
                        } catch (Exception e) {}
                        return;
                    }
                    isProcessingFrame.set(true);

                    Image image = null;
                    try {
                        image = reader.acquireLatestImage();
                        if (image == null) return;

                        long now = System.currentTimeMillis();
                        if (now - lastFrameTime < 150) {
                            image.close();
                            return;
                        }
                        lastFrameTime = now;

                        int width = image.getWidth();
                        int height = image.getHeight();
                        Image.Plane[] planes = image.getPlanes();
                        ByteBuffer buffer = planes[0].getBuffer();
                        int pixelStride = planes[0].getPixelStride();
                        int rowStride = planes[0].getRowStride();
                        int rowPadding = rowStride - pixelStride * width;

                        Bitmap bitmap = Bitmap.createBitmap(width + rowPadding / pixelStride, height, Bitmap.Config.ARGB_8888);
                        bitmap.copyPixelsFromBuffer(buffer);

                        Bitmap croppedBitmap = Bitmap.createBitmap(bitmap, 0, 0, width, height);
                        
                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        croppedBitmap.compress(Bitmap.CompressFormat.JPEG, 70, baos);
                        byte[] byteArray = baos.toByteArray();
                        String base64 = Base64.encodeToString(byteArray, Base64.NO_WRAP);

                        bitmap.recycle();
                        croppedBitmap.recycle();
                        image.close();

                        lastBase64Frame = base64;
                        lastRealFrameTime = now;

                        JSObject frameData = new JSObject();
                        frameData.put("base64", base64);
                        notifyListeners("onFrame", frameData);

                    } catch (Throwable t) {
                        android.util.Log.e("ScreenSharePlugin", "Error processing capture frame: ", t);
                        if (image != null) {
                            try { image.close(); } catch (Exception ex) {}
                        }
                    } finally {
                        isProcessingFrame.set(false);
                    }
                }
            }, backgroundHandler);

            isSharing = true;

            // Heartbeat ticker: If screen is static (no image available from VirtualDisplay for 400ms),
            // re-emit last cached frame to prevent WebRTC track starvation and freezing.
            heartbeatRunnable = new Runnable() {
                @Override
                public void run() {
                    if (!isSharing || backgroundHandler == null) return;
                    long now = System.currentTimeMillis();
                    if (lastBase64Frame != null && (now - lastRealFrameTime >= 400)) {
                        try {
                            JSObject frameData = new JSObject();
                            frameData.put("base64", lastBase64Frame);
                            notifyListeners("onFrame", frameData);
                        } catch (Exception e) {}
                    }
                    if (isSharing && backgroundHandler != null) {
                        backgroundHandler.postDelayed(this, 400);
                    }
                }
            };
            backgroundHandler.postDelayed(heartbeatRunnable, 400);

            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to initialize capture pipeline: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopScreenShare(PluginCall call) {
        stopCapture();
        call.resolve();
    }

    private void stopCapture() {
        if (!isSharing) return;

        isSharing = false;

        try {
            JSObject data = new JSObject();
            notifyListeners("onStop", data);
        } catch (Exception e) {
            // Ignore
        }

        if (backgroundHandler != null && heartbeatRunnable != null) {
            try { backgroundHandler.removeCallbacks(heartbeatRunnable); } catch (Exception e) {}
            heartbeatRunnable = null;
        }
        lastBase64Frame = null;

        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception e) {}
            wakeLock = null;
        }

        if (wifiLock != null && wifiLock.isHeld()) {
            try { wifiLock.release(); } catch (Exception e) {}
            wifiLock = null;
        }

        if (virtualDisplay != null) {
            try { virtualDisplay.release(); } catch (Exception e) {}
            virtualDisplay = null;
        }

        if (imageReader != null) {
            try {
                imageReader.setOnImageAvailableListener(null, null);
                imageReader.close();
            } catch (Exception e) {}
            imageReader = null;
        }

        if (mediaProjection != null) {
            if (mediaProjectionCallback != null) {
                try {
                    mediaProjection.unregisterCallback(mediaProjectionCallback);
                } catch (Exception e) {}
                mediaProjectionCallback = null;
            }
            try { mediaProjection.stop(); } catch (Exception e) {}
            mediaProjection = null;
        }

        if (handlerThread != null) {
            try {
                handlerThread.quitSafely();
                handlerThread.join();
            } catch (InterruptedException e) {
                // Ignore
            }
            handlerThread = null;
            backgroundHandler = null;
        }

        if (isServiceBound && serviceConnection != null) {
            try {
                getContext().unbindService(serviceConnection);
            } catch (Exception e) {
                // Ignore
            }
            isServiceBound = false;
            serviceConnection = null;
        }
        
        try {
            Intent serviceIntent = new Intent(getContext(), ScreenShareService.class);
            getContext().stopService(serviceIntent);
        } catch (Exception e) {
            // Ignore
        }
    }
}
