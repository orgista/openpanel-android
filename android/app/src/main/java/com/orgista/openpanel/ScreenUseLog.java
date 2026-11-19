package com.orgista.openpanel;

import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.os.Build;
import android.util.Log;

import java.util.ArrayList;
import java.util.List;

/** Screen-on, unlocked time from Android's own usage log, for stretches when OpenPanel's process was not running. */
final class ScreenUseLog {
    static final int SCREEN_ON = 15, SCREEN_OFF = 16, LOCKED = 17, UNLOCKED = 18;

    private ScreenUseLog() {}

    static long inUseMs(Context context, long from, long to, boolean inUseAtFrom) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P || to <= from) return 0;
        UsageStatsManager usage = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usage == null) return 0;
        List<long[]> events = new ArrayList<>();
        try {
            UsageEvents log = usage.queryEvents(from, to);
            UsageEvents.Event event = new UsageEvents.Event();
            while (log.hasNextEvent()) {
                log.getNextEvent(event);
                events.add(new long[] {event.getTimeStamp(), event.getEventType()});
            }
        } catch (SecurityException e) {
            Log.w("OpenPanel", "Usage access not granted; time while OpenPanel was stopped is not counted", e);
            return 0;
        }
        return inUseMs(events, from, to, inUseAtFrom);
    }

    /** Each event is {time, type}, in time order; other event types are ignored. */
    static long inUseMs(List<long[]> events, long from, long to, boolean inUseAtFrom) {
        boolean on = inUseAtFrom, locked = false;
        long since = from, total = 0;
        for (long[] event : events) {
            long at = Math.max(from, Math.min(to, event[0]));
            if (on && !locked) total += at - since;
            since = at;
            switch ((int) event[1]) {
                case SCREEN_ON: on = true; break;
                case SCREEN_OFF: on = false; break;
                case LOCKED: locked = true; break;
                case UNLOCKED: locked = false; break;
                default: break;
            }
        }
        if (on && !locked) total += to - since;
        return total;
    }
}
