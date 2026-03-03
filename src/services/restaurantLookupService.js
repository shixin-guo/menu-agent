import fetch from 'node-fetch';

function guessRestaurantName(menuText) {
  const candidates = menuText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 3 && line.length <= 70)
    .slice(0, 12);

  const withRestaurantKeywords = candidates.find((line) => /restaurant|kitchen|bbq|grill|cafe|bistro|ramen|noodle|pizza|sushi/i.test(line));
  return withRestaurantKeywords ?? candidates[0] ?? '';
}

export class RestaurantLookupService {
  constructor({ googleMapsApiKey }) {
    this.googleMapsApiKey = googleMapsApiKey;
  }

  inferRestaurantQuery(menuText) {
    return guessRestaurantName(menuText);
  }

  async findRestaurantByQuery(query) {
    if (!query) {
      return null;
    }
    if (!this.googleMapsApiKey) {
      return { name: query, source: 'inferred-only' };
    }

    const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
    url.searchParams.set('input', query);
    url.searchParams.set('inputtype', 'textquery');
    url.searchParams.set('fields', 'place_id,name,formatted_address,rating');
    url.searchParams.set('key', this.googleMapsApiKey);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google place search failed: ${response.status}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate) {
      return { name: query, source: 'inferred-only' };
    }

    return {
      source: 'google-places',
      placeId: candidate.place_id,
      name: candidate.name,
      address: candidate.formatted_address,
      rating: candidate.rating
    };
  }
}
