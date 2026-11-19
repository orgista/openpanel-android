package com.orgista.openpanel;

import java.io.File;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/**
 * Reads the title and authors an EPUB declares in its package document, so a
 * local import is named after the book rather than its file name.
 */
final class EpubMetadataReader {
    private static final String CONTAINER_NS = "urn:oasis:names:tc:opendocument:xmlns:container";
    private static final String DC_NS = "http://purl.org/dc/elements/1.1/";

    static final class Metadata {
        final String title;
        final List<String> authors;

        Metadata(String title, List<String> authors) {
            this.title = title;
            this.authors = authors;
        }
    }

    private EpubMetadataReader() {}

    /** Returns null when the file is not a readable EPUB or declares no title. */
    static Metadata read(File epub) {
        try (ZipFile zip = new ZipFile(epub)) {
            Document container = parse(zip, "META-INF/container.xml");
            if (container == null) return null;
            NodeList rootFiles = container.getElementsByTagNameNS(CONTAINER_NS, "rootfile");
            if (rootFiles.getLength() == 0) return null;
            String opfPath = ((Element) rootFiles.item(0)).getAttribute("full-path");
            Document opf = parse(zip, opfPath);
            if (opf == null) return null;

            String title = firstText(opf.getElementsByTagNameNS(DC_NS, "title"));
            if (title.isEmpty()) return null;
            List<String> authors = new ArrayList<>();
            NodeList creators = opf.getElementsByTagNameNS(DC_NS, "creator");
            for (int i = 0; i < creators.getLength(); i++) {
                String name = creators.item(i).getTextContent().trim();
                if (!name.isEmpty() && !authors.contains(name)) authors.add(name);
            }
            return new Metadata(title, authors);
        } catch (Exception error) {
            return null;
        }
    }

    private static Document parse(ZipFile zip, String path) throws Exception {
        if (path == null || path.isEmpty()) return null;
        ZipEntry entry = zip.getEntry(path);
        if (entry == null) return null;
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setExpandEntityReferences(false);
        DocumentBuilder builder = factory.newDocumentBuilder();
        try (InputStream input = zip.getInputStream(entry)) {
            return builder.parse(input);
        }
    }

    private static String firstText(NodeList nodes) {
        for (int i = 0; i < nodes.getLength(); i++) {
            String text = nodes.item(i).getTextContent().trim().replaceAll("\\s+", " ");
            if (!text.isEmpty()) return text;
        }
        return "";
    }
}
