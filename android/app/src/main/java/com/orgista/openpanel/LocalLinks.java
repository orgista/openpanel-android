package com.orgista.openpanel;

import android.content.Context;

import java.util.ArrayList;
import java.util.List;

import okhttp3.HttpUrl;

/** Web links an admin added by hand on this tablet, stored as one "url<TAB>title" line per link. */
final class LocalLinks {
    static final int MAX = 50;
    private static final int MAX_TITLE = 120;
    private static final String PREFS = "local_links";

    private LocalLinks() {}

    static String load(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(PREFS, null);
    }

    static void save(Context context, String stored) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(PREFS, stored).apply();
    }

    /** Returns the stored form, or null when an entry is not an https link with a title. */
    static String encode(List<String[]> links) {
        if (links.size() > MAX) return null;
        List<String> urls = new ArrayList<>();
        StringBuilder stored = new StringBuilder();
        for (String[] link : links) {
            String url = link[0];
            String title = link[1] == null ? "" : link[1].replaceAll("\\s+", " ").trim();
            if (title.isEmpty() || !ManagedLinkPolicy.isAllowed(url, url)) return null;
            String canonical = HttpUrl.get(url).toString();
            if (urls.contains(canonical)) continue;
            urls.add(canonical);
            stored.append(canonical).append('\t')
                .append(title.length() > MAX_TITLE ? title.substring(0, MAX_TITLE) : title).append('\n');
        }
        return stored.toString();
    }

    static List<String[]> decode(String stored) {
        List<String[]> links = new ArrayList<>();
        if (stored == null) return links;
        for (String line : stored.split("\n")) {
            int tab = line.indexOf('\t');
            if (tab > 0 && tab < line.length() - 1) links.add(new String[] { line.substring(0, tab), line.substring(tab + 1) });
        }
        return links;
    }

    static boolean contains(String stored, String requested) {
        HttpUrl url = requested == null ? null : HttpUrl.parse(requested);
        if (url == null) return false;
        for (String[] link : decode(stored)) if (link[0].equals(url.toString())) return true;
        return false;
    }
}
