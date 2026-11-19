package com.orgista.openpanel;

import okhttp3.HttpUrl;

final class ManagedLinkPolicy {
    private ManagedLinkPolicy() {}

    static boolean isAllowed(String initial, String candidate) {
        HttpUrl root = initial == null ? null : HttpUrl.parse(initial);
        HttpUrl next = candidate == null ? null : HttpUrl.parse(candidate);
        if (root == null || next == null || !root.isHttps() || !next.isHttps()
                || !root.username().isEmpty() || !root.password().isEmpty()
                || !next.username().isEmpty() || !next.password().isEmpty()) return false;
        String site = root.topPrivateDomain();
        return site == null ? root.host().equals(next.host()) : site.equals(next.topPrivateDomain());
    }
}
