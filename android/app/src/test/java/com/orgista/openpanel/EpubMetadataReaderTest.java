package com.orgista.openpanel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class EpubMetadataReaderTest {
    @Rule public TemporaryFolder folder = new TemporaryFolder();

    private File epub(String opf) throws Exception {
        File file = folder.newFile("book.epub");
        try (ZipOutputStream zip = new ZipOutputStream(new FileOutputStream(file))) {
            put(zip, "META-INF/container.xml",
                "<?xml version=\"1.0\"?><container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">"
                    + "<rootfiles><rootfile full-path=\"OEBPS/content.opf\" media-type=\"application/oebps-package+xml\"/></rootfiles></container>");
            put(zip, "OEBPS/content.opf", opf);
        }
        return file;
    }

    private static void put(ZipOutputStream zip, String name, String body) throws Exception {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(body.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    @Test
    public void readsTitleAndAuthors() throws Exception {
        File file = epub("<?xml version=\"1.0\"?><package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\">"
            + "<metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\"><dc:title>  The Little\n Story </dc:title>"
            + "<dc:creator>Ann Author</dc:creator><dc:creator>Bo Writer</dc:creator><dc:creator>Ann Author</dc:creator>"
            + "</metadata></package>");

        EpubMetadataReader.Metadata metadata = EpubMetadataReader.read(file);

        assertEquals("The Little Story", metadata.title);
        assertEquals(Arrays.asList("Ann Author", "Bo Writer"), metadata.authors);
    }

    @Test
    public void returnsNullWithoutTitle() throws Exception {
        File file = epub("<?xml version=\"1.0\"?><package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\">"
            + "<metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\"></metadata></package>");

        assertNull(EpubMetadataReader.read(file));
    }

    @Test
    public void returnsNullForNonZip() throws Exception {
        File file = folder.newFile("not.epub");
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write("plain text".getBytes(StandardCharsets.UTF_8));
        }

        assertNull(EpubMetadataReader.read(file));
    }
}
