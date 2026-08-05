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
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.util.Base64;
import android.util.DisplayMetrics;
import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

@CapacitorPlugin(name = "ScreenSharePlugin")
public class ScreenSharePlugin extends Plugin {
    private MediaProjectionManager mediaProjectionManager;
    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    
    private ScreenShareService screenShareService;
    private boolean isServiceBound = false;
    private boolean isSharing = false;
    
    private HandlerThread handlerThread;
    private Handler backgroundHandler;

    private ServiceConnection serviceConnection = null;

    @PluginMethod
    public void startScreenShare(PluginCall call) {
        if (isSharing) {
            call.resolve();
            return;
        }
        
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
            getContext().startService(serviceIntent);
            serviceConnection = new ServiceConnection() {
                @Override
                public void onServiceConnected(ComponentName name, IBinder service) {
                    ScreenShareService.LocalBinder binder = (ScreenShareService.LocalBinder) service;
                    screenShareService = binder.getService();
                    isServiceBound = true;

                    mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, data);
                    screenShareService.setMediaProjection(mediaProjection);

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
            DisplayMetrics metrics = new DisplayMetrics();
            getActivity().getWindowManager().getDefaultDisplay().getRealMetrics(metrics);
            final int screenWidth = metrics.widthPixels;
            final int screenHeight = metrics.heightPixels;
            final int screenDensity = metrics.densityDpi;

            final int capWidth = 640;
            final int capHeight = (screenHeight * capWidth) / screenWidth;

            handlerThread = new HandlerThread("ScreenShareBackgroundThread");
            handlerThread.start();
            backgroundHandler = new Handler(handlerThread.getLooper());

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
                    Image image = null;
                    try {
                        image = reader.acquireLatestImage();
                        if (image == null) return;

                        long now = System.currentTimeMillis();
                        if (now - lastFrameTime < 120) {
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
                        croppedBitmap.compress(Bitmap.CompressFormat.JPEG, 45, baos);
                        byte[] byteArray = baos.toByteArray();
                        String base64 = Base64.encodeToString(byteArray, Base64.NO_WRAP);

                        bitmap.recycle();
                        croppedBitmap.recycle();
                        image.close();

                        JSObject frameData = new JSObject();
                        frameData.put("base64", base64);
                        notifyListeners("onFrame", frameData);

                    } catch (Exception e) {
                        if (image != null) {
                            image.close();
                        }
                    }
                }
            }, backgroundHandler);

            isSharing = true;
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

        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }

        if (imageReader != null) {
            imageReader.setOnImageAvailableListener(null, null);
            imageReader.close();
            imageReader = null;
        }

        if (mediaProjection != null) {
            mediaProjection.stop();
            mediaProjection = null;
        }

        if (handlerThread != null) {
            handlerThread.quitSafely();
            try {
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
