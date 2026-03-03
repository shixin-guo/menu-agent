import fetch from 'node-fetch';

export class TranslateService {
  constructor({ provider = 'libre', libreTranslateUrl }) {
    this.provider = provider;
    this.libreTranslateUrl = libreTranslateUrl;
  }

  async toChinese(text) {
    if (!text?.trim()) {
      return '';
    }

    if (this.provider !== 'libre') {
      throw new Error(`Unsupported translate provider: ${this.provider}`);
    }

    const response = await fetch(this.libreTranslateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: text,
        source: 'auto',
        target: 'zh'
      })
    });

    if (!response.ok) {
      throw new Error(`Translation request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.translatedText?.trim() ?? '';
  }
}
