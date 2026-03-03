import { config } from './config.js';
import { createMenuBot } from './bot/menuBot.js';
import { OcrService } from './services/ocrService.js';
import { TranslateService } from './services/translateService.js';
import { RestaurantLookupService } from './services/restaurantLookupService.js';
import { ReviewService } from './services/reviewService.js';

const bot = createMenuBot({
  config,
  ocrService: new OcrService({ provider: config.ocrProvider }),
  translateService: new TranslateService({
    provider: config.translateProvider,
    libreTranslateUrl: config.libreTranslateUrl
  }),
  restaurantLookupService: new RestaurantLookupService({
    googleMapsApiKey: config.googleMapsApiKey
  }),
  reviewService: new ReviewService({
    googleMapsApiKey: config.googleMapsApiKey,
    yelpApiKey: config.yelpApiKey
  })
});

bot
  .launch()
  .then(() => {
    console.log('Menu OCR bot is running...');
  })
  .catch((error) => {
    console.error('Failed to launch bot:', error);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
