<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class VideoStreamController extends Controller
{
    /**
     * Stream a stored video file with proper HTTP range support.
     *
     * The mobile app calls this endpoint with a storage-relative path, e.g.:
     *   GET /api/mobile/video/stream?path=modules/1/videos/intro.mp4
     *
     * Supports byte-range requests so Android/iOS can seek, buffer and
     * resume playback without re-downloading the entire file.
     *
     * Requires a valid Sanctum token so videos are not publicly accessible.
     */
    public function stream(Request $request): StreamedResponse
    {
        $path = $request->query('path', '');

        // Reject empty, absolute, or traversal paths
        if (
            $path === ''
            || str_starts_with($path, '/')
            || str_contains($path, '..')
        ) {
            abort(400, 'Invalid video path.');
        }

        $disk = Storage::disk('public');

        if (! $disk->exists($path)) {
            abort(404, 'Video not found.');
        }

        $size     = $disk->size($path);
        $mimeType = 'video/mp4';

        // FilesystemAdapter exposes mimeType(); the contract doesn't declare it,
        // but it is always present on the local/S3/GCS adapters at runtime.
        if (method_exists($disk, 'mimeType')) {
            $mimeType = $disk->mimeType($path) ?: 'video/mp4';
        }

        $rangeHeader = $request->header('Range');

        // ── No Range header — serve the full file ────────────────────────────
        if (! $rangeHeader) {
            return response()->stream(
                function () use ($disk, $path) {
                    $stream = $disk->readStream($path);
                    fpassthru($stream);
                    fclose($stream);
                },
                200,
                [
                    'Content-Type'              => $mimeType,
                    'Content-Length'            => $size,
                    'Accept-Ranges'             => 'bytes',
                    'Cache-Control'             => 'no-store',
                ],
            );
        }

        // ── Range request — partial content (206) ────────────────────────────
        // Parse "bytes=start-end"
        if (! preg_match('/bytes=(\d*)-(\d*)/', $rangeHeader, $matches)) {
            abort(416, 'Range Not Satisfiable');
        }

        $start = $matches[1] !== '' ? (int) $matches[1] : 0;
        $end   = $matches[2] !== '' ? (int) $matches[2] : $size - 1;

        if ($start > $end || $end >= $size) {
            return response()->stream(
                fn () => null,
                416,
                ['Content-Range' => "bytes */{$size}"],
            );
        }

        $length = $end - $start + 1;

        return response()->stream(
            function () use ($disk, $path, $start, $length) {
                $stream = $disk->readStream($path);

                // Seek to the requested byte offset
                if ($start > 0) {
                    fseek($stream, $start);
                }

                $remaining = $length;
                $chunkSize = 1024 * 512; // 512 KB chunks

                while (! feof($stream) && $remaining > 0) {
                    $chunk = fread($stream, min($chunkSize, $remaining));
                    if ($chunk === false) {
                        break;
                    }
                    echo $chunk;
                    $remaining -= strlen($chunk);
                    flush();
                }

                fclose($stream);
            },
            206,
            [
                'Content-Type'              => $mimeType,
                'Content-Length'            => $length,
                'Content-Range'             => "bytes {$start}-{$end}/{$size}",
                'Accept-Ranges'             => 'bytes',
                'Cache-Control'             => 'no-store',
            ],
        );
    }

    /**
     * Return video metadata (duration is not available server-side without
     * FFmpeg, so we just return size and mime type for now).
     *
     * GET /api/mobile/video/info?path=modules/1/videos/intro.mp4
     */
    public function info(Request $request): \Illuminate\Http\JsonResponse
    {
        $path = $request->query('path', '');

        if (
            $path === ''
            || str_starts_with($path, '/')
            || str_contains($path, '..')
        ) {
            abort(400, 'Invalid video path.');
        }

        $disk = Storage::disk('public');

        if (! $disk->exists($path)) {
            abort(404, 'Video not found.');
        }

        return response()->json([
            'size'      => $disk->size($path),
            'mime_type' => method_exists($disk, 'mimeType') ? ($disk->mimeType($path) ?: 'video/mp4') : 'video/mp4',
            'url'       => $this->buildStreamUrl($path, $request),
        ]);
    }

    /**
     * Build the absolute stream URL for a given storage-relative path,
     * using the incoming request's host so LAN / emulator / tunnel all work.
     */
    private function buildStreamUrl(string $path, Request $request): string
    {
        $base = $request->getScheme() . '://' . $request->getHost();
        $port = $request->getPort();

        if ($port && ! in_array($port, [80, 443])) {
            $base .= ':' . $port;
        }

        return $base . '/api/mobile/video/stream?path=' . urlencode($path);
    }
}
