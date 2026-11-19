package com.orgista.openpanel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class NotificationSoundsTest {
    @Test
    public void offersSixTonesWithUniqueIds() {
        assertEquals(6, NotificationSounds.TONES.length);
        assertEquals(6, java.util.Arrays.stream(NotificationSounds.TONES).map(t -> t.id).distinct().count());
    }

    @Test
    public void mapsIdToResourceAndDisplayName() {
        NotificationSounds.Tone tone = NotificationSounds.find("ripple");
        assertNotNull(tone);
        assertEquals("tone_ripple", NotificationSounds.resourceName(tone));
        assertEquals("OpenPanel Ripple", NotificationSounds.displayName(tone));
    }

    @Test
    public void rejectsUnknownIds() {
        assertNull(NotificationSounds.find("../ringtone"));
        assertNull(NotificationSounds.find(null));
    }
}
