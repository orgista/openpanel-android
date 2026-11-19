package com.orgista.openpanel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class LandscapeOrientationLockTest {
    @Test
    public void recognizesAmazonManufacturerOrBrand() {
        assertTrue(LandscapeOrientationLock.isFireDevice("Amazon", "Amazon"));
        assertTrue(LandscapeOrientationLock.isFireDevice("unknown", "amazon"));
    }

    @Test
    public void ignoresNonFireAndroidDevices() {
        assertFalse(LandscapeOrientationLock.isFireDevice("Lenovo", "Lenovo"));
        assertFalse(LandscapeOrientationLock.isFireDevice(null, null));
    }

    @Test
    public void usesReverseLandscapeForTheFireTabletMount() {
        assertEquals(3, LandscapeOrientationLock.targetRotation());
    }

    @Test
    public void picksTheLandscapeRotationFromTheCurrentScreenShape() {
        // Landscape-natural screen, upright or turned.
        assertEquals(0, LandscapeOrientationLock.landscapeRotation(1840, 1280, 0));
        assertEquals(0, LandscapeOrientationLock.landscapeRotation(1280, 1840, 1));
        // Portrait-natural screen such as the ONN 11 Pro (1280x1840), upright or turned.
        assertEquals(1, LandscapeOrientationLock.landscapeRotation(1280, 1840, 0));
        assertEquals(1, LandscapeOrientationLock.landscapeRotation(1840, 1280, 1));
    }
}
