package com.orgista.openpanel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class NetworkPrivacyStateTest {

    @Test
    public void normalizesAndroidPrivateDnsModes() {
        assertEquals("off", NetworkPrivacyState.normalizePrivateDnsMode("off"));
        assertEquals("opportunistic", NetworkPrivacyState.normalizePrivateDnsMode("opportunistic"));
        assertEquals("hostname", NetworkPrivacyState.normalizePrivateDnsMode("hostname"));
        assertEquals("unknown", NetworkPrivacyState.normalizePrivateDnsMode(null));
        assertEquals("unknown", NetworkPrivacyState.normalizePrivateDnsMode("vendor-mode"));
    }

    @Test
    public void requiresTheInstalledEnabledFilterToOwnTheVpn() {
        assertTrue(NetworkPrivacyState.isFilterActive(true, true, true));
        assertFalse(NetworkPrivacyState.isFilterActive(false, true, true));
        assertFalse(NetworkPrivacyState.isFilterActive(true, false, true));
        assertFalse(NetworkPrivacyState.isFilterActive(true, true, false));
    }

    @Test
    public void recognizesAlwaysOnFilterWhenFireOsRedactsTheVpnOwnerUid() {
        assertTrue(NetworkPrivacyState.isVpnOwnedByFilter(true, false, true));
        assertTrue(NetworkPrivacyState.isVpnOwnedByFilter(true, true, false));
        assertFalse(NetworkPrivacyState.isVpnOwnedByFilter(false, true, true));
        assertFalse(NetworkPrivacyState.isVpnOwnedByFilter(true, false, false));
    }

    @Test
    public void recognizesTheFilterDnsPairWithoutAttributingOtherVpns() throws Exception {
        java.net.InetAddress ipv4 = java.net.InetAddress.getByName("10.10.10.10"); // leak-check: allow
        java.net.InetAddress ipv6 = java.net.InetAddress.getByName("fdc8:1095:91e1:aaaa:aaaa:aaaa:aaaa:aaa1");
        assertTrue(NetworkPrivacyState.hasFilterDnsSignature(java.util.Arrays.asList(ipv4, ipv6)));
        assertFalse(NetworkPrivacyState.hasFilterDnsSignature(java.util.Collections.singletonList(ipv4)));
        assertFalse(NetworkPrivacyState.hasFilterDnsSignature(java.util.Arrays.asList(
            java.net.InetAddress.getByName("192.0.2.1"), ipv6)));
    }

    @Test
    public void warnsWhenPrivateDnsCanBypassTheLocalFilter() {
        assertFalse(NetworkPrivacyState.privateDnsMayBypassFilter(true, "off"));
        assertTrue(NetworkPrivacyState.privateDnsMayBypassFilter(true, "opportunistic"));
        assertTrue(NetworkPrivacyState.privateDnsMayBypassFilter(true, "hostname"));
        assertFalse(NetworkPrivacyState.privateDnsMayBypassFilter(true, "unknown"));
        assertFalse(NetworkPrivacyState.privateDnsMayBypassFilter(false, "hostname"));
    }
}
