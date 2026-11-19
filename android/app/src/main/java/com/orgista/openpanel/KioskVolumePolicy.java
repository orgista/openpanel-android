package com.orgista.openpanel;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.view.KeyEvent;

/**
 * Keeps the media stream child-safe. An enabled Fire kiosk holds one fixed level;
 * the admin volume limit is a ceiling the volume may stay under.
 */
final class KioskVolumePolicy {
    private static final int FIRE_KIOSK_PERCENT = 28;
    private static final int RAISES_BEFORE_HINT = 3;
    private static final long RAISE_WINDOW_MS = 8_000;
    private static int blockedRaises;
    private static long lastBlockedRaiseAt;

    private KioskVolumePolicy() {}

    static boolean shouldLock(String mode, boolean kioskEnabled, boolean fireDevice) {
        return KioskState.MODE_STANDALONE.equals(mode) && kioskEnabled && fireDevice;
    }

    private static boolean isFireKioskLocked(Context context) {
        return shouldLock(
            KioskState.getMode(context),
            KioskState.isEnabled(context),
            LandscapeOrientationLock.isFireDevice(Build.MANUFACTURER, Build.BRAND)
        );
    }

    static boolean shouldLock(Context context) {
        return isFireKioskLocked(context) || isLimitActive(context);
    }

    /** The admin limit is for the tablet's speakers; headphones keep their own volume. */
    private static boolean isLimitActive(Context context) {
        if (!KioskState.isVolumeLimitEnabled(context)) return false;
        AudioManager audio = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (audio == null) return true;
        for (AudioDeviceInfo device : audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            if (isHeadphones(device.getType())) return false;
        }
        return true;
    }

    static boolean isHeadphones(int deviceType) {
        return deviceType == AudioDeviceInfo.TYPE_WIRED_HEADSET
            || deviceType == AudioDeviceInfo.TYPE_WIRED_HEADPHONES
            || deviceType == AudioDeviceInfo.TYPE_USB_HEADSET
            || deviceType == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
            || deviceType == AudioDeviceInfo.TYPE_BLE_HEADSET;
    }

    /** True on the press after RAISES_BEFORE_HINT blocked ones in a row: time to suggest headphones. */
    static synchronized boolean noteBlockedRaise(long now) {
        if (now - lastBlockedRaiseAt > RAISE_WINDOW_MS) blockedRaises = 0;
        lastBlockedRaiseAt = now;
        if (++blockedRaises <= RAISES_BEFORE_HINT) return false;
        blockedRaises = 0;
        return true;
    }

    private static void blockedRaise(Context context) {
        if (noteBlockedRaise(android.os.SystemClock.elapsedRealtime())) SystemBridgePlugin.showVolumeHint(context);
    }

    static boolean shouldConsumeKey(
        boolean fireKioskLocked, boolean limitEnabled, int keyCode, int current, int ceiling
    ) {
        if (fireKioskLocked) return isVolumeMutationKey(keyCode);
        return limitEnabled && keyCode == KeyEvent.KEYCODE_VOLUME_UP && current >= ceiling;
    }

    static boolean shouldConsumeKey(Context context, int keyCode) {
        if (!isVolumeMutationKey(keyCode)) return false;
        boolean fireKioskLocked = isFireKioskLocked(context);
        boolean limitEnabled = isLimitActive(context);
        if (!fireKioskLocked && !limitEnabled) return false;
        AudioManager audio = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (audio == null) return fireKioskLocked;
        int target = targetVolumeForMaximum(
            audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC), getEffectivePercent(context));
        return shouldConsumeKey(fireKioskLocked, limitEnabled, keyCode,
            audio.getStreamVolume(AudioManager.STREAM_MUSIC), target);
    }

    /** A volume-up press that shouldConsumeKey swallowed at the limit. */
    static void onConsumedKeyDown(Context context, int keyCode) {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP && !isFireKioskLocked(context)) blockedRaise(context);
    }

    static int enforcedVolume(boolean fireKioskLocked, int current, int target) {
        return fireKioskLocked ? target : Math.min(current, target);
    }

    static boolean isVolumeMutationKey(int keyCode) {
        return keyCode == KeyEvent.KEYCODE_VOLUME_UP
            || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN
            || keyCode == KeyEvent.KEYCODE_VOLUME_MUTE;
    }

    static int getEffectivePercent(Context context) {
        if (KioskState.isVolumeLimitEnabled(context)) {
            return KioskState.getVolumeLimitPercent(context);
        }
        return FIRE_KIOSK_PERCENT;
    }

    static int targetVolumeForMaximum(int maximum) {
        return targetVolumeForMaximum(maximum, FIRE_KIOSK_PERCENT);
    }

    static int targetVolumeForMaximum(int maximum, int percent) {
        if (maximum <= 0) return 0;
        return Math.max(1, (maximum * percent + 50) / 100);
    }

    static boolean enforceTarget(Context context) {
        if (!shouldLock(context)) return false;
        AudioManager audio = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (audio == null) return false;
        int maximum = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        int target = targetVolumeForMaximum(maximum, getEffectivePercent(context));
        int current = audio.getStreamVolume(AudioManager.STREAM_MUSIC);
        boolean fireKioskLocked = isFireKioskLocked(context);
        int enforced = enforcedVolume(fireKioskLocked, current, target);
        if (current != enforced) {
            audio.setStreamVolume(AudioManager.STREAM_MUSIC, enforced, 0);
            if (!fireKioskLocked) blockedRaise(context);
        }
        return true;
    }
}
