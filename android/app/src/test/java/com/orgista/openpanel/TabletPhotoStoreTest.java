package com.orgista.openpanel;

import static org.junit.Assert.*;
import java.io.File;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class TabletPhotoStoreTest {
    @Rule public TemporaryFolder folder = new TemporaryFolder();

    @Test public void sizesPortraitLandscapeAndSmallPhotos() {
        assertArrayEquals(new int[] {1920, 960}, TabletPhotoStore.dimensions(4000, 2000));
        assertArrayEquals(new int[] {960, 1920}, TabletPhotoStore.dimensions(2000, 4000));
        assertArrayEquals(new int[] {640, 480}, TabletPhotoStore.dimensions(640, 480));
        assertArrayEquals(new int[] {1920, 1}, TabletPhotoStore.dimensions(100000, 1));
    }

    @Test public void onlyListsCompletedPhotosAndRemovesInsideItsDirectory() throws Exception {
        File directory = folder.newFolder();
        TabletPhotoStore store = new TabletPhotoStore(directory);
        String id = "photo:550e8400-e29b-41d4-a716-446655440000";
        File photo = new File(directory, id.substring(6) + ".jpg");
        assertTrue(photo.createNewFile());
        assertTrue(new File(directory, "incomplete.tmp").createNewFile());
        assertTrue(new File(directory, "unknown.jpg").createNewFile());
        assertEquals(1, store.files().length);
        assertFalse(store.remove("photo:../outside"));
        assertTrue(store.remove(id));
        assertEquals(0, store.files().length);
        assertFalse(store.remove(id));
    }

    @Test public void limitsTheCollectionToTwelvePhotos() throws Exception {
        File directory = folder.newFolder();
        TabletPhotoStore store = new TabletPhotoStore(directory);
        for (int i = 0; i < 12; i++) {
            assertTrue(new File(directory, java.util.UUID.randomUUID() + ".jpg").createNewFile());
        }
        assertTrue(store.isFull());
    }
}
