package com.orgista.openpanel;

import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.Assert.*;

public class LocalLinksTest {
    private static List<String[]> links(String[]... entries) { return Arrays.asList(entries); }

    @Test public void storesHttpsLinksOnceAndFindsThemAgain() {
        String stored = LocalLinks.encode(links(
            new String[] { "https://example.org/kids", " Reading\tclub " },
            new String[] { "https://example.org/kids", "Duplicate" }));
        List<String[]> decoded = LocalLinks.decode(stored);
        assertEquals(1, decoded.size());
        assertEquals("https://example.org/kids", decoded.get(0)[0]);
        assertEquals("Reading club", decoded.get(0)[1]);
        assertTrue(LocalLinks.contains(stored, "https://example.org/kids"));
        assertFalse(LocalLinks.contains(stored, "https://example.org/other"));
        assertFalse(LocalLinks.contains(stored, "not a url"));
        assertFalse(LocalLinks.contains(null, "https://example.org/kids"));
    }

    @Test public void rejectsAnythingThatIsNotATitledHttpsLink() {
        assertNull(LocalLinks.encode(links(new String[] { "http://example.org", "Plain" })));
        assertNull(LocalLinks.encode(links(new String[] { "intent://example.org", "Intent" })));
        assertNull(LocalLinks.encode(links(new String[] { "https://user:pw@example.org", "Login" })));
        assertNull(LocalLinks.encode(links(new String[] { "https://example.org", "  " })));
        assertNull(LocalLinks.encode(Collections.nCopies(LocalLinks.MAX + 1, new String[] { "https://example.org", "Many" })));
        assertEquals("", LocalLinks.encode(Collections.emptyList()));
    }
}
