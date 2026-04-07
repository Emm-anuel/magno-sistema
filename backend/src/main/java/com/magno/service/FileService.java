package com.magno.service;

import com.magno.config.StorageProperties;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;

@Service
public class FileService {

    private static final Logger log = LoggerFactory.getLogger(FileService.class);

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "application/pdf",
            "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"
    );
    private static final Set<String> VIDEO_CONTENT_TYPES = Set.of(
            "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"
    );
    private static final long MAX_IMAGE_BYTES = 10L * 1024 * 1024;   // 10 MB
    private static final long MAX_VIDEO_BYTES = 50L * 1024 * 1024;   // 50 MB

    private final S3Client s3Client;
    private final StorageProperties props;

    public FileService(S3Client s3Client, StorageProperties props) {
        this.s3Client = s3Client;
        this.props = props;
    }

    /**
     * Validates and uploads a file to S3. Returns the public URL.
     *
     * @param file   Multipart file from the request
     * @param folder Destination folder within the bucket, e.g. "usuarios-ine/42"
     * @return Public URL of the uploaded file
     */
    public String uploadFile(MultipartFile file, String folder) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("El archivo no puede estar vacío");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Tipo de archivo no permitido. " +
                    "Se aceptan: JPG, PNG, WebP, PDF, MP4, MOV, AVI, WebM");
        }

        long maxBytes = VIDEO_CONTENT_TYPES.contains(contentType) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        if (file.getSize() > maxBytes) {
            long maxMB = maxBytes / (1024 * 1024);
            throw new IllegalArgumentException(
                    "El archivo excede el tamaño máximo permitido de " + maxMB + " MB");
        }

        String key = buildKey(folder, file.getOriginalFilename());

        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(props.getBucket())
                        .key(key)
                        .contentType(contentType)
                        .build(),
                RequestBody.fromInputStream(file.getInputStream(), file.getSize())
        );

        String url = props.getPublicUrl().replaceAll("/$", "") + "/" + key;
        log.info("Archivo subido: {}", url);
        return url;
    }

    /**
     * Deletes a file from S3 by its public URL. Idempotent — no exception if the file doesn't exist.
     *
     * @param fileUrl Public URL previously returned by uploadFile
     */
    public void deleteFile(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) return;

        try {
            String prefix = props.getPublicUrl().replaceAll("/$", "") + "/";
            if (!fileUrl.startsWith(prefix)) {
                log.warn("URL no pertenece a este bucket, ignorando: {}", fileUrl);
                return;
            }
            String key = fileUrl.substring(prefix.length());

            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(props.getBucket())
                    .key(key)
                    .build());

            log.info("Archivo eliminado: {}", key);
        } catch (Exception e) {
            log.warn("No se pudo eliminar archivo {}: {}", fileUrl, e.getMessage());
        }
    }

    // ── private ────────────────────────────────────────────────────────

    private String buildKey(String folder, String originalFilename) {
        String ext = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            ext = originalFilename.substring(originalFilename.lastIndexOf('.')).toLowerCase();
        }
        String filename = UUID.randomUUID() + "-" + System.currentTimeMillis() + ext;
        if (folder != null && !folder.isBlank()) {
            return folder.replaceAll("/$", "") + "/" + filename;
        }
        return filename;
    }
}
