export function truncate(text, maxLength = 700) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

export function formatReviewSummary(reviews) {
  if (!reviews.length) {
    return '暂无评论。';
  }

  return reviews
    .map((review, index) => {
      const rating = review.rating ? `⭐ ${review.rating}` : '⭐ N/A';
      const author = review.author ?? '匿名';
      const snippet = truncate(review.text ?? '无内容', 220);
      return `${index + 1}. ${rating} - ${author}\n${snippet}`;
    })
    .join('\n\n');
}
