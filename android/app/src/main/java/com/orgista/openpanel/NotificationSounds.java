package com.orgista.openpanel;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

final class NotificationSounds {
    static final class Tone {
        final String id;
        final String title;

        Tone(String id, String title) {
            this.id = id;
            this.title = title;
        }
    }

    static final Tone[] TONES = {
        new Tone("chime", "Chime"),
        new Tone("ripple", "Ripple"),
        new Tone("bell", "Bell"),
        new Tone("tap", "Tap"),
        new Tone("drop", "Drop"),
        new Tone("pop", "Pop"),
    };

    private static final String RELATIVE_PATH = "Notifications/OpenPanel";

    private NotificationSounds() {}

    static Tone find(String id) {
        for (Tone tone : TONES) if (tone.id.equals(id)) return tone;
        return null;
    }

    static String resourceName(Tone tone) {
        return "tone_" + tone.id;
    }

    static String displayName(Tone tone) {
        return "OpenPanel " + tone.title;
    }

    static int resourceId(Context context, Tone tone) {
        return context.getResources().getIdentifier(resourceName(tone), "raw", context.getPackageName());
    }

    static AssetFileDescriptor open(Context context, Tone tone) {
        return context.getResources().openRawResourceFd(resourceId(context, tone));
    }

    /** Returns the MediaStore row for the tone, creating it on first use. API 29+ only. */
    static Uri install(Context context, Tone tone) throws IOException {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) throw new IOException("Scoped storage is required");
        ContentResolver resolver = context.getContentResolver();
        Uri collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        try (Cursor cursor = resolver.query(collection, new String[] { MediaStore.Audio.Media._ID },
            MediaStore.Audio.Media.TITLE + " = ? AND " + MediaStore.Audio.Media.RELATIVE_PATH + " LIKE ?",
            new String[] { displayName(tone), RELATIVE_PATH + "%" }, null)) {
            if (cursor != null && cursor.moveToFirst()) return ContentUris.withAppendedId(collection, cursor.getLong(0));
        }
        ContentValues values = new ContentValues();
        values.put(MediaStore.Audio.Media.DISPLAY_NAME, displayName(tone) + ".wav");
        values.put(MediaStore.Audio.Media.TITLE, displayName(tone));
        values.put(MediaStore.Audio.Media.MIME_TYPE, "audio/x-wav");
        values.put(MediaStore.Audio.Media.RELATIVE_PATH, RELATIVE_PATH);
        values.put(MediaStore.Audio.Media.IS_NOTIFICATION, true);
        values.put(MediaStore.Audio.Media.IS_PENDING, 1);
        Uri uri = resolver.insert(collection, values);
        if (uri == null) throw new IOException("MediaStore insert failed");
        try (AssetFileDescriptor fd = open(context, tone);
             InputStream in = fd.createInputStream();
             OutputStream out = resolver.openOutputStream(uri)) {
            if (out == null) throw new IOException("MediaStore stream unavailable");
            byte[] buffer = new byte[16 * 1024];
            for (int read; (read = in.read(buffer)) > 0; ) out.write(buffer, 0, read);
        } catch (IOException | RuntimeException error) {
            resolver.delete(uri, null, null);
            throw error;
        }
        ContentValues done = new ContentValues();
        done.put(MediaStore.Audio.Media.IS_PENDING, 0);
        resolver.update(uri, done, null, null);
        return uri;
    }
}
