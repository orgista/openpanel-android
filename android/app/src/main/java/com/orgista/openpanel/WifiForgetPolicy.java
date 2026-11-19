package com.orgista.openpanel;
final class WifiForgetPolicy {
    private WifiForgetPolicy() {}
    static boolean canForget(boolean deviceOwner, boolean createdByOpenPanel) {
        return deviceOwner || createdByOpenPanel;
    }
}
