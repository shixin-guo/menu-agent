import fetch from 'node-fetch';

export class ReviewService {
  constructor({ googleMapsApiKey, yelpApiKey }) {
    this.googleMapsApiKey = googleMapsApiKey;
    this.yelpApiKey = yelpApiKey;
  }

  async fetchReviews(restaurant) {
    const reviews = [];

    if (restaurant?.placeId && this.googleMapsApiKey) {
      const googleReviews = await this.fetchGoogleReviews(restaurant.placeId);
      reviews.push(...googleReviews);
    }

    if (restaurant?.name && this.yelpApiKey) {
      const yelpReviews = await this.fetchYelpReviews(restaurant.name);
      reviews.push(...yelpReviews);
    }

    return reviews.slice(0, 6);
  }

  async fetchGoogleReviews(placeId) {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'reviews');
    url.searchParams.set('key', this.googleMapsApiKey);

    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.result?.reviews ?? []).map((item) => ({
      source: 'Google',
      rating: item.rating,
      author: item.author_name,
      text: item.text
    }));
  }

  async fetchYelpReviews(name) {
    const searchUrl = new URL('https://api.yelp.com/v3/businesses/search');
    searchUrl.searchParams.set('term', name);
    searchUrl.searchParams.set('limit', '1');

    const searchResponse = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${this.yelpApiKey}`
      }
    });

    if (!searchResponse.ok) {
      return [];
    }

    const searchData = await searchResponse.json();
    const businessId = searchData.businesses?.[0]?.id;
    if (!businessId) {
      return [];
    }

    const reviewResponse = await fetch(`https://api.yelp.com/v3/businesses/${businessId}/reviews`, {
      headers: {
        Authorization: `Bearer ${this.yelpApiKey}`
      }
    });

    if (!reviewResponse.ok) {
      return [];
    }

    const reviewData = await reviewResponse.json();
    return (reviewData.reviews ?? []).map((item) => ({
      source: 'Yelp',
      rating: item.rating,
      author: item.user?.name,
      text: item.text
    }));
  }
}
