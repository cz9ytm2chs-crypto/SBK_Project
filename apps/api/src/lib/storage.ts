import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { env } from '../config/env';
import { badRequest } from './errors';
import { randomToken } from './crypto';

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif']);

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  remove(key: string): Promise<void>;
}

class LocalStorage implements Storage {
  async put(key: string, body: Buffer) {
    const file = path.join(UPLOAD_DIR, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return `/uploads/${key}`;
  }
  async remove(key: string) {
    await unlink(path.join(UPLOAD_DIR, key)).catch(() => undefined);
  }
}

class S3Storage implements Storage {
  private client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: !!env.S3_ENDPOINT, // MinIO
    credentials:
      env.S3_ACCESS_KEY && env.S3_SECRET_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY }
        : undefined,
  });
  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    const base = env.S3_PUBLIC_URL ?? `${env.S3_ENDPOINT}/${env.S3_BUCKET}`;
    return `${base.replace(/\/$/, '')}/${key}`;
  }
  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  }
}

export const storage: Storage = env.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage();

/**
 * Validates an uploaded image by decoding it (the client-sent MIME type is not trusted),
 * strips metadata and re-encodes to WebP at a bounded size.
 */
export async function storeProductImage(buffer: Buffer) {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw badRequest('Файл не является изображением', 'INVALID_IMAGE');
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format))
    throw badRequest('Допустимы JPEG, PNG, WebP, AVIF', 'INVALID_IMAGE');
  if ((meta.width ?? 0) < 300 || (meta.height ?? 0) < 300)
    throw badRequest('Минимальный размер изображения 300×300', 'IMAGE_TOO_SMALL');

  const webp = await sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const key = `products/${new Date().toISOString().slice(0, 7)}/${randomToken(12)}.webp`;
  const url = await storage.put(key, webp, 'image/webp');
  return { url, storageKey: key };
}
