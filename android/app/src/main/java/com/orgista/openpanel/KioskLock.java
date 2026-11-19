package com.orgista.openpanel;

import android.app.admin.DevicePolicyManager;
import android.app.admin.SystemUpdatePolicy;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.util.Log;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Shared Device-Owner kiosk lockdown so MainActivity's auto-pin and the plugin's
 * enableKioskLock behave identically: a silent LOCKED lock task with the status
 * bar + notifications hidden — never the user-confirmed "App is pinned" mode.
 *
 * The nag appears when startLockTask() runs without the calling package being in
 * the Device-Owner lock-task allowlist, so this always allowlists OpenPanel
 * (merged with any existing entries) first.
 */
final class KioskLock {
    private static final String LOG_TAG = "OpenPanel";
    static final int UPDATE_WINDOW_START_MINUTE = 2 * 60;
    static final int UPDATE_WINDOW_END_MINUTE = 5 * 60;

    private KioskLock() {}

    private static DevicePolicyManager dpm(Context context) {
        return (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
    }

    /**
     * As Device Owner, allowlist OpenPanel (plus any extra packages, merged with
     * the current allowlist so previously-added apps stay launchable) and hide
     * the status bar + notifications, so a following startLockTask() enters
     * silent LOCKED mode. No-op — returns false — when not Device Owner.
     */
    static boolean applyDeviceOwnerLockdown(Context context, List<String> extraPackages) {
        DevicePolicyManager dpm = dpm(context);
        String self = context.getPackageName();
        if (dpm == null || !dpm.isDeviceOwnerApp(self)) return false;
        ComponentName admin = OpenPanelDeviceAdminReceiver.getComponentName(context);
        try {
            Set<String> allow = new LinkedHashSet<>();
            allow.add(self);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                String[] current = dpm.getLockTaskPackages(admin);
                if (current != null) allow.addAll(Arrays.asList(current));
            }
            if (extraPackages != null) {
                for (String p : extraPackages) {
                    if (p != null && !p.isEmpty()) allow.add(p);
                }
            }
            dpm.setLockTaskPackages(admin, allow.toArray(new String[0]));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                // Keep only the power long-press menu; hide status bar,
                // notifications, Home, and Recents inside the lock task.
                dpm.setLockTaskFeatures(admin, DevicePolicyManager.LOCK_TASK_FEATURE_GLOBAL_ACTIONS);
            }
            dpm.setStatusBarDisabled(admin, true);
            // Honor the operator's lock-screen choice on every kiosk engage; the
            // DevicePolicyManager keyguard flag resets across reboots.
            try { dpm.setKeyguardDisabled(admin, KioskState.isKeyguardDisabled(context)); }
            catch (Exception ignored) {}
            disablePlayProtectVerifier(context);
            // Android updates install overnight, never mid-play and never as a prompt a child can tap.
            try { dpm.setSystemUpdatePolicy(admin, SystemUpdatePolicy.createWindowedInstallPolicy(
                UPDATE_WINDOW_START_MINUTE, UPDATE_WINDOW_END_MINUTE)); }
            catch (Exception error) { Log.w(LOG_TAG, "Could not set the system update window", error); }
            return true;
        } catch (Exception error) {
            Log.w(LOG_TAG, "applyDeviceOwnerLockdown failed", error);
            return false;
        }
    }

    /**
     * As Device Owner, turn off the install-time package verifier so Google
     * Play Protect stops scanning/prompting on reboots and subsequent app
     * installs (standard managed-kiosk policy). Best-effort and DO-only; the
     * one-time scan of OpenPanel during provisioning happens before the app has
     * this authority and cannot be suppressed. No-op when not Device Owner.
     */
    static void disablePlayProtectVerifier(Context context) {
        DevicePolicyManager dpm = dpm(context);
        String self = context.getPackageName();
        if (dpm == null || !dpm.isDeviceOwnerApp(self)) return;
        ComponentName admin = OpenPanelDeviceAdminReceiver.getComponentName(context);
        try {
            dpm.setGlobalSetting(admin, "package_verifier_enable", "0");
            dpm.setGlobalSetting(admin, "verifier_verify_adb_installs", "0");
        } catch (Exception error) {
            Log.w(LOG_TAG, "Could not disable the package verifier", error);
        }
    }

    /**
     * As Device Owner, make OpenPanel's HOME alias the fixed Home app without
     * Android's picker. Returns false when not Device Owner.
     */
    static boolean claimHome(Context context) {
        DevicePolicyManager dpm = dpm(context);
        String self = context.getPackageName();
        if (dpm == null || !dpm.isDeviceOwnerApp(self)) return false;
        IntentFilter home = new IntentFilter(Intent.ACTION_MAIN);
        home.addCategory(Intent.CATEGORY_HOME);
        home.addCategory(Intent.CATEGORY_DEFAULT);
        try {
            dpm.addPersistentPreferredActivity(OpenPanelDeviceAdminReceiver.getComponentName(context),
                home, new ComponentName(self, DeviceAccess.HOME_ALIAS_CLASS));
            return true;
        } catch (Exception error) {
            Log.w(LOG_TAG, "Could not set OpenPanel as Home", error);
            return false;
        }
    }

    /** Undo claimHome so the system launcher can resolve Home again (Device Owner only). */
    static void releaseHome(Context context) {
        DevicePolicyManager dpm = dpm(context);
        String self = context.getPackageName();
        if (dpm == null || !dpm.isDeviceOwnerApp(self)) return;
        try {
            dpm.clearPackagePersistentPreferredActivities(
                OpenPanelDeviceAdminReceiver.getComponentName(context), self);
        } catch (Exception error) {
            Log.w(LOG_TAG, "Could not release Home", error);
        }
    }

    /** Re-enable the status bar when leaving the kiosk (Device Owner only). */
    static void releaseStatusBar(Context context) {
        DevicePolicyManager dpm = dpm(context);
        String self = context.getPackageName();
        if (dpm == null || !dpm.isDeviceOwnerApp(self)) return;
        try {
            dpm.setStatusBarDisabled(OpenPanelDeviceAdminReceiver.getComponentName(context), false);
        } catch (Exception ignored) {}
    }
}
