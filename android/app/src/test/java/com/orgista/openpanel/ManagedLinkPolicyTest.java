package com.orgista.openpanel;

import org.junit.Test;
import static org.junit.Assert.*;

public class ManagedLinkPolicyTest {
    @Test public void permitsOnlyEncryptedPagesWithinTheRegistrableSite() {
        String root = "https://learn.example.co.uk/start";
        assertTrue(ManagedLinkPolicy.isAllowed(root, "https://media.example.co.uk/page"));
        assertFalse(ManagedLinkPolicy.isAllowed(root, "https://other.co.uk"));
        assertFalse(ManagedLinkPolicy.isAllowed(root, "https://example.co.uk.evil.com"));
        assertFalse(ManagedLinkPolicy.isAllowed(root, "https://user:password@example.co.uk"));
        assertFalse(ManagedLinkPolicy.isAllowed(root, "http://example.co.uk"));
        assertFalse(ManagedLinkPolicy.isAllowed(root, "intent://example.co.uk"));
        assertFalse(ManagedLinkPolicy.isAllowed(root, "javascript:alert(1)"));
    }
    @Test public void keepsPrivateSuffixTenantsSeparateAndHandlesIpHostsExactly() {
        assertFalse(ManagedLinkPolicy.isAllowed("https://one.github.io", "https://two.github.io"));
        assertTrue(ManagedLinkPolicy.isAllowed("https://192.0.2.1", "https://192.0.2.1/page"));
        assertFalse(ManagedLinkPolicy.isAllowed("https://192.0.2.1", "https://192.0.2.2"));
        assertFalse(ManagedLinkPolicy.isAllowed("bad", "https://example.com"));
    }
}
