// Registering Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(registration => {
    // Registration was successful
    console.log('Service Worker registration is successful!' + registration.scope);
  }).catch(error => {
    console.log('Service worker registration failed:', error);
  });
};

/**
 * Common database helper functions.
 */

if (typeof idb === 'undefined') {
  self.importScripts('js/idb.js');
}

let fetchedCuisines;
let fetchedNeighborhoods;

class DBHelper {

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337; // Change this to your server port
    return `http://localhost:${port}/restaurants`;
  }

  static get DATABASE_REVIEWS_URL() {
    const port = 1337; // Change this to your server port
    return `http://localhost:${port}/reviews`;
  }

  /**
   * Fetch all restaurants. Add restaurants to database.
   */
  static fetchRestaurants(callback, id) {
    let fetchURL;
    if (!id) {
      fetchURL = DBHelper.DATABASE_URL;
    } else {
      fetchURL = DBHelper.DATABASE_URL + "/" + id;
    }
    fetch(fetchURL, {method: 'GET'}).then(response => {
      response.json().then(restaurants => {
        if (restaurants.length) {
          // Get all neighborhoods from all restaurants
          const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood);
          // Remove duplicates from neighborhoods
          fetchedNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i);

          // Get all cuisines from all restaurants
          const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
          // Remove duplicates from cuisines
          fetchedCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i);
        }
        dbPromise.then((db) => {
          return dbPromise.then(db => {
            const tx = db.transaction('restaurants', 'readwrite');
            const store = tx.objectStore('restaurants');
            for (const restaurant of restaurants) {
              store.put(restaurant);
            }
          });
          // console.log("Restaurants: ", restaurants);
          return restaurants;
        });
        callback(null, restaurants);
      });
    }).catch(error => {
        callback(`Request failed. Returned status of ${error.statusText}`, null);
      dbPromise.then((db) => {
        let restaurantObjectStore = db.transaction('restaurants').objectStore('restaurants')
        return restaurantObjectStore.getAll();
      });  
    });
  }
  
  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        const restaurant = restaurants.find(r => r.id == id);
        if (restaurant) {
          // Got the restaurant
          callback(null, restaurant);
        } else {
          // Restaurant does not exist in the database
          callback('Restaurant does not exist', null);
        }
      }
    });
  }
  

  /**
   * Fetch a restaurant reviews by ID. Add reviews to database.
   */
  static fetchRestaurantReviewsById(id, callback) {
    // Fetch all reviews for the specific restaurant
    const fetchURL = DBHelper.DATABASE_REVIEWS_URL + "/?restaurant_id=" + id;
    fetch(fetchURL, {method: 'GET'}).then(response => {
      response.json().then(reviews => {
        // Cache all reviews for the specific restaurant
        dbPromise.then((db) => {
          return dbPromise.then(db => {
            const tx = db.transaction('reviews', 'readwrite');
            const store = tx.objectStore('reviews');
            for (const review of reviews) {
              store.put(review);
            }
          });
          return reviews;
      });
        callback(null, reviews);
      })
      }).catch(error => {
        callback(`Request failed. Returned status of ${error.statusText}`, null);
       dbPromise.then((db) => {
          let reviewObjectStore = db.transaction('reviews', 'readwrite').objectStore('reviews')
            return (offlineReviews) => {
              console.log('getting offline reviews');
              return Promise.resolve(offlineReviews);
            };
          return reviewObjectStore.getAll();
      });
    });
  }
    
  

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants
        if (cuisine != 'all') {
          // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') {
          // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    if (fetchedNeighborhoods) {
      callback(null, fetchedNeighborhoods);
      return;
    }
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
        // Remove duplicates from neighborhoods
        fetchedNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
        callback(null, fetchedNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    if (fetchedCuisines) {
      callback(null, fetchedCuisines);
      return;
    }
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
        // Remove duplicates from cuisines
        fetchedCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
        callback(null, fetchedCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    return (`/img/${restaurant.photograph}.jpg`);
  }

  /**
     * Restaurant image URL.
     */
  imageUrlForRestaurant(restaurant) {
    if (!restaurant.photograph)
      return (`/img/noimage.png`);

    return (`/img/${restaurant.photograph}.jpg`);
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    // https://leafletjs.com/reference-1.3.0.html#marker  
    const marker = new L.marker([restaurant.latlng.lat, restaurant.latlng.lng],
      {
        title: restaurant.name,
        alt: restaurant.name,
        url: DBHelper.urlForRestaurant(restaurant)
      });
    marker.addTo(newMap);
    return marker;
  }

  static addPendingRequestToQueue(url, method, body) {
    // Open the database ad add the request details to the pending table
    const dbPromise = idb.open('restaurant-reviews');
    dbPromise.then(db => {
      const tx = db.transaction('pending', 'readwrite');
      tx.objectStore('pending').put({
        data: {
          url,
          method,
          body
        }
      })
    }).catch(error => { }).then(DBHelper.nextPending());
  }

  static nextPending() {
    DBHelper.attemptCommitPending(DBHelper.nextPending);
  }

  static attemptCommitPending(callback) {
    // Iterate over the pending items until there is a network failure
    let url;
    let method;
    let body;

    dbPromise.then(db => {
      if (!db.objectStoreNames.length) {
        console.log('Database not available');
        db.close();
        return;
      }

      const tx = db.transaction('pending', 'readwrite');
      tx.objectStore('pending').openCursor().then(cursor => {
        if (!cursor) {
          return;
      }
        const value = cursor.value;
        url = cursor.value.data.url;
        method = cursor.value.data.method;
        body = cursor.value.data.body;

        // If we don't have a parameter then we're on a bad record that should be tossed
        // and then move on
        if ((!url || !method) || (method === 'POST' && !body)) {
          cursor.delete().then(callback());
          return;
      };

        const properties = {
          body: JSON.stringify(body),
          method: method
      }
        console.log('sending post from queue: ', properties);
        fetch(url, properties).then(response => {
          // If we don't get a good response then assume we're offline
          if (!response.ok && !response.redirected) {
            return;
          }
      }).then(() => {
          // Success! Delete the item from the pending queue
          const deltx = db.transaction('pending', 'readwrite');
          deltx.objectStore('pending').openCursor().then(cursor => {
            cursor.delete().then(() => {
              callback();
            })
          })
          console.log('deleted pending item from queue');
      })
      }).catch(error => {
        console.log('Error reading cursor');
        return;
      })
    })
  }

  static updateCachedRestaurantData(id, updateObj) {
    const dbPromise = idb.open('restaurant-reviews');
    // Update in the data for all restaurants first
    dbPromise.then(db => {
      console.log('Getting db transaction');
      const tx = db.transaction('restaurants', 'readwrite');
      const value = tx.objectStore('restaurants').get('-1').then(value => {
        if (!value) {
          console.log('No cached data found');
          return;
      }
        const data = value.data;
        const restaurantArr = data.filter(r => r.id === id);
        const restaurantObj = restaurantArr[0];
        // Update restaurantObj with updateObj details
        if (!restaurantObj) {
          return;
      }
        const keys = Object.keys(updateObj);
        keys.forEach(k => {
          restaurantObj[k] = updateObj[k];
      })

        // Put the data back in IDB storage
        dbPromise.then(db => {
          const tx = db.transaction('restaurants', 'readwrite');
          tx.objectStore('restaurants').put({ id: '-1', data: data });
          return tx.complete;
      })
      })
    })

    // Update the restaurant specific data
    dbPromise.then(db => {
      console.log('Getting db transaction');
      const tx = db.transaction('restaurants', 'readwrite');
      const value = tx.objectStore('restaurants').get(id + '').then(value => {
        if (!value) {
          console.log('No cached data found');
          return;
      }
        const restaurantObj = value.data;
        console.log('Specific restaurant obj: ', restaurantObj);
        // Update restaurantObj with updateObj details
        if (!restaurantObj) {
          return;
      }
        const keys = Object.keys(updateObj);
        keys.forEach(k => {
          restaurantObj[k] = updateObj[k];
      })

        // Put the data back in IDB storage
        dbPromise.then(db => {
          const tx = db.transaction('restaurants', 'readwrite');
          tx.objectStore('restaurants').put({
            id: id + '',
            data: restaurantObj
          });
          return tx.complete;
      });
      });
    });
  }

  static updateFavorite(id, newState, callback) {
    // Push the request into the waiting queue in IDB
    const url = `${DBHelper.DATABASE_URL}/${id}/?is_favorite=${newState}`;
    const method = 'PUT';
    DBHelper.updateCachedRestaurantData(id, { 'is_favorite': newState });
    DBHelper.addPendingRequestToQueue(url, method);
    // Update the favorite data on the selected ID in the cached data
    callback(null, { id, value: newState });
  }

  static updateCachedRestaurantReview(id, bodyObj) {
    console.log('updating cache for new review: ', bodyObj);
    // Push the review into the reviews store
    dbPromise.then(db => {
      const tx = db.transaction('reviews', 'readwrite');
      const store = tx.objectStore('reviews');
      console.log('putting cached review into store');
      store.put({
        id: Date.now(),
        'restaurant_id': id,
        data: bodyObj
      });
      console.log('successfully put cached review into store');
      return tx.complete;
    });
  }

  static saveNewReview(id, bodyObj, callback) {
    // Push the request into the waiting queue in IDB
    const url = `${DBHelper.DATABASE_REVIEWS_URL}`;
    const method = 'POST';
    DBHelper.updateCachedRestaurantReview(id, bodyObj);
    DBHelper.addPendingRequestToQueue(url, method, bodyObj);
    callback(null, null);
  }

  static handleFavoriteClick(id, newState) {
    // Block any more clicks on this until the callback
    const fav = document.getElementById('favorite-icon-' + id);
    fav.onclick = null;

    DBHelper.updateFavorite(id, newState, (error, resultObj) => {
      if (error) {
        console.log('Error updating favorite');
        return;
      }
      // Update the button background for the specified favorite
      const favorite = document.getElementById('favorite-icon-' + resultObj.id);
      favorite.style.background = resultObj.value ? `url('/img/icon-fav-1.svg') no-repeat` : `url('/img/icon-fav-2.svg') no-repeat`;
    });
  }

  static saveReview(id, name, rating, comment, callback) {
    // Block any more clicks on the submit button until the callback
    const btn = document.getElementById('btnSaveReview');
    btn.onclick = null;

    // Create the POST body
    const body = {
      restaurant_id: id,
      name: name,
      rating: rating,
      comments: comment,
      createdAt: Date.now()
    }

    DBHelper.saveNewReview(id, body, (error, result) => {
      if (error) {
        callback(error, null);
        return;
      }
      callback(null, result);
    })
  }
};

window.DBHelper = DBHelper;
