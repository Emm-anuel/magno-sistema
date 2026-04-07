package com.magno.controller;

import com.magno.dto.ApiResponse;
import com.magno.service.FileService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final FileService fileService;

    public FileController(FileService fileService) {
        this.fileService = fileService;
    }

    /**
     * POST /api/files/upload
     * Multipart fields: "file" (required), "folder" (optional query param).
     * Requires authentication (any role).
     */
    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<Map<String, String>>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", required = false, defaultValue = "") String folder) {

        try {
            String url = fileService.uploadFile(file, folder);
            return ResponseEntity.ok(ApiResponse.ok(Map.of("url", url)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Error al subir el archivo, intente de nuevo"));
        }
    }

    /**
     * GET /api/files/local/{filename}
     * Serves files from the local temp directory — only used in dev without MinIO.
     * Permitted without authentication in SecurityConfig.
     */
    @GetMapping("/local/{filename:.+}")
    public ResponseEntity<Resource> serveLocal(@PathVariable String filename) throws IOException {
        Path file = Path.of(System.getProperty("java.io.tmpdir"), "magno-uploads", filename);
        Resource resource = new FileSystemResource(file);

        if (!resource.exists()) {
            return ResponseEntity.notFound().build();
        }

        String contentType = Files.probeContentType(file);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        contentType != null ? contentType : "application/octet-stream"))
                .body(resource);
    }
}
