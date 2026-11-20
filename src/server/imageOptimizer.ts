import crypto from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import type { ImageOptimizationInfo } from '../types/migration.ts';

export interface ImageOptimizeConfig {
  enabled: boolean;
  quality: number;
  maxWidth: number;
}

export interface ImageOptimizeOutcome {
  buffer: Buffer;
  mimeType: string;
  localPath: string | null;
  info: ImageOptimizationInfo;
}

const RASTER_MIMES = new Set([
  'image/png',
  'image/webp',
  'image/jpeg',
  'image/jpg',
  'image/avif',
  'image/tiff',
  'image/gif',
]);

const RASTER_EXTS = new Set(['png', 'webp', 'jpg', 'jpeg', 'avif', 'tif', 'tiff', 'gif']);

export function isSvgImage(mimeType: string, pathOrName?: string): boolean {
  const mime = (mimeType || '').toLowerCase();
  if (mime.includes('svg')) return true;
  if (pathOrName && /\.svg(\?|#|$)/i.test(pathOrName)) return true;
  return false;
}

export function isEligibleRasterImage(mimeType: string, pathOrName?: string): boolean {
  if (isSvgImage(mimeType, pathOrName)) return false;
  const mime = (mimeType || '').split(';')[0].trim().toLowerCase();
  if (RASTER_MIMES.has(mime)) return true;
  if (pathOrName) {
    const ext = pathOrName.split('?')[0].split('.').pop()?.toLowerCase() || '';
    return RASTER_EXTS.has(ext);
  }
  return false;
}

function normalizeFormatLabel(rawFormat: string | undefined, mimeType: string, filename: string): string {
  const f = (rawFormat || '').toLowerCase();
  if (f === 'jpeg' || f === 'jpg') return 'JPEG';
  if (f === 'png') return 'PNG';
  if (f === 'webp') return 'WEBP';
  if (f === 'avif') return 'AVIF';
  if (f === 'gif') return 'GIF';
  if (f === 'svg') return 'SVG';
  if (f === 'tiff' || f === 'tif') return 'TIFF';

  const mime = mimeType.toLowerCase();
  if (mime.includes('svg')) return 'SVG';
  if (mime.includes('webp')) return 'WEBP';
  if (mime.includes('png')) return 'PNG';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'JPEG';
  if (mime.includes('gif')) return 'GIF';

  const ext = filename.split('.').pop()?.toUpperCase();
  return ext || 'IMAGE';
}

export function rewritePathToJpeg(localPath: string | null): string | null {
  if (!localPath) return null;
  if (/\.jpe?g$/i.test(localPath)) return localPath;
  if (/\.[a-z0-9]{2,5}$/i.test(localPath)) {
    return localPath.replace(/\.[a-z0-9]{2,5}$/i, '.jpg');
  }
  return `${localPath}.jpg`;
}

export function clampJpegQuality(quality: number | undefined): number {
  const n = Number(quality);
  if (!Number.isFinite(n)) return 82;
  return Math.max(50, Math.min(95, Math.round(n)));
}

export function normalizeMaxWidth(maxWidth: number | undefined): number {
  const n = Number(maxWidth);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(400, Math.min(3840, Math.round(n)));
}

/**
 * Inspects and optionally converts/compresses high-resolution raster images
 * (WebP, heavy PNG, high-res JPEG, AVIF, TIFF) into progressive mozjpeg JPEGs.
 * Vector SVGs are always preserved untouched.
 */
export async function processImageBinary(
  originalBuffer: Buffer,
  originalMimeType: string,
  originalLocalPath: string | null,
  displayName: string,
  config: ImageOptimizeConfig,
): Promise<ImageOptimizeOutcome> {
  const isSvg = isSvgImage(originalMimeType, originalLocalPath || displayName);
  const eligible = !isSvg && isEligibleRasterImage(originalMimeType, originalLocalPath || displayName);

  if (isSvg || !eligible) {
    return {
      buffer: originalBuffer,
      mimeType: originalMimeType,
      localPath: originalLocalPath,
      info: {
        eligible: false,
        applied: false,
        originalFormat: isSvg ? 'SVG' : normalizeFormatLabel(undefined, originalMimeType, displayName),
        outputFormat: isSvg ? 'SVG' : normalizeFormatLabel(undefined, originalMimeType, displayName),
        bytesSaved: 0,
      },
    };
  }

  let metadata: Metadata | null = null;
  try {
    metadata = await sharp(originalBuffer).metadata();
  } catch {
    return {
      buffer: originalBuffer,
      mimeType: originalMimeType,
      localPath: originalLocalPath,
      info: {
        eligible: false,
        applied: false,
        originalFormat: normalizeFormatLabel(undefined, originalMimeType, displayName),
        outputFormat: normalizeFormatLabel(undefined, originalMimeType, displayName),
        bytesSaved: 0,
      },
    };
  }

  const originalFormat = normalizeFormatLabel(metadata.format, originalMimeType, displayName);
  const originalWidth = metadata.width;
  const originalHeight = metadata.height;

  if (!config.enabled) {
    return {
      buffer: originalBuffer,
      mimeType: originalMimeType,
      localPath: originalLocalPath,
      info: {
        eligible: true,
        applied: false,
        originalFormat,
        outputFormat: originalFormat,
        originalWidth,
        originalHeight,
        outputWidth: originalWidth,
        outputHeight: originalHeight,
        bytesSaved: 0,
      },
    };
  }

  const quality = clampJpegQuality(config.quality);
  const maxWidth = normalizeMaxWidth(config.maxWidth);

  try {
    let pipeline = sharp(originalBuffer, { animated: false });
    if (maxWidth > 0 && originalWidth && originalWidth > maxWidth) {
      pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
    }

    // Flatten alpha channel cleanly onto crisp white before JPEG encoding
    pipeline = pipeline.flatten({ background: '#ffffff' });

    const { data: optimizedBuffer, info: outInfo } = await pipeline
      .jpeg({
        quality,
        progressive: true,
        mozjpeg: true,
        chromaSubsampling: '4:2:0',
      })
      .toBuffer({ resolveWithObject: true });

    // If source was already JPEG and re-encoding didn't shrink or resize it, keep original
    const wasAlreadyJpeg = originalFormat === 'JPEG';
    const wasResized = Boolean(originalWidth && outInfo.width && outInfo.width < originalWidth);
    if (wasAlreadyJpeg && !wasResized && optimizedBuffer.byteLength >= originalBuffer.byteLength) {
      return {
        buffer: originalBuffer,
        mimeType: 'image/jpeg',
        localPath: rewritePathToJpeg(originalLocalPath),
        info: {
          eligible: true,
          applied: true,
          originalFormat: 'JPEG',
          outputFormat: 'JPEG',
          originalWidth,
          originalHeight,
          outputWidth: originalWidth,
          outputHeight: originalHeight,
          quality,
          bytesSaved: 0,
        },
      };
    }

    const bytesSaved = Math.max(0, originalBuffer.byteLength - optimizedBuffer.byteLength);

    return {
      buffer: optimizedBuffer,
      mimeType: 'image/jpeg',
      localPath: rewritePathToJpeg(originalLocalPath),
      info: {
        eligible: true,
        applied: true,
        originalFormat,
        outputFormat: 'JPEG',
        originalWidth,
        originalHeight,
        outputWidth: outInfo.width,
        outputHeight: outInfo.height,
        quality,
        bytesSaved,
      },
    };
  } catch {
    return {
      buffer: originalBuffer,
      mimeType: originalMimeType,
      localPath: originalLocalPath,
      info: {
        eligible: true,
        applied: false,
        originalFormat,
        outputFormat: originalFormat,
        originalWidth,
        originalHeight,
        outputWidth: originalWidth,
        outputHeight: originalHeight,
        bytesSaved: 0,
      },
    };
  }
}

// ---------- Cached High-Res Sample Raster Renderer ----------
// Generates authentic high-resolution PNG / WebP images from sample artwork
// so built-in Wix/Squarespace/Strikingly/Webflow samples exercise real image optimization.

const sampleRasterCache = new Map<string, Buffer>();

export async function renderSampleRasterImage(
  svgMarkup: string,
  format: 'png' | 'webp',
  width = 2400,
): Promise<Buffer> {
  const key = `${format}:${width}:${crypto.createHash('sha1').update(svgMarkup).digest('hex').slice(0, 10)}`;
  const cached = sampleRasterCache.get(key);
  if (cached) return cached;

  // Render crisp SVG at high resolution, then encode as authentic high-res source PNG or lossless WebP
  const svgBuf = Buffer.from(svgMarkup, 'utf8');
  const resized = sharp(svgBuf, { density: 220 }).resize({ width, withoutEnlargement: false });

  // Add subtle natural surface variation via raw pixel pass so lossless PNG/WebP behaves like real photography
  const { data: rawPixels, info } = await resized
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Deterministic lightweight film-grain micro-texture (amplitude +/- 3 levels) — visually crisp, realistic raster entropy
  let seed = 0x9e3779b9;
  for (let i = 0; i < rawPixels.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const delta = ((seed >>> 29) & 7) - 3; // -3..+4
    rawPixels[i] = Math.max(0, Math.min(255, rawPixels[i] + delta));
    rawPixels[i + 1] = Math.max(0, Math.min(255, rawPixels[i + 1] + delta));
    rawPixels[i + 2] = Math.max(0, Math.min(255, rawPixels[i + 2] + delta));
  }

  const pipeline = sharp(rawPixels, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  });

  const outBuf =
    format === 'png'
      ? await pipeline.png({ compressionLevel: 6 }).toBuffer()
      : await pipeline.webp({ quality: 96, effort: 2 }).toBuffer();

  sampleRasterCache.set(key, outBuf);
  return outBuf;
}
