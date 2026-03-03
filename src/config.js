import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  telegramToken: required('TELEGRAM_BOT_TOKEN'),
  ocrProvider: process.env.OCR_PROVIDER ?? 'tesseract',
  translateProvider: process.env.TRANSLATE_PROVIDER ?? 'libre',
  libreTranslateUrl: process.env.LIBRE_TRANSLATE_URL ?? 'https://libretranslate.com/translate',
  yelpApiKey: process.env.YELP_API_KEY,
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  placeSearchRadiusMeters: Number(process.env.PLACE_SEARCH_RADIUS_METERS ?? '1200')
};
