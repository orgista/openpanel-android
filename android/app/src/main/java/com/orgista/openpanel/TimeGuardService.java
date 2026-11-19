package com.orgista.openpanel;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.RequiresApi;

/**
 * Held only while a child is in another app with a time limit or downtime armed. Without it Android 14 caches and
 * freezes OpenPanel after a screen off/on, which stops the time guard's ticks.
 */
public class TimeGuardService extends Service {
    private static final String CHANNEL_ID = "time_limits";
    private static final int NOTIFICATION_ID = 4523;

    private static final Object LOCK = new Object();
    private static boolean wanted;
    private static TimeGuardService running;

    static void start(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        synchronized (LOCK) {
            wanted = true;
            if (running != null) return;
        }
        try {
            context.startForegroundService(new Intent(context, TimeGuardService.class));
        } catch (RuntimeException e) {
            Log.w("OpenPanel", "Time guard service could not start", e);
        }
    }

    // Stopping before onStartCommand has called startForeground() crashes the app
    // (ForegroundServiceDidNotStartInTimeException), e.g. a pause and resume in quick
    // succession. A pending start stops itself right after entering the foreground.
    static void stop(Context context) {
        synchronized (LOCK) {
            wanted = false;
            // Cleared now, not in onDestroy: a start() before the old instance is destroyed must start a new one.
            if (running != null) running.stopSelf();
            running = null;
        }
    }

    @RequiresApi(Build.VERSION_CODES.O)
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        NotificationManager notifications = getSystemService(NotificationManager.class);
        notifications.createNotificationChannel(
                new NotificationChannel(CHANNEL_ID, "Time limits", NotificationManager.IMPORTANCE_MIN));
        Notification notification = new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher_monochrome)
                .setContentTitle("Time limits")
                .setOngoing(true)
                .build();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (RuntimeException e) {
            Log.w("OpenPanel", "Time guard service could not enter the foreground", e);
            stopSelf();
            return START_NOT_STICKY;
        }
        synchronized (LOCK) {
            running = this;
            if (!wanted) stopSelf();
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        synchronized (LOCK) {
            if (running == this) running = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
