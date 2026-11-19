package com.orgista.openpanel;

import android.content.Context;
import android.os.Environment;
import com.getcapacitor.JSObject;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.nio.charset.StandardCharsets;


final class ManagedSettingsFile {
    private ManagedSettingsFile() {}

    static JSObject read(Context context) {
        File media = new File(Environment.getExternalStorageDirectory(),
            "Android/media/" + context.getPackageName() + "/openpanel-managed.json");
        File external = context.getExternalFilesDir(null);
        File[] candidates = external == null ? new File[] { media }
            : new File[] { media, new File(external, "openpanel-managed.json") };
        JSObject result = new JSObject();
        result.put("contents", JSONObject.NULL);
        for (File file : candidates) {
            if (!file.exists()) continue;
            result.put("source", file.getAbsolutePath());
            try {
                if (file.length() > 262144) throw new java.io.IOException("File too large");
                java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
                try (java.io.InputStream stream = new java.io.FileInputStream(file)) {
                    byte[] buffer = new byte[4096];
                    int count;
                    while ((count = stream.read(buffer)) != -1) {
                        if (bytes.size() + count > 262144) throw new java.io.IOException("File too large");
                        bytes.write(buffer, 0, count);
                    }
                }
                result.put("contents", new String(bytes.toByteArray(), StandardCharsets.UTF_8));
            } catch (java.io.IOException | SecurityException error) {
                result.put("error", "unreadable");
            }
            return result;
        }
        return result;
    }

    static boolean containsLink(Context context, String requested) {
        try {
            String contents = read(context).getString("contents");
            if (contents == null) return false;
            JSONObject settings = new JSONObject(contents);
            if (settings.optInt("version") != 1) return false;
            JSONArray links = settings.optJSONArray("links");
            if (links == null) return false;
            for (int i = 0; i < links.length(); i++) {
                if (okhttp3.HttpUrl.get(requested).equals(okhttp3.HttpUrl.parse(links.getJSONObject(i).optString("url")))) return true;
            }
        } catch (org.json.JSONException ignored) {
            return false;
        }
        return false;
    }
}
