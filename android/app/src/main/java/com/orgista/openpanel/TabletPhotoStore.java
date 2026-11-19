package com.orgista.openpanel;

import android.content.ContentResolver;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Comparator;
import java.util.UUID;

final class TabletPhotoStore {
    static final int MAX_PHOTOS = 12;
    private static final String PHOTO_NAME = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg";
    private final File directory;

    TabletPhotoStore(File directory) { this.directory = directory; }

    File[] files() throws IOException {
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Photo storage unavailable");
        File[] files = directory.listFiles(file -> file.isFile() && file.getName().matches(PHOTO_NAME));
        if (files == null) throw new IOException("Photo storage unavailable");
        Arrays.sort(files, Comparator.comparing(File::getName));
        return files;
    }

    boolean isFull() throws IOException { return files().length >= MAX_PHOTOS; }

    static int[] dimensions(int width, int height) {
        double scale = Math.min(1, 1920.0 / Math.max(width, height));
        return new int[] {Math.max(1, (int) Math.round(width * scale)), Math.max(1, (int) Math.round(height * scale))};
    }

    File add(ContentResolver resolver, Uri uri) throws IOException {
        if (isFull()) throw new PhotoException("PHOTO_LIMIT");
        if (directory.getUsableSpace() < 16L * 1024 * 1024) throw new PhotoException("PHOTO_STORAGE_FULL");
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;
        try (InputStream input = resolver.openInputStream(uri)) { BitmapFactory.decodeStream(input, null, options); }
        if (options.outWidth <= 0 || options.outHeight <= 0) throw new PhotoException("PHOTO_UNREADABLE");
        int[] size = dimensions(options.outWidth, options.outHeight);
        options.inSampleSize = 1;
        while (Math.max(options.outWidth, options.outHeight) / options.inSampleSize > 3840) options.inSampleSize *= 2;
        options.inJustDecodeBounds = false;
        Bitmap decoded = null;
        Bitmap scaled = null;
        Bitmap oriented = null;
        File temporary = new File(directory, UUID.randomUUID() + ".tmp");
        File destination = new File(directory, UUID.randomUUID() + ".jpg");
        try {
            try (InputStream input = resolver.openInputStream(uri)) { decoded = BitmapFactory.decodeStream(input, null, options); }
            if (decoded == null) throw new PhotoException("PHOTO_UNREADABLE");
            scaled = Bitmap.createScaledBitmap(decoded, size[0], size[1], true);
            Matrix orientation = orientation(resolver, uri);
            oriented = Bitmap.createBitmap(scaled, 0, 0, scaled.getWidth(), scaled.getHeight(), orientation, true);
            try (FileOutputStream output = new FileOutputStream(temporary)) {
                if (!oriented.compress(Bitmap.CompressFormat.JPEG, 85, output)) throw new IOException("Photo encoding failed");
                output.getFD().sync();
            }
            if (!temporary.renameTo(destination)) throw new IOException("Photo save failed");
            return destination;
        } finally {
            temporary.delete();
            if (oriented != null && oriented != scaled) oriented.recycle();
            if (scaled != null && scaled != decoded) scaled.recycle();
            if (decoded != null) decoded.recycle();
        }
    }

    private static Matrix orientation(ContentResolver resolver, Uri uri) throws IOException {
        Matrix matrix = new Matrix();
        int orientation;
        try (InputStream input = resolver.openInputStream(uri)) {
            orientation = new ExifInterface(input).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
        } catch (IOException unsupportedMetadata) {
            return matrix;
        }
        switch (orientation) {
            case ExifInterface.ORIENTATION_FLIP_HORIZONTAL: matrix.setScale(-1, 1); break;
            case ExifInterface.ORIENTATION_ROTATE_180: matrix.setRotate(180); break;
            case ExifInterface.ORIENTATION_FLIP_VERTICAL: matrix.setScale(1, -1); break;
            case ExifInterface.ORIENTATION_TRANSPOSE: matrix.setRotate(90); matrix.postScale(-1, 1); break;
            case ExifInterface.ORIENTATION_ROTATE_90: matrix.setRotate(90); break;
            case ExifInterface.ORIENTATION_TRANSVERSE: matrix.setRotate(-90); matrix.postScale(-1, 1); break;
            case ExifInterface.ORIENTATION_ROTATE_270: matrix.setRotate(-90); break;
        }
        return matrix;
    }

    boolean remove(String id) {
        if (!id.startsWith("photo:")) return false;
        String name = id.substring(6) + ".jpg";
        return name.matches(PHOTO_NAME) && new File(directory, name).delete();
    }

    static final class PhotoException extends IOException {
        final String code;
        PhotoException(String code) { super(code); this.code = code; }
    }
}
