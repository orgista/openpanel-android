package com.orgista.openpanel;
import org.junit.Test;
import static org.junit.Assert.*;
public class WifiForgetPolicyTest {
    @Test public void managedNetworksAreNotRemovableByCompanion() {
        assertFalse(WifiForgetPolicy.canForget(false, false));
        assertTrue(WifiForgetPolicy.canForget(false, true));
    }
    @Test public void deviceOwnerCanRemoveSavedNetworks() {
        assertTrue(WifiForgetPolicy.canForget(true, false));
        assertTrue(WifiForgetPolicy.canForget(true, true));
    }
}
