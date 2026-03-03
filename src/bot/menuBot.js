import { Telegraf } from 'telegraf';
import { formatReviewSummary, truncate } from '../utils/formatters.js';

export function createMenuBot({ config, ocrService, translateService, restaurantLookupService, reviewService }) {
  const bot = new Telegraf(config.telegramToken);

  bot.start((ctx) =>
    ctx.reply(
      '欢迎使用 Menu OCR Bot！请直接上传菜单图片，我会帮你：\n' +
        '1) OCR 识别文字\n2) 翻译成中文\n3) 识别可能的餐馆\n4) 拉取 Google / Yelp 评论'
    )
  );

  bot.on('photo', async (ctx) => {
    await ctx.reply('收到图片，正在识别中，请稍候...');

    try {
      const photo = ctx.message.photo.at(-1);
      const file = await ctx.telegram.getFile(photo.file_id);
      const imageUrl = `https://api.telegram.org/file/bot${config.telegramToken}/${file.file_path}`;

      const ocrText = await ocrService.extractTextFromImageUrl(imageUrl);
      if (!ocrText) {
        await ctx.reply('OCR 没有识别到可用文字，请换一张清晰的菜单图片。');
        return;
      }

      const translatedText = await translateService.toChinese(ocrText);
      const guessedRestaurant = restaurantLookupService.inferRestaurantQuery(ocrText);
      const restaurant = await restaurantLookupService.findRestaurantByQuery(guessedRestaurant);
      const reviews = await reviewService.fetchReviews(restaurant);

      const header = [
        `🏪 餐馆猜测: ${restaurant?.name ?? guessedRestaurant ?? '未知'}`,
        restaurant?.address ? `📍 地址: ${restaurant.address}` : null,
        restaurant?.rating ? `⭐ Google评分: ${restaurant.rating}` : null
      ]
        .filter(Boolean)
        .join('\n');

      await ctx.reply(`${header}\n\n🧾 OCR 文本(截断):\n${truncate(ocrText, 800)}`);
      await ctx.reply(`🇨🇳 中文翻译(截断):\n${truncate(translatedText, 800)}`);
      await ctx.reply(`🗣 评论摘要:\n${formatReviewSummary(reviews)}`);
    } catch (error) {
      await ctx.reply(`处理失败: ${error.message}`);
    }
  });

  bot.on('message', (ctx) =>
    ctx.reply('请发送菜单图片（photo）。如果你发送的是文件，请改为“照片”发送。')
  );

  return bot;
}
