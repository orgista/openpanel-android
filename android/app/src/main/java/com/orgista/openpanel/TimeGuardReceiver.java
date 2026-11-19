package com.orgista.openpanel;

import android.app.AlarmManager;
import android.app.KeyguardManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import android.util.Log;

/** Downtime and budget alarms: wake OpenPanel even if Android froze or killed it while a child was in another app. */
public class TimeGuardReceiver extends BroadcastReceiver {
    static final String ACTION_BUDGET = "com.orgista.openpanel.TIME_BUDGET";
    /** True while this process is counting away time; a fresh process after a kill starts false. */
    static volatile boolean counting = false;
    private static final long RETRY_MS = 60_000;

    @Override
    public void onReceive(Context context, Intent intent) {
        // A live process stops the budget itself from its own count, which leaves out screen-off time.
        if (ACTION_BUDGET.equals(intent.getAction()) && counting) return;
        if (screenInUse(context)) {
            bringOpenPanelForward(context);
            return;
        }
        // Delivered under the lock screen: try again shortly (non-wakeup, so only while the tablet is awake),
        // otherwise unlocking returns the child to the app that was in front.
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        boolean budget = ACTION_BUDGET.equals(intent.getAction());
        Intent again = new Intent(context, TimeGuardReceiver.class);
        if (budget) again.setAction(ACTION_BUDGET);
        PendingIntent retry = PendingIntent.getBroadcast(context, budget ? 1 : 0, again,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        alarms.setWindow(AlarmManager.RTC, System.currentTimeMillis() + RETRY_MS, RETRY_MS, retry);
    }

    static boolean screenInUse(Context context) {
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        KeyguardManager keyguard = (KeyguardManager) context.getSystemService(Context.KEYGUARD_SERVICE);
        return power != null && power.isInteractive() && (keyguard == null || !keyguard.isKeyguardLocked());
    }

    /** OpenPanel's own lock takes over once it is in front. */
    static void bringOpenPanelForward(Context context) {
        if (!screenInUse(context)) return;
        Intent intent = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        try {
            context.startActivity(intent);
        } catch (Exception e) {
            Log.w("OpenPanel", "Time guard could not bring OpenPanel forward", e);
        }
    }
}
