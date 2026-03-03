import { createWorker } from 'tesseract.js';
import fetch from 'node-fetch';

export class OcrService {
  constructor({ provider = 'tesseract' } = {}) {
    this.provider = provider;
  }

  async extractTextFromImageUrl(imageUrl) {
    if (this.provider !== 'tesseract') {
      throw new Error(`Unsupported OCR provider: ${this.provider}`);
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image for OCR: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const worker = await createWorker('eng+chi_sim');

    try {
      const {
        data: { text }
      } = await worker.recognize(buffer);
      return text.trim();
    } finally {
      await worker.terminate();
    }
  }
}
