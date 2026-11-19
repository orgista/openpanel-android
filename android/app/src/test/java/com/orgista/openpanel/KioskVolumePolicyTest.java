package com.orgista.openpanel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class KioskVolumePolicyTest {
    @Test
    public void suggestsHeadphonesOnTheFourthBlockedRaiseInARow() {
        long start = 1_000_000;
        assertFalse(KioskVolumePolicy.noteBlockedRaise(start));
        assertFalse(KioskVolumePolicy.noteBlockedRaise(start + 500));
        assertFalse(KioskVolumePolicy.noteBlockedRaise(start + 1_000));
        assertTrue(KioskVolumePolicy.noteBlockedRaise(start + 1_500));
        assertFalse(KioskVolumePolicy.noteBlockedRaise(start + 2_000));
        // A pause starts the count again.
        assertFalse(KioskVolumePolicy.noteBlockedRaise(start + 60_000));
        assertFalse(KioskVolumePolicy.noteBlockedRaise(start + 61_000));
        assertFalse(KioskVolumePolicy.noteBlockedRaise(start + 62_000));
        assertFalse(KioskVolumePolicy.noteBlockedRaise(start + 90_000));
    }

    @Test
    public void limitIsForSpeakersNotHeadphones() {
        assertTrue(KioskVolumePolicy.isHeadphones(android.media.AudioDeviceInfo.TYPE_BLUETOOTH_A2DP));
        assertTrue(KioskVolumePolicy.isHeadphones(android.media.AudioDeviceInfo.TYPE_WIRED_HEADPHONES));
        assertFalse(KioskVolumePolicy.isHeadphones(android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER));
        assertFalse(KioskVolumePolicy.isHeadphones(android.media.AudioDeviceInfo.TYPE_HDMI));
    }

    @Test
    public void locksMediaVolumeOnlyForEnabledStandaloneFireKiosks() {
        assertTrue(KioskVolumePolicy.shouldLock("standalone", true, true));
        assertFalse(KioskVolumePolicy.shouldLock("standalone", false, true));
        assertFalse(KioskVolumePolicy.shouldLock("companion", true, true));
        assertFalse(KioskVolumePolicy.shouldLock("standalone", true, false));
    }

    @Test
    public void consumesEveryHardwareMediaVolumeMutationWhileLocked() {
        assertTrue(KioskVolumePolicy.isVolumeMutationKey(24));
        assertTrue(KioskVolumePolicy.isVolumeMutationKey(25));
        assertTrue(KioskVolumePolicy.isVolumeMutationKey(164));
        assertFalse(KioskVolumePolicy.isVolumeMutationKey(4));
    }

    @Test
    public void fireKioskBlocksEveryVolumeKeyAtAnyLevel() {
        assertTrue(KioskVolumePolicy.shouldConsumeKey(true, false, 24, 3, 7));
        assertTrue(KioskVolumePolicy.shouldConsumeKey(true, true, 25, 7, 7));
        assertTrue(KioskVolumePolicy.shouldConsumeKey(true, false, 164, 7, 7));
    }

    @Test
    public void volumeLimitOnlyBlocksVolumeUpAtTheCeiling() {
        assertTrue(KioskVolumePolicy.shouldConsumeKey(false, true, 24, 7, 7));
        assertFalse(KioskVolumePolicy.shouldConsumeKey(false, true, 24, 6, 7));
        assertFalse(KioskVolumePolicy.shouldConsumeKey(false, true, 25, 7, 7));
        assertFalse(KioskVolumePolicy.shouldConsumeKey(false, true, 164, 7, 7));
        assertFalse(KioskVolumePolicy.shouldConsumeKey(false, false, 24, 15, 7));
    }

    @Test
    public void volumeLimitLowersLoudAudioButKeepsQuieterLevels() {
        assertEquals(7, KioskVolumePolicy.enforcedVolume(false, 12, 7));
        assertEquals(3, KioskVolumePolicy.enforcedVolume(false, 3, 7));
        assertEquals(7, KioskVolumePolicy.enforcedVolume(true, 3, 7));
    }

    @Test
    public void scalesTheAdminLimitPercentToStreamSteps() {
        assertEquals(8, KioskVolumePolicy.targetVolumeForMaximum(15, 50));
        assertEquals(15, KioskVolumePolicy.targetVolumeForMaximum(15, 100));
        assertEquals(1, KioskVolumePolicy.targetVolumeForMaximum(15, 1));
    }

    @Test
    public void usesAQuietChildSafeTargetInsteadOfMaximumVolume() {
        assertEquals(7, KioskVolumePolicy.targetVolumeForMaximum(25));
        assertEquals(4, KioskVolumePolicy.targetVolumeForMaximum(15));
        assertEquals(1, KioskVolumePolicy.targetVolumeForMaximum(3));
        assertEquals(0, KioskVolumePolicy.targetVolumeForMaximum(0));
    }
}
