package com.orgista.openpanel;

import android.content.Context;
import android.graphics.Point;
import android.hardware.display.DisplayManager;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import android.view.Display;
import android.view.Surface;

import java.util.Locale;

/**
 * Keeps the device in landscape, OpenPanel's only layout, when the operator has
 * granted Modify system settings: auto-rotate goes off and the fixed rotation is
 * set to landscape, so apps launched from the panel open sideways too.
 */
final class LandscapeOrientationLock {
    private static final String LOG_TAG = "OpenPanel";

    private LandscapeOrientationLock() {}

    static boolean isFireDevice(String manufacturer, String brand) {
        String normalizedManufacturer = normalize(manufacturer);
        String normalizedBrand = normalize(brand);
        return normalizedManufacturer.contains("amazon") || normalizedBrand.contains("amazon");
    }

    static boolean enforce(Context context) {
        if (!Settings.System.canWrite(context)) return false;
        int target = isFireDevice(Build.MANUFACTURER, Build.BRAND)
            ? targetRotation()
            : landscapeRotation(context);
        try {
            if (Settings.System.getInt(
                    context.getContentResolver(),
                    Settings.System.ACCELEROMETER_ROTATION,
                    0
                ) != 0) {
                Settings.System.putInt(
                    context.getContentResolver(),
                    Settings.System.ACCELEROMETER_ROTATION,
                    0
                );
            }
            if (Settings.System.getInt(
                    context.getContentResolver(),
                    Settings.System.USER_ROTATION,
                    Surface.ROTATION_0
                ) != target) {
                Settings.System.putInt(
                    context.getContentResolver(),
                    Settings.System.USER_ROTATION,
                    target
                );
            }
            return true;
        } catch (RuntimeException error) {
            Log.w(LOG_TAG, "Landscape lock could not update system rotation", error);
            return false;
        }
    }

    /** Fire tablet is mounted with its buttons/camera on the opposite landscape edge. */
    static int targetRotation() {
        return Surface.ROTATION_270;
    }

    /** Rotation 0 on screens that are landscape in their natural orientation, else 90. */
    static int landscapeRotation(Context context) {
        DisplayManager displays = (DisplayManager) context.getSystemService(Context.DISPLAY_SERVICE);
        Display display = displays == null ? null : displays.getDisplay(Display.DEFAULT_DISPLAY);
        if (display == null) return Surface.ROTATION_0;
        Point size = new Point();
        display.getRealSize(size);
        return landscapeRotation(size.x, size.y, display.getRotation());
    }

    static int landscapeRotation(int width, int height, int rotation) {
        boolean sideways = rotation == Surface.ROTATION_90 || rotation == Surface.ROTATION_270;
        boolean naturallyLandscape = (width > height) != sideways;
        return naturallyLandscape ? Surface.ROTATION_0 : Surface.ROTATION_90;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
